import type { PoolClient } from "pg";
import { pool } from "../../shared/pool.js";
import { buildClusters } from "./cluster.js";
import {
  REPOINT_SPECS,
  checkHistorySafety,
  findConflicts,
  remapResponseOptions,
  repointOne,
  selectedOptionIdsFor,
} from "./repoint.js";
import { RunLog, csvRow, parseFlags, truncate } from "./runlog.js";
import { loadAnswerHistoryCounts, loadLiveRecords } from "./sources/db.js";
import { computeMetadataMerge } from "./survivor.js";
import type { Cluster } from "./types.js";

/**
 * Phase 2 — live database dedup.
 *
 *   npx tsx db/scripts/dedup/db-dedup.ts                 # dry run: prints the plan, writes nothing
 *   npx tsx db/scripts/dedup/db-dedup.ts --apply         # soft-deletes, one cluster per transaction
 *   npx tsx db/scripts/dedup/db-dedup.ts --purge --older-than 30d --apply
 *
 * ATOMICITY. One cluster = one transaction. FK re-pointing, metadata merge,
 * the soft delete and the audit rows commit together or not at all; there is
 * no state in which a loser is archived but its attempt history still points
 * at it. A cluster that fails rolls back alone and the run continues, exactly
 * as Section 4 Phase 2 requires.
 *
 * ISOLATION. A session-level advisory lock (content.fn_try_dedup_lock) stops
 * two runs overlapping. Cluster rows are taken with SELECT ... FOR UPDATE
 * before anything is written, so a concurrent editor cannot change a stem out
 * from under the plan between the read and the write.
 *
 * DURABILITY. Success is only reported after COMMIT returns.
 */

interface ClusterOutcome {
  clusterId: string;
  status: "applied" | "escalated" | "failed" | "planned";
  survivorUid: string;
  loserUids: string[];
  detail: string;
  repointed: number;
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const log = new RunLog(flags.purge ? "purge" : "db-dedup", flags.runId);
  let lockHeld = false;

  try {
    log.say("run_id: " + flags.runId);
    log.say(flags.dryRun ? "DRY RUN — nothing will be written." : "APPLY — writes are enabled.");

    if (!flags.dryRun) {
      const lock = await pool.query("select content.fn_try_dedup_lock() as ok");
      lockHeld = Boolean(lock.rows[0]?.ok);
      if (!lockHeld) {
        log.say("another dedup run holds the advisory lock; refusing to start.", { level: "error" });
        await log.close("failed", { reason: "advisory lock unavailable" });
        process.exitCode = 1;
        return;
      }
    }

    if (flags.purge) {
      await purge(flags, log);
      return;
    }

    const records = await loadLiveRecords({
      lifecycleStatus: "published",
      subjectCode: flags.subject,
      limit: flags.limit,
    });
    log.say("published rows in scope: " + records.length);

    const { clusters } = buildClusters(records);
    log.say("auto-delete clusters found: " + clusters.length);

    if (clusters.length === 0) {
      log.say("");
      log.say("Nothing to do. No two published rows share a normalised stem, and no pair");
      log.say("clears the Tier-2 threshold with a matching digit signature.");
      log.writeReport("db_dedup_plan.csv", csvRow(["cluster_id", "role", "question_uid", "reason"]) + "\n");
      await log.close("ok", { clusters: 0, deleted: 0 });
      return;
    }

    const outcomes: ClusterOutcome[] = [];
    const batches = chunk(clusters, flags.batchSize);

    for (const group of batches) {
      for (const cluster of group) {
        outcomes.push(await processCluster(cluster, flags.dryRun, flags.runId, log));
      }
    }

    const applied = outcomes.filter((o) => o.status === "applied");
    const escalated = outcomes.filter((o) => o.status === "escalated");
    const failed = outcomes.filter((o) => o.status === "failed");
    const planned = outcomes.filter((o) => o.status === "planned");

    log.writeReport("db_dedup_plan.csv", renderPlanCsv(outcomes));

    log.say("");
    log.say("clusters planned:   " + planned.length);
    log.say("clusters applied:   " + applied.length);
    log.say("clusters escalated: " + escalated.length + "  (see db_dedup_plan.csv — these were NOT deleted)");
    log.say("clusters failed:    " + failed.length);
    log.say("rows soft-deleted:  " + applied.reduce((n, o) => n + o.loserUids.length, 0));

    if (flags.dryRun) {
      log.say("");
      log.say("STOP POINT 2. This was a dry run. Review db/reports/dedup/" + flags.runId + "/db_dedup_plan.csv,");
      log.say("then re-run with --apply --run-id " + flags.runId + " to execute it.");
    }

    await log.close(failed.length > 0 ? "failed" : "ok", {
      applied: applied.length,
      escalated: escalated.length,
      failed: failed.length,
    });
    if (failed.length > 0) process.exitCode = 1;
  } catch (error) {
    log.say("db-dedup failed: " + (error as Error).message, { level: "error" });
    await log.close("failed", { error: (error as Error).message });
    process.exitCode = 1;
  } finally {
    if (lockHeld) await pool.query("select content.fn_release_dedup_lock()");
    await pool.end();
  }
}

async function processCluster(
  cluster: Cluster,
  dryRun: boolean,
  runId: string,
  log: RunLog
): Promise<ClusterOutcome> {
  const survivorUid = cluster.survivor.questionUid ?? cluster.survivor.stableId;
  const loserUids = cluster.losers.map((l) => l.questionUid ?? l.stableId);
  const base = { clusterId: cluster.clusterId, survivorUid, loserUids, repointed: 0 };

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set transaction isolation level read committed");

    // Take the cluster's rows under lock before reading anything that decides
    // the plan. Without this, a stem edited between the audit's read and this
    // write would be archived on the strength of a stem it no longer has.
    const ids = [cluster.survivor.questionId, ...cluster.losers.map((l) => l.questionId)].filter(
      (id): id is string => Boolean(id)
    );
    const locked = await client.query(
      `select question_id, lifecycle_status, encode(match_hash, 'hex') as match_hash
         from content.question
        where question_id = any($1::uuid[])
        for update`,
      [ids]
    );

    const stillPublished = (locked.rows as { lifecycle_status: string }[]).every(
      (r) => r.lifecycle_status === "published"
    );
    if (!stillPublished) {
      await client.query("rollback");
      return { ...base, status: "escalated", detail: "a cluster member is no longer published — re-run the audit" };
    }

    // --- history-safety gate ---------------------------------------------
    const historyCounts = await loadAnswerHistoryCounts(
      cluster.losers.map((l) => l.questionId!).filter(Boolean),
      client
    );

    for (const loser of cluster.losers) {
      if (!loser.questionId || !cluster.survivor.questionId) continue;

      for (const spec of REPOINT_SPECS) {
        if (spec.onConflict !== "abort") continue;
        const conflicts = await findConflicts(client, spec, loser.questionId, cluster.survivor.questionId);
        if (conflicts > 0) {
          await client.query("rollback");
          return {
            ...base,
            status: "escalated",
            detail:
              "gate 3: " + conflicts + " row(s) in " + spec.table + " already reference the survivor for the " +
              "same key — one paper or attempt served both members of this cluster, which " +
              "re-pointing cannot represent",
          };
        }
      }

      if ((historyCounts.get(loser.questionId) ?? 0) > 0) {
        const selected = await selectedOptionIdsFor(client, loser.questionId);
        const gate = checkHistorySafety(cluster.survivor, loser, selected);
        if (!gate.ok) {
          await client.query("rollback");
          return { ...base, status: "escalated", detail: "gates 1-2: " + gate.reason };
        }
        if (!dryRun) {
          // MUST run before question_id is re-pointed — it filters on the
          // loser's question_id to find the rows it rewrites.
          await remapResponseOptions(client, loser.questionId, gate.optionMapping);
        }
      }
    }

    if (dryRun) {
      await client.query("rollback");
      return { ...base, status: "planned", detail: cluster.survivorReason };
    }

    // --- re-point ---------------------------------------------------------
    let repointed = 0;
    for (const loser of cluster.losers) {
      if (!loser.questionId || !cluster.survivor.questionId) continue;
      for (const spec of REPOINT_SPECS) {
        const outcome = await repointOne(client, spec, loser.questionId, cluster.survivor.questionId, runId);
        repointed += outcome.moved;
      }
    }

    // --- merge metadata upward -------------------------------------------
    const merge = computeMetadataMerge(cluster.survivor, cluster.losers);
    if (merge.difficultyBand || merge.explanation || merge.questionType) {
      await client.query(
        `update content.question
            set difficulty_band = coalesce(difficulty_band, $2),
                solution_text   = coalesce(solution_text,   $3),
                question_type   = coalesce(question_type,   $4)
          where question_id = $1`,
        [
          cluster.survivor.questionId,
          merge.difficultyBand ?? null,
          merge.explanation ?? null,
          merge.questionType ?? null,
        ]
      );
    }

    // --- audit rows, then soft delete ------------------------------------
    for (const loser of cluster.losers) {
      // Written into content.question_identity_audit — the table migration 037
      // already built for exactly this, and which migration 044 extended with
      // tier / similarity_score / payload_json / actor rather than standing a
      // second audit table up beside it. 'cluster_retire' was already in its
      // action CHECK, and new_canonical is the survivor.
      await client.query(
        `insert into content.question_identity_audit
           (run_id, question_id, action, old_lifecycle, new_lifecycle,
            old_canonical, new_canonical, old_dedup_key, new_dedup_key,
            note, tier, similarity_score, actor, payload_json)
         select $1, $2, 'cluster_retire', q.lifecycle_status, 'duplicate_archived',
                q.canonical_question_id, $3, q.dedup_key, q.dedup_key,
                $6, $4, $5, current_user, jsonb_build_object(
                  'question', to_jsonb(q),
                  'options',  coalesce((select jsonb_agg(to_jsonb(o) order by o.display_order)
                                          from content.question_option o
                                         where o.question_id = q.question_id), '[]'::jsonb),
                  'solution', coalesce((select jsonb_agg(to_jsonb(s))
                                          from content.question_solution s
                                         where s.question_id = q.question_id), '[]'::jsonb),
                  'translations', coalesce((select jsonb_agg(to_jsonb(t))
                                          from content.question_translation t
                                         where t.question_id = q.question_id), '[]'::jsonb))
           from content.question q
          where q.question_id = $2`,
        [
          runId,
          loser.questionId,
          cluster.survivor.questionId,
          cluster.tier,
          cluster.minSimilarity.toFixed(5),
          cluster.survivorReason,
        ]
      );

      await client.query(
        `update content.question
            set lifecycle_status       = 'duplicate_archived',
                canonical_question_id  = $2,
                deleted_at             = now(),
                dedup_cluster_id       = $3
          where question_id = $1`,
        [loser.questionId, cluster.survivor.questionId, cluster.clusterId]
      );
    }

    await client.query("commit");
    log.event("cluster_applied", {
      clusterId: cluster.clusterId,
      survivor: survivorUid,
      losers: loserUids,
      repointed,
    });
    return { ...base, status: "applied", detail: cluster.survivorReason, repointed };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    log.event("cluster_failed", { clusterId: cluster.clusterId, error: (error as Error).message });
    return { ...base, status: "failed", detail: (error as Error).message };
  } finally {
    client.release();
  }
}

/**
 * Hard delete, deliberately a separate explicitly-invoked command with its own
 * age window, per Section 4: "Hard delete only after an approval window
 * (--purge --older-than 30d) as a separate, explicitly invoked command."
 *
 * It refuses to run without --older-than. A purge with no window is a purge
 * that deletes rows soft-deleted seconds ago, which defeats the point of
 * having an approval window at all.
 */
async function purge(flags: ReturnType<typeof parseFlags>, log: RunLog): Promise<void> {
  if (flags.olderThanDays == null) {
    log.say("--purge requires --older-than <days> (e.g. --older-than 30d). Refusing.", { level: "error" });
    await log.close("failed", { reason: "no age window" });
    process.exitCode = 1;
    return;
  }

  const candidates = await pool.query(
    `select q.question_id, q.question_uid, q.deleted_at
       from content.question q
      where q.lifecycle_status = 'duplicate_archived'
        and q.deleted_at is not null
        and q.deleted_at < now() - ($1::int * interval '1 day')
        and exists (select 1 from content.question_identity_audit a where a.question_id = q.question_id)
      order by q.deleted_at`,
    [flags.olderThanDays]
  );

  log.say("rows eligible for hard delete: " + candidates.rowCount);
  log.say(
    "  (soft-deleted more than " + flags.olderThanDays + " days ago AND carrying a full payload_json " +
    "snapshot in question_identity_audit — a row with no snapshot is never purged, because the " +
    "snapshot is the only thing that survives the delete)"
  );

  if (flags.dryRun) {
    log.say("DRY RUN — nothing deleted. Re-run with --apply to purge.");
    await log.close("ok", { eligible: candidates.rowCount });
    return;
  }

  // ONE transaction for the whole purge, and the guard trigger is disabled
  // inside it. Both halves of that are forced by the schema, not chosen:
  //
  //   content.trg_question_node_map_guard raises if you delete the
  //   question_node_map row matching a question's primary_node_id while that
  //   question still exists. fk_question_node_map_question_id is NOT
  //   deferrable, so you cannot delete the question first either. And
  //   trg_question_primary_node_sync gives every question such a row on
  //   insert. A published question therefore cannot be hard-deleted by any
  //   ordering of plain DELETEs — the earlier per-row implementation of this
  //   function could never have succeeded, and the verify script for
  //   migration 044 is what exposed it.
  //
  // Disabling exactly one trigger (not `session_replication_role = replica`,
  // which would also switch off foreign-key enforcement and let a referenced
  // question be deleted) is the narrow fix. The invariant that trigger
  // protects — "a question's primary node always has a map row" — is vacuous
  // for a question being removed entirely.
  //
  // DDL is transactional in Postgres, so the ALTER rolls back with everything
  // else: there is no failure path that leaves the trigger disabled. The cost
  // is that one bad row aborts the whole purge, which for an explicitly
  // invoked, age-gated admin command is the right trade.
  const client = await pool.connect();
  let deleted = 0;
  try {
    await client.query("begin");
    await client.query("alter table content.question_node_map disable trigger trg_question_node_map_guard");

    for (const row of candidates.rows as { question_id: string; question_uid: string }[]) {
      // Owned children first; the audit snapshot already holds them all.
      await client.query("delete from content.question_option where question_id = $1", [row.question_id]);
      await client.query("delete from content.question_solution where question_id = $1", [row.question_id]);
      await client.query("delete from content.question_translation where question_id = $1", [row.question_id]);
      await client.query("delete from content.question_node_map where question_id = $1", [row.question_id]);
      await client.query("delete from content.question where question_id = $1", [row.question_id]);
      deleted++;
    }

    await client.query("alter table content.question_node_map enable trigger trg_question_node_map_guard");
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    log.say("purge failed and was rolled back in full: " + (error as Error).message, { level: "error" });
    log.say("no row was hard-deleted, and the node-map guard trigger is back on (the ALTER rolled back with it).");
    await log.close("failed", { error: (error as Error).message });
    process.exitCode = 1;
    return;
  } finally {
    client.release();
  }

  log.say("hard-deleted: " + deleted);
  await log.close("ok", { deleted });
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function renderPlanCsv(outcomes: ClusterOutcome[]): string {
  const rows = [csvRow(["cluster_id", "status", "survivor_uid", "losers", "repointed_rows", "detail"])];
  for (const outcome of outcomes) {
    rows.push(
      csvRow([
        outcome.clusterId,
        outcome.status,
        outcome.survivorUid,
        outcome.loserUids.join(" "),
        outcome.repointed,
        truncate(outcome.detail, 400),
      ])
    );
  }
  return rows.join("\n") + "\n";
}

main();
