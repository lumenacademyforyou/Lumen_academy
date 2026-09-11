import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateResponse } from "./evaluate.js";
import type { ScoringRule, ServedQuestion, StudentResponse } from "./types.js";

function singleChoiceRule(overrides: Partial<ScoringRule> = {}): ScoringRule {
  return {
    ruleId: "rule_single",
    questionFormat: "MCQ_SINGLE",
    correctMarks: "4",
    incorrectMarks: "-1",
    unattemptedMarks: "0",
    partialMode: "NONE",
    numericToleranceAbs: null,
    numericToleranceRelPct: null,
    voidDisposition: "EXCLUDED",
    ...overrides,
  };
}

function singleChoiceQuestion(overrides: Partial<ServedQuestion> = {}): ServedQuestion {
  return {
    questionId: "q1",
    format: "MCQ_SINGLE",
    ruleId: "rule_single",
    isVoided: false,
    correctOptionIds: ["opt_a"],
    correctNumericValue: null,
    optionIds: ["opt_a", "opt_b", "opt_c", "opt_d"],
    ...overrides,
  };
}

function answered(overrides: Partial<StudentResponse> = {}): StudentResponse {
  return {
    questionId: "q1",
    selectedOptionIds: [],
    numericValue: null,
    isMarkedForReview: false,
    answeredAt: "2026-08-25T09:00:00.000Z",
    ...overrides,
  };
}

test("MCQ_SINGLE: correct selection awards correctMarks", () => {
  const result = evaluateResponse(singleChoiceQuestion(), answered({ selectedOptionIds: ["opt_a"] }), singleChoiceRule());
  assert.deepEqual(result, { questionId: "q1", outcome: "CORRECT", marksAwarded: "4", ruleId: "rule_single" });
});

test("MCQ_SINGLE: incorrect selection awards incorrectMarks", () => {
  const result = evaluateResponse(singleChoiceQuestion(), answered({ selectedOptionIds: ["opt_b"] }), singleChoiceRule());
  assert.deepEqual(result, { questionId: "q1", outcome: "INCORRECT", marksAwarded: "-1", ruleId: "rule_single" });
});

test("unattempted question under a penalising rule awards the (possibly zero) unattemptedMarks, never incorrectMarks", () => {
  const result = evaluateResponse(singleChoiceQuestion(), undefined, singleChoiceRule({ unattemptedMarks: "0" }));
  assert.equal(result.outcome, "UNATTEMPTED");
  assert.equal(result.marksAwarded, "0");
});

test("unattempted question under a no-penalise-but-credit rule still awards unattemptedMarks exactly, not correctMarks", () => {
  // Some real schemes give a small non-zero unattempted allowance distinct
  // from both correct and incorrect marks — the engine must not special-case.
  const result = evaluateResponse(singleChoiceQuestion(), undefined, singleChoiceRule({ unattemptedMarks: "1" }));
  assert.equal(result.outcome, "UNATTEMPTED");
  assert.equal(result.marksAwarded, "1");
});

test("an explicitly-served response with answeredAt null is also UNATTEMPTED, not INCORRECT", () => {
  const result = evaluateResponse(
    singleChoiceQuestion(),
    { questionId: "q1", selectedOptionIds: [], numericValue: null, isMarkedForReview: true, answeredAt: null },
    singleChoiceRule()
  );
  assert.equal(result.outcome, "UNATTEMPTED");
});

function numericRule(overrides: Partial<ScoringRule> = {}): ScoringRule {
  return singleChoiceRule({ questionFormat: "NUMERICAL", ruleId: "rule_numeric", ...overrides });
}
function numericQuestion(overrides: Partial<ServedQuestion> = {}): ServedQuestion {
  return singleChoiceQuestion({ format: "NUMERICAL", ruleId: "rule_numeric", correctOptionIds: [], correctNumericValue: "9.8", ...overrides });
}

test("NUMERICAL: value exactly on the absolute-tolerance boundary (below) is CORRECT", () => {
  const rule = numericRule({ numericToleranceAbs: "0.2" });
  const result = evaluateResponse(numericQuestion(), answered({ numericValue: "9.6" }), rule); // diff = 0.2, boundary itself
  assert.equal(result.outcome, "CORRECT");
});

test("NUMERICAL: value exactly on the absolute-tolerance boundary (above) is CORRECT", () => {
  const rule = numericRule({ numericToleranceAbs: "0.2" });
  const result = evaluateResponse(numericQuestion(), answered({ numericValue: "10.0" }), rule); // diff = 0.2, boundary itself
  assert.equal(result.outcome, "CORRECT");
});

test("NUMERICAL: value just past the absolute-tolerance boundary is INCORRECT", () => {
  const rule = numericRule({ numericToleranceAbs: "0.2" });
  const result = evaluateResponse(numericQuestion(), answered({ numericValue: "10.01" }), rule);
  assert.equal(result.outcome, "INCORRECT");
});

test("NUMERICAL: relative-percent tolerance is honoured when no absolute tolerance is set", () => {
  const rule = numericRule({ numericToleranceRelPct: "5" }); // 5% of 9.8 = 0.49
  assert.equal(evaluateResponse(numericQuestion(), answered({ numericValue: "10.29" }), rule).outcome, "CORRECT");
  assert.equal(evaluateResponse(numericQuestion(), answered({ numericValue: "10.30" }), rule).outcome, "INCORRECT");
});

test("NUMERICAL: no tolerance configured requires an exact match", () => {
  const rule = numericRule();
  assert.equal(evaluateResponse(numericQuestion(), answered({ numericValue: "9.8" }), rule).outcome, "CORRECT");
  assert.equal(evaluateResponse(numericQuestion(), answered({ numericValue: "9.80001" }), rule).outcome, "INCORRECT");
});

test("NUMERICAL: an answered-but-blank numeric value is UNATTEMPTED, not INCORRECT", () => {
  const result = evaluateResponse(numericQuestion(), answered({ numericValue: null }), numericRule());
  assert.equal(result.outcome, "UNATTEMPTED");
});

test("a voided question with FULL_CREDIT disposition awards full marks regardless of the response", () => {
  const question = singleChoiceQuestion({ isVoided: true });
  const rule = singleChoiceRule({ voidDisposition: "FULL_CREDIT" });
  const result = evaluateResponse(question, answered({ selectedOptionIds: ["opt_b"] }), rule);
  assert.deepEqual(result, { questionId: "q1", outcome: "VOID", marksAwarded: "4", ruleId: "rule_single" });
});

test("a voided question with EXCLUDED disposition awards zero regardless of the response", () => {
  const question = singleChoiceQuestion({ isVoided: true });
  const rule = singleChoiceRule({ voidDisposition: "EXCLUDED" });
  const result = evaluateResponse(question, undefined, rule);
  assert.deepEqual(result, { questionId: "q1", outcome: "VOID", marksAwarded: "0", ruleId: "rule_single" });
});

function multiQuestion(overrides: Partial<ServedQuestion> = {}): ServedQuestion {
  return singleChoiceQuestion({
    format: "MCQ_MULTI",
    ruleId: "rule_multi",
    correctOptionIds: ["opt_a", "opt_b"],
    optionIds: ["opt_a", "opt_b", "opt_c", "opt_d"],
    ...overrides,
  });
}
function multiRule(overrides: Partial<ScoringRule> = {}): ScoringRule {
  return singleChoiceRule({ questionFormat: "MCQ_MULTI", ruleId: "rule_multi", partialMode: "PROPORTIONAL", ...overrides });
}

test("a partial-credit case (MCQ_MULTI, one of two correct options selected, none wrong) is PARTIAL with non-zero marks", () => {
  const result = evaluateResponse(multiQuestion(), answered({ selectedOptionIds: ["opt_a"] }), multiRule());
  assert.equal(result.outcome, "PARTIAL");
  assert.equal(result.marksAwarded, "2"); // 4 * (1/2)
});

test("MCQ_SINGLE: more than one selected option is a caller-invariant violation, thrown loudly rather than guessed at", () => {
  assert.throws(
    () => evaluateResponse(singleChoiceQuestion(), answered({ selectedOptionIds: ["opt_a", "opt_b"] }), singleChoiceRule()),
    /selected options/
  );
});

test("a rule scoped to the wrong question format is rejected rather than silently misapplied", () => {
  const mismatchedRule = singleChoiceRule({ questionFormat: "NUMERICAL" }); // same ruleId, different format
  assert.throws(() => evaluateResponse(singleChoiceQuestion(), answered({ selectedOptionIds: ["opt_a"] }), mismatchedRule), /format/);
});

test("a rule with a different ruleId than the question declares is rejected", () => {
  assert.throws(() => evaluateResponse(singleChoiceQuestion(), answered({ selectedOptionIds: ["opt_a"] }), numericRule()), /ruleId/);
});
