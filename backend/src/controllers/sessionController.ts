import crypto from "node:crypto";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { pool } from "../../../db/shared/pool.js";
import { AppError } from "../middleware/errorHandler.js";
import { createPracticeTest, type PracticeTestLine } from "../../../db/assess/test/definition/create-practice-test.js";
import { startAttempt } from "../../../db/assess/test/attempt/attempt-flow.js";
import { getAttemptEnvelope } from "../../../db/assess/test/attempt/envelope.js";

// POST /api/assess/sessions (LA-APP-COMPLETION-001 Phase C, C1). One call that
// covers all three test-directory entry points (subject-wise practice, full
// mock, custom builder): resolves a blueprint, creates+publishes the
// underlying assess.test via createPracticeTest (already supports arbitrary
// multi-line blueprints — see db/assess/test/definition/create-practice-test.ts's
// header comment), immediately starts an attempt against it (assembly +
// seeding + the exposure-ledger exclusion all happen inside startAttempt ->
// assembleForAttempt), and returns the same answer-key-free envelope
// GET /api/assess/attempts/:id/envelope returns — so the client gets a fixed,
// ready-to-render question set in one round trip, matching "a session with
// its question set already fixed" from the directive.
//
// Business-rule assumption (not recoverable from the existing schema — no
// canonical full-NEET catalog.exam_pattern exists yet): a full mock follows
// the real NEET exam's standard structure, 45 questions per subject (Physics,
// Chemistry, Botany, Zoology), 180 total, 180 minutes. Internal-choice (NEET
// actually shows 50/subject with 45 to be attempted) is not modelled — every
// served question counts, matching how the rest of this app's scoring works.
const FULL_MOCK_DURATION_MINUTES = 180;
const FULL_MOCK_QUESTIONS_PER_SUBJECT = 45;

// Phase C, C5: each session call creates its own fresh assess.test (see
// createSession below — a session is never shared across attempts), and
// assess.test_section.sequence_no (set once at creation, from this array's
// order) is what envelope.ts's section list is ordered by — so shuffling
// this array per request is sufficient for "a full mock is not served
// subject-block by subject-block" without touching persistence/ordering
// logic elsewhere. Each subject's own questions stay contiguous within
// their section; only which section comes first/second/etc. varies.
function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const difficultyBandSchema = z.enum(["easy", "medium", "hard"]);

const customLineSchema = z.object({
  subjectId: z.string().uuid(),
  syllabusNodeId: z.string().uuid().optional(),
  includeDescendants: z.boolean().optional(),
  difficultyBand: difficultyBandSchema.optional(),
  questionFormat: z.string().min(1).optional(),
  pickCount: z.number().int().positive(),
  sectionName: z.string().min(1),
});

const createSessionSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("subject-wise"),
    title: z.string().min(1),
    durationMinutes: z.number().int().positive(),
    subjectId: z.string().uuid(),
    syllabusNodeId: z.string().uuid().optional(),
    includeDescendants: z.boolean().optional(),
    difficultyBand: difficultyBandSchema.optional(),
    questionFormat: z.string().min(1).optional(),
    pickCount: z.number().int().positive(),
  }),
  z.object({
    mode: z.literal("full-mock"),
    title: z.string().min(1).optional(),
  }),
  z.object({
    mode: z.literal("custom"),
    title: z.string().min(1),
    durationMinutes: z.number().int().positive(),
    lines: z.array(customLineSchema).min(1),
  }),
]);

type CreateSessionInput = z.infer<typeof createSessionSchema>;

// BUG-28 (docs/assessment-tool-debug-plan.md): "Gate Full Tests" — the
// plan's recommended rule (option a): an account with no completed practice
// test cannot start a full mock. Found live, not guessed, that this had
// zero server-side enforcement before this fix — TestListView.tsx's
// "Start Full Mock Test" button had its own *different*, currently
// feature-flagged-off gate (FULL_MOCK_REQUIRES_SYLLABUS_COMPLETION, a
// separate P1-9 decision, left untouched here), and StudyPlanView.tsx's
// "Mock Test" quick-start button called createSession({mode:"full-mock"})
// with no gate at all. Enforced here, on the one endpoint both paths funnel
// through, per the plan's explicit "hiding the button is not sufficient."
// "Completed" reuses the same attempt_state='scored' definition BUG-23 (P8)
// established as this app's one source of truth for that word; "practice"
// excludes MOCK-type tests via the test_code TEST_TYPE segment
// (test-code.ts) the same way deriveSessionModeFromTestCode does, since
// test_type itself isn't a real column (see that file's own header).
async function hasCompletedPracticeTest(appUserId: string): Promise<boolean> {
  const res = await pool.query(
    `select 1 from assess.attempt a
       join assess.test t on t.test_id = a.test_id
      where a.user_id = $1 and a.attempt_state = 'scored' and t.test_code !~ '^LMN-[A-Z]+-MOCK-'
      limit 1`,
    [appUserId]
  );
  return (res.rowCount ?? 0) > 0;
}

async function resolveActiveExam(): Promise<{ examId: string; examCode: string }> {
  const res = await pool.query<{ exam_id: string; exam_code: string }>(
    `select exam_id, exam_code from catalog.exam where is_active = true order by exam_id limit 1`
  );
  if (res.rowCount === 0) throw new AppError(500, "NO_ACTIVE_EXAM", "No active catalog.exam row exists.");
  return { examId: res.rows[0].exam_id, examCode: res.rows[0].exam_code };
}

async function resolveAllSubjectIds(examId: string): Promise<{ subjectId: string; subjectCode: string }[]> {
  const res = await pool.query<{ subject_id: string; subject_code: string }>(
    `select subject_id, subject_code from catalog.subject where exam_id = $1 order by display_order`,
    [examId]
  );
  return res.rows.map((r) => ({ subjectId: r.subject_id, subjectCode: r.subject_code }));
}

function toLines(input: CreateSessionInput, subjects: { subjectId: string; subjectCode: string }[]): {
  testType: "SUBJ" | "UNIT" | "MOCK";
  scopeCode: string;
  title: string;
  durationMinutes: number;
  lines: PracticeTestLine[];
} {
  if (input.mode === "subject-wise") {
    const subject = subjects.find((s) => s.subjectId === input.subjectId);
    if (!subject) throw new AppError(400, "VALIDATION_ERROR", `subjectId ${input.subjectId} is not a subject of the active exam.`);
    return {
      testType: input.syllabusNodeId ? "UNIT" : "SUBJ",
      scopeCode: subject.subjectCode,
      title: input.title,
      durationMinutes: input.durationMinutes,
      lines: [
        {
          subjectId: input.subjectId,
          syllabusNodeId: input.syllabusNodeId ?? null,
          includeDescendants: input.includeDescendants ?? true,
          difficultyBand: input.difficultyBand ?? null,
          questionFormat: input.questionFormat ?? null,
          pickCount: input.pickCount,
          sectionName: subject.subjectCode,
        },
      ],
    };
  }

  if (input.mode === "full-mock") {
    return {
      testType: "MOCK",
      scopeCode: "ALL",
      title: input.title ?? "Full Mock Test",
      durationMinutes: FULL_MOCK_DURATION_MINUTES,
      lines: shuffled(subjects).map((s) => ({
        subjectId: s.subjectId,
        includeDescendants: true,
        pickCount: FULL_MOCK_QUESTIONS_PER_SUBJECT,
        sectionName: s.subjectCode,
      })),
    };
  }

  // custom: the frontend owns turning "several selected units + an overall
  // difficulty mix + a total count" into concrete per-line pickCounts — this
  // endpoint only validates and assembles the lines it's given, the same
  // general primitive full-mock and subject-wise both build on.
  const subjectIds = new Set(subjects.map((s) => s.subjectId));
  for (const line of input.lines) {
    if (!subjectIds.has(line.subjectId)) {
      throw new AppError(400, "VALIDATION_ERROR", `subjectId ${line.subjectId} is not a subject of the active exam.`);
    }
  }
  return {
    testType: "MOCK",
    scopeCode: "CUSTOM",
    title: input.title,
    durationMinutes: input.durationMinutes,
    lines: input.lines,
  };
}

export async function createSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      next(new AppError(400, "VALIDATION_ERROR", parsed.error.issues[0].message));
      return;
    }

    if (parsed.data.mode === "full-mock" && !(await hasCompletedPracticeTest(req.user!.appUserId))) {
      next(new AppError(403, "FULL_MOCK_LOCKED", "Complete at least one subject-wise practice test before starting a Full Mock Test."));
      return;
    }

    const { examId, examCode } = await resolveActiveExam();
    const subjects = await resolveAllSubjectIds(examId);
    const { testType, scopeCode, title, durationMinutes, lines } = toLines(parsed.data, subjects);

    const test = await createPracticeTest({
      examId,
      examCode,
      testType,
      scopeCode,
      title,
      durationMinutes,
      createdBy: req.user!.appUserId,
      lines,
    });
    await pool.query(`update assess.test set test_status = 'published' where test_id = $1`, [test.testId]);

    const attempt = await startAttempt(test.testId, req.user!.appUserId);
    const envelope = await getAttemptEnvelope(attempt.attemptId, req.user!.appUserId);

    res.status(201).json({ data: { mode: parsed.data.mode, testId: test.testId, testCode: test.testCode, ...envelope } });
  } catch (err) {
    next(err);
  }
}
