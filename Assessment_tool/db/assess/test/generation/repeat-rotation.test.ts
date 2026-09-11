import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";

// Live-reported regression: "repetition questions still" — investigated
// against real exposure data (docs/BUGS.md's D-2 policy, assemble.ts's
// LINE_CANDIDATE_SQL) rather than re-guessed. The real driver, confirmed
// against live assess.user_question_seen data, is a content-volume limit —
// units are seeded with only 30 published questions each, so a handful of
// unit-scoped attempts genuinely exhausts the unseen pool, and recycling
// least-recently-seen questions from then on is the correct, designed
// fallback, not a bug a query change can fix.
//
// Separately, LINE_CANDIDATE_SQL's `min(last_seen_at)` fallback had no
// explicit tiebreaker, even though startAttempt's own serve-time exposure
// upsert (A6) stamps every question served in one attempt with the *same*
// last_seen_at — meaning once a pool is exhausted, many candidates tie
// exactly, leaving their relative order to Postgres's unspecified
// (contractually not random, not guaranteed stable either) tie-breaking
// instead of this query's own seed. A live reproduction attempt against
// this Postgres build/plan did not actually observe that manifest as
// repeated identical draws — but relying on incidental physical/plan
// ordering for something the exposure design explicitly wants
// seed-randomized is a real latent risk regardless of whether it's visibly
// misbehaving today. Hardened with an explicit seed-keyed md5 tiebreaker;
// this test is the permanent guard that two independently-seeded draws
// over a fully-tied pool keep rotating rather than silently regressing to
// deterministic physical order if a future Postgres version, plan shape,
// or statistics change ever makes that latent risk real.
const hasDb = Boolean(process.env.DATABASE_URL);

test(
  "repeat-pool rotation: once every candidate ties on the same last_seen_at, different seeds still draw different subsets",
  { skip: hasDb ? false : "DATABASE_URL not set — this integration test needs a live assess/catalog/content database" },
  async (t) => {
    const { pool } = await import("../../../shared/pool.js");
    const { createPracticeTest } = await import("../definition/create-practice-test.js");
    const { startAttempt, submitAttempt } = await import("../attempt/attempt-flow.js");
    const { getAttemptEnvelope } = await import("../attempt/envelope.js");

    try {
      const examRes = await pool.query<{ exam_id: string; exam_code: string }>(`select exam_id, exam_code from catalog.exam where is_active = true limit 1`);
      if (examRes.rowCount === 0) throw new Error("no active catalog.exam row — needed for this integration test");
      const { exam_id: examId, exam_code: examCode } = examRes.rows[0];

      // The smallest real published-question pool under a single syllabus
      // node — deliberately, not an arbitrarily-picked one, so "fully
      // saturate it in one attempt" stays cheap regardless of which unit
      // this happens to land on in a given environment.
      const nodeRes = await pool.query<{ node_id: string; subject_id: string; n: string }>(
        `select sn.node_id, sn.subject_id, count(distinct q.question_id) as n
           from content.question q
           join content.question_node_map qnm on qnm.question_id = q.question_id
           join catalog.syllabus_node sn on sn.node_id = qnm.node_id
          where q.lifecycle_status = 'published'
          group by sn.node_id, sn.subject_id
          having count(distinct q.question_id) between 5 and 60
          order by n asc
          limit 1`
      );
      if (nodeRes.rowCount === 0) throw new Error("no syllabus_node with a small (5-60 question) published pool found — needed for this test");
      const { node_id: nodeId, subject_id: subjectId, n } = nodeRes.rows[0];
      const poolSize = Number(n);

      // Same "any row is safe, files never run concurrently" reasoning
      // assemble.test.ts's own comment documents — a different offset here
      // only to keep this file's account bookkeeping independent to read.
      const userRes = await pool.query<{ user_id: string }>(`select user_id from core.app_user order by user_id asc offset 4 limit 1`);
      if (userRes.rowCount === 0) throw new Error("no core.app_user row at the expected offset — needed to own the test attempts this creates");
      const userId = userRes.rows[0].user_id;
      await pool.query(`update assess.attempt set attempt_state = 'abandoned' where user_id = $1 and attempt_state in ('in_progress', 'paused')`, [userId]);
      // A clean exposure ledger for this node's questions — this test's own
      // premise (a freshly, fully saturated pool) requires starting from
      // zero prior exposure, not whatever this shared dev DB already has.
      await pool.query(
        `delete from assess.user_question_seen where user_id = $1 and question_id in (
           select question_id from content.question_node_map where node_id = $2
         )`,
        [userId, nodeId]
      );

      async function drawFromSavedNode(pickCount: number, scopeCode: string) {
        const created = await createPracticeTest({
          examId,
          examCode,
          testType: "UNIT",
          scopeCode,
          title: `repeat-rotation test (${scopeCode})`,
          durationMinutes: 30,
          createdBy: userId,
          lines: [{ subjectId, syllabusNodeId: nodeId, includeDescendants: false, pickCount, sectionName: "SEC" }],
        });
        await pool.query(`update assess.test set test_status = 'published' where test_id = $1`, [created.testId]);
        const attempt = await startAttempt(created.testId, userId);
        const envelope = await getAttemptEnvelope(attempt.attemptId, userId);
        await submitAttempt(attempt.attemptId, userId);
        return envelope.questions.map((q) => q.questionId);
      }

      // Serve the ENTIRE pool in one attempt — every question this node has
      // gets the exact same last_seen_at, stamped by startAttempt's own
      // serve-time upsert in one batched query. This is the real, live
      // trigger condition for the bug, not a synthetic approximation of it.
      await t.test("saturate the whole pool in one attempt", async () => {
        const ids = await drawFromSavedNode(poolSize, "SAT");
        assert.equal(ids.length, poolSize, "did not serve the full pool in the saturating attempt");
      });

      await t.test("two further draws, different seeds, over the now-fully-tied pool, return different subsets", async () => {
        const drawSize = Math.max(3, Math.floor(poolSize / 3));
        const drawA = await drawFromSavedNode(drawSize, "ROTA");
        const drawB = await drawFromSavedNode(drawSize, "ROTB");
        const identical = drawA.length === drawB.length && drawA.every((id, i) => id === drawB[i]);
        assert.equal(
          identical,
          false,
          "two independent draws over a fully-tied (same last_seen_at) pool returned the identical subset in the identical order — the tiebreaker fix did not take effect"
        );
      });
    } finally {
      await pool.end();
    }
  }
);
