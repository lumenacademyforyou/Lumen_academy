import { apiFetch } from "./api.js";
import type { Question } from "../types";

export interface ApiQuestionOption {
  id: string;
  label: string;
  textEn: string;
  textTa: string | null;
}

export interface ApiQuestion {
  id: string;
  stemEn: string;
  stemTa: string | null;
  marks: number;
  negativeMarks: number;
  subject: string;
  unit: string;
  options: ApiQuestionOption[];
}

export interface StartAttemptInput {
  subjectId?: string;
  unitId?: string;
  topicId?: string;
  count: number;
  durationSeconds: number;
}

export interface StartAttemptResponse {
  id: string;
  durationSeconds: number;
  startedAt: string;
  requestedCount: number;
  shortfall: number;
  questions: ApiQuestion[];
}

export function startAttempt(input: StartAttemptInput): Promise<StartAttemptResponse> {
  return apiFetch<StartAttemptResponse>("/tests", { method: "POST", body: JSON.stringify(input) });
}

export interface AnswerInput {
  questionId: string;
  selectedOptionId: string | null;
  timeSpentMs: number;
}

export function patchAnswers(attemptId: string, answers: AnswerInput[]): Promise<{ status: string }> {
  return apiFetch(`/tests/${attemptId}/answers`, { method: "PATCH", body: JSON.stringify(answers) });
}

export interface ResultSummary {
  id: string;
  status: string;
  score: number | null;
  maxScore: number | null;
  correctCount: number | null;
  wrongCount: number | null;
  skippedCount: number | null;
  submittedAt: string | null;
}

export function submitAttempt(attemptId: string): Promise<ResultSummary> {
  return apiFetch(`/tests/${attemptId}/submit`, { method: "POST" });
}

export interface ResultQuestion {
  id: string;
  stemEn: string;
  stemTa: string | null;
  explanationEn: string | null;
  explanationTa: string | null;
  selectedOptionId: string | null;
  timeSpentMs: number | null;
  subject: string;
  unit: string;
  options: Array<{ id: string; label: string; textEn: string; textTa: string | null; isCorrect: boolean }>;
}

export interface AttemptResult extends ResultSummary {
  questions: ResultQuestion[];
}

export function getResult(attemptId: string): Promise<AttemptResult> {
  return apiFetch(`/tests/${attemptId}/result`);
}

export interface QuestionIdMapEntry {
  questionId: string;
  optionIdByIndex: string[];
}

// Adapts the API's real question shape into the legacy client-side Question
// type so TestTakingView (untouched) can keep rendering it unmodified.
// correctAnswerIndex is intentionally a sentinel, never a real answer — the
// server never sends the correct option before submission, and this value is
// only ever read by TestTakingView's practice-mode branch, which this flow
// doesn't use.
export function toLegacyQuestions(questions: ApiQuestion[]): {
  legacy: Question[];
  idMap: Map<number, QuestionIdMapEntry>;
} {
  const idMap = new Map<number, QuestionIdMapEntry>();

  const legacy = questions.map((q, index) => {
    const legacyId = index + 1;
    idMap.set(legacyId, {
      questionId: q.id,
      optionIdByIndex: q.options.map((o) => o.id),
    });

    return {
      id: legacyId,
      text: q.stemEn,
      textTa: q.stemTa ?? undefined,
      options: q.options.map((o) => o.textEn),
      optionsTa: q.options.some((o) => o.textTa) ? q.options.map((o) => o.textTa ?? "") : undefined,
      correctAnswerIndex: -1,
      subject: q.subject as Question["subject"],
      unit: q.unit,
    };
  });

  return { legacy, idMap };
}
