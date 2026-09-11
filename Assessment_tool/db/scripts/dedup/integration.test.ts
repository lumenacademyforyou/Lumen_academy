import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import type { PoolClient } from "pg";
import { pool } from "../../shared/pool.js";
import { matchHash, normalizeForMatch } from "./normalize.js";
import { REPOINT_SPECS, checkHistorySafety, findConflicts, repointOne } from "./repoint.js";
import type { CanonicalRecord } from "./types.js";

/**
 * Database-backed tests for the dedup toolkit.
 *
 * EVERY ONE OF THESE RUNS INSIDE A TRANSACTION THAT IS ALWAYS ROLLED BACK.
 * Nothing here persists — not the migrations it applies, not the synthetic
 * questions it creates, not the re-pointing it performs. That is what makes
 * it safe to run these against the live bank, which is also the only place
 * the real schema, the real constraints and the real normaliser exist.
 *
 * The migrations under test (043, 044) are applied inside the same
 * transaction, so this file also serves as their pre-flight check: if 043
 * cannot be applied to the live schema, this suite says so before anyone runs
 * it for real.
 */

// ORDER MATTERS: 043 redefines fn_question_stem_norm, and 044's match_hash
// is a STORED generated column over it. A stored generated column is NOT
// recomputed when a function it calls is redefined, so applying 044 first
// bakes in the pre-fold hash. Running these in the wrong order is what
// surfaced that, and this ordering is the fix.
const MIGRATIONS = ["043_stem_norm_dash_fold.sql", "044_dedup_toolkit.sql"];

function migrationBody(fileName: string): string {
  const raw = fs.readFileSync(path.join("db", "migrations", fileName), "utf8");
  // The file's own BEGIN/COMMIT are stripped so it joins the caller's
  // transaction instead of committing itself.
  return raw.replace(/^\s*begin\s*;/im, "").replace(/^\s*commit\s*;/im, "");
}

async function withRollback(fn: (client: PoolClient) => Promise<void>): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const migration of MIGRATIONS) await client.query(migrationBody(migration));
    await fn(client);
  } finally {
    await client.query("rollback").catch(() => undefined);
    client.release();
  }
}

/** A syllabus node and generation job that already exist, for FK satisfaction. */
async function fixtures(client: PoolClient): Promise<{ nodeId: string; jobId: string; otherNodeId: string }> {
  const nodes = await client.query(`select node_id from catalog.syllabus_node order by tag_code limit 2`);
  const job = await client.query(`select job_id from content.ai_generation_job limit 1`);
  return {
    nodeId: nodes.rows[0].node_id,
    otherNodeId: nodes.rows[1].node_id,
    jobId: job.rows[0].job_id,
  };
}

async function insertQuestion(
  client: PoolClient,
  fx: { nodeId: string; jobId: string },
  uid: string,
  stem: string,
  lifecycle = "published"
): Promise<string> {
  const res = await client.query(
    `insert into content.question
       (question_uid, primary_node_id, job_id, question_type, difficulty_band, stem_text,
        stem_format, solution_format, lifecycle_status)
     values ($1, $2, $3, 'single_choice', 'easy', $4, 'plain', 'plain', $5)
     returning question_id`,
    [uid, fx.nodeId, fx.jobId, stem, lifecycle]
  );
  return res.rows[0].question_id;
}

// ---------------------------------------------------------------------------

test("migration 044 applies cleanly and adds the soft-delete columns", async () => {
  await withRollback(async (client) => {
    const cols = await client.query(
      `select column_name, is_generated from information_schema.columns
        where table_schema = 'content' and table_name = 'question'
          and column_name in ('is_deleted','merged_into_id','deleted_at','dedup_cluster_id','match_hash')
        order by column_name`
    );
    const byName = new Map(cols.rows.map((r: any) => [r.column_name, r.is_generated]));
    assert.equal(byName.size, 5);
    // is_deleted / merged_into_id / match_hash are GENERATED so they cannot
    // drift from the columns the assembler actually reads.
    assert.equal(byName.get("is_deleted"), "ALWAYS");
    assert.equal(byName.get("merged_into_id"), "ALWAYS");
    assert.equal(byName.get("match_hash"), "ALWAYS");
    assert.equal(byName.get("deleted_at"), "NEVER");
    assert.equal(byName.get("dedup_cluster_id"), "NEVER");
  });
});

test("044 extends the existing structures instead of standing parallel ones beside them", async () => {
  // An earlier draft of 044 created content.question_dedup_audit and
  // content.ingestion_run, and left migration 041's uq_question_dedup in
  // place next to the new index — three duplications of structures this
  // schema already had, two of them holding real history. This test is what
  // stops that coming back.
  await withRollback(async (client) => {
    for (const parallel of ["content.question_dedup_audit", "content.ingestion_run"]) {
      const exists = await client.query("select to_regclass($1) as oid", [parallel]);
      assert.equal(exists.rows[0].oid, null, parallel + " must not exist — it duplicates a table that already does the job");
    }

    // question_identity_audit (migration 037) gained the four columns a dedup
    // run needs, and kept every row it already had.
    const audit = await client.query(
      `select column_name from information_schema.columns
        where table_schema='content' and table_name='question_identity_audit'
          and column_name in ('tier','similarity_score','payload_json','actor')`
    );
    assert.equal(audit.rowCount, 4, "question_identity_audit is missing the columns 044 should have added");

    const rows = await client.query("select count(*)::int as n from content.question_identity_audit");
    assert.ok(rows.rows[0].n >= 1467, "the 1467 pre-existing audit rows must survive the extension");

    // 'cluster_retire' was already in its action CHECK, so a dedup run needs
    // no new vocabulary — that is why reusing this table works at all.
    const check = await client.query(
      `select pg_get_constraintdef(oid) as def from pg_constraint
        where conrelid = 'content.question_identity_audit'::regclass
          and conname = 'question_identity_audit_action_check'`
    );
    assert.match(check.rows[0].def, /cluster_retire/);

    // import_batch (the schema's own ingestion ledger) gained two columns.
    const batch = await client.query(
      `select column_name from information_schema.columns
        where table_schema='content' and table_name='import_batch'
          and column_name in ('duplicate_count','detail')`
    );
    assert.equal(batch.rowCount, 2, "import_batch is missing the columns 044 should have added");

    // And 041's index, strictly subsumed by uq_question_match_hash, is gone.
    const oldIndex = await client.query(
      "select 1 from pg_indexes where schemaname='content' and indexname='uq_question_dedup'"
    );
    assert.equal(oldIndex.rowCount, 0, "uq_question_dedup is subsumed and must be dropped, not kept alongside");
  });
});

test("the live bank has zero violations of the stem-only unique index", async () => {
  await withRollback(async (client) => {
    const res = await client.query(
      `select count(*)::int as n from (
         select match_hash from content.question
          where lifecycle_status = 'published'
          group by match_hash having count(*) > 1) t`
    );
    assert.equal(res.rows[0].n, 0, "migration 044's unique index could not be created on today's data");
  });
});

test("parity: the TypeScript match hash equals the database's for every published row", async () => {
  await withRollback(async (client) => {
    const rows = await client.query(
      `select question_uid, stem_text, encode(match_hash, 'hex') as db_hash
         from content.question where lifecycle_status = 'published'`
    );
    const mismatches = rows.rows.filter((r: any) => matchHash(r.stem_text) !== r.db_hash);
    assert.equal(
      mismatches.length,
      0,
      "TypeScript and SQL normalisers disagree on " + mismatches.length + " row(s), e.g. " +
        mismatches.slice(0, 3).map((r: any) => r.question_uid).join(", ")
    );
    assert.ok(rows.rowCount > 0, "the parity check must actually have compared something");
  });
});

test("parity: stem_norm computed in SQL equals normalizeForMatch in TypeScript", async () => {
  await withRollback(async (client) => {
    const rows = await client.query(
      `select question_uid, stem_text, content.fn_question_stem_norm(stem_text) as db_norm
         from content.question where lifecycle_status = 'published'`
    );
    const mismatches = rows.rows.filter((r: any) => normalizeForMatch(r.stem_text) !== r.db_norm);
    assert.equal(
      mismatches.length,
      0,
      mismatches.slice(0, 3).map((r: any) => r.question_uid + ": " + JSON.stringify(r.db_norm)).join(" | ")
    );
  });
});

test("migration 043 folds en/em dashes in SQL exactly as the TypeScript does", async () => {
  await withRollback(async (client) => {
    const res = await client.query(
      `select content.fn_question_stem_norm($1) as em, content.fn_question_stem_norm($2) as ascii`,
      ["a well–known result", "a well-known result"]
    );
    assert.equal(res.rows[0].em, res.rows[0].ascii);
    assert.equal(res.rows[0].em, normalizeForMatch("a well-known result"));
  });
});

test("the unique index actually rejects a second published row with the same stem", async () => {
  await withRollback(async (client) => {
    const fx = await fixtures(client);
    const stem = "A synthetic stem used only by the dedup integration test, 42 units.";
    await insertQuestion(client, fx, "TEST-DEDUP-A", stem);

    await client.query("savepoint duplicate_attempt");
    await assert.rejects(
      () => insertQuestion(client, fx, "TEST-DEDUP-B", stem),
      /uq_question_match_hash|duplicate key/i,
      "a second published row with the same normalised stem must be rejected by the database"
    );
    await client.query("rollback to savepoint duplicate_attempt");

    // Same stem, different lifecycle_status — allowed, because the index is
    // partial. Without this an archived duplicate could not sit beside its
    // survivor and soft delete would be unrepresentable.
    const archivedId = await insertQuestion(client, fx, "TEST-DEDUP-C", stem, "duplicate_archived");
    assert.ok(archivedId);
  });
});

test("push idempotency: ON CONFLICT makes a re-run insert zero rows and still succeed", async () => {
  await withRollback(async (client) => {
    const fx = await fixtures(client);
    const stem = "An idempotency probe stem for the dedup suite, 7 widgets.";

    const first = await client.query(
      `insert into content.question
         (question_uid, primary_node_id, job_id, question_type, difficulty_band, stem_text,
          stem_format, solution_format, lifecycle_status)
       values ($1, $2, $3, 'single_choice', 'easy', $4, 'plain', 'plain', 'published')
       on conflict (match_hash) where lifecycle_status = 'published' do nothing
       returning question_id`,
      ["TEST-IDEM-1", fx.nodeId, fx.jobId, stem]
    );
    assert.equal(first.rowCount, 1);

    const second = await client.query(
      `insert into content.question
         (question_uid, primary_node_id, job_id, question_type, difficulty_band, stem_text,
          stem_format, solution_format, lifecycle_status)
       values ($1, $2, $3, 'single_choice', 'easy', $4, 'plain', 'plain', 'published')
       on conflict (match_hash) where lifecycle_status = 'published' do nothing
       returning question_id`,
      ["TEST-IDEM-2", fx.nodeId, fx.jobId, stem]
    );
    assert.equal(second.rowCount, 0, "the re-run must be a no-op, not an error and not a second row");
  });
});

test("FK re-pointing moves a loser's node tags onto the survivor and records the move", async () => {
  await withRollback(async (client) => {
    const fx = await fixtures(client);
    const survivor = await insertQuestion(client, fx, "TEST-RP-S", "Survivor stem for re-pointing, 1 unit.");
    const loser = await insertQuestion(client, fx, "TEST-RP-L", "Loser stem for re-pointing, 2 units.");

    await client.query(`insert into content.question_node_map (question_id, node_id) values ($1, $2)`, [
      loser,
      fx.otherNodeId,
    ]);

    const spec = REPOINT_SPECS.find((s) => s.table === "content.question_node_map")!;
    const runId = "00000000-0000-4000-8000-000000000001";
    const outcome = await repointOne(client, spec, loser, survivor, runId);

    assert.equal(outcome.moved, 1);

    const moved = await client.query(
      `select count(*)::int as n from content.question_node_map where question_id = $1 and node_id = $2`,
      [survivor, fx.otherNodeId]
    );
    assert.equal(moved.rows[0].n, 1, "the tag must now hang off the survivor");

    // The loser keeps exactly one map row: the one matching its own
    // primary_node_id, which content.trg_question_node_map_guard forbids
    // deleting while the question exists. Soft delete keeps the question, so
    // that row stays — see the skipWhere note on the spec in repoint.ts.
    const left = await client.query(
      `select node_id from content.question_node_map where question_id = $1`,
      [loser]
    );
    assert.equal(left.rowCount, 1, "only the loser's own primary-node row may remain");
    assert.equal(left.rows[0].node_id, fx.nodeId);

    const ledger = await client.query(
      `select from_id, to_id, table_name from content.question_dedup_repoint where run_id = $1`,
      [runId]
    );
    assert.equal(ledger.rowCount, 1, "every moved row must be recorded so rollback can move it back");
    assert.equal(ledger.rows[0].from_id, loser);
    assert.equal(ledger.rows[0].to_id, survivor);
  });
});

test("a benign collision merges away instead of violating the primary key", async () => {
  await withRollback(async (client) => {
    const fx = await fixtures(client);
    const survivor = await insertQuestion(client, fx, "TEST-MG-S", "Merge survivor stem, 3 units.");
    const loser = await insertQuestion(client, fx, "TEST-MG-L", "Merge loser stem, 4 units.");

    // BOTH carry the same tag. A naive UPDATE would violate
    // pk_question_node_map (question_id, node_id).
    for (const id of [survivor, loser]) {
      await client.query(`insert into content.question_node_map (question_id, node_id) values ($1, $2)`, [
        id,
        fx.otherNodeId,
      ]);
    }

    const spec = REPOINT_SPECS.find((s) => s.table === "content.question_node_map")!;
    const outcome = await repointOne(client, spec, loser, survivor, "00000000-0000-4000-8000-000000000002");

    assert.equal(outcome.mergedAway, 1, "the loser's duplicate tag must be dropped, not moved");
    assert.equal(outcome.moved, 0);

    const total = await client.query(
      `select count(*)::int as n from content.question_node_map where question_id = $1 and node_id = $2`,
      [survivor, fx.otherNodeId]
    );
    assert.equal(total.rows[0].n, 1, "the survivor must end up with exactly one tag, not two");
  });
});

test("an injected failure rolls the whole cluster back, leaving nothing half-applied", async () => {
  await withRollback(async (client) => {
    const fx = await fixtures(client);
    const survivor = await insertQuestion(client, fx, "TEST-TX-S", "Transaction survivor stem, 5 units.");
    const loser = await insertQuestion(client, fx, "TEST-TX-L", "Transaction loser stem, 6 units.");

    const before = await client.query(
      `select lifecycle_status from content.question where question_id = $1`,
      [loser]
    );
    assert.equal(before.rows[0].lifecycle_status, "published");

    await client.query("savepoint cluster");
    try {
      await client.query(
        `update content.question set lifecycle_status = 'duplicate_archived',
            canonical_question_id = $2, deleted_at = now(), dedup_cluster_id = 'c-test'
          where question_id = $1`,
        [loser, survivor]
      );
      // Injected failure, standing in for anything that can go wrong midway:
      // a constraint violation, a lost connection, a bad node reference.
      await client.query("select 1 / 0");
      assert.fail("the injected failure did not fire");
    } catch (error) {
      assert.match((error as Error).message, /division by zero/);
      await client.query("rollback to savepoint cluster");
    }

    const after = await client.query(
      `select lifecycle_status, deleted_at, dedup_cluster_id from content.question where question_id = $1`,
      [loser]
    );
    assert.equal(after.rows[0].lifecycle_status, "published", "the soft delete must not have survived");
    assert.equal(after.rows[0].deleted_at, null);
    assert.equal(after.rows[0].dedup_cluster_id, null);
  });
});

test("a question cannot be hard-deleted without disabling the node-map guard — the purge path depends on this", async () => {
  // Regression guard for a defect this suite found in --purge. Two schema
  // rules deadlock an ordinary delete:
  //
  //   trg_question_node_map_guard   forbids deleting the question_node_map row
  //                                 matching a question's primary_node_id
  //                                 while the question exists;
  //   fk_question_node_map_question_id (NOT deferrable) forbids deleting the
  //                                 question while the map row exists.
  //
  // and trg_question_primary_node_sync gives every question such a row on
  // insert. So neither order works, and the original per-row purge could
  // never have succeeded. If someone later makes the guard conditional or
  // the FK deferrable, this test fails and the disable-trigger workaround in
  // db-dedup.ts's purge() can be simplified away.
  await withRollback(async (client) => {
    const fx = await fixtures(client);
    const id = await insertQuestion(client, fx, "TEST-HARD-DEL", "Hard delete probe stem, 11 units.");

    await client.query("savepoint naive_delete");
    await assert.rejects(
      () => client.query("delete from content.question_node_map where question_id = $1", [id]),
      /cannot delete the row matching question/,
      "the guard trigger must still block removing the primary-node map row"
    );
    await client.query("rollback to savepoint naive_delete");

    await client.query("savepoint reverse_order");
    await assert.rejects(
      () => client.query("delete from content.question where question_id = $1", [id]),
      /violates foreign key constraint/,
      "and the non-deferrable FK must still block deleting the question first"
    );
    await client.query("rollback to savepoint reverse_order");

    // The workaround purge() uses: disable exactly that one trigger. DDL is
    // transactional, so this rolls back with the rest of the test.
    await client.query("alter table content.question_node_map disable trigger trg_question_node_map_guard");
    await client.query("delete from content.question_node_map where question_id = $1", [id]);
    await client.query("delete from content.question where question_id = $1", [id]);
    await client.query("alter table content.question_node_map enable trigger trg_question_node_map_guard");

    const left = await client.query("select 1 from content.question where question_id = $1", [id]);
    assert.equal(left.rowCount, 0, "with the guard disabled the delete must succeed");
  });
});

test("findConflicts sees a collision that re-pointing could not represent", async () => {
  await withRollback(async (client) => {
    const fx = await fixtures(client);
    const survivor = await insertQuestion(client, fx, "TEST-CF-S", "Conflict survivor stem, 8 units.");
    const loser = await insertQuestion(client, fx, "TEST-CF-L", "Conflict loser stem, 9 units.");
    for (const id of [survivor, loser]) {
      await client.query(`insert into content.question_node_map (question_id, node_id) values ($1, $2)`, [
        id,
        fx.otherNodeId,
      ]);
    }
    const spec = REPOINT_SPECS.find((s) => s.table === "content.question_node_map")!;
    const conflicts = await findConflicts(client, spec, loser, survivor);
    assert.equal(conflicts, 1);
  });
});

// ---------------------------------------------------------------------------
// The history-safety gate — pure logic, no database needed
// ---------------------------------------------------------------------------

function withOptions(texts: [string, boolean][], idPrefix: string): CanonicalRecord {
  return {
    origin: "db",
    questionId: idPrefix,
    questionUid: idPrefix,
    stableId: idPrefix,
    stemText: "shared stem",
    stemNorm: "shared stem",
    matchHash: "h",
    digits: "",
    options: texts.map(([text, isCorrect], i) => ({
      label: String.fromCharCode(65 + i),
      text,
      isCorrect,
      optionId: idPrefix + "-opt" + i,
    })),
    questionType: "single_choice",
    difficultyBand: null,
    subjectCode: null,
    nodeTagCode: null,
    explanation: null,
    numericAnswer: null,
    lifecycleStatus: "published",
    sourceBatch: null,
    createdAt: null,
    raw: {},
  };
}

test("history gate: allows the merge when every selected option maps and the answer agrees", () => {
  const survivor = withOptions([["2 A", true], ["5 A", false]], "S");
  const loser = withOptions([["5 A", false], ["2 A", true]], "L");
  const gate = checkHistorySafety(survivor, loser, ["L-opt0", "L-opt1"]);
  assert.equal(gate.ok, true);
  assert.equal(gate.optionMapping.byId.get("L-opt1"), "S-opt0", "5 A -> 5 A, 2 A -> 2 A regardless of order");
});

test("history gate: blocks the merge when a selected option has no equivalent", () => {
  const survivor = withOptions([["2 A", true], ["5 A", false]], "S");
  const loser = withOptions([["2 A", true], ["9 A", false]], "L");
  const gate = checkHistorySafety(survivor, loser, ["L-opt1"]);
  assert.equal(gate.ok, false);
  assert.match(gate.reason ?? "", /no text-equivalent option/);
});

test("history gate: blocks the merge when the correct answers disagree", () => {
  // Section 2 says a differing correct answer is not a reason to keep a second
  // copy — and it is right, for the QUESTION. But an already-scored attempt
  // carries is_correct and marks_awarded computed against the loser's key.
  // Re-pointing it would leave those values contradicting the question they
  // now name, so this cluster goes to review instead.
  const survivor = withOptions([["2 A", true], ["5 A", false]], "S");
  const loser = withOptions([["2 A", false], ["5 A", true]], "L");
  const gate = checkHistorySafety(survivor, loser, ["L-opt0"]);
  assert.equal(gate.ok, false);
  assert.match(gate.reason ?? "", /different correct answers/);
});

test.after(async () => {
  await pool.end();
});
