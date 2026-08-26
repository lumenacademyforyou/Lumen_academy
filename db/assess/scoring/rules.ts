/**
 * MCQ_MULTI partial-credit strategies, selected by ScoringRule.partialMode
 * (D-3: a new exam's scheme is a new strategy plus a rule row, never an
 * `if (exam === ...)` branch). Called only for MCQ_MULTI questions with at
 * least one option selected — evaluate.ts handles UNATTEMPTED/VOID/other
 * formats before reaching here.
 */
import * as decimal from "./decimal.js";
import type { EvaluatedResponse, ScoringRule, ServedQuestion, StudentResponse } from "./types.js";

export function applyPartialCredit(
  question: ServedQuestion,
  response: StudentResponse,
  rule: ScoringRule
): EvaluatedResponse {
  const correctSet = new Set(question.correctOptionIds);
  const correctSelected = response.selectedOptionIds.filter((id) => correctSet.has(id));
  const wrongSelected = response.selectedOptionIds.filter((id) => !correctSet.has(id));
  const totalCorrect = question.correctOptionIds.length;

  switch (rule.partialMode) {
    case "NONE": {
      const isExactMatch = wrongSelected.length === 0 && correctSelected.length === totalCorrect;
      return {
        questionId: question.questionId,
        outcome: isExactMatch ? "CORRECT" : "INCORRECT",
        marksAwarded: isExactMatch ? rule.correctMarks : rule.incorrectMarks,
        ruleId: rule.ruleId,
      };
    }

    case "JEE_ADV_2019": {
      // Official JEE Advanced multiple-correct scheme: full marks only when
      // every correct option is chosen and nothing else; +1-per-correct-
      // option credit (derived as correctMarks / totalCorrect, so a
      // 4-mark/4-correct-option question gives +1 per option, matching the
      // published rule) when a non-empty strict subset of correct options
      // is chosen and no incorrect option is chosen; the rule's negative
      // marks otherwise.
      if (wrongSelected.length > 0) {
        return { questionId: question.questionId, outcome: "INCORRECT", marksAwarded: rule.incorrectMarks, ruleId: rule.ruleId };
      }
      if (correctSelected.length === totalCorrect) {
        return { questionId: question.questionId, outcome: "CORRECT", marksAwarded: rule.correctMarks, ruleId: rule.ruleId };
      }
      const perOption = decimal.divide(rule.correctMarks, String(totalCorrect));
      const marksAwarded = decimal.multiply(perOption, String(correctSelected.length));
      return { questionId: question.questionId, outcome: "PARTIAL", marksAwarded, ruleId: rule.ruleId };
    }

    case "PROPORTIONAL": {
      // Generic proportional scheme (not tied to one exam's published
      // rule): credit for the fraction of correct options chosen, minus an
      // equal fractional penalty for each incorrect option chosen, floored
      // at zero — never negative, unlike JEE_ADV_2019's fixed penalty.
      if (wrongSelected.length === 0 && correctSelected.length === totalCorrect) {
        return { questionId: question.questionId, outcome: "CORRECT", marksAwarded: rule.correctMarks, ruleId: rule.ruleId };
      }
      const creditFraction = decimal.divide(String(correctSelected.length), String(totalCorrect));
      const penaltyFraction = decimal.divide(String(wrongSelected.length), String(totalCorrect));
      const rawMarks = decimal.subtract(
        decimal.multiply(rule.correctMarks, creditFraction),
        decimal.multiply(rule.correctMarks, penaltyFraction)
      );
      const marksAwarded = decimal.clampMin(rawMarks, "0");
      return {
        questionId: question.questionId,
        outcome: correctSelected.length === 0 ? "INCORRECT" : "PARTIAL",
        marksAwarded,
        ruleId: rule.ruleId,
      };
    }

    default: {
      const exhaustive: never = rule.partialMode;
      throw new Error(`applyPartialCredit: unknown partialMode ${exhaustive}`);
    }
  }
}
