import assert from "node:assert/strict";
import { test } from "node:test";
import { scoreAttempt, toPublicQuestion, type ScoringInput } from "./attempt.service.js";

function buildQuestion() {
  return {
    id: "q_1",
    unitId: "phy_01",
    topicId: null,
    stemEn: "Sample stem",
    stemTa: null,
    difficulty: 3,
    marks: 4,
    negativeMarks: 1,
    explanationEn: "This explanation must never reach the client before submission.",
    explanationTa: null,
    isActive: true,
    createdAt: new Date(),
    unit: { name: "Mechanics & Rotational Dynamics", subject: { name: "Physics" } },
    options: [
      { id: "q_1_A", questionId: "q_1", label: "A", textEn: "Right answer", textTa: null, isCorrect: true, displayOrder: 0 },
      { id: "q_1_B", questionId: "q_1", label: "B", textEn: "Wrong answer", textTa: null, isCorrect: false, displayOrder: 1 },
    ],
  };
}

test("toPublicQuestion never leaks isCorrect or the explanation", () => {
  // biome-ignore lint: constructing a Prisma model shape for a pure-function test
  const question = buildQuestion() as any;
  const result = toPublicQuestion(question);
  const serialized = JSON.stringify(result);

  assert.ok(!("explanationEn" in result), "explanation must be absent from the response shape");
  assert.ok(!serialized.includes("isCorrect"), "serialized response must never contain isCorrect");
  assert.ok(!serialized.includes("explanation"), "serialized response must never contain the explanation");
  assert.equal(result.options.length, 2);
});

test("toPublicQuestion sorts options by displayOrder regardless of input order", () => {
  const question = buildQuestion() as any;
  question.options.reverse();

  const result = toPublicQuestion(question);

  assert.equal(result.options[0].label, "A");
  assert.equal(result.options[1].label, "B");
});

function answer(overrides: Partial<ScoringInput>): ScoringInput {
  return { selectedOptionId: null, isCorrect: null, marks: 4, negativeMarks: 1, ...overrides };
}

test("scoreAttempt: all correct", () => {
  const items: ScoringInput[] = [
    answer({ selectedOptionId: "a", isCorrect: true }),
    answer({ selectedOptionId: "b", isCorrect: true }),
    answer({ selectedOptionId: "c", isCorrect: true }),
  ];

  const result = scoreAttempt(items);

  assert.deepEqual(result, { score: 12, maxScore: 12, correctCount: 3, wrongCount: 0, skippedCount: 0 });
});

test("scoreAttempt: all wrong", () => {
  const items: ScoringInput[] = [
    answer({ selectedOptionId: "a", isCorrect: false }),
    answer({ selectedOptionId: "b", isCorrect: false }),
    answer({ selectedOptionId: "c", isCorrect: false }),
  ];

  const result = scoreAttempt(items);

  assert.deepEqual(result, { score: -3, maxScore: 12, correctCount: 0, wrongCount: 3, skippedCount: 0 });
});

test("scoreAttempt: all skipped", () => {
  const items: ScoringInput[] = [answer({}), answer({}), answer({})];

  const result = scoreAttempt(items);

  assert.deepEqual(result, { score: 0, maxScore: 12, correctCount: 0, wrongCount: 0, skippedCount: 3 });
});

test("scoreAttempt: mixed attempt", () => {
  const items: ScoringInput[] = [
    answer({ selectedOptionId: "a", isCorrect: true }), // +4
    answer({ selectedOptionId: "b", isCorrect: false }), // -1
    answer({}), // skipped, 0
    answer({ selectedOptionId: "d", isCorrect: true, marks: 4, negativeMarks: 1 }), // +4
  ];

  const result = scoreAttempt(items);

  assert.deepEqual(result, { score: 7, maxScore: 16, correctCount: 2, wrongCount: 1, skippedCount: 1 });
});

test("scoreAttempt: expired attempt with only some answers recorded", () => {
  // Simulates a PATCH-triggered expiry: only the first two questions were
  // answered before time ran out, the rest are still null (skipped).
  const items: ScoringInput[] = [
    answer({ selectedOptionId: "a", isCorrect: true }),
    answer({ selectedOptionId: "b", isCorrect: false }),
    answer({}),
    answer({}),
    answer({}),
  ];

  const result = scoreAttempt(items);

  assert.deepEqual(result, { score: 3, maxScore: 20, correctCount: 1, wrongCount: 1, skippedCount: 3 });
});
