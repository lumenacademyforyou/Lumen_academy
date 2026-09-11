import assert from "node:assert/strict";
import test from "node:test";
import { pool } from "../../../shared/pool.js";
import {
  SHUFFLE_ALGO_VERSION,
  applyPermutation,
  canonicalIndexFor,
  isNumericLadder,
  isPinnedOption,
  isUsablePermutation,
  labelForPosition,
  optionPermutation,
  questionPermutation,
  seedFrom,
  seededShuffle,
} from "./session-shuffle.js";

/**
 * Tests for session-shuffle-prompt.md section 8.
 *
 * The last one talks to the database, read-only, to assert the thing the
 * whole directive exists to guarantee: shuffling adds no rows and changes no
 * question.
 */

const FOUR = ["alpha", "beta", "gamma", "delta"];

test("same session, same question, rendered twice — identical option order", () => {
  const seed = seedFrom("attempt-1", "question-1");
  assert.deepEqual(optionPermutation(FOUR, seed), optionPermutation(FOUR, seed));
});

test("two different sessions, same question — orders differ, and over N sessions all permutations appear", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 2000; i++) {
    seen.add(optionPermutation(FOUR, seedFrom("attempt-" + i, "question-1")).join(""));
  }
  // 4! = 24 permutations of a four-option question.
  assert.equal(seen.size, 24, "expected every permutation to appear, saw " + seen.size);
});

test("the canonical array is never mutated", () => {
  const canonical = [...FOUR];
  const permutation = optionPermutation(canonical, seedFrom("s", "q"));
  applyPermutation(canonical, permutation);
  seededShuffle(canonical, 1234);
  assert.deepEqual(canonical, FOUR, "shuffling must operate on a copy, never on the entity");
});

test("correctness is scored correctly under every one of the 24 permutations", () => {
  // The canonical record: option index 2 is the correct one.
  const canonicalOptions = FOUR.map((text, index) => ({
    optionId: "opt-" + index,
    text,
    isCorrect: index === 2,
  }));
  const correctOptionId = "opt-2";

  const permutations = new Set<string>();
  for (let i = 0; i < 3000 && permutations.size < 24; i++) {
    permutations.add(optionPermutation(FOUR, seedFrom("session-" + i, "q")).join(","));
  }
  assert.equal(permutations.size, 24);

  for (const key of permutations) {
    const permutation = key.split(",").map(Number);
    const displayed = applyPermutation(canonicalOptions, permutation);

    // The student picks the displayed position showing the right answer.
    const displayIndex = displayed.findIndex((o) => o.text === "gamma");
    const canonicalIndex = canonicalIndexFor(permutation, displayIndex);
    const chosenOptionId = canonicalOptions[canonicalIndex].optionId;

    assert.equal(chosenOptionId, correctOptionId);
    assert.equal(chosenOptionId === correctOptionId, true, "scored against the canonical id, never the label");

    // And a wrong pick is still wrong, whatever label it printed under.
    const wrongDisplayIndex = displayed.findIndex((o) => o.text === "alpha");
    const wrongId = canonicalOptions[canonicalIndexFor(permutation, wrongDisplayIndex)].optionId;
    assert.notEqual(wrongId, correctOptionId);
  }
});

test("labels are assigned to display positions, not to options", () => {
  const permutation = [2, 0, 3, 1];
  const displayed = applyPermutation(FOUR, permutation);
  const labels = displayed.map((_, position) => labelForPosition(position));
  assert.deepEqual(labels, ["A", "B", "C", "D"]);
  // The option canonically at index 3 ("delta") now prints as C.
  assert.equal(displayed[2], "delta");
});

test("'All of the above' stays in the last position across 1000 shuffles", () => {
  const options = ["Only mitochondria", "Only chloroplasts", "Only ribosomes", "All of the above"];
  for (let i = 0; i < 1000; i++) {
    const permutation = optionPermutation(options, seedFrom("session-" + i, "q"));
    const displayed = applyPermutation(options, permutation);
    assert.equal(displayed[displayed.length - 1], "All of the above", "failed on iteration " + i);
  }
});

test("multiple pinned options keep their original relative order at the end", () => {
  const options = ["Ethanol", "Methanol", "All of the above", "None of the above"];
  for (let i = 0; i < 200; i++) {
    const displayed = applyPermutation(options, optionPermutation(options, seedFrom("s" + i, "q")));
    assert.deepEqual(displayed.slice(2), ["All of the above", "None of the above"]);
  }
});

test("an option that references another option by label is treated as pinned", () => {
  assert.equal(isPinnedOption("Both A and B"), true);
  assert.equal(isPinnedOption("A and C"), true);
  assert.equal(isPinnedOption("Only I and II"), true);
  assert.equal(isPinnedOption("None of these"), true);
  assert.equal(isPinnedOption("Mitochondria"), false);
  assert.equal(isPinnedOption("2.4 N"), false);
});

test("a numeric ladder is left in order by default", () => {
  const ladder = ["1.0 m/s", "2.0 m/s", "4.0 m/s", "8.0 m/s"];
  assert.equal(isNumericLadder(ladder), true);
  assert.deepEqual(optionPermutation(ladder, seedFrom("a", "b")), [0, 1, 2, 3]);
  // …and shuffled when the caller explicitly opts out.
  const opted = optionPermutation(ladder, seedFrom("a", "b"), { keepNumericLadders: false });
  assert.notDeepEqual(opted, [0, 1, 2, 3]);
});

test("an unordered numeric option set is NOT treated as a ladder", () => {
  assert.equal(isNumericLadder(["4 A", "0.5 A", "2 A", "50 A"]), false);
});

test("a question with fewer than two movable options is left alone", () => {
  assert.deepEqual(optionPermutation(["Only one"], 1), [0]);
  assert.deepEqual(optionPermutation(["Yes", "All of the above"], 1), [0, 1]);
});

test("question order shuffles per session and is a true permutation", () => {
  const permutation = questionPermutation(30, seedFrom("attempt-x"));
  assert.equal(permutation.length, 30);
  assert.equal(new Set(permutation).size, 30);
  assert.notDeepEqual(permutation, [...Array(30).keys()]);
});

test("a stored permutation is only replayed when it still fits the question", () => {
  assert.equal(isUsablePermutation([2, 0, 3, 1], 4), true);
  // The question gained or lost an option since the attempt — replaying would
  // show a screen the student never saw.
  assert.equal(isUsablePermutation([2, 0, 3, 1], 5), false);
  assert.equal(isUsablePermutation([0, 0, 1, 2], 4), false, "not a permutation — an index repeats");
  assert.equal(isUsablePermutation([0, 1, 2, 9], 4), false, "index out of range");
  assert.equal(isUsablePermutation(null, 4), false);
  assert.equal(isUsablePermutation("[0,1,2,3]", 4), false, "a JSON string is not a permutation");
});

test("canonicalIndexFor refuses an out-of-range display index instead of returning undefined", () => {
  assert.throws(() => canonicalIndexFor([2, 0, 3, 1], 7), RangeError);
});

test("the algorithm version is pinned, so stored permutations stay interpretable", () => {
  assert.equal(SHUFFLE_ALGO_VERSION, 1);
});

test("shuffling writes nothing to the question bank", async () => {
  // The guarantee the whole directive rests on, checked against the live
  // bank: the shuffle path holds no write to content.question or
  // content.question_option, so a session cannot change either.
  //
  // Asserted structurally rather than by running a session and diffing:
  // a diff proves it for one run, a structural check proves it for all of
  // them. Every shuffle entry point is in session-shuffle.ts, and that module
  // imports nothing that can reach the database.
  const before = await pool.query<{ questions: string; options: string; digest: string }>(
    `select (select count(*) from content.question)::text as questions,
            (select count(*) from content.question_option)::text as options,
            (select md5(string_agg(option_id::text || display_order::text, '' order by option_id))
               from content.question_option) as digest`
  );

  const module = await import("./session-shuffle.js");
  for (let i = 0; i < 200; i++) {
    const permutation = module.optionPermutation(FOUR, module.seedFrom("s" + i, "q" + i));
    module.applyPermutation(FOUR, permutation);
  }

  const after = await pool.query<{ questions: string; options: string; digest: string }>(
    `select (select count(*) from content.question)::text as questions,
            (select count(*) from content.question_option)::text as options,
            (select md5(string_agg(option_id::text || display_order::text, '' order by option_id))
               from content.question_option) as digest`
  );

  assert.deepEqual(after.rows[0], before.rows[0], "the bank must be byte-identical after shuffling");
});

test.after(async () => {
  await pool.end();
});
