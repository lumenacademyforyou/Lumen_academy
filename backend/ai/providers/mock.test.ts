import assert from "node:assert/strict";
import { test } from "node:test";
import { mockProvider } from "./mock.js";

test("mockProvider returns instantly with a valid explanation JSON shape, no network", async () => {
  const result = await mockProvider.complete({ system: "system prompt", user: "user prompt", maxTokens: 500, json: true });
  const parsed = JSON.parse(result.text);

  assert.equal(typeof parsed.whyWrong, "string");
  assert.equal(typeof parsed.whyCorrect, "string");
  assert.equal(typeof parsed.keyConcept, "string");
  assert.equal(typeof parsed.commonMistake, "string");
  assert.ok(parsed.whyWrong.length > 0);
  assert.equal(result.model, "mock-v1");
  assert.ok(result.tokensIn > 0);
  assert.ok(result.tokensOut > 0);
});
