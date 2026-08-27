import type { AIProvider, CompletionRequest, CompletionResult } from "../types.js";

// Fixed, always-valid response so local dev and CI never need a real API key.
const MOCK_RESPONSE = {
  whyWrong: "This option overlooks a key condition stated in the question, so it doesn't hold under the rule being tested.",
  whyCorrect: "This option follows directly from the underlying concept the question is testing.",
  keyConcept: "Revisit the NCERT section for this unit and make sure you can restate the rule in your own words.",
  commonMistake: "Students often pick this kind of option by pattern-matching instead of checking the condition carefully.",
};

export const mockProvider: AIProvider = {
  name: "mock",
  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const text = JSON.stringify(MOCK_RESPONSE);
    return {
      text,
      tokensIn: Math.ceil((request.system.length + request.user.length) / 4),
      tokensOut: Math.ceil(text.length / 4),
      model: "mock-v1",
    };
  },
};
