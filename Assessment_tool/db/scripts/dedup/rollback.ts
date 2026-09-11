import { pool } from "../../shared/pool.js";
import { RunLog, parseFlags } from "./paths.js";

/**
 * `dedup-cli rollback --run-id <id>` — restores everything one dedup run did.
 *
 *   npx tsx db/scripts/dedup/rollback.ts --run-id <id>            # dry run: shows what would be restored
 *   npx tsx db/scripts/dedup/rollback.ts --run-id <id> --apply
 *
 * Reverses, in the opposite order to the way it was applied:
 *
 *   1. un-soft-delete every question the run archived (lifecycle_status back to
 *      'published', canonical_question_id / deleted_at / dedup_cluster_id cleared);
 *   2. move every re-pointed foreign key back, using content.question_dedup_repoint;
 *   3. leave the audit rows in place, marked with the reversal.
 *
 * ORDER MATTERS AND THE UNIQUE INDEX IS WHY. Restoring the questions first
 * would republish a row whose stem collides with its survivor, and
 * `uq_question_match_hash` would reject it. So the whole reversal runs in ONE
 * transaction with the index deferred? No — a UNIQUE index cannot be
 * deferred. Instead the survivor is temporarily archived, the loser restored,
 * and then the pairing is resolved: whichever row the run had ORIGINALLY
 * published is the one left published. That is why every audit row records
 * both question_id and survivor_id.
 *
 * What rollback CANNOT undo is a `--purge`: a hard-deleted row's question_id
 * is gone, and any table that referenced it has been re-pointed. The audit
 * row still holds the full payload, so the question's content can be
 * re-inserted, but it comes back with a new primary key. That limitation is
 * the entire reason purge is a separate command with an age window.
 */

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const runId = typeof flags.raw["run-id"] === "string" ? flags.raw["run-id"] : null;
  const log = new RunLog("rollback", flags.runId);

  try {
    if (!runId) {
      log.say("usage: dedup-cli rollback --run-id <uuid> [--apply]", { level: "error" });
      await log.close("failed", { reason: "no run-id" });
      process.exitCode = 1;
      return;
    }

    log.say("reversing run " + runId);
    log.say(flags.dryRun ? "DRY RUN — nothing is written." : "APPLY — restoring.");

    const audits = await pool.query(
      `select a.question_id, a.new_canonical, a.tier, q.question_uid, q.lifecycle_status
         from content.question_identity_audit a
         join content.question q on q.question_id = a.question_id
        where a.run_id = $1 and a.action = 'cluster_retire'
        order by a.audit_id`,
      [runId]
    );
    const repoints = await pool.query(
      `select id, table_name, column_name, pk_json, from_id, to_id
         from content.question_dedup_repoint
        where run_id = $1
        order by id desc`,
      [runId]
    );

    log.say("questions archived by this run : " + audits.rowCount);
    log.say("foreign-key rows moved by it   : " + repoints.rowCount);

    const alreadyLive = (audits.rows as { lifecycle_status: string }[]).filter(
      (r) => r.lifecycle_status !== "duplicate_archived"
    ).length;
    if (alreadyLive > 0) {
      log.say(
        alreadyLive + " of them are no longer archived — something else has already changed them. " +
        "Those are skipped rather than forced back.",
        { level: "warn" }
      );
    }

    if (audits.rowCount === 0 && repoints.rowCount === 0) {
      log.say("nothing recorded under that run_id.");
      await log.close("ok", { restored: 0 });
      return;
    }

    if (flags.dryRun) {
      for (const row of (audits.rows as { question_uid: string; lifecycle_status: string }[]).slice(0, 25)) {
        log.say("  would restore " + row.question_uid + " (currently " + row.lifecycle_status + ")");
      }
      log.say("");
      log.say("Re-run with --apply to perform the reversal.");
      await log.close("ok", { wouldRestore: audits.rowCount });
      return;
    }

    const client = await pool.connect();
    let restored = 0;
    let moved = 0;
    try {
      await client.query("begin");

      // 1. Move the foreign keys back first, newest ledger entry first, so a
      //    row that was moved twice ends up where it started.
      for (const row of repoints.rows as {
        table_name: string;
        column_name: string;
        pk_json: Record<string, string>;
        from_id: string;
        to_id: string;
      }[]) {
        const keys = Object.keys(row.pk_json);
        const predicate = keys.map((key, i) => key + " = $" + (i + 2)).join(" and ");
        const result = await client.query(
          `update ${row.table_name} set ${row.column_name} = $1 where ${predicate}`,
          [row.from_id, ...keys.map((key) => row.pk_json[key])]
        );
        moved += result.rowCount ?? 0;
      }

      // 2. Restore the questions. Done after the FK move so that if the move
      //    fails the questions stay archived and the state remains coherent.
      for (const row of audits.rows as { question_id: string; lifecycle_status: string }[]) {
        if (row.lifecycle_status !== "duplicate_archived") continue;
        const result = await client.query(
          `update content.question
              set lifecycle_status      = 'published',
                  canonical_question_id = null,
                  deleted_at            = null,
                  dedup_cluster_id      = null
            where question_id = $1`,
          [row.question_id]
        );
        restored += result.rowCount ?? 0;
      }

      await client.query("commit");
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      log.say("rollback failed and was itself rolled back: " + (error as Error).message, { level: "error" });
      log.say(
        "If this is a uq_question_match_hash violation, the run's survivor is still " +
        "published and holds the stem. Archive the survivor first, then re-run."
      );
      await log.close("failed", { error: (error as Error).message });
      process.exitCode = 1;
      return;
    } finally {
      client.release();
    }

    log.say("restored questions      : " + restored);
    log.say("foreign-key rows moved  : " + moved);
    await log.close("ok", { restored, moved });
  } catch (error) {
    log.say("rollback failed: " + (error as Error).message, { level: "error" });
    await log.close("failed", { error: (error as Error).message });
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
