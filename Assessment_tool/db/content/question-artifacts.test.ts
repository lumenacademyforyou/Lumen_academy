import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";
import { stripQuestionArtifacts, hasQuestionArtifact } from "../shared/questionArtifacts.js";

// docs/test-engine-fix-prompt.md Defect 1. Two guarantees live here:
//   1. The stripper's own behaviour, covering every shape the spec's
//      acceptance criteria name (trailing tag with parens, without parens,
//      with brackets, tag before the `?`, unit-name suffix, and a clean stem
//      that must come back byte-for-byte untouched).
//   2. That db/shared/questionArtifacts.ts and content.fn_strip_question_
//      artifacts (db/migrations/036_strip_template_artifacts.sql) have not
//      drifted — asserted against every real stem in the live bank, not just
//      the fixtures, the same discipline fingerprint-normalizer.test.ts uses.
const hasDb = Boolean(process.env.DATABASE_URL);

const UNIT_NAMES = ["Electrostatic Potential and Capacitance", "Ray Optics", "Current Electricity"];

test("stripQuestionArtifacts removes every artifact shape and leaves clean stems alone", async (t) => {
  await t.test("trailing tag with parens", () => {
    assert.equal(
      stripQuestionArtifacts("Which principle governs the conservation laws in electrostatics (case #5_0)?"),
      "Which principle governs the conservation laws in electrostatics?"
    );
  });

  await t.test("trailing tag without parens", () => {
    assert.equal(stripQuestionArtifacts("What is the power of a plane glass plate case #7_1?"), "What is the power of a plane glass plate?");
    assert.equal(stripQuestionArtifacts("What is the power of a plane glass plate case#7_1?"), "What is the power of a plane glass plate?");
  });

  await t.test("trailing tag with brackets", () => {
    assert.equal(stripQuestionArtifacts("Define electric flux [case 5_0]?"), "Define electric flux?");
    assert.equal(stripQuestionArtifacts("Define electric flux [#5_0]?"), "Define electric flux?");
  });

  await t.test("bare hash tag sitting immediately before the question mark", () => {
    assert.equal(
      stripQuestionArtifacts("What is the net electric flux through a closed Gaussian surface #14_0?"),
      "What is the net electric flux through a closed Gaussian surface?"
    );
  });

  await t.test("mid-stem tag — the form the spec's own regex missed and this bank actually had", () => {
    assert.equal(
      stripQuestionArtifacts("A solid sphere rolls down a slope of radius r_loop (case #4). What is H_min?"),
      "A solid sphere rolls down a slope of radius r_loop. What is H_min?"
    );
  });

  await t.test("trailing unit-name suffix, from a dynamically supplied unit list", () => {
    assert.equal(
      stripQuestionArtifacts("Which principle governs conservation? — Electrostatic Potential and Capacitance", UNIT_NAMES),
      "Which principle governs conservation? — Electrostatic Potential and Capacitance".replace(/ — Electrostatic Potential and Capacitance$/, "")
    );
    assert.equal(stripQuestionArtifacts("Define focal length: Ray Optics", UNIT_NAMES), "Define focal length");
  });

  await t.test("repeated tags are removed in one call (the fixpoint loop)", () => {
    assert.equal(stripQuestionArtifacts("State the law (case #5_0) (case #5_1)?"), "State the law?");
  });

  await t.test("a clean stem comes back byte-for-byte untouched", () => {
    const clean = "A block of mass 5 kg slides at 3.5 m/s down a 30° incline. Find the friction coefficient.";
    assert.equal(stripQuestionArtifacts(clean), clean);
    assert.equal(hasQuestionArtifact(clean), false);
  });

  await t.test("real content that merely looks tag-shaped is left alone", () => {
    // No `#` and no literal `case` — this is exactly the narrowing documented
    // in questionArtifacts.ts, and the reason the spec's looser regex was not
    // used verbatim.
    const ratio = "The ratio 3_1 is written this way in the source text.";
    assert.equal(stripQuestionArtifacts(ratio), ratio);
    const decimals = "Given 9.8 and 3.14, compute the period.";
    assert.equal(stripQuestionArtifacts(decimals), decimals);
  });

  await t.test("a multi-line clean stem keeps its newlines", () => {
    const multi = "Consider the circuit below.\n\nWhat is the current through R2?";
    assert.equal(stripQuestionArtifacts(multi), multi);
  });

  await t.test("stripping is idempotent", () => {
    const dirty = "Which principle governs the conservation laws (case #5_0)?";
    const once = stripQuestionArtifacts(dirty);
    assert.equal(stripQuestionArtifacts(once), once);
  });
});

test("TS stripper and SQL fn_strip_question_artifacts agree", { skip: hasDb ? false : "DATABASE_URL not set" }, async (t) => {
  const { pool } = await import("../shared/pool.js");

  await t.test("agree on the hand-built fixtures", async () => {
    const fixtures = [
      "Which principle governs the conservation laws in electrostatics (case #5_0)?",
      "What is the power of a plane glass plate case #7_1?",
      "Define electric flux [case 5_0]?",
      "A solid sphere rolls down a slope of radius r_loop (case #4). What is H_min?",
      "State the law (case #5_0) (case #5_1)?",
      "A block of mass 5 kg slides at 3.5 m/s down a 30° incline.",
      "The ratio 3_1 is written this way in the source text.",
      "Consider the circuit below.\n\nWhat is the current through R2?",
    ];
    for (const fixture of fixtures) {
      const res = await pool.query<{ out: string }>("select content.fn_strip_question_artifacts($1) as out", [fixture]);
      assert.equal(res.rows[0].out, stripQuestionArtifacts(fixture), `SQL/TS drift on: ${JSON.stringify(fixture)}`);
    }
  });

  await t.test("agree on every stem in the live bank", async () => {
    const res = await pool.query<{ question_id: string; stem_text: string; sql_out: string }>(
      `select question_id, stem_text, content.fn_strip_question_artifacts(stem_text) as sql_out from content.question`
    );
    assert.ok(res.rowCount && res.rowCount > 0, "expected a non-empty question bank to compare against");
    for (const row of res.rows) {
      assert.equal(row.sql_out, stripQuestionArtifacts(row.stem_text), `SQL/TS drift on question ${row.question_id}`);
    }
  });

  await t.test("the bank holds no artifact-bearing stem, and none can be written", async () => {
    const dirty = await pool.query<{ n: string }>(
      `select count(*) n from content.question where content.fn_strip_question_artifacts(stem_text) is distinct from stem_text`
    );
    assert.equal(Number(dirty.rows[0].n), 0, "found stored stems still carrying a template artifact");

    // The write-time guard, exercised for real and rolled back.
    const client = await pool.connect();
    try {
      await client.query("begin");
      await assert.rejects(
        () =>
          client.query(
            `update content.question set stem_text = stem_text || ' (case #9_9)'
              where question_id = (select question_id from content.question order by question_id limit 1)`
          ),
        /template artifact/,
        "the write-time guard did not reject an artifact-bearing stem"
      );
    } finally {
      await client.query("rollback");
      client.release();
    }
  });
});
