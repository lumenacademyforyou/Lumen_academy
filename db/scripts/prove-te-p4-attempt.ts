/**
 * TE-P4 stop-gate proof (LA-BE-ENGINE-001 Section 6). Runs the full attempt
 * lifecycle against the live database using the real 20-question FIXED test
 * from db/scripts/seed/03_assess_fixture.ts: start (with idempotency
 * replay), fetch the envelope (asserting no answer-key field appears
 * anywhere in it — R-9), answer a known mix of correct/incorrect/
 * unattempted questions, pause, resume, submit (idempotent on repeat, both
 * with and without the original idempotency key), and check the D-2 seen
 * ledger updated.
 *
 * Usage: npx tsx db/scripts/prove-te-p4-attempt.ts
 */
import { pool } from "../shared/pool.js";
import { startAttempt, upsertResponse, submitAttempt } from "../assess/test/attempt/attempt-flow.js";
import { getAttemptEnvelope } from "../assess/test/attempt/envelope.js";
import * as attemptFlow from "../assess/test/attempt/attempt-flow.js";

// Checked as JSON *keys* ("isCorrect":), not bare substrings — a question's
// own legitimate stem text can contain a word like "solution" (this fixture
// has one: "Which of the following solutions will have the highest boiling
// point elevation...", a real chemistry question) without that being an
// answer-key leak. A false positive there would be worse than useless — it
// would train future runs of this proof to ignore real hits.
const FORBIDDEN_KEYS = ["isCorrect\":", "is_correct\":", "correctOptionIds\":", "correctNumericValue\":", "solutionText\":", "explanation\":", "answerTolerance\":"];

async function main() {
  const testRes = await pool.query<{ test_id: string }>(`select test_id from assess.test where test_code = 'NEET_E2E_FIXTURE'`);
  if (testRes.rowCount === 0) throw new Error("NEET_E2E_FIXTURE not found — run db/scripts/seed/03_assess_fixture.ts first");
  const testId = testRes.rows[0].test_id;
  const studentRes = await pool.query<{ user_id: string }>(`select user_id from core.app_user where email = 'student@lumen.internal'`);
  const studentId = studentRes.rows[0].user_id;

  console.log("=== Part 1: startAttempt (idempotent) ===");
  const startKey = `te-p4-proof-start-${Date.now()}`;
  const start1 = await startAttempt(testId, studentId, startKey);
  console.log(`start 1: attemptId=${start1.attemptId}, attemptNo=${start1.attemptNo}, idempotent=${start1.idempotent}`);
  const start2 = await startAttempt(testId, studentId, startKey);
  console.log(`start 2 (same key): attemptId=${start2.attemptId}, idempotent=${start2.idempotent}`);
  console.log(`same attempt both times: ${start1.attemptId === start2.attemptId ? "PASS" : "FAIL"}`);
  const attemptId = start1.attemptId;

  console.log("\n=== Part 2: getAttemptEnvelope (R-9 answer-key exclusion) ===");
  const envelope = await getAttemptEnvelope(attemptId, studentId);
  const envelopeJson = JSON.stringify(envelope);
  const leaked = FORBIDDEN_KEYS.filter((k) => envelopeJson.includes(k));
  console.log(`questions served: ${envelope.questions.length}, sections: ${envelope.sections.length}`);
  console.log(`no answer-key field in envelope: ${leaked.length === 0 ? "PASS" : `FAIL (found: ${leaked.join(", ")})`}`);

  console.log("\n=== Part 3: answer a known mix, hand-computing the expected total ===");
  const correctByQuestion = await pool.query<{ question_id: string; option_id: string }>(
    `select question_id, option_id from content.question_option where question_id = any($1::uuid[]) and is_correct = true`,
    [envelope.questions.map((q) => q.questionId)]
  );
  const correctOptionByQuestion = new Map(correctByQuestion.rows.map((r) => [r.question_id, r.option_id]));

  let expectedTotal = 0;
  const plan: { questionId: string; give: "correct" | "wrong" | "skip" }[] = envelope.questions.map((q, i) => ({
    questionId: q.questionId,
    give: i % 3 === 0 ? "correct" : i % 3 === 1 ? "wrong" : "skip",
  }));
  for (let i = 0; i < plan.length; i++) {
    const q = envelope.questions[i];
    const marks = Number(q.marks);
    const negMarks = Number(q.negativeMarks);
    if (plan[i].give === "correct") {
      expectedTotal += marks;
      await upsertResponse(attemptId, q.questionId, studentId, { optionId: correctOptionByQuestion.get(q.questionId) });
    } else if (plan[i].give === "wrong") {
      expectedTotal += negMarks;
      const wrongOption = q.options.find((o) => o.optionId !== correctOptionByQuestion.get(q.questionId));
      await upsertResponse(attemptId, q.questionId, studentId, { optionId: wrongOption?.optionId });
    }
    // "skip" — leave unattempted, unattemptedMarks assumed 0 per the seeded NEET_STANDARD scheme
  }
  console.log(`answered ${plan.filter((p) => p.give !== "skip").length}/${plan.length}, expected hand-computed total: ${expectedTotal}`);

  console.log("\n=== Part 4: pause / resume ===");
  await attemptFlow.pauseAttempt(attemptId, studentId);
  const pausedEnvelope = await getAttemptEnvelope(attemptId, studentId);
  console.log(`status after pause: ${pausedEnvelope.status}`);
  await new Promise((r) => setTimeout(r, 1100));
  await attemptFlow.resumeAttempt(attemptId, studentId);
  const resumedEnvelope = await getAttemptEnvelope(attemptId, studentId);
  console.log(`status after resume: ${resumedEnvelope.status}`);
  console.log(`pause/resume cycle: ${pausedEnvelope.status === "paused" && resumedEnvelope.status === "in_progress" ? "PASS" : "FAIL"}`);

  console.log("\n=== Part 5: submit, idempotent resubmit (with and without the key) ===");
  const submitKey = `te-p4-proof-submit-${Date.now()}`;
  const result1 = await submitAttempt(attemptId, studentId, submitKey);
  console.log(`submit 1: obtained=${result1.obtainedMarks}/${result1.totalMarks}, correct=${result1.correctCount}, incorrect=${result1.incorrectCount}, unattempted=${result1.unattemptedCount}, idempotent=${result1.idempotent}`);
  console.log(`matches hand-computed total: ${Number(result1.obtainedMarks) === expectedTotal ? "PASS" : `FAIL (got ${result1.obtainedMarks}, expected ${expectedTotal})`}`);

  const result2 = await submitAttempt(attemptId, studentId, submitKey);
  console.log(`submit 2 (same key): obtained=${result2.obtainedMarks}, idempotent=${result2.idempotent}`);
  console.log(`same result via key replay: ${result2.idempotent && result2.obtainedMarks === result1.obtainedMarks ? "PASS" : "FAIL"}`);

  const result3 = await submitAttempt(attemptId, studentId); // no key — state-based idempotency (D-7)
  console.log(`submit 3 (no key, already-scored state): obtained=${result3.obtainedMarks}, idempotent=${result3.idempotent}`);
  console.log(`state-based idempotency (no key needed): ${result3.idempotent && result3.obtainedMarks === result1.obtainedMarks ? "PASS" : "FAIL"}`);

  console.log("\n=== Part 6: D-2 seen-ledger updated ===");
  const seenRes = await pool.query<{ n: string }>(
    `select count(*) as n from assess.user_question_seen where user_id = $1 and question_id = any($2::uuid[])`,
    [studentId, envelope.questions.map((q) => q.questionId)]
  );
  console.log(`seen-ledger rows for this attempt's ${envelope.questions.length} questions: ${seenRes.rows[0].n}`);
  console.log(`seen ledger fully updated: ${Number(seenRes.rows[0].n) === envelope.questions.length ? "PASS" : "FAIL"}`);

  await pool.end();
}

main().catch((err) => {
  console.error("prove-te-p4-attempt failed:", err);
  process.exitCode = 1;
});
