import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";

// docs/no-repeat-questions-fix.md follow-up: confirms, live, the exact
// property asked about after Phases 0-7 landed — the same question content
// is usable by many different users of the whole system at the same time
// (there is no global "used" flag anywhere in this design; Phase 0
// explicitly rejected one, precisely because a shared flag would make the
// pool appear to shrink under concurrent load and hide questions from other
// students), while no single user ever sees a repeat within their own
// paper, even when several users draw from the same small pool at once.
//
// Distinct from concurrent-generation.test.ts (which proves no deadlock/
// double-active-attempt race) — this proves the actual repetition property:
// zero within-user duplicates, plus real cross-user content overlap
// (proof, not just "wasn't prevented" — a pool this size WILL be shared).
const hasDb = Boolean(process.env.DATABASE_URL);

test(
  "concurrent shared pool: 8 users drawing from the same small pool at once each get zero internal repeats, with real cross-user content overlap",
  { skip: hasDb ? false : "DATABASE_URL not set — this integration test needs a live assess/catalog/content database" },
  async () => {
    const { pool } = await import("../../../shared/pool.js");
    const { createPracticeTest } = await import("../definition/create-practice-test.js");
    const { startAttempt, submitAttempt } = await import("./attempt-flow.js");

    try {
      const unitRes = await pool.query<{ node_id: string; subject_id: string }>(
        `select node_id, subject_id from catalog.syllabus_node where title = 'Mechanics & Rotational Dynamics' and node_type = 'unit' limit 1`
      );
      if (unitRes.rowCount === 0) throw new Error("fixture unit 'Mechanics & Rotational Dynamics' not found — content bank may have changed");
      const { node_id: nodeId, subject_id: subjectId } = unitRes.rows[0];

      // docs/test-engine-fix-prompt.md Defect 5 added a template-family guard:
      // at most one question per skeleton_fp family in any single paper, so a
      // student never sees eight "solid sphere of mass M = 6.0 / 10.0 / 14.0 kg"
      // variants of one question in the same test. That is a real reduction in
      // what a *narrow unit scope* can deliver, and this fixture was hardcoded
      // to 10 from a unit that holds 19 published rows but only 5 distinct
      // families — so it began failing with a correct PoolInsufficientError.
      //
      // Fixed by deriving the count from the pool rather than re-hardcoding a
      // smaller number: the test now asks for exactly what this unit can
      // actually deliver, so it keeps proving its real property (zero
      // within-user repeats under concurrency, with genuine cross-user
      // overlap) and does not silently break again the next time content
      // changes on either side. Measured with the same expression
      // LINE_AVAILABLE_SQL uses, including its null-skeleton fallback.
      const poolRes = await pool.query<{ families: string }>(
        `select count(distinct coalesce(q.skeleton_fp, decode(md5(q.question_id::text), 'hex'))) as families
           from content.question q
           join content.question_node_map qnm on qnm.question_id = q.question_id
          where qnm.node_id = $1 and q.lifecycle_status = 'published'`,
        [nodeId]
      );
      const pickCount = Math.min(10, Number(poolRes.rows[0].families));
      assert.ok(pickCount >= 3, `fixture unit has only ${pickCount} usable question families — too few to prove anything about concurrent sharing`);

      const examRes = await pool.query<{ exam_id: string; exam_code: string }>(`select exam_id, exam_code from catalog.exam where is_active = true limit 1`);
      if (examRes.rowCount === 0) throw new Error("no active catalog.exam row");
      const { exam_id: examId, exam_code: examCode } = examRes.rows[0];

      // Same "--test-concurrency=1 makes any row choice safe" reasoning as
      // every sibling file in this directory — 8 distinct rows needed here
      // (one per simulated concurrent user), any 8 are fine.
      const usersRes = await pool.query<{ user_id: string }>(`select user_id from core.app_user order by user_id asc limit 8`);
      if ((usersRes.rowCount ?? 0) < 8) throw new Error(`need at least 8 core.app_user rows for this test, found ${usersRes.rowCount}`);
      const userIds = usersRes.rows.map((r) => r.user_id);

      for (const userId of userIds) {
        await pool.query(`update assess.attempt set attempt_state = 'abandoned' where user_id = $1 and attempt_state in ('in_progress','paused')`, [userId]);
      }

      const created = await createPracticeTest({
        examId,
        examCode,
        testType: "SUBJ",
        scopeCode: "CONCURPROOF",
        title: "Concurrent shared-pool regression test",
        durationMinutes: 30,
        createdBy: userIds[0],
        lines: [{ subjectId, syllabusNodeId: nodeId, includeDescendants: false, pickCount, sectionName: "PHY" }],
      });
      await pool.query(`update assess.test set test_status = 'published' where test_id = $1`, [created.testId]);

      const results = await Promise.all(
        userIds.map(async (userId) => {
          const attempt = await startAttempt(created.testId, userId);
          const rows = await pool.query<{ question_id: string; content_fp: Buffer }>(
            `select question_id, content_fp from assess.attempt_question where attempt_id = $1`,
            [attempt.attemptId]
          );
          return { userId, attemptId: attempt.attemptId, items: rows.rows };
        })
      );

      // Property 1: zero repeats within any one user's own paper.
      for (const r of results) {
        assert.equal(r.items.length, pickCount, `user ${r.userId} did not receive the requested ${pickCount} items`);
        const qIds = r.items.map((i) => i.question_id);
        const fps = r.items.map((i) => i.content_fp.toString("hex"));
        assert.equal(new Set(qIds).size, pickCount, `user ${r.userId}'s paper has a duplicate question_id`);
        assert.equal(new Set(fps).size, pickCount, `user ${r.userId}'s paper has a duplicate content_fp (same visible question twice)`);
      }

      // Property 2: cross-user overlap is real, not just "not observed" —
      // proves the system isn't accidentally partitioning the pool per user
      // (which would itself be a bug: a hidden per-user exclusion where none
      // was ever asked for). With a 26-question pool and 8x10=80 draws, heavy
      // overlap is expected.
      const usage = new Map<string, number>();
      for (const r of results) {
        for (const item of r.items) {
          const fp = item.content_fp.toString("hex");
          usage.set(fp, (usage.get(fp) ?? 0) + 1);
        }
      }
      const sharedCount = [...usage.values()].filter((n) => n > 1).length;
      assert.ok(sharedCount > 0, "expected real content overlap across users on a shared small pool — got none, suggesting an unintended global exclusion");

      for (const r of results) {
        await submitAttempt(r.attemptId, r.userId);
      }
    } finally {
      await pool.end();
    }
  }
);
