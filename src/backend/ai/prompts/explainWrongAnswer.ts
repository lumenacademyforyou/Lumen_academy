import type { CompletionRequest } from "../types.js";

export const EXPLAIN_WRONG_ANSWER_PROMPT_VERSION = "explainWrongAnswer_v1";

export interface ExplainWrongAnswerInput {
  questionStem: string;
  selectedOptionText: string;
  correctOptionText: string;
  locale: "en" | "ta";
}

export function explainWrongAnswer_v1(input: ExplainWrongAnswerInput): CompletionRequest {
  const languageInstruction = input.locale === "ta" ? "Respond entirely in Tamil (தமிழ்)." : "Respond entirely in English.";

  const system = [
    "You are a patient NEET exam tutor helping a student understand a mistake on a mock test question.",
    languageInstruction,
    "Respond with ONLY a JSON object with exactly these four string fields: whyWrong, whyCorrect, keyConcept, commonMistake.",
    "Keep each field to 1-3 sentences, written for a Class 11/12 NEET aspirant. Do not include any text outside the JSON object.",
  ].join(" ");

  const user = [
    `Question: ${input.questionStem}`,
    `Student's selected (incorrect) answer: ${input.selectedOptionText}`,
    `Correct answer: ${input.correctOptionText}`,
    "",
    "Explain why the student's answer is wrong, why the correct answer is right, the key concept being tested, and a common mistake students make on this topic.",
  ].join("\n");

  return {
    system,
    user,
    maxTokens: 500,
    temperature: 0.3,
    json: true,
  };
}
