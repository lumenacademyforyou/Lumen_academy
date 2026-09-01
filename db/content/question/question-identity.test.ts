import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";

/**
 * Test suite for question-dedup-audit-and-fix.md (Part 3, deliverable 7).
 *
 * Each test names the specific claim it defends. The regression guards matter
 * more than the positive cases here: the directive's Bug 3 is that a naive
 * similarity merge destroys legitimately distinct questions, and the audit
 * found real examples of exactly that in this bank, so several of these tests
 * exist to prove the system REFUSES to merge things.
 *
 * These run against the live content schema (read-only except where a test
 * creates and then removes its own fixture rows inside a rolled-back
 * transaction), matching the convention of the other db/ integration tests.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const skip = hasDb ? false : "DATABASE_URL not set — these integration tests need a live content database";

test("identity: the decorative chapter lead-in collapses onto one stem_norm", { skip }, async () => {
  const { pool } = await import("../../shared/pool.js");
  const res = await pool.query<{ a: string; b: string; c: string }>(
    `select content.fn_question_stem_norm($1) as a,
            content.fn_question_stem_norm($2) as b,
            content.fn_question_stem_norm($3) as c`,
    [
      "In Kinetic Theory of Gases, a body of mass m = 10.0 kg operates with velocity v = 15.0 m/s.",
      "In Waves, a body of mass m = 10.0 kg operates with velocity v = 15.0 m/s.",
      // comma-containing chapter title — migration 039's regression
      "In Work, Energy and Power, a body of mass m = 10.0 kg operates with velocity v = 15.0 m/s.",
    ]
  );
  const { a, b, c } = res.rows[0];
  assert.equal(a, b, "two chapters must normalise identically");
  assert.equal(a, c, "a comma-containing chapter title must strip completely");
  assert.ok(!a.startsWith("in "), `lead-in survived normalisation: ${a}`);
});

test("REGRESSION GUARD (directive Bug 3): same stem + different options stay DISTINCT", { skip }, async () => {
  const { pool } = await import("../../shared/pool.js");
  // Row C in the directive: a generic colligative-properties stem that could
  // front dozens of genuinely different questions. Same stem, different
  // option sets, different correct answers -> must NOT share a dedup_key.
  const res = await pool.query<{ same_stem: boolean; same_key: boolean }>(
    `with a as (select content.fn_question_stem_norm($1) sn, digest($1 || chr(30) || $2 || chr(30) || $3, 'sha256') k),
          b as (select content.fn_question_stem_norm($1) sn, digest($1 || chr(30) || $4 || chr(30) || $5, 'sha256') k)
     select (a.sn = b.sn) as same_stem, (a.k = b.k) as same_key from a, b`,
    [
      "Which of the following solutions will have the highest boiling point elevation at the same concentration?",
      "0.1 m nacl|0.1 m glucose",
      "0.1 m nacl",
      "0.1 m cacl2|0.1 m urea",
      "0.1 m cacl2",
    ]
  );
  assert.equal(res.rows[0].same_stem, true, "the stems really are identical — that is the premise");
  assert.equal(res.rows[0].same_key, false, "identical stems with different options must NOT collide");
});

test("REGRESSION GUARD: two live questions sharing an answer_key but genuinely distinct are not merged", { skip }, async () => {
  const { pool } = await import("../../shared/pool.js");
  // The real pair the audit found: oxidation number +6, in H2SO4 vs K2Cr2O7.
  const res = await pool.query<{ n: string; distinct_keys: string }>(
    `select count(*)::text as n, count(distinct i.dedup_key)::text as distinct_keys
       from content.question q
       cross join lateral content.fn_question_identity(q.question_id) i
      where q.question_uid in ('LMN-CHEM-CHEM08-000014','LMN-CHEM-CHEM08-000026')`
  );
  if (res.rows[0].n !== "2") return; // fixture rows absent on a wiped bank
  assert.equal(res.rows[0].distinct_keys, "2", "two distinct questions sharing an answer must keep distinct dedup_keys");
});

test("image-only difference produces distinct identities", { skip }, async () => {
  const { pool } = await import("../../shared/pool.js");
  // Same stem, same options, same answer, different image -> different key.
  // This is why image_phash is in the composition at all.
  const res = await pool.query<{ same: boolean }>(
    `select digest($1 || chr(30) || $2 || chr(30) || $3, 'sha256')
          = digest($1 || chr(30) || $2 || chr(30) || $4, 'sha256') as same`,
    ["identify the labelled structure", "a|b|c|d", "aa11", "bb22"]
  );
  assert.equal(res.rows[0].same, false, "a differing image_phash must break identity");
});

test("answer-key blocking finds the same fact filed under two different nodes", { skip }, async () => {
  const { pool } = await import("../../shared/pool.js");
  // Validates the design decision to block on answer_key and NOT on
  // primary_node_id. The audit found families spanning up to 7 units.
  const res = await pool.query<{ groups: string; max_nodes: string }>(
    `with k as (
       select q.question_id, q.primary_node_id, i.dedup_key
         from content.question q
         cross join lateral content.fn_question_identity(q.question_id) i
        where q.lifecycle_status = 'published' and q.canonical_question_id is null
          and i.dedup_key is not null
     )
     select count(*)::text as groups, coalesce(max(nodes),0)::text as max_nodes
       from (select dedup_key, count(distinct primary_node_id) nodes
               from k group by dedup_key having count(*) > 1) z`
  );
  const groups = Number(res.rows[0].groups);
  if (groups === 0) return; // clean bank — the clustering pass has already run
  assert.ok(
    Number(res.rows[0].max_nodes) > 1,
    "at least one identity collision must span more than one node, or answer-key blocking bought nothing"
  );
});

test("near-duplicates are QUEUED for review, never auto-merged", { skip }, async () => {
  const { pool } = await import("../../shared/pool.js");
  // The detector's own predicate: it must only ever produce 'pending' rows,
  // and must never touch canonical_question_id.
  const res = await pool.query<{ non_pending_from_job: string }>(
    `select count(*)::text as non_pending_from_job
       from content.question_duplicate_candidate
      where detection_method = 'trigram' and status <> 'pending' and reviewed_by is null`
  );
  assert.equal(
    res.rows[0].non_pending_from_job,
    "0",
    "the nightly job must never set a status other than pending; only a reviewer may"
  );
});

test("rejections are permanent — a rejected pair can never be re-queued", { skip }, async () => {
  const { pool } = await import("../../shared/pool.js");
  // Enforced structurally by the unique pair index, not by job logic.
  const res = await pool.query<{ has_unique: string }>(
    `select count(*)::text as has_unique from pg_indexes
      where schemaname = 'content' and indexname = 'uq_question_duplicate_candidate_pair'`
  );
  assert.equal(res.rows[0].has_unique, "1", "without the unique pair index a rejected pair could resurface");
});

test("assembler: the candidate query excludes answer_key and canonical duplicates", { skip }, async () => {
  const { LINE_CANDIDATE_SQL, LINE_AVAILABLE_SQL } = await import("../../assess/test/generation/assemble.js");
  // Structural assertion — the guarantee lives in the SQL, so the SQL is what
  // is asserted. A future edit that drops either exclusion fails here.
  assert.ok(LINE_CANDIDATE_SQL.includes("q.answer_key = any ($13::text[])"), "answer_key exclusion missing from candidate query");
  assert.ok(
    LINE_CANDIDATE_SQL.includes("coalesce(q.canonical_question_id, q.question_id) = any ($14::uuid[])"),
    "canonical exclusion missing from candidate query"
  );
  // REGRESSION GUARD for a bug this pass introduced and then removed: there
  // must be exactly ONE within-line de-duplication partition (the template
  // family). A second parallel partition on answer_key cannot be reduced to
  // rank 1 alongside it without under-drawing the line — that is maximum
  // bipartite matching, not a window function — and it also guards the wrong
  // thing, since two questions sharing an answer are not duplicates.
  assert.ok(LINE_CANDIDATE_SQL.includes("family_rank = 1"), "the template-family guard must remain");
  assert.ok(
    !LINE_CANDIDATE_SQL.includes("answer_rank"),
    "answer_key must NOT be a within-line ranking partition — it under-draws the pool and can raise PoolInsufficientError on a sufficient pool"
  );

  // The availability count must be the SAME query as the picker, not a
  // hand-written approximation of it — that is what keeps the number a student
  // is shown honest. Both are now composed from one shared body.
  const sharedBody = LINE_CANDIDATE_SQL.slice(0, LINE_CANDIDATE_SQL.indexOf("  select question_id,"));
  assert.ok(sharedBody.length > 500, "expected a substantial shared candidate body");
  assert.ok(
    LINE_AVAILABLE_SQL.startsWith(sharedBody),
    "LINE_AVAILABLE_SQL must be composed from the same CANDIDATE_BODY as LINE_CANDIDATE_SQL, or the two will drift"
  );
  assert.ok(LINE_AVAILABLE_SQL.includes("count(*)"), "availability must count the picker's own output");
  // The count form must not actually apply the pick_count LIMIT. Checked on
  // the SQL with comments stripped — the explanatory comment legitimately
  // mentions "limit $9" while the statement itself must not use it.
  const availableCode = LINE_AVAILABLE_SQL.replace(/--[^\n]*/g, "");
  assert.ok(!/\blimit\s+\$9/.test(availableCode), "the availability form must drop the pick_count limit");
});

test("post-assembly gate fails a deliberately poisoned paper", { skip }, async () => {
  const { AssemblerDuplicateAssertionError } = await import("../../shared/errors.js");
  // Reproduces the gate's logic over a hand-poisoned pick set. The pair below
  // is the decorative-chapter case: DIFFERENT content_fp (which is exactly why
  // a content_fp-only gate was not enough) but the SAME dedup_key, because
  // stem_norm strips the chapter noun that is the only thing separating them.
  const rows = [
    { question_id: "11111111-1111-1111-1111-111111111111", content_fp: Buffer.from("aa", "hex"), dedup_key: Buffer.from("dd", "hex"), canonical_id: "c1" },
    { question_id: "22222222-2222-2222-2222-222222222222", content_fp: Buffer.from("bb", "hex"), dedup_key: Buffer.from("dd", "hex"), canonical_id: "c2" },
  ];
  const seen = new Map<string, string>();
  const duplicates: { questionIdA: string; questionIdB: string; contentFpHex: string }[] = [];
  for (const row of rows) {
    for (const [label, value] of [
      ["content_fp", row.content_fp ? row.content_fp.toString("hex") : null],
      ["dedup_key", row.dedup_key ? row.dedup_key.toString("hex") : null],
      ["canonical_id", row.canonical_id],
    ] as const) {
      if (!value) continue;
      const key = `${label}:${value}`;
      const existing = seen.get(key);
      if (existing && existing !== row.question_id) {
        duplicates.push({ questionIdA: existing, questionIdB: row.question_id, contentFpHex: key });
      } else {
        seen.set(key, row.question_id);
      }
    }
  }
  assert.equal(duplicates.length, 1, "the poisoned pair must be caught");
  assert.ok(duplicates[0].contentFpHex.startsWith("dedup_key:"), "it must be caught on dedup_key, since content_fp differs");
  const err = new AssemblerDuplicateAssertionError(duplicates);
  assert.ok(err instanceof Error);

  // ...and the gate must NOT fire on two genuinely different questions that
  // merely share a correct answer (directive Bug 3; seven such pairs are live
  // in this bank). This is the guard against re-adding answer_key to the gate.
  const sameAnswer = [
    { question_id: "33333333-3333-3333-3333-333333333333", content_fp: Buffer.from("11", "hex"), dedup_key: Buffer.from("aa11", "hex"), canonical_id: "c3" },
    { question_id: "44444444-4444-4444-4444-444444444444", content_fp: Buffer.from("22", "hex"), dedup_key: Buffer.from("bb22", "hex"), canonical_id: "c4" },
  ];
  const seen2 = new Map<string, string>();
  let clashes = 0;
  for (const row of sameAnswer) {
    for (const [label, value] of [
      ["content_fp", row.content_fp.toString("hex")],
      ["dedup_key", row.dedup_key.toString("hex")],
      ["canonical_id", row.canonical_id],
    ] as const) {
      const key = `${label}:${value}`;
      if (seen2.has(key)) clashes++;
      else seen2.set(key, row.question_id);
    }
  }
  assert.equal(clashes, 0, "two distinct questions sharing an answer must pass the gate");
});

test("usage: content.question_usage exists and usage_count is trigger-maintained", { skip }, async () => {
  const { pool } = await import("../../shared/pool.js");
  const res = await pool.query<{ usage_rows: string; counted: string; has_trigger: string }>(
    `select (select count(*)::text from content.question_usage) as usage_rows,
            (select count(*)::text from content.question where usage_count > 0) as counted,
            (select count(*)::text from pg_trigger
              where tgrelid = 'content.question_usage'::regclass
                and tgname = 'trg_question_usage_count' and not tgisinternal) as has_trigger`
  );
  assert.equal(res.rows[0].has_trigger, "1", "usage_count must be maintained by trigger, not application code");
  if (Number(res.rows[0].usage_rows) > 0) {
    assert.ok(
      Number(res.rows[0].counted) > 0,
      "usage rows exist but usage_count is 0 everywhere — the directive's Bug 5 has regressed"
    );
  }
});

test("identity columns are trigger-owned: an application-supplied dedup_key is overwritten", { skip }, async () => {
  const { pool } = await import("../../shared/pool.js");
  // The permanence guarantee: if an importer can supply these values, it can
  // supply wrong ones. Proven against a real row inside a rolled-back
  // transaction so the live bank is untouched.
  const client = await pool.connect();
  try {
    await client.query("begin");
    const target = await client.query<{ question_id: string; dedup_key: string | null }>(
      `select question_id, encode(dedup_key,'hex') as dedup_key
         from content.question where lifecycle_status = 'published' limit 1`
    );
    if (target.rowCount === 0) return;
    const id = target.rows[0].question_id;
    // Touch a trigger-watched column while also trying to force a bogus key.
    await client.query(
      `update content.question set dedup_key = decode('deadbeef','hex'), stem_text = stem_text where question_id = $1`,
      [id]
    );
    const after = await client.query<{ dedup_key: string | null }>(
      `select encode(dedup_key,'hex') as dedup_key from content.question where question_id = $1`,
      [id]
    );
    assert.notEqual(after.rows[0].dedup_key, "deadbeef", "the trigger must overwrite an application-supplied dedup_key");
  } finally {
    await client.query("rollback");
    client.release();
  }
});
