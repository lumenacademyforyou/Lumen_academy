export interface ChapterGoal {
  id: string;
  subject: "Physics" | "Chemistry" | "Biology" | "Botany" | "Zoology";
  chapter: string;
  highYieldTag: string;
  hoursNeeded: number;
  completed: boolean;
}

export interface Question {
  id: number;
  text: string;
  textTa?: string;
  options: string[];
  optionsTa?: string[];
  correctAnswerIndex: number;
  subject: "Physics" | "Chemistry" | "Biology" | "Botany" | "Zoology";
  unit?: string;
  ncertReference?: string;
  explanation?: string;
}

export interface LaggingTopic {
  topic: string;
  unit: string;
  subject: "Physics" | "Chemistry" | "Biology" | "Botany" | "Zoology";
  accuracy: number;
  negativeMarksLost: number;
  conceptGap: string;
  improvementSteps: string[];
  ncertReference: {
    book: string;
    chapter: string;
    pages: string;
    keyLines: string;
  };
}

export interface TestAttempt {
  id: string;
  title: string;
  date: string;
  totalScore: number; // percentage
  accuracy: number; // percentage
  percentile: number;
  correctAnswers: number;
  incorrectAnswers: number;
  skippedAnswers: number;
  timeTakenMinutes: number;
  subjectBreakdown: {
    Physics: { score: number; growth: number; status: "Strong" | "Average" | "Expert" };
    Chemistry: { score: number; growth: number; status: "Strong" | "Average" | "Expert" };
    Biology: { score: number; growth: number; status: "Strong" | "Average" | "Expert" };
  };
  aiRecommendation: {
    topics: string[];
    potentialGain: number;
    focusAreas: { topic: string; level: "Critical" | "Improvement" | "Done" }[];
  };
  laggingTopics?: LaggingTopic[];
  questionTimeData?: { questionId: number; subject: "Physics" | "Chemistry" | "Biology" | "Botany" | "Zoology"; timeSpentSeconds: number }[];
  averageTimePerQuestionSeconds?: number;
}

// --- Real API types (LA-APP-COMPLETION-001 Phase D) ---------------------
// Mirrors backend/src/controllers/catalogTreeController.ts and
// db/assess/test/attempt/envelope.ts's real shapes. Deliberately separate
// from Question/TestAttempt above (Phase G's concern) rather than widening
// those — this is the shape the new session/workspace/result flow actually
// consumes end to end, with real UUIDs and no answer keys pre-submission.

export type SubjectCode = "PHY" | "CHEM" | "BOT" | "ZOO";

export interface CatalogUnit {
  nodeId: string;
  tagCode: string;
  title: string;
  classLevel: string | null;
  displayOrder: number | null;
  publishedQuestionCount: number;
  /** Image-based test type (docs/BUGS.md#E1-E3) — published, has_image=true questions reachable from this unit. */
  imageQuestionCount: number;
}

export interface CatalogSubject {
  subjectId: string;
  subjectCode: SubjectCode;
  subjectName: string;
  displayOrder: number | null;
  publishedQuestionCount: number;
  /** Image-based test type (docs/BUGS.md#E1-E3) — published, has_image=true questions in this subject. */
  imageQuestionCount: number;
  units: CatalogUnit[];
}

export interface CatalogTree {
  examId: string;
  examCode: string;
  examName: string;
  subjects: CatalogSubject[];
}

export type DifficultyBand = "easy" | "medium" | "hard";

/** One line of a custom-mode session request — see sessionController.ts's customLineSchema. */
export interface SessionLine {
  subjectId: string;
  syllabusNodeId?: string;
  includeDescendants?: boolean;
  difficultyBand?: DifficultyBand;
  hasImageOnly?: boolean;
  pickCount: number;
  sectionName: string;
}

// Single source for the session/attempt mode taxonomy — was four separate
// repeated union literals below (SessionResult/AttemptEnvelope/AttemptSummary/
// CreateSessionRequest), the same drift risk F4 (docs/BUGS.md) already fixed
// once on the backend side (test-code.ts's TestTypeCode/TEST_TYPE_CONFIG).
export type SessionMode = "subject-wise" | "full-mock" | "image-practice" | "custom";

export type CreateSessionRequest =
  | { mode: "subject-wise"; title: string; durationMinutes: number; subjectId: string; syllabusNodeId?: string; includeDescendants?: boolean; difficultyBand?: DifficultyBand; hasImageOnly?: boolean; pickCount: number }
  | { mode: "full-mock"; title?: string }
  // Image-based test type (docs/BUGS.md#E1-E3) — the server resolves real
  // per-subject has_image=true availability itself (sessionController.ts),
  // so the client only needs to ask for the mode, same shape as full-mock.
  | { mode: "image-practice"; title?: string }
  | { mode: "custom"; title: string; durationMinutes: number; lines: SessionLine[] };

export interface EnvelopeOption {
  optionId: string;
  optionLabel: string;
  optionText: string;
  optionTextTa: string | null;
}

export interface EnvelopeImage {
  url: string;
  altText: string | null;
  optionId: string | null;
}

export interface EnvelopeQuestion {
  questionId: string;
  testSectionId: string;
  sequenceNo: number;
  format: string | null;
  marks: string;
  negativeMarks: string;
  stemText: string;
  stemTextTa: string | null;
  stemFormat: string;
  options: EnvelopeOption[];
  images: EnvelopeImage[];
}

export interface EnvelopeSection {
  testSectionId: string;
  sectionName: string;
  sequenceNo: number;
  questionCount: number;
}

export interface EnvelopeResponse {
  questionId: string;
  selectedOptionId: string | null;
  numericAnswer: string | null;
  isMarkedForReview: boolean;
  hasAnswered: boolean;
  timeSpentSeconds: number;
}

export interface AttemptEnvelope {
  attemptId: string;
  attemptNo: number;
  status: string;
  serverNow: string;
  remainingSeconds: number;
  allowPause: boolean;
  test: { testId: string; title: string; durationMinutes: number | null };
  // Phase E — every envelope (not just the one returned at session-creation
  // time) now carries these, so a resumed/reloaded attempt can be rebuilt
  // into a full SessionResult from one GET call (see sessionApi.ts's
  // getActiveAttempt).
  testCode: string;
  mode: SessionMode;
  sections: EnvelopeSection[];
  questions: EnvelopeQuestion[];
  responses: EnvelopeResponse[];
  // docs/no-repeat-questions-fix.md Phase 5.
  hasRecycledItems: boolean;
  recycledItemCount: number;
}

export interface SessionResult {
  mode: SessionMode;
  testId: string;
  testCode: string;
  attemptId: string;
  attemptNo: number;
  status: string;
  serverNow: string;
  remainingSeconds: number;
  allowPause: boolean;
  test: { testId: string; title: string; durationMinutes: number | null };
  sections: EnvelopeSection[];
  questions: EnvelopeQuestion[];
  responses: EnvelopeResponse[];
  // docs/no-repeat-questions-fix.md Phase 5: honest recycling disclosure,
  // shown on the Lobby screen before the student answers anything.
  hasRecycledItems: boolean;
  recycledItemCount: number;
}

// Phase E — summary row from GET /assess/attempts (db/assess/test/attempt/
// attempt-flow.ts's listAttempts), used only to detect an in-progress/paused
// attempt worth resuming; not the full envelope shape above.
export interface AttemptSummary {
  attemptId: string;
  testId: string;
  testCode: string;
  testTitle: string;
  mode: SessionMode;
  durationMinutes: number | null;
  attemptNo: number;
  attemptState: string;
  startedAt: string | null;
  submittedAt: string | null;
  obtainedMarks: string | null;
  totalMarks: string | null;
}

// Phase E — GET /auth/session's status snapshot, used to drive the
// idle-warning countdown without ever touching last_activity_at itself.
export interface SessionStatus {
  sessionId: string;
  issuedAt: string;
  lastActivityAt: string;
  absoluteExpiresAt: string;
  idleTimeoutMs: number;
  serverNow: string;
}

// Matches db/assess/test/attempt/attempt-flow.ts's SubmitResult (the POST
// .../submit response) — camelCase, unlike GET .../scorecard's raw DB-model
// shape, which this app doesn't need yet (submit's own response already
// carries everything the result screen shows).
export interface Scorecard {
  scorecardId: string;
  obtainedMarks: string;
  totalMarks: string;
  correctCount: number;
  incorrectCount: number;
  partialCount: number;
  unattemptedCount: number;
  idempotent: boolean;
}

// --- Phase G: dashboard/analytics (real, SQL-aggregated) ------------------
// Mirrors db/assess/analytics/dashboard.ts exactly — every number here comes
// from a SQL count(*)/avg() over the caller's own scored attempts, never
// computed client-side. No percentile/rank/growth/AI-recommendation fields
// exist because nothing in the backend populates them (assess.scorecard.
// percentile is a dead column — see APP_COMPLETION_PLAN.md's Phase G notes)
// — deliberately not fabricated here to fill the gap.

export interface AttemptHistoryEntry {
  attemptId: string;
  testId: string;
  testTitle: string;
  testCode: string;
  mode: SessionMode;
  submittedAt: string;
  obtainedMarks: string;
  totalMarks: string;
  accuracyPercent: string;
}

export interface ScoreTrendPoint {
  attemptId: string;
  submittedAt: string;
  obtainedMarks: string;
  totalMarks: string;
  accuracyPercent: string;
}

export interface SubjectAccuracy {
  subjectCode: SubjectCode;
  subjectName: string;
  correct: number;
  incorrect: number;
  unattempted: number;
  total: number;
  accuracyPercent: number;
}

export interface UnitAccuracy {
  subjectCode: SubjectCode;
  nodeId: string;
  tagCode: string;
  unitTitle: string;
  correct: number;
  incorrect: number;
  unattempted: number;
  total: number;
  accuracyPercent: number;
}

export interface DifficultyAccuracy {
  difficultyBand: string;
  correct: number;
  incorrect: number;
  unattempted: number;
  total: number;
  accuracyPercent: number;
}

export interface TimeBucket {
  bucketLabel: string;
  questionCount: number;
  averageSeconds: number | null;
}

export interface DashboardAnalytics {
  attemptHistory: AttemptHistoryEntry[];
  scoreTrend: ScoreTrendPoint[];
  subjectAccuracy: SubjectAccuracy[];
  unitAccuracy: UnitAccuracy[];
  difficultyAccuracy: DifficultyAccuracy[];
  timeDistribution: TimeBucket[];
  weakestUnits: UnitAccuracy[];
  unattemptedRate: { servedCount: number; unattemptedCount: number; unattemptedPercent: number };
  // BUG-23 (docs/assessment-tool-debug-plan.md) — the real, server-counted
  // "Tests Taken" (attempt_state = 'scored', uncapped — attemptHistory above
  // is capped at 20 for chart/list rendering).
  totalScoredAttempts: number;
}

// --- Phase G: per-attempt review (G4) -------------------------------------
// Mirrors db/assess/test/attempt/attempt-flow.ts's ReviewQuestion — the
// answer-key-revealing, post-scoring-only shape GET /attempts/:id/review
// returns. "Unattempted" for a given question is isCorrect === null (see
// getReview's own comment: a question never interacted with never got an
// attempt_response row at all).

export interface ReviewOption {
  optionId: string;
  optionLabel: string;
  optionText: string;
  isCorrect: boolean;
  wasSelected: boolean;
}

export interface ReviewImage {
  url: string;
  altText: string | null;
  optionId: string | null;
  targetRole: string;
}

export interface ReviewQuestion {
  questionId: string;
  testSectionId: string;
  sequenceNo: number;
  stemText: string;
  questionType: string | null;
  topicTagCode: string;
  topicTitle: string;
  options: ReviewOption[];
  images: ReviewImage[];
  correctNumericValue: string | null;
  studentNumericAnswer: string | null;
  isCorrect: boolean | null;
  marksAwarded: string | null;
  timeSpentSeconds: number | null;
  explanationText: string | null;
  formulaReference: string | null;
}

// --- P1-7: real IRT (Rasch) ability estimate — mirrors db/assess/analytics/irt.ts exactly. ---

export interface IrtItemCharacteristic {
  questionId: string;
  difficulty: number;
  correct: boolean;
}

export interface IrtAbilityTrendPoint {
  attemptId: string;
  submittedAt: string;
  theta: number;
  standardError: number;
}

export type IrtBand = "well above average" | "above average" | "average" | "below average" | "well below average";

export type IrtReport =
  | { available: false; reason: string }
  | {
      available: true;
      theta: number;
      standardError: number;
      itemsUsed: number;
      band: IrtBand;
      itemCharacteristics: IrtItemCharacteristic[];
      abilityTrend: IrtAbilityTrendPoint[];
      calibration: { itemCount: number; personCount: number };
    };

// --- P1-10: detailed report — mirrors db/assess/test/attempt/attempt-flow.ts's
// getScorecardWithSections and db/assess/analytics/dashboard.ts's
// getCohortComparison exactly (raw snake_case — same "read the persisted
// row directly" discipline as the rest of this app's scorecard/review data). ---

export interface ScorecardDetail {
  scorecard_id: string;
  attempt_id: string;
  obtained_marks: string | null;
  total_marks: string | null;
  accuracy_percent: string | null;
  percentile: string | null;
  rank_in_cohort: number | null;
  generated_at: string | null;
}

export interface SectionScoreDetail {
  section_score_id: string;
  scorecard_id: string;
  test_section_id: string;
  section_name: string;
  question_count: number | null;
  obtained_marks: string | null;
  attempted_count: number | null;
  correct_count: number | null;
  average_time_seconds: number | null;
}

export interface ScorecardTiming {
  started_at: string | null;
  submitted_at: string | null;
  allotted_minutes: number | null;
}

export interface DetailedScorecardResponse {
  scorecard: ScorecardDetail;
  sectionScores: SectionScoreDetail[];
  timing: ScorecardTiming | null;
}

export interface CohortComparison {
  cohortAverageAccuracy: number;
  cohortSize: number;
}
