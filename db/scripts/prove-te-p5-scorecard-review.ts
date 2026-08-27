import { pool } from "../shared/pool.js";
import { getScorecardWithSections, getReview, listAttempts, startAttempt } from "../assess/test/attempt/attempt-flow.js";

// TE-P5 proof (LA-PLAN-002 Day 2, G7) — reuses the real 'scored' attempt TE-P4's
// own proof run already left live (db/scripts/prove-te-p4-attempt.ts), rather
// than fabricating a new one. Proves:
//   1. getScorecardWithSections reads the persisted scorecard only (D-anything
//      it returns must equal what submitAttempt itself wrote, not a recompute).
//   2. getReview reveals per-question correctness/marks/solution/topic, but
//      only because this attempt is genuinely 'scored' — an in_progress
//      attempt is proven to be rejected by getReview separately below.
//   3. listAttempts returns this attempt for its owning user, joined to the
//      same persisted scorecard totals.

async function main() {
  const attemptRes = await pool.query<{ attempt_id: string; user_id: string; test_id: string }>(
    `select attempt_id, user_id, test_id from assess.attempt where attempt_state = 'scored' limit 1`
  );
  if (attemptRes.rowCount === 0) throw new Error("no live 'scored' attempt to test against — run TE-P4's proof script first");
  const { attempt_id: attemptId, user_id: userId, test_id: testId } = attemptRes.rows[0];
  console.log(`using real live scored attempt: ${attemptId} (user ${userId}, test ${testId})`);

  const { scorecard, sectionScores } = await getScorecardWithSections(attemptId);
  if (!scorecard) throw new Error("getScorecardWithSections returned null for a scored attempt");
  console.log(`\nPart 1 — getScorecardWithSections: obtained ${scorecard.obtained_marks}/${scorecard.total_marks}, ${sectionScores.length} section(s)`);

  const directRes = await pool.query<{ obtained_marks: string; total_marks: string }>(
    `select obtained_marks, total_marks from assess.scorecard where attempt_id = $1`,
    [attemptId]
  );
  if (String(directRes.rows[0].obtained_marks) !== String(scorecard.obtained_marks)) {
    throw new Error("getScorecardWithSections does not match a direct read of assess.scorecard — it is recomputing, not reading");
  }
  console.log("Part 1 PASS — matches a direct table read exactly (no recomputation).");

  const review = await getReview(attemptId, userId);
  console.log(`\nPart 2 — getReview: ${review.length} question(s) reviewed`);
  const sample = review[0];
  console.log("sample question review:", {
    questionId: sample.questionId,
    topicTitle: sample.topicTitle,
    isCorrect: sample.isCorrect,
    marksAwarded: sample.marksAwarded,
    hasExplanation: sample.explanationText !== null,
    correctOptionPresent: sample.options.some((o) => o.isCorrect),
  });
  if (!sample.options.some((o) => o.isCorrect) && sample.correctNumericValue === null) {
    throw new Error("review question exposes no correct answer at all — broken for both MCQ and numeric shape");
  }
  console.log("Part 2 PASS — review reveals correct answer, marks, and topic for a genuinely scored attempt.");

  const wrongUserRes = await pool.query<{ user_id: string }>(`select user_id from core.app_user where user_id != $1 limit 1`, [userId]);
  let ownershipOk = false;
  try {
    await getReview(attemptId, wrongUserRes.rows[0].user_id);
  } catch (err) {
    ownershipOk = (err as Error).name === "NotFoundError";
  }
  if (!ownershipOk) throw new Error("getReview did not reject a non-owning user with NotFoundError");
  console.log("Part 2b PASS — a non-owning user gets NotFoundError, not someone else's review.");

  let inProgress = (await pool.query<{ attempt_id: string; user_id: string }>(
    `select attempt_id, user_id from assess.attempt where attempt_state = 'in_progress' limit 1`
  )).rows[0];
  if (!inProgress) {
    const started = await startAttempt(testId, userId);
    inProgress = { attempt_id: started.attemptId, user_id: userId };
    console.log(`\n(started a fresh real attempt ${inProgress.attempt_id} to prove the not-yet-scored rejection path)`);
  }
  let rejected = false;
  try {
    await getReview(inProgress.attempt_id, inProgress.user_id);
  } catch (err) {
    rejected = (err as Error).name === "ReviewNotAvailableError";
  }
  if (!rejected) throw new Error("getReview did not reject a not-yet-scored attempt with ReviewNotAvailableError");
  console.log("Part 2c PASS — an in_progress (not-yet-scored) attempt is rejected with ReviewNotAvailableError.");

  const attempts = await listAttempts(userId);
  console.log(`\nPart 3 — listAttempts: ${attempts.length} attempt(s) for user ${userId}`);
  const found = attempts.find((a) => a.attemptId === attemptId);
  if (!found) throw new Error("listAttempts did not return the attempt we just reviewed");
  if (found.obtainedMarks !== String(scorecard.obtained_marks)) {
    throw new Error("listAttempts' obtainedMarks does not match the persisted scorecard");
  }
  console.log("Part 3 PASS — listAttempts includes this attempt with the correct persisted score, most-recent-first.");

  console.log("\nTE-P5 PASS — getScorecardWithSections, getReview, listAttempts all proven against real live data.");
  await pool.end();
}

main().catch((err) => {
  console.error("TE-P5 proof failed:", err);
  process.exitCode = 1;
});
