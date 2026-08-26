import assert from "node:assert/strict";
import { test } from "node:test";
import * as decimal from "./decimal.js";

test("add: sums that would drift under IEEE754 floats are exact", () => {
  // 0.1 + 0.2 === 0.30000000000000004 in native JS float arithmetic.
  assert.equal(decimal.add("0.1", "0.2"), "0.3");
});

test("add: sums an arbitrary number of values in one call", () => {
  assert.equal(decimal.add("4", "-1", "0.5"), "3.5");
});

test("subtract, multiply, divide are exact for typical marks values", () => {
  assert.equal(decimal.subtract("4", "1"), "3");
  assert.equal(decimal.multiply("4", "0.5"), "2");
  assert.equal(decimal.divide("4", "3"), "1.333333333");
});

test("compare orders negatives, zero and positives correctly", () => {
  assert.equal(decimal.compare("-1", "0"), -1);
  assert.equal(decimal.compare("0", "0"), 0);
  assert.equal(decimal.compare("0.5", "0.4"), 1);
});

test("abs strips the sign without touching magnitude", () => {
  assert.equal(decimal.abs("-1"), "1");
  assert.equal(decimal.abs("1"), "1");
  assert.equal(decimal.abs("0"), "0");
});

test("clampMin floors a negative result at the given minimum", () => {
  assert.equal(decimal.clampMin("-2", "0"), "0");
  assert.equal(decimal.clampMin("2", "0"), "2");
});

test("sum of an empty list is zero, not an error", () => {
  assert.equal(decimal.sum([]), "0");
});

test("divide by zero throws rather than returning Infinity/NaN", () => {
  assert.throws(() => decimal.divide("1", "0"));
});
