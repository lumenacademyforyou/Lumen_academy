import assert from "node:assert/strict";
import { test } from "node:test";
import { aggregateAttempt, aggregateSection, type SectionInput } from "./aggregate.js";
import type { EvaluatedResponse } from "./types.js";

function evaluated(outcome: EvaluatedResponse["outcome"], marksAwarded: string): EvaluatedResponse {
  return { questionId: `q_${outcome}_${marksAwarded}`, outcome, marksAwarded, ruleId: "rule_1" };
}

test("aggregateSection sums marks exactly and counts each outcome", () => {
  const section: SectionInput = {
    sectionId: "s1",
    totalAvailableMarks: "16",
    responses: [evaluated("CORRECT", "4"), evaluated("CORRECT", "4"), evaluated("INCORRECT", "-1"), evaluated("UNATTEMPTED", "0")],
  };
  const result = aggregateSection(section);
  assert.equal(result.subtotalMarks, "7"); // 4 + 4 - 1 + 0
  assert.equal(result.correctCount, 2);
  assert.equal(result.incorrectCount, 1);
  assert.equal(result.unattemptedCount, 1);
  assert.equal(result.partialCount, 0);
  assert.equal(result.voidCount, 0);
});

test("a section with zero attempted questions (all unattempted) has a subtotal of exactly zero, not an error", () => {
  const section: SectionInput = {
    sectionId: "s1",
    totalAvailableMarks: "8",
    responses: [evaluated("UNATTEMPTED", "0"), evaluated("UNATTEMPTED", "0")],
  };
  const result = aggregateSection(section);
  assert.equal(result.subtotalMarks, "0");
  assert.equal(result.unattemptedCount, 2);
});

test("a section with no responses at all aggregates to a zero subtotal", () => {
  const result = aggregateSection({ sectionId: "s1", totalAvailableMarks: "0", responses: [] });
  assert.equal(result.subtotalMarks, "0");
});

test("the attempt total never drifts from the sum of its section subtotals", () => {
  const sections: SectionInput[] = [
    { sectionId: "physics", totalAvailableMarks: "180", responses: [evaluated("CORRECT", "4"), evaluated("INCORRECT", "-1")] },
    { sectionId: "chemistry", totalAvailableMarks: "180", responses: [evaluated("CORRECT", "4"), evaluated("CORRECT", "4"), evaluated("PARTIAL", "0.1")] },
  ];
  const result = aggregateAttempt(sections);
  const expectedTotal = sections
    .flatMap((s) => s.responses.map((r) => r.marksAwarded))
    .reduce((sum, m) => sum + Number(m), 0); // native-float cross-check is fine here since the test's own values are float-safe
  assert.equal(Number(result.totalMarks), expectedTotal);

  const sumOfSectionSubtotals = result.sections.reduce((sum, s) => sum + Number(s.subtotalMarks), 0);
  assert.equal(Number(result.totalMarks), sumOfSectionSubtotals);
});

test("totalAvailableMarks on the attempt is the sum of each section's totalAvailableMarks", () => {
  const sections: SectionInput[] = [
    { sectionId: "physics", totalAvailableMarks: "180", responses: [] },
    { sectionId: "chemistry", totalAvailableMarks: "180", responses: [] },
    { sectionId: "botany", totalAvailableMarks: "360", responses: [] },
  ];
  const result = aggregateAttempt(sections);
  assert.equal(result.totalAvailableMarks, "720"); // matches NEET UG's real total, incidentally
});
