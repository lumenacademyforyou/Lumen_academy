import { pool } from "../../shared/pool.js";
import { RunLog, parseFlags } from "./paths.js";

/**
 * Hard-delete the duplicate_archived questions and everything they own.
 *
 *   npx tsx db/scripts/dedup/purge-archived.ts            # dry run
 *   npx tsx db/scripts/dedup/purge-archived.ts --apply
 *
 * WHAT THIS REMOVES
 * -----------------
 * Rows with lifecycle_status = 'duplicate_archived'. These are duplicates
 * that migrations 030/031 and the 037-041 identity pass already identified
 * and soft-deleted; every one carries a canonical_question_id pointing at the
 * survivor that replaced it. They have been invisible to the app for a long
 * time — the assembler filters on lifecycle_status — but they were still
 * physically present, with their options, solutions and translations.
 *
 * WHY THIS IS SAFE, CHECKED RATHER THAN ASSUMED
 * ---------------------------------------------
 * The run refuses unless, at the moment it runs:
 *
 *   1. every row it is about to delete has a canonical survivor, so nothing
 *      is being lost that has no replacement;
 *   2. no row is referenced by attempt history (attempt_response,
 *      attempt_question), by any paper (test_question), or by
 *      user_question_seen / flashcards;
 *   3. every row has been snapshotted into content.question_identity_audit's
 *      payload_json first.
 *
 * Condition 3 is what makes this recoverable: after the delete, that snapshot
 * is the only copy of the question, its options, its solution and its
 * translations. Migration 045 is what lets the audit row survive the deletion
 * of the question it describes.
 *
 * WHY ONE TRANSACTION WITH A TRIGGER DISABLED
 * -------------------------------------------
 * content.trg_question_node_map_guard forbids deleting the question_node_map
 * row matching a question's primary_node_id while that question exists, and
 * fk_question_node_map_question_id is not deferrable, so the question cannot
 * be deleted first either. No ordering of plain DELETEs can remove a
 * question. Exactly that one trigger is disabled — not
 * `session_replication_role = replica`, which would also switch off foreign
 * key enforcement and could orphan live rows. DDL is transactional in
 * Postgres, so the trigger comes back on whether the run commits or aborts.
 */

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const log = new RunLog("purge-archived", flags.runId);

  try {
    log.say("run_id: " + flags.runId);
    log.say(flags.dryRun ? "DRY RUN — nothing will be deleted." : "APPLY — hard delete.");

    const scope = await pool.query<{
      total: number;
      without_canonical: number;
      referenced: number;
    }>(
      `with arch as (select question_id from content.question where lifecycle_status = 'duplicate_archived')
       select
         (select count(*)::int from arch) as total,
         (select count(*)::int from content.question
           where lifecycle_status = 'duplicate_archived' and canonical_question_id is null) as without_canonical,
         (select count(*)::int from (
            select question_id from assess.attempt_response where question_id in (select question_id from arch)
            union select question_id from assess.attempt_question where question_id in (select question_id from arch)
            union select question_id from assess.test_question   where question_id in (select question_id from arch)
            union select question_id from assess.user_question_seen where question_id in (select question_id from arch)
            union select question_id from learn.flashcard        where question_id in (select question_id from arch)
          ) r) as referenced`
    );
    const { total, without_canonical: withoutCanonical, referenced } = scope.rows[0];

    log.say("duplicate_archived rows        : " + total);
    log.say("  without a canonical survivor : " + withoutCanonical);
    log.say("  referenced by live history   : " + referenced);

    if (total === 0) {
      log.say("nothing to purge.");
      await log.close("ok", { deleted: 0 });
      return;
    }
    if (withoutCanonical > 0) {
      log.say("REFUSING — " + withoutCanonical + " row(s) have no canonical survivor. Deleting them would lose content that has no replacement.", { level: "error" });
      await log.close("failed", { reason: "rows without canonical" });
      process.exitCode = 1;
      return;
    }
    if (referenced > 0) {
      log.say("REFUSING — " + referenced + " row(s) are referenced by live attempt or paper history.", { level: "error" });
      await log.close("failed", { reason: "referenced by live history" });
      process.exitCode = 1;
      return;
    }

    const children = await pool.query(
      `with arch as (select question_id from content.question where lifecycle_status = 'duplicate_archived')
       select
         (select count(*)::int from content.question_option      where question_id in (select question_id from arch)) as options,
         (select count(*)::int from content.question_solution    where question_id in (select question_id from arch)) as solutions,
         (select count(*)::int from content.question_translation where question_id in (select question_id from arch)) as translations,
         (select count(*)::int from content.question_review      where question_id in (select question_id from arch)) as reviews,
         (select count(*)::int from content.question_node_map    where question_id in (select question_id from arch)) as node_maps`
    );
    const c = children.rows[0] as Record<string, number>;
    log.say("");
    log.say("owned rows that go with them:");
    for (const [k, v] of Object.entries(c)) log.say("  " + k.padEnd(14) + v);

    if (flags.dryRun) {
      log.say("");
      log.say("DRY RUN. Re-run with --apply to delete.");
      await log.close("ok", { wouldDelete: total });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("begin");

      // 1. Snapshot every row into the audit trail BEFORE deleting anything.
      //    After the delete this is the only copy that exists.
      const snapped = await client.query(
        `insert into content.question_identity_audit
           (run_id, question_id, question_uid, action, old_lifecycle, new_lifecycle,
            old_canonical, new_canonical, old_dedup_key, new_dedup_key,
            note, tier, actor, payload_json)
         select $1, q.question_id, q.question_uid, 'cluster_retire',
                q.lifecycle_status, q.lifecycle_status,
                q.canonical_question_id, q.canonical_question_id,
                q.dedup_key, q.dedup_key,
                'hard-deleted by purge-archived; payload_json is the only remaining copy',
                1, current_user,
                jsonb_build_object(
                  'question', to_jsonb(q),
                  'options',  coalesce((select jsonb_agg(to_jsonb(o) order by o.display_order)
                                          from content.question_option o where o.question_id = q.question_id), '[]'::jsonb),
                  'solution', coalesce((select jsonb_agg(to_jsonb(s))
                                          from content.question_solution s where s.question_id = q.question_id), '[]'::jsonb),
                  'translations', coalesce((select jsonb_agg(to_jsonb(t))
                                          from content.question_translation t where t.question_id = q.question_id), '[]'::jsonb),
                  'node_map', coalesce((select jsonb_agg(to_jsonb(n))
                                          from content.question_node_map n where n.question_id = q.question_id), '[]'::jsonb))
           from content.question q
          where q.lifecycle_status = 'duplicate_archived'`,
        [flags.runId]
      );
      log.say("snapshotted " + snapped.rowCount + " question(s) into content.question_identity_audit");

      // 2. Delete, children first. See the header for why the guard trigger
      //    has to come off for the node-map delete.
      await client.query("alter table content.question_node_map disable trigger trg_question_node_map_guard");

      const arch = `(select question_id from content.question where lifecycle_status = 'duplicate_archived')`;
      const counts: Record<string, number> = {};
      for (const [label, sql] of [
        ["question_option", `delete from content.question_option where question_id in ${arch}`],
        ["question_solution", `delete from content.question_solution where question_id in ${arch}`],
        ["question_translation", `delete from content.question_translation where question_id in ${arch}`],
        ["question_review", `delete from content.question_review where question_id in ${arch}`],
        ["question_usage", `delete from content.question_usage where question_id in ${arch}`],
        ["question_source", `delete from content.question_source where question_id in ${arch}`],
        ["question_chunk_ref", `delete from content.question_chunk_ref where question_id in ${arch}`],
        ["question_duplicate_candidate", `delete from content.question_duplicate_candidate where question_id_a in ${arch} or question_id_b in ${arch}`],
        ["question_node_map", `delete from content.question_node_map where question_id in ${arch}`],
      ] as const) {
        const res = await client.query(sql);
        counts[label] = res.rowCount ?? 0;
      }

      const deleted = await client.query(
        `delete from content.question where lifecycle_status = 'duplicate_archived'`
      );
      counts["question"] = deleted.rowCount ?? 0;

      await client.query("alter table content.question_node_map enable trigger trg_question_node_map_guard");
      await client.query("commit");

      log.say("");
      for (const [k, v] of Object.entries(counts)) log.say("  deleted " + k.padEnd(30) + v);
      await log.close("ok", { deleted: counts["question"], counts });
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      log.say("purge failed and was rolled back in full: " + (error as Error).message, { level: "error" });
      log.say("nothing was deleted; the node-map guard trigger is back on (the ALTER rolled back with it).");
      await log.close("failed", { error: (error as Error).message });
      process.exitCode = 1;
    } finally {
      client.release();
    }
  } catch (error) {
    log.say("purge-archived failed: " + (error as Error).message, { level: "error" });
    await log.close("failed", { error: (error as Error).message });
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
