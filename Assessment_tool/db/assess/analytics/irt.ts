import { pool } from "../../shared/pool.js";
import { calibrateRasch, estimateThetaAgainstCalibration, type Response01 } from "./irt-model.js";
import { NotFoundError, ReviewNotAvailableError } from "../../shared/errors.js";

/**
 * P1-7 (docs/assessment-tool-fix-prompt.md) — real IRT (Rasch/1PL) analysis,
 * calibrated from actual response data (see irt-model.ts's header for the
 * algorithm). This file is the DB-facing half: pulling the response matrix,
 * deciding whether there's enough data to trust an estimate, and shaping
 * the result for the report/dashboard UI.
 *
 * Deliberately population-wide, not per-test: Rasch item difficulty is only
 * meaningful when calibrated against everyone who has ever answered that
 * item, across every test it's ever been served in — scoping calibration to
 * one test's attempts alone would starve it of data and make estimates
 * swing wildly between reports.
 */

// Below these, an estimate is either mathematically unstable (too few points
// to constrain the joint likelihood) or not meaningfully population-level —
// the caller gets an explicit "not enough data yet" instead of a number that
// looks precise but isn't. Deliberately low (this app's real data volume is
// small — see docs/ASSESSMENT_FIX_TRACKER.md's P1-6 seeding notes) rather
// than a textbook-scale threshold that would never fire in practice here.
const MIN_ITEMS_FOR_CALIBRATION = 8;
const MIN_PERSONS_FOR_CALIBRATION = 4;
const MIN_ITEMS_FOR_ATTEMPT_ESTIMATE = 5;
// The real gate, not the two counts above (which only catch the most
// obviously-empty case): with response data this sparse, most items are
// each answered by only a handful of people and the response graph stays
// weakly connected — JMLE still "converges" but to an arbitrary, wildly
// unstable placement (seen live: theta ~3 with standard error ~400+ against
// this app's actual current data volume). Standard error is the honest
// signal for that, not item/person counts — an estimate this uncertain is
// indistinguishable from noise and must not be shown as a number. 2.0
// logits is a conventional "still informative" ceiling for a 1PL ability
// estimate; this app's real data will likely need much more volume before
// routinely clearing it, which is the correct, non-misleading behavior.
const MAX_TRUSTED_STANDARD_ERROR = 2.0;

export interface ItemCharacteristic {
  questionId: string;
  difficulty: number;
  correct: boolean;
}

export interface AbilityTrendPoint {
  attemptId: string;
  submittedAt: string;
  theta: number;
  standardError: number;
}

/** Plain-language band, not raw jargon — the report UI still shows theta, but this is what drives copy like "above average". */
export type IrtBand = "well above average" | "above average" | "average" | "below average" | "well below average";

export type IrtReport =
  | { available: false; reason: string }
  | {
      available: true;
      theta: number;
      standardError: number;
      itemsUsed: number;
      band: IrtBand;
      itemCharacteristics: ItemCharacteristic[];
      abilityTrend: AbilityTrendPoint[];
      calibration: { itemCount: number; personCount: number };
    };

function bandFor(theta: number): IrtBand {
  if (theta >= 1.5) return "well above average";
  if (theta >= 0.5) return "above average";
  if (theta > -0.5) return "average";
  if (theta > -1.5) return "below average";
  return "well below average";
}

interface ResponseRow {
  attempt_id: string;
  question_id: string;
  is_correct: boolean;
}

async function loadAllScoredResponses(): Promise<ResponseRow[]> {
  const res = await pool.query<ResponseRow>(
    `select ar.attempt_id, ar.question_id, ar.is_correct
       from assess.attempt_response ar
       join assess.attempt a on a.attempt_id = ar.attempt_id
      where a.attempt_state = 'scored' and ar.is_correct is not null`
  );
  return res.rows;
}

async function loadResponsesForAttempt(attemptId: string): Promise<{ questionId: string; correct: boolean }[]> {
  const res = await pool.query<{ question_id: string; is_correct: boolean }>(
    `select question_id, is_correct from assess.attempt_response where attempt_id = $1 and is_correct is not null`,
    [attemptId]
  );
  return res.rows.map((r) => ({ questionId: r.question_id, correct: r.is_correct }));
}

/**
 * @throws {NotFoundError} attemptId doesn't exist or isn't owned by userId (same not-found-not-403 discipline as everywhere else — see backend/lib/dbCrudRouter.ts's header)
 * @throws {ReviewNotAvailableError} the attempt hasn't been scored yet — same precondition getReview enforces
 */
export async function getIrtReportForAttempt(userId: string, attemptId: string): Promise<IrtReport> {
  const ownershipRes = await pool.query<{ attempt_state: string; user_id: string }>(
    `select attempt_state, user_id from assess.attempt where attempt_id = $1`,
    [attemptId]
  );
  if (ownershipRes.rowCount === 0 || ownershipRes.rows[0].user_id !== userId) {
    throw new NotFoundError("assess.attempt", attemptId);
  }
  if (ownershipRes.rows[0].attempt_state !== "scored") {
    throw new ReviewNotAvailableError(attemptId, ownershipRes.rows[0].attempt_state);
  }

  const allResponses = await loadAllScoredResponses();
  const distinctItems = new Set(allResponses.map((r) => r.question_id));
  const distinctPersons = new Set(allResponses.map((r) => r.attempt_id));

  if (distinctItems.size < MIN_ITEMS_FOR_CALIBRATION || distinctPersons.size < MIN_PERSONS_FOR_CALIBRATION) {
    return {
      available: false,
      reason: `Not enough attempts across the platform yet to calibrate a reliable ability estimate (have ${distinctPersons.size} scored attempt(s) covering ${distinctItems.size} question(s); need at least ${MIN_PERSONS_FOR_CALIBRATION} attempts and ${MIN_ITEMS_FOR_CALIBRATION} questions).`,
    };
  }

  const asResponses01: Response01[] = allResponses.map((r) => ({ itemId: r.question_id, personId: r.attempt_id, correct: r.is_correct }));
  const { itemDifficulty } = calibrateRasch(asResponses01);

  const targetResponses = await loadResponsesForAttempt(attemptId);
  if (targetResponses.length < MIN_ITEMS_FOR_ATTEMPT_ESTIMATE) {
    return {
      available: false,
      reason: `This attempt only answered ${targetResponses.length} question(s) — need at least ${MIN_ITEMS_FOR_ATTEMPT_ESTIMATE} to estimate ability reliably.`,
    };
  }

  const estimate = estimateThetaAgainstCalibration(
    targetResponses.map((r) => ({ itemId: r.questionId, correct: r.correct })),
    itemDifficulty
  );
  if (!estimate) {
    return { available: false, reason: "None of this attempt's questions overlap the platform's calibrated question pool yet." };
  }
  if (estimate.standardError > MAX_TRUSTED_STANDARD_ERROR) {
    return {
      available: false,
      reason:
        "There isn't enough overlapping response data across attempts yet to place this attempt's ability reliably — as more students answer the same questions, this becomes more precise.",
    };
  }

  const itemCharacteristics: ItemCharacteristic[] = targetResponses
    .filter((r) => itemDifficulty.has(r.questionId))
    .map((r) => ({ questionId: r.questionId, difficulty: itemDifficulty.get(r.questionId)!, correct: r.correct }));

  // Ability trend: same calibrated (population-fixed) item difficulties,
  // re-estimating theta per one of this user's own past scored attempts —
  // one calibration, many placements, not a re-run of the whole joint
  // estimation per historical attempt.
  //
  // P2-13 (docs/assessment-tool-fix-prompt.md's N+1 audit): this used to
  // issue one extra loadResponsesForAttempt query per past attempt inside
  // the loop below — a real N+1 against this exact "results/report
  // endpoint" the item calls out. allResponses (already fetched, above, for
  // calibration) already contains every one of this user's own scored
  // responses too — group it once instead of re-querying per attempt.
  const userAttemptsRes = await pool.query<{ attempt_id: string; submitted_at: string }>(
    `select attempt_id, submitted_at from assess.attempt where user_id = $1 and attempt_state = 'scored' and submitted_at is not null order by submitted_at asc`,
    [userId]
  );
  const responsesByAttempt = new Map<string, { questionId: string; correct: boolean }[]>();
  for (const r of allResponses) {
    const list = responsesByAttempt.get(r.attempt_id) ?? [];
    list.push({ questionId: r.question_id, correct: r.is_correct });
    responsesByAttempt.set(r.attempt_id, list);
  }

  const abilityTrend: AbilityTrendPoint[] = [];
  for (const row of userAttemptsRes.rows) {
    const responses = row.attempt_id === attemptId ? targetResponses.map((r) => ({ questionId: r.questionId, correct: r.correct })) : (responsesByAttempt.get(row.attempt_id) ?? []);
    if (responses.length < MIN_ITEMS_FOR_ATTEMPT_ESTIMATE) continue;
    const pointEstimate = estimateThetaAgainstCalibration(
      responses.map((r) => ({ itemId: r.questionId, correct: r.correct })),
      itemDifficulty
    );
    if (pointEstimate && pointEstimate.standardError <= MAX_TRUSTED_STANDARD_ERROR) {
      abilityTrend.push({ attemptId: row.attempt_id, submittedAt: row.submitted_at, theta: pointEstimate.theta, standardError: pointEstimate.standardError });
    }
  }

  return {
    available: true,
    theta: estimate.theta,
    standardError: estimate.standardError,
    itemsUsed: estimate.itemsUsed,
    band: bandFor(estimate.theta),
    itemCharacteristics,
    abilityTrend,
    calibration: { itemCount: distinctItems.size, personCount: distinctPersons.size },
  };
}
