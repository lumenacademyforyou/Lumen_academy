import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeStem } from "../shared/normalizeStem.js";

// docs/no-repeat-questions-fix.md Phase 1.1. content.fn_normalize_stem
// (db/migrations/030_question_fingerprints.sql) is a hand-mirrored SQL
// port of db/shared/normalizeStem.ts's normalizeStem() — the two must never
// drift, since every content_fp/stem_fp comparison across the assembler,
// the collapse migration, and the importer's dedup check depends on both
// sides agreeing byte-for-byte. This is the guard: fixtures covering every
// step of the pipeline (HTML, markdown, LaTeX tokens, $ delimiters, leading
// enumeration, decimal points vs. stripped punctuation, unit spacing),
// plus a live sample of real stems from the bank so the guarantee isn't
// just "passes on hand-picked examples."
const hasDb = Boolean(process.env.DATABASE_URL);

const FIXTURES = [
  "What is 5kg equal to in Newtons?",
  "1. What is the capital of France?",
  "(2) Solve for x: 3.5 + 2.1 = ?",
  "**Bold** and _italic_ and `code` and ~strike~",
  "# Heading\nSome question text",
  "Use \\, spacing \\! and \\; latex tokens \\quad \\qquad here",
  "$$E=mc^2$$ what is this formula?",
  "A value of 98.6 degrees, or maybe 3.14159, matters here.",
  "<p>HTML wrapped question</p> with <b>bold</b> text",
  "[Link text](http://example.com) inside a question",
  "Multiple   spaces    collapse   here",
  "Mixed CASE Text Should Lowercase",
  "Question with symbols: @#%^&*()!",
  "10th standard physics question about 5m/s velocity",
  "Mg2+ ion concentration in blood plasma is 1.5 mmol/L",
  "Mixture: 25.5% NaCl + 74.5% H2O by mass",
];

test("normalizeStem produces the documented, deterministic transform (no DB needed)", () => {
  assert.equal(normalizeStem("What is 5kg equal to in Newtons?"), "what is 5 kg equal to in newtons");
  assert.equal(normalizeStem("1. What is the capital of France?"), "what is the capital of france");
  assert.equal(normalizeStem("$$E=mc^2$$ what is this formula?"), "e=mc2 what is this formula");
  assert.equal(normalizeStem("A value of 98.6, or 3.14159."), "a value of 98.6 or 3.14159");
  // idempotent
  const once = normalizeStem("  Hello, WORLD!  5kg  ");
  assert.equal(normalizeStem(once), once, "normalizeStem should be idempotent on its own output");
});

test(
  "content.fn_normalize_stem (SQL) agrees with normalizeStem (TS) on every fixture and a live sample of real stems",
  { skip: hasDb ? false : "DATABASE_URL not set — this integration test needs a live content database" },
  async () => {
    const { pool } = await import("../shared/pool.js");
    try {
      for (const fixture of FIXTURES) {
        const tsResult = normalizeStem(fixture);
        const sqlRes = await pool.query<{ r: string }>("select content.fn_normalize_stem($1) as r", [fixture]);
        assert.equal(sqlRes.rows[0].r, tsResult, `TS/SQL mismatch on fixture: ${JSON.stringify(fixture)}`);
      }

      const liveRes = await pool.query<{ stem_text: string }>(
        `select stem_text from content.question order by random() limit 200`
      );
      assert.ok(liveRes.rowCount && liveRes.rowCount > 0, "expected at least one live content.question row to sample");

      const mismatches: { stem: string; ts: string; sql: string }[] = [];
      for (const row of liveRes.rows) {
        const tsResult = normalizeStem(row.stem_text);
        const sqlRes = await pool.query<{ r: string }>("select content.fn_normalize_stem($1) as r", [row.stem_text]);
        if (sqlRes.rows[0].r !== tsResult) {
          mismatches.push({ stem: row.stem_text.slice(0, 80), ts: tsResult, sql: sqlRes.rows[0].r });
        }
      }
      assert.deepEqual(mismatches, [], `TS/SQL normalizer diverged on ${mismatches.length}/${liveRes.rowCount} live stems`);
    } finally {
      await pool.end();
    }
  }
);
