/**
 * backfill-question-identity — Layer 1 of question-dedup-audit-and-fix.md.
 *
 * Two phases, both idempotent, batched, resumable and fully reversible:
 *
 *   A. IDENTITY BACKFILL — compute stem_norm / answer_key / dedup_key and
 *      recompute has_math / has_table from actual content (directive Bug 4:
 *      the stored flags contradict themselves on legacy rows, so they are
 *      never read back). Resumable: only rows whose dedup_key is NULL are
 *      touched, so an interrupted run picks up exactly where it stopped.
 *
 *   B. CLUSTERING — group published rows on the EXACT dedup_key, elect one
 *      canonical per group, and retire the rest by setting
 *      canonical_question_id + lifecycle_status='duplicate_archived'.
 *      Nothing is ever deleted.
 *
 * On auto-merging, which this script deliberately does NOT do beyond exact
 * identity: the audit (docs/QUESTION_DEDUP_AUDIT.md, Finding 3) found live
 * pairs that share an answer_key and are genuinely different questions —
 * oxidation number +6 in H2SO4 vs in K2Cr2O7, 2 A from Ohm's law vs from a
 * series network. Merging those would be a content-destroying bug. Exact
 * dedup_key equality is the only thing merged here; everything weaker is
 * routed to content.question_duplicate_candidate for a human
 * (db/scripts/detect-duplicate-candidates.ts).
 *
 * Node-map preservation: when a duplicate is retired, its
 * content.question_node_map rows are merged onto the canonical first. The
 * audit found one family spanning 7 different units, so retiring without
 * this would silently strip a question out of 6 units' candidate pools —
 * turning a dedup fix into a pool-coverage regression. Merging keeps every
 * unit able to draw the surviving question.
 *
 *   npx tsx db/scripts/backfill-question-identity.ts --dry-run
 *   npx tsx db/scripts/backfill-question-identity.ts --execute
 *   npx tsx db/scripts/backfill-question-identity.ts --restore <run_id>
 */
import crypto from "node:crypto";
import { pool } from "../shared/pool.js";

const BATCH = 200;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const execute = args.includes("--execute");
const restoreIdx = args.indexOf("--restore");
const restoreRunId = restoreIdx >= 0 ? args[restoreIdx + 1] : null;

if (!dryRun && !execute && !restoreRunId) {
  console.error(
    "usage: backfill-question-identity.ts (--dry-run | --execute | --restore <run_id>)"
  );
  process.exit(1);
}

interface ClusterMember {
  question_id: string;
  question_uid: string;
  revision_no: number;
  difficulty_band: string | null;
  usage_count: number;
  is_legacy: boolean;
  node_ids: string[];
}

/**
 * Canonical election, in the directive's stated preference order:
 * highest revision_no, then a non-null difficulty_band, then non-legacy
 * provenance, then highest usage_count. question_uid breaks the final tie so
 * the choice is deterministic across runs — without it, a re-run could elect
 * a different canonical and churn the bank.
 */
function electCanonical(members: ClusterMember[]): ClusterMember {
  return [...members].sort((a, b) => {
    if (a.revision_no !== b.revision_no) return b.revision_no - a.revision_no;
    const aBand = a.difficulty_band !== null ? 1 : 0;
    const bBand = b.difficulty_band !== null ? 1 : 0;
    if (aBand !== bBand) return bBand - aBand;
    const aLeg = a.is_legacy ? 1 : 0;
    const bLeg = b.is_legacy ? 1 : 0;
    if (aLeg !== bLeg) return aLeg - bLeg;
    if (a.usage_count !== b.usage_count) return b.usage_count - a.usage_count;
    return a.question_uid.localeCompare(b.question_uid);
  })[0];
}

async function phaseA(runId: string, write: boolean): Promise<number> {
  console.log("\n=== Phase A — identity backfill ===");
  let total = 0;

  if (!write) {
    // Nothing is written in dry-run, so the "outstanding" set never shrinks
    // and a batch loop would never terminate. Report the outstanding count
    // once instead.
    const remaining = await pool.query<{ c: string }>(
      `select count(*)::text as c from content.question where dedup_key is null`
    );
    total = Number(remaining.rows[0].c);
    console.log(`Phase A would compute identity for ${total} row(s).`);
    return total;
  }

  for (;;) {
    // Resumable by construction: dedup_key IS NULL is the "not yet done"
    // marker, so this loop is safe to interrupt and restart at any point.
    const ids = await pool.query<{ question_id: string }>(
      `select question_id from content.question
        where dedup_key is null
        order by question_id
        limit $1`,
      [BATCH]
    );
    if (ids.rows.length === 0) break;

    // The lateral lives inside a CTE rather than in the UPDATE's own FROM:
    // Postgres forbids a lateral in UPDATE ... FROM from referencing the
    // update target (42P10), but inside the CTE `q` is an ordinary FROM entry.
    const res = await pool.query(
      `with ident as (
         select q.question_id,
                i.stem_norm, i.answer_key, i.dedup_key,
                coalesce(content.fn_question_detect_math(q.question_id), false)  as has_math,
                coalesce(content.fn_question_detect_table(q.question_id), false) as has_table
           from content.question q
           cross join lateral content.fn_question_identity(q.question_id) i
          where q.question_id = any($1::uuid[])
       )
       update content.question q
          set stem_norm  = ident.stem_norm,
              answer_key = ident.answer_key,
              dedup_key  = ident.dedup_key,
              has_math   = ident.has_math,
              has_table  = ident.has_table
         from ident
        where ident.question_id = q.question_id`,
      [ids.rows.map((r) => r.question_id)]
    );
    total += res.rowCount ?? 0;
    console.log(`  computed identity for ${total} rows...`);
  }

  if (total > 0) {
    await pool.query(
      `insert into content.question_identity_audit (question_id, run_id, action, note)
       select question_id, $1, 'backfill', 'identity columns computed'
         from content.question where dedup_key is not null`,
      [runId]
    );
  }
  console.log(`Phase A wrote ${total} row(s).`);
  return total;
}

async function phaseB(runId: string, write: boolean): Promise<void> {
  console.log("\n=== Phase B — clustering on exact dedup_key ===");

  // Only published rows compete for canonical status. duplicate_archived and
  // retired rows are already out of the pool and must not be resurrected
  // into a cluster.
  // The key is computed live from content.fn_question_identity rather than
  // read out of the dedup_key column, so a --dry-run reports the true blast
  // radius BEFORE Phase A has written anything. In --execute mode the two are
  // identical by construction (Phase A has just written exactly this value),
  // so there is no divergence risk from sourcing it this way.
  const groups = await pool.query<{ dedup_key: string; members: ClusterMember[] }>(
    `with keyed as (
       select q.question_id, q.question_uid, q.revision_no, q.difficulty_band,
              q.usage_count, i.dedup_key
         from content.question q
         cross join lateral (select * from content.fn_question_identity(q.question_id)) i
        where q.lifecycle_status = 'published'
          and q.canonical_question_id is null
          and i.dedup_key is not null
     )
     select encode(k.dedup_key,'hex') as dedup_key,
            json_agg(json_build_object(
              'question_id', k.question_id,
              'question_uid', k.question_uid,
              'revision_no', k.revision_no,
              'difficulty_band', k.difficulty_band,
              'usage_count', k.usage_count,
              'is_legacy', k.question_uid like 'LEGACY-%',
              'node_ids', coalesce((select json_agg(m.node_id) from content.question_node_map m where m.question_id = k.question_id), '[]'::json)
            ) order by k.question_uid) as members
       from keyed k
      group by k.dedup_key
     having count(*) > 1`
  );

  console.log(`  ${groups.rows.length} collision group(s) found.`);
  let retired = 0;
  let nodeMerges = 0;

  for (const g of groups.rows) {
    const canonical = electCanonical(g.members);
    const dupes = g.members.filter((m) => m.question_id !== canonical.question_id);
    const canonicalNodes = new Set(canonical.node_ids);
    const missingNodes = new Set<string>();
    for (const d of dupes) {
      for (const n of d.node_ids) if (!canonicalNodes.has(n)) missingNodes.add(n);
    }

    console.log(
      `  [${g.dedup_key.slice(0, 8)}] keep ${canonical.question_uid}, retire ${dupes
        .map((d) => d.question_uid)
        .join(", ")}${missingNodes.size ? ` (+${missingNodes.size} node tag(s) merged)` : ""}`
    );
    retired += dupes.length;
    nodeMerges += missingNodes.size;

    if (!write) continue;

    const client = await pool.connect();
    try {
      await client.query("begin");

      // Node tags first: the canonical must be able to serve every unit the
      // retired rows served before any of them leave the pool.
      for (const nodeId of missingNodes) {
        await client.query(
          `insert into content.question_node_map (question_id, node_id, relevance_rank)
           values ($1, $2, 2)
           on conflict (question_id, node_id) do nothing`,
          [canonical.question_id, nodeId]
        );
      }

      for (const d of dupes) {
        await client.query(
          `insert into content.question_identity_audit
             (question_id, run_id, action, old_lifecycle, new_lifecycle, old_canonical, new_canonical, note)
           select question_id, $1, 'cluster_retire', lifecycle_status, 'duplicate_archived',
                  canonical_question_id, $2, $3
             from content.question where question_id = $4`,
          [runId, canonical.question_id, `merged into ${canonical.question_uid}`, d.question_id]
        );
        await client.query(
          `update content.question
              set lifecycle_status = 'duplicate_archived',
                  canonical_question_id = $1
            where question_id = $2`,
          [canonical.question_id, d.question_id]
        );
      }
      await client.query("commit");
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
  }

  console.log(
    `Phase B ${write ? "retired" : "would retire"} ${retired} row(s) across ${groups.rows.length} group(s); ${nodeMerges} node tag(s) ${write ? "merged" : "would be merged"} onto canonicals.`
  );
}

async function restore(runId: string): Promise<void> {
  console.log(`\n=== Restore — reversing run ${runId} ===`);
  const rows = await pool.query<{
    question_id: string;
    old_lifecycle: string;
    old_canonical: string | null;
  }>(
    `select question_id, old_lifecycle, old_canonical
       from content.question_identity_audit
      where run_id = $1 and action = 'cluster_retire'
      order by audit_id desc`,
    [runId]
  );
  if (rows.rows.length === 0) {
    console.log("  nothing to restore for that run_id.");
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const r of rows.rows) {
      await client.query(
        `update content.question
            set lifecycle_status = $1, canonical_question_id = $2
          where question_id = $3`,
        [r.old_lifecycle, r.old_canonical, r.question_id]
      );
      await client.query(
        `insert into content.question_identity_audit
           (question_id, run_id, action, new_lifecycle, new_canonical, note)
         values ($1, $2, 'cluster_restore', $3, $4, 'reversed by --restore')`,
        [r.question_id, runId, r.old_lifecycle, r.old_canonical]
      );
    }
    await client.query("commit");
    console.log(`  restored ${rows.rows.length} row(s) to their pre-run state.`);
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  if (restoreRunId) {
    await restore(restoreRunId);
    return;
  }
  const runId = crypto.randomUUID();
  console.log(`run_id = ${runId}  (mode: ${execute ? "EXECUTE" : "DRY RUN"})`);
  await phaseA(runId, execute);
  await phaseB(runId, execute);
  if (execute) {
    console.log(`\nDone. To reverse this run:\n  npx tsx db/scripts/backfill-question-identity.ts --restore ${runId}`);
  } else {
    console.log("\nDry run only — nothing was written.");
  }
}

main()
  .catch((err) => {
    console.error("backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
