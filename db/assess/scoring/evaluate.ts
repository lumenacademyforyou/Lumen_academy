/**
 * Per-response scoring evaluation (LA-BE-ENGINE-001 TE-P2). Pure function,
 * no database, no HTTP, no clock — every input is explicit.
 */
import * as decimal from "./decimal.js";
import { applyPartialCredit } from "./rules.js";
import type { EvaluatedResponse, ScoringRule, ServedQuestion, StudentResponse } from "./types.js";

function isAnswered(response: StudentResponse | undefined): response is StudentResponse {
  return response !== undefined && response.answeredAt !== null;
}

/**
 * True if `value` matches `target` within the rule's tolerance. If neither
 * tolerance is set, an exact match is required. If both are set, either one
 * matching is sufficient (the more permissive of the two) — the brief's
 * data contract allows both to be non-null simultaneously without stating a
 * combination rule, so this module picks the more permissive reading rather
 * than guessing which one "wins".
 */
function isNumericMatch(value: string, target: string, rule: ScoringRule): boolean {
  const diff = decimal.abs(decimal.subtract(value, target));
  if (rule.numericToleranceAbs === null && rule.numericToleranceRelPct === null) {
    return decimal.compare(diff, "0") === 0;
  }
  if (rule.numericToleranceAbs !== null && decimal.compare(diff, rule.numericToleranceAbs) <= 0) {
    return true;
  }
  if (rule.numericToleranceRelPct !== null) {
    const allowedDiff = decimal.divide(decimal.multiply(decimal.abs(target), rule.numericToleranceRelPct), "100");
    if (decimal.compare(diff, allowedDiff) <= 0) {
      return true;
    }
  }
  return false;
}

export function evaluateResponse(
  question: ServedQuestion,
  response: StudentResponse | undefined,
  rule: ScoringRule
): EvaluatedResponse {
  if (question.ruleId !== rule.ruleId) {
    throw new Error(`evaluateResponse: rule ${rule.ruleId} does not match question ${question.questionId}'s ruleId ${question.ruleId}`);
  }
  if (question.format !== rule.questionFormat) {
    throw new Error(
      `evaluateResponse: rule ${rule.ruleId} is scoped to format ${rule.questionFormat}, but question ${question.questionId} is ${question.format}`
    );
  }

  if (question.isVoided) {
    const marksAwarded = rule.voidDisposition === "FULL_CREDIT" ? rule.correctMarks : "0";
    return { questionId: question.questionId, outcome: "VOID", marksAwarded, ruleId: rule.ruleId };
  }

  if (!isAnswered(response)) {
    return { questionId: question.questionId, outcome: "UNATTEMPTED", marksAwarded: rule.unattemptedMarks, ruleId: rule.ruleId };
  }

  if (question.format === "NUMERICAL") {
    if (response.numericValue === null) {
      return { questionId: question.questionId, outcome: "UNATTEMPTED", marksAwarded: rule.unattemptedMarks, ruleId: rule.ruleId };
    }
    if (question.correctNumericValue === null) {
      throw new Error(`evaluateResponse: NUMERICAL question ${question.questionId} has no correctNumericValue`);
    }
    const isCorrect = isNumericMatch(response.numericValue, question.correctNumericValue, rule);
    return {
      questionId: question.questionId,
      outcome: isCorrect ? "CORRECT" : "INCORRECT",
      marksAwarded: isCorrect ? rule.correctMarks : rule.incorrectMarks,
      ruleId: rule.ruleId,
    };
  }

  if (response.selectedOptionIds.length === 0) {
    return { questionId: question.questionId, outcome: "UNATTEMPTED", marksAwarded: rule.unattemptedMarks, ruleId: rule.ruleId };
  }

  if (question.format === "MCQ_MULTI") {
    return applyPartialCredit(question, response, rule);
  }

  // MCQ_SINGLE / ASSERTION_REASON: exactly one selection is a caller-side
  // invariant (enforced upstream — see RESPONSE_OPTION_MISMATCH in the
  // brief's error catalogue). Surfaced loudly here rather than guessed at,
  // matching this codebase's existing "left ungraded rather than guessed
  // at" convention (db/assess/test/attempt/attempt-flow.ts).
  if (response.selectedOptionIds.length !== 1) {
    throw new Error(
      `evaluateResponse: question ${question.questionId} is ${question.format} but the response has ${response.selectedOptionIds.length} selected options`
    );
  }
  const isCorrect = question.correctOptionIds.includes(response.selectedOptionIds[0]);
  return {
    questionId: question.questionId,
    outcome: isCorrect ? "CORRECT" : "INCORRECT",
    marksAwarded: isCorrect ? rule.correctMarks : rule.incorrectMarks,
    ruleId: rule.ruleId,
  };
}
