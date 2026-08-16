import { apiFetch } from "./api.js";
import type { Question } from "../../types";

// Client for the newer db/assess-backed attempt flow (/api/assess/attempts/*)
// and the real catalog/content reads (/api/syllabus, /api/questions) — kept
// separate from lib/testApi.ts, which targets the older, still-live Prisma
// /api/tests/* routes. Mirrors testApi.ts's conventions (apiFetch, a
// toLegacyQuestions-style adapter) for consistency.

export interface SyllabusUnit {
  id: string;
  subject: string;
  subjectLabel: string;
  ncertClass: string | null;
  unitName: string;
}

export function getSyllabus(): Promise<{ status: string; units: SyllabusUnit[] }> {
  return apiFetch("/syllabus");
}

export interface AttemptRow {
  attempt_id: string;
  test_id: string;
  user_id: string;
  attempt_no: number;
  attempt_state: string;
  started_at: string | null;
  server_deadline: string | null;
  submitted_at: string | null;
}

export function startAttempt(testId: string): Promise<{ data: AttemptRow }> {
  return apiFetch("/assess/attempts/start", { method: "POST", body: JSON.stringify({ test_id: testId }) });
}

export interface PaperOption {
  option_id: string;
  option_label: string;
  option_text: string;
}

export interface PaperQuestion {
  test_question_id: string;
  sequence_no: number;
  question_id: string;
  stem_text: string;
  question_type: string | null;
  options: PaperOption[];
}

export function getPaper(attemptId: string): Promise<{ data: PaperQuestion[] }> {
  return apiFetch(`/assess/attempts/${attemptId}/paper`);
}

export interface BatchResponseInput {
  testQuestionId: string;
  option_id?: string | null;
  time_spent_seconds?: number | null;
}

export function batchSaveResponses(attemptId: string, responses: BatchResponseInput[]): Promise<{ data: unknown[] }> {
  return apiFetch(`/assess/attempts/${attemptId}/responses`, { method: "PATCH", body: JSON.stringify({ responses }) });
}

export interface ScorecardResult {
  scorecardId: string;
  obtainedMarks: number;
  totalMarks: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  ungradedCount: number;
}

export function submitAttempt(attemptId: string): Promise<{ data: { attempt: AttemptRow; scorecard: ScorecardResult } }> {
  return apiFetch(`/assess/attempts/${attemptId}/submit`, { method: "POST" });
}

export interface ScorecardRow {
  scorecard_id: string;
  attempt_id: string;
  obtained_marks: string | null;
  total_marks: string | null;
  accuracy_percent: string | null;
  percentile: string | null;
  rank_in_cohort: number | null;
  generated_at: string | null;
}

export function getScorecard(attemptId: string): Promise<{ data: { scorecard: ScorecardRow; sectionScores: unknown[] } }> {
  return apiFetch(`/assess/attempts/${attemptId}/scorecard`);
}

export interface QuestionIdMapEntry {
  testQuestionId: string;
  optionIdByIndex: string[];
}

// Adapts PaperQuestion[] -> the legacy client-side Question[] shape so
// TestTakingView (data-agnostic, already designed for this) renders it
// unmodified. correctAnswerIndex is a sentinel, never a real answer — the
// server never sends the answer key before submission. Mirrors
// lib/testApi.ts's toLegacyQuestions exactly, keyed by test_question_id
// instead of question_id (the new schema submits answers against a
// question's placement in a specific test, not the bare question).
export function toLegacyQuestions(paper: PaperQuestion[]): {
  legacy: Question[];
  idMap: Map<number, QuestionIdMapEntry>;
} {
  const idMap = new Map<number, QuestionIdMapEntry>();

  const legacy = paper.map((q, index) => {
    const legacyId = index + 1;
    idMap.set(legacyId, {
      testQuestionId: q.test_question_id,
      optionIdByIndex: q.options.map((o) => o.option_id),
    });

    return {
      id: legacyId,
      text: q.stem_text,
      options: q.options.map((o) => o.option_text),
      correctAnswerIndex: -1,
      subject: "Physics" as Question["subject"], // real subject isn't in the paper shape yet; display-only field
      unit: "",
    };
  });

  return { legacy, idMap };
}
