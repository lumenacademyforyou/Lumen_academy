import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";

// Phase F3 (LA-APP-COMPLETION-001) — the automated version of Phase C9's
// manual harness (db/scripts/manual/prove-c1-sessions.ts / verify-c-done-when.ts).
// Same live-DB-integration convention as backend/src/controllers/questionController.test.ts:
// db/config/env.ts exits the whole process if DATABASE_URL is missing at
// import time, so every db/ module import is deferred inside the test body
// and the test is skipped with an explicit reason (never a silent pass) when
// there's no database to run against.
const hasDb = Boolean(process.env.DATABASE_URL);

test(
  "assembly: no duplicates, differs between requests, respects pickCount, and reports insufficient pool structurally",
  { skip: hasDb ? false : "DATABASE_URL not set — this integration test needs a live assess/catalog/content database" },
  async (t) => {
    const { pool } = await import("../../../shared/pool.js");
    const { PoolInsufficientError } = await import("../../../shared/errors.js");
    const { createPracticeTest } = await import("../definition/create-practice-test.js");
    const { startAttempt } = await import("../attempt/attempt-flow.js");
    const { getAttemptEnvelope } = await import("../attempt/envelope.js");

    try {
      const examRes = await pool.query<{ exam_id: string; exam_code: string }>(`select exam_id, exam_code from catalog.exam where is_active = true limit 1`);
      if (examRes.rowCount === 0) throw new Error("no active catalog.exam row — needed for this integration test");
      const { exam_id: examId, exam_code: examCode } = examRes.rows[0];

      const subjectRes = await pool.query<{ subject_id: string; subject_code: string }>(
        `select subject_id, subject_code from catalog.subject where exam_id = $1 order by display_order limit 1`,
        [examId]
      );
      if (subjectRes.rowCount === 0) throw new Error("no catalog.subject row for the active exam");
      const { subject_id: subjectId, subject_code: subjectCode } = subjectRes.rows[0];

      const userRes = await pool.query<{ user_id: string }>(`select user_id from core.app_user limit 1`);
      if (userRes.rowCount === 0) throw new Error("no core.app_user row — needed to own the test attempts this creates");
      const userId = userRes.rows[0].user_id;

      async function assemble(pickCount: number, scopeCode: string) {
        const created = await createPracticeTest({
          examId,
          examCode,
          testType: "SUBJ",
          scopeCode,
          title: `F3 assembly test (${scopeCode})`,
          durationMinutes: 30,
          createdBy: userId,
          lines: [{ subjectId, includeDescendants: true, pickCount, sectionName: subjectCode }],
        });
        await pool.query(`update assess.test set test_status = 'published' where test_id = $1`, [created.testId]);
        const attempt = await startAttempt(created.testId, userId);
        return getAttemptEnvelope(attempt.attemptId, userId);
      }

      await t.test("no duplicate questions within one assembled paper", async () => {
        const envelope = await assemble(15, "F3DUP");
        const ids = envelope.questions.map((q) => q.questionId);
        assert.equal(new Set(ids).size, ids.length, "duplicate question id served within a single attempt");
      });

      await t.test("blueprint pickCount is respected", async () => {
        const envelope = await assemble(12, "F3COUNT");
        assert.equal(envelope.questions.length, 12);
        assert.equal(envelope.sections.length, 1);
        assert.equal(envelope.sections[0].questionCount, 12);
      });

      await t.test("two assemblies of the same blueprint produce different question sets", async () => {
        const [a, b] = await Promise.all([assemble(8, "F3DIFFA"), assemble(8, "F3DIFFB")]);
        const idsA = a.questions.map((q) => q.questionId);
        const idsB = b.questions.map((q) => q.questionId);
        const identical = idsA.length === idsB.length && idsA.every((id, i) => id === idsB[i]);
        assert.equal(identical, false, "two independent assemblies from the same blueprint returned an identical, identically-ordered question set");
      });

      await t.test("insufficient pool throws a structured PoolInsufficientError, never a silently short paper", async () => {
        // 30,000 — comfortably more than any real subject's published bank
        // (hundreds, per Phase B4's inventory) but still well under
        // catalog.pattern_section.question_count's smallint ceiling (32,767),
        // so this exercises the real insufficient-pool path in assemble.ts
        // rather than an unrelated numeric-overflow error at the earlier
        // exam_pattern insert.
        const requested = 30_000;
        await assert.rejects(
          () => assemble(requested, "F3INSUFFICIENT"),
          (err: unknown) => {
            assert.ok(err instanceof PoolInsufficientError, `expected PoolInsufficientError, got ${err instanceof Error ? err.constructor.name : typeof err}`);
            const poolErr = err as InstanceType<typeof PoolInsufficientError>;
            assert.equal(poolErr.requested, requested);
            assert.ok(poolErr.available < requested);
            return true;
          }
        );
      });

      await t.test("no answer-key leakage in an assembled, unsubmitted envelope", async () => {
        const envelope = await assemble(5, "F3NOLEAK");
        assert.ok(!JSON.stringify(envelope).includes("isCorrect"), "envelope leaked isCorrect before submission (R-9 violation)");
      });
    } finally {
      await pool.end();
    }
  }
);
