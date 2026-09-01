/**
 * detect-duplicate-candidates — Layer 3 of question-dedup-audit-and-fix.md.
 * The nightly near-duplicate detector.
 *
 * WHAT THIS DOES NOT DO: merge anything. Ever. The audit found live pairs
 * that share an answer_key and are genuinely different questions — oxidation
 * number +6 in H2SO4 vs in K2Cr2O7, 2 A from Ohm's law vs from a series
 * network, a spirometer-diagram question vs the text definition of residual
 * volume. Auto-merging on similarity would destroy those. This job only ever
 * INSERTS pending rows into content.question_duplicate_candidate for a human
 * to confirm or reject.
 *
 * BLOCKING: on answer_key, per the directive's design decision — never on
 * primary_node_id. The audit validated that empirically: one template family
 * spans 7 different units, so a node-scoped comparison would never have put
 * its members side by side.
 *
 * BOUNDING: pairs are compared only within the same question_type, only among
 * published rows, and only when a candidate row does not already exist for the
 * pair. Because content.question_duplicate_candidate has a UNIQUE index on
 * (question_id_a, question_id_b) and this job skips any pair already present
 * regardless of status, a REJECTION IS PERMANENT — a rejected pair can never
 * resurface in front of a reviewer.
 *
 * TIER: pg_trgm similarity over stem_norm. The embedding tier described in the
 * directive is not available — no embedding provider is configured in this
 * environment and content.question.stem_vec is deliberately unpopulated (see
 * docs/QUESTION_DEDUP_AUDIT.md, deviation 2). When one is configured, add an
 * 'embedding' detection_method here; the table and the review flow already
 * accommodate it.
 *
 * THRESHOLD: 0.45, tuned against a hand-labelled sample of 209 pairs rather
 * than guessed. Precision 1.000, recall 1.000 across the whole 0.35-0.50
 * plateau; 0.45 is its midpoint, maximally far from the nearest false
 * positive (0.328) and the nearest false negative (0.523). Full working in
 * docs/QUESTION_DEDUP_THRESHOLDS.md.
 *
 *   npx tsx db/scripts/detect-duplicate-candidates.ts [--threshold 0.45] [--dry-run]
 */
import { pool } from "../shared/pool.js";

const DEFAULT_THRESHOLD = 0.45;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const thIdx = args.indexOf("--threshold");
const threshold = thIdx >= 0 ? Number(args[thIdx + 1]) : DEFAULT_THRESHOLD;

if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
  console.error(`invalid --threshold ${args[thIdx + 1]} (expected 0 < t <= 1)`);
  process.exit(1);
}

/**
 * Blocked on answer_key, bounded to one question_type, exact-identity pairs
 * excluded (those are the unique index's job, not a reviewer's), and any pair
 * already carrying a candidate row excluded so rejections stay permanent.
 */
const DETECT_SQL = `
  with pairs as (
    select a.question_id as id_a,
           b.question_id as id_b,
           similarity(a.stem_norm, b.stem_norm) as sim
      from content.question a
      join content.question b
        on a.answer_key = b.answer_key
       and a.question_id < b.question_id
       and coalesce(a.question_type, '') = coalesce(b.question_type, '')
     where a.lifecycle_status = 'published'
       and b.lifecycle_status = 'published'
       and a.canonical_question_id is null
       and b.canonical_question_id is null
       and a.answer_key is not null
       and a.stem_norm is not null
       and b.stem_norm is not null
       -- exact identity is the unique index's business, not a reviewer's
       and a.dedup_key is distinct from b.dedup_key
  )
  select id_a, id_b, round(sim::numeric, 5) as sim
    from pairs p
   where p.sim >= $1
     and not exists (
       select 1 from content.question_duplicate_candidate c
        where c.question_id_a = p.id_a and c.question_id_b = p.id_b
     )
   order by p.sim desc
`;

async function main(): Promise<void> {
  console.log(`detect-duplicate-candidates — threshold ${threshold}${dryRun ? " (DRY RUN)" : ""}`);

  const backfilled = await pool.query<{ c: string }>(
    `select count(*)::text as c from content.question
      where lifecycle_status = 'published' and stem_norm is null`
  );
  if (Number(backfilled.rows[0].c) > 0) {
    console.warn(
      `  WARNING: ${backfilled.rows[0].c} published row(s) have no stem_norm yet — run backfill-question-identity.ts --execute first, or those rows are invisible to this job.`
    );
  }

  const found = await pool.query<{ id_a: string; id_b: string; sim: string }>(DETECT_SQL, [threshold]);
  console.log(`  ${found.rows.length} new candidate pair(s) above threshold.`);

  if (found.rows.length === 0 || dryRun) {
    if (dryRun) {
      for (const r of found.rows.slice(0, 25)) {
        console.log(`    ${r.sim}  ${r.id_a}  ${r.id_b}`);
      }
      console.log("  Dry run — nothing inserted.");
    }
    return;
  }

  const res = await pool.query(
    `insert into content.question_duplicate_candidate
       (question_id_a, question_id_b, similarity_score, detection_method, status)
     select a, b, s, 'trigram', 'pending'
       from unnest($1::uuid[], $2::uuid[], $3::numeric[]) as t(a, b, s)
     on conflict (question_id_a, question_id_b) do nothing`,
    [
      found.rows.map((r) => r.id_a),
      found.rows.map((r) => r.id_b),
      found.rows.map((r) => r.sim),
    ]
  );
  console.log(`  queued ${res.rowCount ?? 0} pending candidate(s) for review.`);

  const pending = await pool.query<{ c: string }>(
    `select count(*)::text as c from content.question_duplicate_candidate where status = 'pending'`
  );
  console.log(`  review queue now holds ${pending.rows[0].c} pending pair(s).`);
}

main()
  .catch((err) => {
    console.error("detection failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
