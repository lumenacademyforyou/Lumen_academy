import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * docs/test-engine-fix-prompt.md Defect 2 — "debug output in the test
 * console", turned into a standing guard instead of a one-time cleanup.
 *
 * The audit for this pass found the defect did not reproduce in this
 * codebase: there is no `console.log` in the test-runtime path at all, and
 * `envelope.ts` never selects `is_correct`, so no answer key reaches the
 * client before submission (the existing assemble.test.ts case "no answer-key
 * leakage in an assembled, unsubmitted envelope" asserts that end of it
 * against the live DB).
 *
 * Rather than add a debug-flag logger with nothing to log — dead code that
 * would itself become the risk — the fix here is this test: it fails the
 * moment someone adds a `console.log` back into the exam runtime, which is
 * the acceptance criterion the spec actually names.
 */

// The files a student's browser executes during a live attempt.
const TEST_RUNTIME_FILES = [
  "frontend/src/pages/TestTakingView.tsx",
  "frontend/src/pages/LobbyView.tsx",
  "frontend/src/pages/SystemCheckView.tsx",
  "frontend/src/pages/EvaluatingView.tsx",
  "frontend/src/services/sessionApi.ts",
  "frontend/src/components/ui/QuestionImage.tsx",
];

describe("test-runtime logging discipline (Defect 2)", () => {
  for (const relative of TEST_RUNTIME_FILES) {
    it(`${relative} emits no console.log`, () => {
      const full = path.join(process.cwd(), relative);
      const source = fs.readFileSync(full, "utf8");
      // Strip comments first — a prose mention of "console.log" in a comment
      // explaining this rule must not fail the rule.
      const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      const hits = code.match(/console\s*\.\s*(log|debug|info|table|dir)\s*\(/g) ?? [];
      expect(hits, `found ${hits.length} debug console call(s) in ${relative}`).toEqual([]);
    });
  }

  it("the exam envelope type carries no answer key for the client to log", () => {
    const types = fs.readFileSync(path.join(process.cwd(), "frontend/src/types/index.ts"), "utf8");
    const envelopeBlock = types.slice(types.indexOf("export interface EnvelopeOption"), types.indexOf("export interface EnvelopeImage"));
    expect(envelopeBlock).not.toMatch(/isCorrect|correctOption|answerKey/);
  });
});
