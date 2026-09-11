import assert from "node:assert/strict";
import { test } from "node:test";
import { calibrateRasch, estimateThetaAgainstCalibration, sigmoid, type Response01 } from "./irt-model.js";

// P1-7 (docs/assessment-tool-fix-prompt.md) — pure-math correctness for the
// Rasch JMLE calibration, no DB involved. Assertions are on monotonic
// ordering and known invariants (mean-centering, sigmoid shape) rather than
// exact floating-point values, since JMLE has no closed-form answer to
// compare against — this is what "correct" looks like for an iterative
// estimator.

test("sigmoid: standard logistic shape", () => {
  assert.equal(sigmoid(0), 0.5);
  assert.ok(sigmoid(10) > 0.99);
  assert.ok(sigmoid(-10) < 0.01);
});

test("calibrateRasch: empty input returns empty, zero iterations", () => {
  const result = calibrateRasch([]);
  assert.equal(result.itemDifficulty.size, 0);
  assert.equal(result.personAbility.size, 0);
  assert.equal(result.iterations, 0);
});

test("calibrateRasch: harder items (lower correct rate) get higher difficulty than easier ones", () => {
  // 10 persons answer both an "easy" item (9/10 correct) and a "hard" item (2/10 correct).
  const responses: Response01[] = [];
  for (let p = 0; p < 10; p++) {
    responses.push({ itemId: "easy", personId: `p${p}`, correct: p < 9 });
    responses.push({ itemId: "hard", personId: `p${p}`, correct: p < 2 });
  }
  const { itemDifficulty } = calibrateRasch(responses);
  assert.ok(itemDifficulty.get("hard")! > itemDifficulty.get("easy")!, "the item almost nobody got right should calibrate as harder");
});

test("calibrateRasch: higher raw scorers get higher ability than lower raw scorers, on a shared item set", () => {
  const items = ["i1", "i2", "i3", "i4", "i5"];
  const responses: Response01[] = [];
  // Six persons with a clean gradient of raw scores 0..5 out of 5, all
  // answering the same 5 items (so difficulty is well-identified).
  for (let score = 0; score <= 5; score++) {
    items.forEach((itemId, idx) => {
      responses.push({ itemId, personId: `p${score}`, correct: idx < score });
    });
  }
  const { personAbility } = calibrateRasch(responses);
  const abilities = [0, 1, 2, 3, 4, 5].map((s) => personAbility.get(`p${s}`)!);
  for (let i = 1; i < abilities.length; i++) {
    assert.ok(abilities[i] > abilities[i - 1], `ability at raw score ${i} should exceed raw score ${i - 1} (got ${abilities[i - 1]} -> ${abilities[i]})`);
  }
});

test("calibrateRasch: mean item difficulty stays anchored near 0 (Rasch's additive-constant identification)", () => {
  const responses: Response01[] = [];
  for (let p = 0; p < 8; p++) {
    for (let i = 0; i < 6; i++) {
      responses.push({ itemId: `i${i}`, personId: `p${p}`, correct: (p + i) % 3 !== 0 });
    }
  }
  const { itemDifficulty } = calibrateRasch(responses);
  const mean = [...itemDifficulty.values()].reduce((a, b) => a + b, 0) / itemDifficulty.size;
  assert.ok(Math.abs(mean) < 1e-6, `mean item difficulty should be ~0 after re-centering, got ${mean}`);
});

test("estimateThetaAgainstCalibration: no overlapping items returns null", () => {
  const calibrated = new Map([["known-item", 0]]);
  const result = estimateThetaAgainstCalibration([{ itemId: "unknown-item", correct: true }], calibrated);
  assert.equal(result, null);
});

test("estimateThetaAgainstCalibration: a student who beat harder items scores higher theta than one who only cleared easy ones", () => {
  const itemDifficulty = new Map([
    ["easy1", -1.5],
    ["easy2", -1.0],
    ["hard1", 1.0],
    ["hard2", 1.5],
  ]);

  const strongStudent = estimateThetaAgainstCalibration(
    [
      { itemId: "easy1", correct: true },
      { itemId: "easy2", correct: true },
      { itemId: "hard1", correct: true },
      { itemId: "hard2", correct: true },
    ],
    itemDifficulty
  )!;
  const weakStudent = estimateThetaAgainstCalibration(
    [
      { itemId: "easy1", correct: true },
      { itemId: "easy2", correct: false },
      { itemId: "hard1", correct: false },
      { itemId: "hard2", correct: false },
    ],
    itemDifficulty
  )!;

  assert.ok(strongStudent.theta > weakStudent.theta);
  assert.equal(strongStudent.itemsUsed, 4);
});

test("estimateThetaAgainstCalibration: standard error shrinks with more answered items (more information)", () => {
  const itemDifficulty = new Map(Array.from({ length: 20 }, (_, i) => [`i${i}`, 0] as const));

  const few = estimateThetaAgainstCalibration(
    Array.from({ length: 3 }, (_, i) => ({ itemId: `i${i}`, correct: i % 2 === 0 })),
    itemDifficulty
  )!;
  const many = estimateThetaAgainstCalibration(
    Array.from({ length: 20 }, (_, i) => ({ itemId: `i${i}`, correct: i % 2 === 0 })),
    itemDifficulty
  )!;

  assert.ok(many.standardError < few.standardError, `more answered items should narrow the standard error (${few.standardError} -> ${many.standardError})`);
});
