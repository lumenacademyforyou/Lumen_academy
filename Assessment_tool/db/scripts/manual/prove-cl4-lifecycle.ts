import { pool } from "../../shared/pool.js";
import { submitForReview, decideReview, publishQuestion, retireQuestion, listReviewHistory } from "../../content/lifecycle.js";

// CL-4 proof (LA-PLAN-002 Day 2) — walks a real live question (one of the
// 120 just live-imported by CL-2) through the full state machine using a
// real fixture educator account, then proves the machine rejects an
// out-of-order transition. RBAC (who is allowed to call which function) is
// deliberately not part of this proof — that's requirePermission at the
// HTTP layer (CL-5), not this module's job (see lifecycle.ts's own header).

async function main() {
  const qRes = await pool.query<{ question_id: string; question_uid: string }>(
    `select question_id, question_uid from content.question where lifecycle_status = 'draft' order by question_id limit 1`
  );
  if (qRes.rowCount === 0) throw new Error("no live draft question to test against");
  const { question_id: questionId, question_uid: questionUid } = qRes.rows[0];

  const educatorRes = await pool.query<{ user_id: string }>(`select user_id from core.app_user where email = 'educator@lumen.internal'`);
  if (educatorRes.rowCount === 0) throw new Error("fixture educator@lumen.internal not found");
  const actorId = educatorRes.rows[0].user_id;

  console.log(`using real live question ${questionUid} (${questionId}), actor ${actorId}`);

  const submitted = await submitForReview(questionId, actorId, "ready for review");
  if (submitted.lifecycleStatus !== "in_review") throw new Error("submitForReview did not reach in_review");
  console.log(`Part 1 PASS — draft -> in_review (review row ${submitted.reviewId})`);

  let rejectedDoubleSubmit = false;
  try {
    await submitForReview(questionId, actorId);
  } catch (err) {
    rejectedDoubleSubmit = (err as Error).name === "InvalidStateTransitionError";
  }
  if (!rejectedDoubleSubmit) throw new Error("submitForReview did not reject an already-in_review question");
  console.log("Part 2 PASS — a second submitForReview on the same question is rejected with InvalidStateTransitionError.");

  const approved = await decideReview(questionId, actorId, "approve", "looks correct");
  if (approved.lifecycleStatus !== "approved") throw new Error("decideReview(approve) did not reach approved");
  console.log(`Part 3 PASS — in_review -> approved (review row ${approved.reviewId})`);

  let rejectedPublishFromWrongState = false;
  const q2 = await pool.query<{ question_id: string }>(`select question_id from content.question where lifecycle_status = 'draft' and question_id != $1 limit 1`, [questionId]);
  if (q2.rowCount && q2.rowCount > 0) {
    try {
      await publishQuestion(q2.rows[0].question_id, actorId);
    } catch (err) {
      rejectedPublishFromWrongState = (err as Error).name === "InvalidStateTransitionError";
    }
    if (!rejectedPublishFromWrongState) throw new Error("publishQuestion did not reject a draft (non-approved) question");
    console.log("Part 4 PASS — publishQuestion on a draft (non-approved) question is rejected with InvalidStateTransitionError.");
  }

  const published = await publishQuestion(questionId, actorId, "published for pilot");
  if (published.lifecycleStatus !== "published") throw new Error("publishQuestion did not reach published");
  console.log(`Part 5 PASS — approved -> published (review row ${published.reviewId})`);

  const retired = await retireQuestion(questionId, actorId, "superseded proof run");
  if (retired.lifecycleStatus !== "retired") throw new Error("retireQuestion did not reach retired");
  console.log(`Part 6 PASS — published -> retired (review row ${retired.reviewId})`);

  const history = await listReviewHistory(questionId);
  const verdicts = history.map((h) => h.verdict);
  console.log(`Part 7 — review history: ${verdicts.join(" -> ")}`);
  if (verdicts.join(",") !== "submitted,approved,published,retired") {
    throw new Error(`unexpected review history order: ${verdicts.join(",")}`);
  }
  console.log("Part 7 PASS — full review trail persisted in order: submitted, approved, published, retired.");

  console.log("\nCL-4 PASS — full lifecycle state machine proven against a real live question.");
  await pool.end();
}

main().catch((err) => {
  console.error("CL-4 proof failed:", err);
  process.exitCode = 1;
});
