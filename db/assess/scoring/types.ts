/**
 * TE-P2 scoring domain data contract (LA-BE-ENGINE-001 Section 6). Pure
 * types only — no database or HTTP dependency belongs in this file.
 */

export type QuestionFormat = "MCQ_SINGLE" | "MCQ_MULTI" | "NUMERICAL" | "ASSERTION_REASON";
export type Outcome = "CORRECT" | "INCORRECT" | "PARTIAL" | "UNATTEMPTED" | "VOID";
export type PartialMode = "NONE" | "PROPORTIONAL" | "JEE_ADV_2019";

export interface ScoringRule {
  ruleId: string;
  questionFormat: QuestionFormat;
  correctMarks: string; // NUMERIC as string; never number
  incorrectMarks: string; // signed, negative for a penalty
  unattemptedMarks: string;
  partialMode: PartialMode;
  numericToleranceAbs: string | null;
  numericToleranceRelPct: string | null;
  /**
   * Not in the brief's original data contract. TE-P2 work item 4 requires a
   * per-rule void disposition ("a voided question awards its full marks to
   * every attempt in which it was served, or is excluded from the total,
   * per the rule row") but the brief's ScoringRule type has no field for
   * it, and catalog.marking_scheme (docs/DB_STATE.md) has no matching
   * column either. Added here rather than guessed at in evaluate.ts;
   * whichever phase wires this engine to the live schema needs a follow-up
   * migration adding the column and populating it when building a
   * ScoringRule from a live catalog.marking_scheme row.
   */
  voidDisposition: "FULL_CREDIT" | "EXCLUDED";
}

export interface ServedQuestion {
  questionId: string;
  format: QuestionFormat;
  ruleId: string;
  isVoided: boolean;
  correctOptionIds: string[]; // empty for NUMERICAL
  correctNumericValue: string | null;
  optionIds: string[]; // every option legally belonging to this question
}

export interface StudentResponse {
  questionId: string;
  selectedOptionIds: string[];
  numericValue: string | null;
  isMarkedForReview: boolean;
  answeredAt: string | null; // null means never answered
}

export interface EvaluatedResponse {
  questionId: string;
  outcome: Outcome;
  marksAwarded: string;
  ruleId: string;
}

export interface SectionAggregate {
  sectionId: string;
  subtotalMarks: string;
  totalAvailableMarks: string;
  correctCount: number;
  incorrectCount: number;
  partialCount: number;
  unattemptedCount: number;
  voidCount: number;
}

export interface AttemptAggregate {
  totalMarks: string;
  totalAvailableMarks: string;
  sections: SectionAggregate[];
}
