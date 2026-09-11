import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";

// Test-layer hardening A6 (docs/test-layer-hardening-prompt.md,
// docs/BUGS.md#A6, docs/AUDIT.md §1.1). assess.user_question_seen used to be
// written only inside submitAttempt — a started-then-abandoned attempt burnt
// none of its served questions' exposure, so the next generation for that
// user treated every one of them as fully unseen again. Fixed by also
// upserting a "served" marker at serve time (startAttempt), and removing the
// now-redundant times_seen increment from submitAttempt's own write (which
// would otherwise double-count every question served-and-then-submitted
// relative to one that was only ever served-and-abandoned).
const hasDb = Boolean(process.env.DATABASE_URL);

test(
  "anti-repeat exposure: an abandoned attempt still marks its served questions as seen; submit never double-counts them",
  { skip: hasDb ? false : "DATABASE_URL not set — this integration test needs a live assess/catalog/content database" },
  async (t) => {
    const { pool } = await import("../../../shared/pool.js");
    const { createPracticeTest } = await import("../definition/create-practice-test.js");
    const { startAttempt, submitAttempt } = await import("./attempt-flow.js");
    const { getAttemptEnvelope } = await import("./envelope.js");

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

      // This shared dev database's core.app_user table is also used by
      // several other attempt-lifecycle integration tests in this
      // directory. Two different in-file coordination schemes (a disjoint
      // static row partition, then a Postgres advisory lock) were tried and
      // both caused real problems under node's default per-file
      // concurrency — see package.json's test:unit script, which now runs
      // `node --test --test-concurrency=1` specifically so these files
      // never execute concurrently with each other at all. That makes any
      // row choice here safe by construction; row 5 is kept only because
      // it's already what this file used.
      const userRes = await pool.query<{ user_id: string }>(`select user_id from core.app_user order by user_id asc offset 4 limit 1`);
      if (userRes.rowCount === 0) throw new Error("no core.app_user row — needed to own the test attempts this creates");
      const userId = userRes.rows[0].user_id;

      await pool.query(`update assess.attempt set attempt_state = 'abandoned' where user_id = $1 and attempt_state in ('in_progress','paused')`, [userId]);

      async function makeTest(scopeCode: string, pickCount: number) {
        const created = await createPracticeTest({
          examId,
          examCode,
          testType: "SUBJ",
          scopeCode,
          title: `A6 exposure test (${scopeCode})`,
          durationMinutes: 30,
          createdBy: userId,
          lines: [{ subjectId, includeDescendants: true, pickCount, sectionName: subjectCode }],
        });
        await pool.query(`update assess.test set test_status = 'published' where test_id = $1`, [created.testId]);
        return created.testId;
      }

      async function seenRows(questionIds: string[]) {
        const res = await pool.query<{ question_id: string; times_seen: number; last_seen_attempt_seq: number; was_correct_last: boolean | null }>(
          `select question_id, times_seen, last_seen_attempt_seq, was_correct_last from assess.user_question_seen where user_id = $1 and question_id = any($2::uuid[])`,
          [userId, questionIds]
        );
        return new Map(res.rows.map((r) => [r.question_id, r]));
      }

      await t.test("starting an attempt (never submitted) marks its served questions as seen", async () => {
        const testId = await makeTest("A6ABANDON", 5);
        const attempt = await startAttempt(testId, userId);
        const envelope = await getAttemptEnvelope(attempt.attemptId, userId);
        const questionIds = envelope.questions.map((q) => q.questionId);
        assert.equal(questionIds.length, 5);

        const before = await seenRows(questionIds);
        for (const qid of questionIds) {
          const row = before.get(qid);
          assert.ok(row, `question ${qid} served by a started attempt has no assess.user_question_seen row — A6 not fixed`);
          assert.ok(row!.times_seen >= 1, `question ${qid}'s times_seen should be >= 1 immediately after being served`);
        }

        // Leave this attempt in_progress (simulating abandonment) — the
        // whole point of A6 is that exposure must already be recorded
        // without ever calling submitAttempt. Force-close it afterward only
        // so it doesn't block this test's own later sub-tests, not because
        // the fix depends on it.
        await pool.query(`update assess.attempt set attempt_state = 'abandoned' where attempt_id = $1`, [attempt.attemptId]);
      });

      await t.test("submitting an attempt does not double-count exposure already recorded at serve time", async () => {
        const testId = await makeTest("A6NODOUBLE", 4);
        const attempt = await startAttempt(testId, userId);
        const envelope = await getAttemptEnvelope(attempt.attemptId, userId);
        const questionIds = envelope.questions.map((q) => q.questionId);

        const afterServe = await seenRows(questionIds);
        const timesSeenAfterServe = new Map(questionIds.map((qid) => [qid, afterServe.get(qid)!.times_seen]));

        await submitAttempt(attempt.attemptId, userId); // no responses — every question ends up UNATTEMPTED

        const afterSubmit = await seenRows(questionIds);
        for (const qid of questionIds) {
          const row = afterSubmit.get(qid);
          assert.ok(row, `question ${qid} missing a user_question_seen row after submit`);
          assert.equal(
            row!.times_seen,
            timesSeenAfterServe.get(qid),
            `question ${qid}'s times_seen changed between serve and submit (${timesSeenAfterServe.get(qid)} -> ${row!.times_seen}) — submitAttempt is double-counting exposure already recorded by startAttempt`
          );
        }
      });
    } finally {
      await pool.end();
    }
  }
);
