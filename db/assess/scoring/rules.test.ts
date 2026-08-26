import assert from "node:assert/strict";
import { test } from "node:test";
import { applyPartialCredit } from "./rules.js";
import type { ScoringRule, ServedQuestion, StudentResponse } from "./types.js";

function question(overrides: Partial<ServedQuestion> = {}): ServedQuestion {
  return {
    questionId: "q1",
    format: "MCQ_MULTI",
    ruleId: "rule_multi",
    isVoided: false,
    correctOptionIds: ["opt_a", "opt_b", "opt_c", "opt_d"], // 4 correct, mirrors the real JEE Advanced case
    correctNumericValue: null,
    optionIds: ["opt_a", "opt_b", "opt_c", "opt_d", "opt_e"],
    ...overrides,
  };
}
function response(selectedOptionIds: string[]): StudentResponse {
  return { questionId: "q1", selectedOptionIds, numericValue: null, isMarkedForReview: false, answeredAt: "2026-08-25T09:00:00.000Z" };
}
function rule(partialMode: ScoringRule["partialMode"], overrides: Partial<ScoringRule> = {}): ScoringRule {
  return {
    ruleId: "rule_multi",
    questionFormat: "MCQ_MULTI",
    correctMarks: "4",
    incorrectMarks: "-2",
    unattemptedMarks: "0",
    partialMode,
    numericToleranceAbs: null,
    numericToleranceRelPct: null,
    voidDisposition: "EXCLUDED",
    ...overrides,
  };
}

test("NONE: all correct options and nothing else is CORRECT", () => {
  const result = applyPartialCredit(question(), response(["opt_a", "opt_b", "opt_c", "opt_d"]), rule("NONE"));
  assert.deepEqual(result.outcome, "CORRECT");
  assert.equal(result.marksAwarded, "4");
});

test("NONE: any subset short of all correct options is INCORRECT, not PARTIAL — this mode has no partial credit", () => {
  const result = applyPartialCredit(question(), response(["opt_a", "opt_b"]), rule("NONE"));
  assert.equal(result.outcome, "INCORRECT");
  assert.equal(result.marksAwarded, "-2");
});

test("JEE_ADV_2019: all four correct options chosen and nothing else is full marks", () => {
  const result = applyPartialCredit(question(), response(["opt_a", "opt_b", "opt_c", "opt_d"]), rule("JEE_ADV_2019"));
  assert.equal(result.outcome, "CORRECT");
  assert.equal(result.marksAwarded, "4");
});

test("JEE_ADV_2019: two of four correct options chosen, no wrong ones, is +1 per correct option (published rule)", () => {
  const result = applyPartialCredit(question(), response(["opt_a", "opt_c"]), rule("JEE_ADV_2019"));
  assert.equal(result.outcome, "PARTIAL");
  assert.equal(result.marksAwarded, "2"); // (4/4) * 2 correct selected = 2
});

test("JEE_ADV_2019: one of four correct options chosen, no wrong ones, is +1", () => {
  const result = applyPartialCredit(question(), response(["opt_a"]), rule("JEE_ADV_2019"));
  assert.equal(result.outcome, "PARTIAL");
  assert.equal(result.marksAwarded, "1");
});

test("JEE_ADV_2019: any incorrect option chosen forfeits partial credit entirely, even alongside correct ones", () => {
  const result = applyPartialCredit(question(), response(["opt_a", "opt_b", "opt_e"]), rule("JEE_ADV_2019"));
  assert.equal(result.outcome, "INCORRECT");
  assert.equal(result.marksAwarded, "-2");
});

test("PROPORTIONAL: all correct options and nothing else is full marks", () => {
  const result = applyPartialCredit(question(), response(["opt_a", "opt_b", "opt_c", "opt_d"]), rule("PROPORTIONAL"));
  assert.equal(result.outcome, "CORRECT");
  assert.equal(result.marksAwarded, "4");
});

test("PROPORTIONAL: half correct, none wrong, is half marks", () => {
  const result = applyPartialCredit(question(), response(["opt_a", "opt_b"]), rule("PROPORTIONAL"));
  assert.equal(result.outcome, "PARTIAL");
  assert.equal(result.marksAwarded, "2"); // 4 * (2/4 - 0/4)
});

test("PROPORTIONAL: credit and penalty cancelling out floors at zero rather than going negative", () => {
  // 1 of 4 correct selected, 1 wrong selected: 4*(1/4) - 4*(1/4) = 0
  const result = applyPartialCredit(question(), response(["opt_a", "opt_e"]), rule("PROPORTIONAL"));
  assert.equal(result.marksAwarded, "0");
});

test("PROPORTIONAL: only wrong options selected floors at zero and reports INCORRECT, not PARTIAL", () => {
  const result = applyPartialCredit(question(), response(["opt_e"]), rule("PROPORTIONAL"));
  assert.equal(result.outcome, "INCORRECT");
  assert.equal(result.marksAwarded, "0");
});
