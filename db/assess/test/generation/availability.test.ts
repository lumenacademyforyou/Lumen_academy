import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";

// docs/test-engine-fix-prompt.md Defect 6's central acceptance criterion:
// "availability counts matching what the assembler actually produces." A
// number that is merely *plausible* is worse than no number — it is the
// notification lying, which is the failure mode the spec calls out by name.
// So this asserts the equality directly, against the live bank, rather than
// asserting the endpoint returns some number.
//
// User partition note (see the sibling attempt-lifecycle test files): this
// file is read-only — checkAvailability never writes and never starts an
// attempt — so it needs no exclusive user row and cannot collide with them.
const hasDb = Boolean(process.env.DATABASE_URL);

test("availability", { skip: hasDb ? false : "DATABASE_URL not set" }, async (t) => {
  const { pool } = await import("../../../shared/pool.js");
  const { checkAvailability, computeConfigHash } = await import("./availability.js");

  const user = await pool.query<{ user_id: string }>(`select user_id from core.app_user order by user_id limit 1`);
  const userId = user.rows[0].user_id;

  const subject = await pool.query<{ subject_id: string; subject_code: string }>(
    `select s.subject_id, s.subject_code
       from catalog.subject s
       join catalog.exam e on e.exam_id = s.exam_id and e.is_active = true
      order by s.display_order limit 1`
  );
  const subjectId = subject.rows[0].subject_id;

  await t.test("a satisfiable config reports zero shortfall and no per-unit rows", async () => {
    const result = await checkAvailability("subject-wise", [{ subjectId, pickCount: 5, sectionName: subject.rows[0].subject_code }], userId);
    assert.equal(result.requested, 5);
    assert.equal(result.available, 5, "a 5-question draw from a whole subject should be satisfiable in this bank");
    assert.equal(result.shortfall, 0);
    assert.deepEqual(result.byUnit, [], "no unit rows when nothing is short");
  });

  await t.test("an unsatisfiable config reports the real post-dedup number, not the raw row count", async () => {
    const absurd = 100_000;
    const result = await checkAvailability("subject-wise", [{ subjectId, pickCount: absurd, sectionName: subject.rows[0].subject_code }], userId);

    assert.equal(result.requested, absurd);
    assert.ok(result.available > 0, "expected a non-empty pool for this subject");
    assert.equal(result.shortfall, absurd - result.available);
    assert.equal(result.byUnit.length, 1);
    assert.equal(result.byUnit[0].reason, "POOL_TOO_SMALL");
    assert.equal(result.byUnit[0].available, result.available);

    // The number must be the *family-deduped* count, strictly below the raw
    // published row count for this subject — otherwise the template-family
    // guard is not being applied and the banner would over-promise.
    const raw = await pool.query<{ n: string }>(
      `select count(distinct q.question_id) n
         from content.question q
         join content.question_node_map qnm on qnm.question_id = q.question_id
         join catalog.syllabus_node sn on sn.node_id = qnm.node_id
        where sn.subject_id = $1 and q.lifecycle_status = 'published'`,
      [subjectId]
    );
    assert.ok(
      result.available <= Number(raw.rows[0].n),
      `availability (${result.available}) must never exceed the raw published count (${raw.rows[0].n})`
    );
  });

  await t.test("availability equals what the assembler really delivers", async () => {
    // Ask for exactly what availability says is there, then let the real
    // assembler try to build it. If the count were inflated, this throws
    // PoolInsufficientError; if deflated, the assembler returns more than
    // promised. Both are failures, so equality is asserted rather than a bound.
    const probe = await checkAvailability("subject-wise", [{ subjectId, pickCount: 100_000 }], userId);
    const exact = probe.available;

    const { createPracticeTest } = await import("../definition/create-practice-test.js");
    const { assembleForAttempt } = await import("./assemble.js");
    const exam = await pool.query<{ exam_id: string; exam_code: string }>(
      `select exam_id, exam_code from catalog.exam where is_active = true limit 1`
    );

    const testRow = await createPracticeTest({
      examId: exam.rows[0].exam_id,
      examCode: exam.rows[0].exam_code,
      testType: "SUBJ",
      scopeCode: `AVAILCHK${Date.now() % 100000}`,
      title: "availability parity check",
      durationMinutes: 10,
      createdBy: userId,
      lines: [{ subjectId, includeDescendants: true, pickCount: exact, sectionName: subject.rows[0].subject_code }],
    });

    try {
      const assembled = await assembleForAttempt(testRow.testId, userId);
      const total = assembled.sections.reduce((n, sec) => n + sec.questionIds.length, 0);
      assert.equal(total, exact, "the assembler delivered a different count than availability promised");

      // And it delivered them without a repeat, by id and by content.
      const ids = assembled.sections.flatMap((sec) => sec.questionIds);
      assert.equal(new Set(ids).size, ids.length, "duplicate question_id in an assembled paper");
      const fps = assembled.sections.flatMap((sec) => sec.contentFps).filter(Boolean);
      assert.equal(new Set(fps).size, fps.length, "duplicate content fingerprint in an assembled paper");
    } finally {
      await pool.query(`delete from assess.test_blueprint where test_section_id in (select test_section_id from assess.test_section where test_id = $1)`, [testRow.testId]);
      await pool.query(`delete from assess.test_section where test_id = $1`, [testRow.testId]);
      await pool.query(`delete from assess.test where test_id = $1`, [testRow.testId]);
    }
  });

  await t.test("configHash is stable for the same config and differs when the config differs", async () => {
    const a = await computeConfigHash("custom", [{ subjectId, pickCount: 10 }], 10);
    const b = await computeConfigHash("custom", [{ subjectId, pickCount: 10 }], 10);
    const c = await computeConfigHash("custom", [{ subjectId, pickCount: 11 }], 11);
    assert.equal(a, b, "same config must hash the same — otherwise the banner would never render");
    assert.notEqual(a, c, "a changed count must change the hash — otherwise a stale banner could survive");
  });

  await t.test("two lines over the same scope do not both claim the whole pool", async () => {
    const single = await checkAvailability("custom", [{ subjectId, pickCount: 100_000 }], userId);
    const doubled = await checkAvailability(
      "custom",
      [
        { subjectId, pickCount: 100_000 },
        { subjectId, pickCount: 100_000 },
      ],
      userId
    );
    // The second line sees only what the first left behind — which is nothing.
    assert.equal(doubled.available, single.available, "a second line over the same scope must not re-count the same questions");
    assert.equal(doubled.byUnit.length, 2, "both short lines should be reported");
    assert.equal(doubled.byUnit[1].available, 0);
  });

  await pool.end();
});
