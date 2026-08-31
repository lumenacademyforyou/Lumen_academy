import assert from "node:assert/strict";
import { test } from "node:test";
import { TEST_TYPE_CONFIG, SINGLE_SCOPE_TEST_TYPES, NON_PRACTICE_TEST_TYPES, type TestTypeCode } from "./test-code.js";

// Test-layer hardening F4 (docs/BUGS.md#F4). No live database needed — this
// is pure config/derivation logic, not a query. Proves TEST_TYPE_CONFIG's
// two derived lists (SINGLE_SCOPE_TEST_TYPES, feeding assess.routes.ts's
// z.enum allowlist; NON_PRACTICE_TEST_TYPES, feeding sessionController.ts's
// hasCompletedPracticeTest regex) match today's known-correct values, so a
// future edit to TEST_TYPE_CONFIG that accidentally changes either list is
// caught here rather than only discovered live against the two routes that
// actually consume them.

test("SINGLE_SCOPE_TEST_TYPES is exactly the single-scope test types (everything but MOCK)", () => {
  assert.deepEqual(new Set(SINGLE_SCOPE_TEST_TYPES), new Set(["SUBJ", "CHAP", "TOPIC", "UNIT"]));
  assert.ok(!SINGLE_SCOPE_TEST_TYPES.includes("MOCK" as TestTypeCode), "MOCK is multi-scope (spans several subjects/lines) and must not appear in the single-scope allowlist");
});

test("NON_PRACTICE_TEST_TYPES is exactly MOCK today", () => {
  assert.deepEqual(NON_PRACTICE_TEST_TYPES, ["MOCK"]);
});

test("every TestTypeCode has a TEST_TYPE_CONFIG entry (enforced structurally by Record<TestTypeCode, ...>, re-asserted here for a direct, readable failure)", () => {
  const allTypes: TestTypeCode[] = ["MOCK", "SUBJ", "CHAP", "TOPIC", "UNIT"];
  for (const type of allTypes) {
    assert.ok(TEST_TYPE_CONFIG[type], `TEST_TYPE_CONFIG is missing an entry for ${type}`);
  }
});

test("the non-practice test_code regex pattern sessionController.ts builds from NON_PRACTICE_TEST_TYPES matches MOCK-type codes and nothing else (matches the old hand-written '^LMN-[A-Z]+-MOCK-' behavior)", () => {
  const pattern = new RegExp(`^LMN-[A-Z]+-(${NON_PRACTICE_TEST_TYPES.join("|")})-`);

  assert.ok(pattern.test("LMN-NEET-MOCK-ALL-000001"), "a full-mock test_code should match the non-practice pattern");
  assert.ok(pattern.test("LMN-NEET-MOCK-CUSTOM-000002"), "a custom (MOCK-typed) test_code should match the non-practice pattern");
  assert.ok(!pattern.test("LMN-NEET-SUBJ-BOT-000001"), "a subject-wise practice test_code must not match the non-practice pattern");
  assert.ok(!pattern.test("LMN-NEET-CHAP-PHYWAVE-000001"), "a chapter-scoped practice test_code must not match the non-practice pattern");
  assert.ok(!pattern.test("LMN-NEET-TOPIC-CHEMBOND-000001"), "a topic-scoped practice test_code must not match the non-practice pattern");
  assert.ok(!pattern.test("LMN-NEET-UNIT-ZOOCELL-000001"), "a unit-scoped practice test_code must not match the non-practice pattern");
});
