import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";

// docs/no-repeat-questions-fix.md Phase 5 — "Within a single attempt:
// repeats are now impossible (Phases 3/4). Across attempts: the fallback
// [D-2, least-recently-seen recycling once a scope's unseen pool is
// exhausted] stays, but stops being silent." startAttempt now returns
// hasRecycledItems/recycledItemCount (mirrored onto assess.attempt and
// assess.unit_recycle_log) whenever any served question was already in
// assess.user_question_seen before this attempt. Proven against a unit
// docs/POOL_CENSUS.md already identified as having exactly 2 real
// (distinct-content) published questions — small enough to force full
// exhaustion deterministically in two attempts, not a contrived fixture.
const hasDb = Boolean(process.env.DATABASE_URL);

test(
  "recycled-item disclosure: fresh draw reports none recycled; a second draw against an exhausted 2-question unit reports full recycling, logged per unit",
  { skip: hasDb ? false : "DATABASE_URL not set — this integration test needs a live assess/catalog/content database" },
  async () => {
    const { pool } = await import("../../../shared/pool.js");
    const { createPracticeTest } = await import("../definition/create-practice-test.js");
    const { startAttempt, submitAttempt } = await import("./attempt-flow.js");

    try {
      // "Biotechnology: Principles & Applications" (Zoology) — 2 real
      // published questions behind 31 rows per docs/POOL_CENSUS.md, post
      // migration 031's collapse. Verified live below rather than assumed,
      // since content authoring could change this over time.
      const unitRes = await pool.query<{ node_id: string; subject_id: string }>(
        `select node_id, subject_id from catalog.syllabus_node where title = 'Biotechnology: Principles & Applications' and node_type = 'unit' limit 1`
      );
      if (unitRes.rowCount === 0) throw new Error("fixture unit 'Biotechnology: Principles & Applications' not found — content bank may have changed");
      const { node_id: nodeId, subject_id: subjectId } = unitRes.rows[0];

      const realCountRes = await pool.query<{ c: string }>(
        `select count(distinct q.question_id) as c
           from content.question q
           join content.question_node_map qnm on qnm.question_id = q.question_id
          where qnm.node_id = $1 and q.lifecycle_status = 'published'`,
        [nodeId]
      );
      const realCount = Number(realCountRes.rows[0].c);
      if (realCount !== 2) {
        throw new Error(
          `fixture unit's real question count changed (expected 2, got ${realCount}) — content authoring moved the target; update this test's assumptions rather than skipping it`
        );
      }

      const examRes = await pool.query<{ exam_id: string; exam_code: string }>(`select exam_id, exam_code from catalog.exam where is_active = true limit 1`);
      if (examRes.rowCount === 0) throw new Error("no active catalog.exam row — needed for this integration test");
      const { exam_id: examId, exam_code: examCode } = examRes.rows[0];

      // --test-concurrency=1 (package.json) serializes every integration
      // test file against this shared dev DB, so any core.app_user row
      // choice is safe by construction — same reasoning already documented
      // in anti-repeat-exposure.test.ts/reproduce-assembly.test.ts. Row 6
      // (offset 5) is arbitrary, just distinct from those two files' own
      // picks for readability, not because it's structurally required.
      const userRes = await pool.query<{ user_id: string }>(`select user_id from core.app_user order by user_id asc offset 5 limit 1`);
      if (userRes.rowCount === 0) throw new Error("no core.app_user row at the expected offset — needed to own the test attempts this creates");
      const userId = userRes.rows[0].user_id;

      await pool.query(`update assess.attempt set attempt_state = 'abandoned' where user_id = $1 and attempt_state in ('in_progress','paused')`, [userId]);

      // This is a shared dev database with real accumulated history (774+
      // attempts) — with a real pool this small (2 questions), an earlier,
      // unrelated session touching this exact unit for this exact user is a
      // live possibility, not just a theoretical one (this was caught live
      // while writing this test, not assumed). Deterministic setup means
      // clearing this user's exposure for this unit's own questions first,
      // same "reset relevant shared state before asserting against it"
      // discipline already used elsewhere in this directory (e.g. every
      // sibling file's own attempt_state reset above).
      const unitQuestionIdsRes = await pool.query<{ question_id: string }>(
        `select distinct q.question_id from content.question q
           join content.question_node_map qnm on qnm.question_id = q.question_id
          where qnm.node_id = $1 and q.lifecycle_status = 'published'`,
        [nodeId]
      );
      await pool.query(`delete from assess.user_question_seen where user_id = $1 and question_id = any($2::uuid[])`, [
        userId,
        unitQuestionIdsRes.rows.map((r) => r.question_id),
      ]);

      const created = await createPracticeTest({
        examId,
        examCode,
        testType: "SUBJ",
        scopeCode: "P5RECYCLE",
        title: "Phase 5 recycled-item disclosure regression test",
        durationMinutes: 30,
        createdBy: userId,
        lines: [{ subjectId, syllabusNodeId: nodeId, includeDescendants: false, pickCount: 2, sectionName: "P5" }],
      });
      await pool.query(`update assess.test set test_status = 'published' where test_id = $1`, [created.testId]);

      const attempt1 = await startAttempt(created.testId, userId);
      assert.equal(attempt1.hasRecycledItems, false, "first-ever draw against this unit for this user should have nothing recycled");
      assert.equal(attempt1.recycledItemCount, 0);
      await submitAttempt(attempt1.attemptId, userId);

      const attempt2 = await startAttempt(created.testId, userId);
      assert.equal(attempt2.hasRecycledItems, true, "second draw against a now-fully-exhausted 2-question unit should report recycling");
      assert.equal(attempt2.recycledItemCount, 2, "both served questions were already seen — should be fully (not partially) recycled");

      const attemptRow = await pool.query<{ has_recycled_items: boolean; recycled_item_count: number }>(
        `select has_recycled_items, recycled_item_count from assess.attempt where attempt_id = $1`,
        [attempt2.attemptId]
      );
      assert.equal(attemptRow.rows[0].has_recycled_items, true, "assess.attempt.has_recycled_items was not persisted");
      assert.equal(attemptRow.rows[0].recycled_item_count, 2, "assess.attempt.recycled_item_count was not persisted correctly");

      const logRows = await pool.query<{ subject_id: string; syllabus_node_id: string; requested_count: number; recycled_count: number }>(
        `select subject_id, syllabus_node_id, requested_count, recycled_count from assess.unit_recycle_log where attempt_id = $1`,
        [attempt2.attemptId]
      );
      assert.equal(logRows.rowCount, 1, "expected exactly one assess.unit_recycle_log row for the one recycled blueprint line");
      assert.equal(logRows.rows[0].syllabus_node_id, nodeId);
      assert.equal(logRows.rows[0].requested_count, 2);
      assert.equal(logRows.rows[0].recycled_count, 2);

      await submitAttempt(attempt2.attemptId, userId);
    } finally {
      await pool.end();
    }
  }
);
