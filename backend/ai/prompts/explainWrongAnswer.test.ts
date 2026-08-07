import assert from "node:assert/strict";
import { test } from "node:test";
import { explainWrongAnswer_v1 } from "./explainWrongAnswer.js";

test("explainWrongAnswer_v1 requests JSON output and embeds the question context", () => {
  const request = explainWrongAnswer_v1({
    questionStem: "Which codon is the universal start codon?",
    selectedOptionText: "UAA (Stop)",
    correctOptionText: "AUG (Methionine)",
    locale: "en",
  });

  assert.equal(request.json, true);
  assert.ok(request.system.includes("whyWrong"));
  assert.ok(request.user.includes("UAA (Stop)"));
  assert.ok(request.user.includes("AUG (Methionine)"));
  assert.ok(request.system.includes("English"));
});

test("explainWrongAnswer_v1 asks for Tamil when locale is ta", () => {
  const request = explainWrongAnswer_v1({
    questionStem: "Q",
    selectedOptionText: "A",
    correctOptionText: "B",
    locale: "ta",
  });

  assert.ok(request.system.includes("Tamil"));
});
