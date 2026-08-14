// tests/idor.test.ts
//
// "User A cannot read or write User B's row" — for every student-owned
// table the service layer touches. Run against a real (test) Postgres
// instance, not mocks: IDOR bugs live in the actual WHERE clause, and a
// mocked Prisma client can't catch a missing userId filter.
//
// Setup: DATABASE_URL / DIRECT_URL should point at a disposable test DB.
//   npx prisma migrate deploy   (against the test DB)
//   npx vitest run tests/idor.test.ts
//
// Pattern per test: create two students (and where relevant, a faculty
// user), have student A create/own a row, then assert student B is
// rejected by every service function that touches it — never assert only
// on the HTTP layer, since a route can be added later that forgets the
// check the underlying service was supposed to enforce.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient, Role, QStatus, QuestionType, TargetExam } from "@prisma/client";
import {
  startAttempt,
  autosaveAnswer,
  submitAttempt,
  ForbiddenError as AttemptForbiddenError,
  NotFoundError as AttemptNotFoundError,
} from "../lib/services/attempt-service";
import {
  publishQuestion,
  rejectQuestion,
  retireQuestion,
  getReviewQueue,
  submitForReview,
  ForbiddenError as ReviewForbiddenError,
} from "../lib/services/question-review-service";

const prisma = new PrismaClient();

let studentA: { id: string };
let studentB: { id: string };
let faculty: { id: string };
let subjectId: string;
let unitId: string;

beforeAll(async () => {
  // Pre-cleanup in case of prior interrupted run
  await prisma.attemptQuestion.deleteMany({ where: { attempt: { userId: { in: ["test-student-a", "test-student-b"] } } } });
  await prisma.attemptSection.deleteMany({ where: { attempt: { userId: { in: ["test-student-a", "test-student-b"] } } } });
  await prisma.attempt.deleteMany({ where: { userId: { in: ["test-student-a", "test-student-b"] } } });
  await prisma.unitMastery.deleteMany({ where: { userId: { in: ["test-student-a", "test-student-b"] } } });
  await prisma.user.deleteMany({ where: { id: { in: ["test-student-a", "test-student-b", "test-faculty"] } } });

  studentA = await prisma.user.create({ data: { id: "test-student-a", role: Role.STUDENT } });
  studentB = await prisma.user.create({ data: { id: "test-student-b", role: Role.STUDENT } });
  faculty = await prisma.user.create({ data: { id: "test-faculty", role: Role.FACULTY } });

  const subject = await prisma.subject.create({
    data: { slug: `test-subject-${Date.now()}`, nameEn: "Test Subject", examTypes: [TargetExam.NEET] },
  });
  subjectId = subject.id;

  const unit = await prisma.unit.create({
    data: { slug: `test-unit-${Date.now()}`, nameEn: "Test Unit", subjectId, examTypes: [TargetExam.NEET] },
  });
  unitId = unit.id;
});

afterAll(async () => {
  // Order matters — children before parents.
  await prisma.attemptQuestion.deleteMany({ where: { attempt: { userId: { in: [studentA.id, studentB.id] } } } });
  await prisma.attemptSection.deleteMany({ where: { attempt: { userId: { in: [studentA.id, studentB.id] } } } });
  await prisma.attempt.deleteMany({ where: { userId: { in: [studentA.id, studentB.id] } } });
  await prisma.unitMastery.deleteMany({ where: { unitId } });
  await prisma.testQuestion.deleteMany({ where: { test: { ownerUserId: null } } });
  await prisma.option.deleteMany({ where: { question: { unitId } } });
  await prisma.question.deleteMany({ where: { unitId } });
  await prisma.test.deleteMany({ where: { name: { startsWith: "IDOR test" } } });
  await prisma.unit.delete({ where: { id: unitId } });
  await prisma.subject.delete({ where: { id: subjectId } });
  await prisma.user.deleteMany({ where: { id: { in: [studentA.id, studentB.id, faculty.id] } } });
  await prisma.$disconnect();
});

// Fresh published question + test before every test in the Attempt block,
// so attempts in one test never leak state into the next.
async function createPublishedTest() {
  const question = await prisma.question.create({
    data: {
      type: QuestionType.SINGLE_CORRECT,
      stemEn: "2 + 2 = ?",
      status: QStatus.PUBLISHED,
      subjectId,
      unitId,
      marks: 4,
      negativeMarks: 1,
      examTypes: [TargetExam.NEET],
      options: {
        create: [
          { label: "A", textEn: "3", orderIndex: 0, isCorrect: false },
          { label: "B", textEn: "4", orderIndex: 1, isCorrect: true },
          { label: "C", textEn: "5", orderIndex: 2, isCorrect: false },
          { label: "D", textEn: "22", orderIndex: 3, isCorrect: false },
        ],
      },
    },
  });

  const test = await prisma.test.create({
    data: {
      name: `IDOR test ${Date.now()}`,
      type: "SUBJECT",
      examType: TargetExam.NEET,
      isPublished: true,
      durationSeconds: 3600,
      questions: { create: [{ questionId: question.id, orderIndex: 0 }] },
    },
  });

  return { question, test };
}

describe("Attempt ownership (IDOR)", () => {
  it("student B cannot autosave into student A's attempt", async () => {
    const { question, test } = await createPublishedTest();
    const attempt = await startAttempt(studentA.id, test.id);

    await expect(
      autosaveAnswer(studentB.id, attempt.id, question.id, { chosenOptionIds: ["x"] })
    ).rejects.toBeInstanceOf(AttemptForbiddenError);

    // And confirm nothing was actually written.
    const aq = await prisma.attemptQuestion.findUnique({
      where: { attemptId_questionId: { attemptId: attempt.id, questionId: question.id } },
    });
    expect(aq?.chosenOptionIds).toEqual([]);
  });

  it("student B cannot submit student A's attempt", async () => {
    const { test } = await createPublishedTest();
    const attempt = await startAttempt(studentA.id, test.id);

    await expect(submitAttempt(studentB.id, attempt.id)).rejects.toBeInstanceOf(
      AttemptForbiddenError
    );

    const reloaded = await prisma.attempt.findUnique({ where: { id: attempt.id } });
    expect(reloaded?.status).toBe("IN_PROGRESS");
    expect(reloaded?.submittedAt).toBeNull();
  });

  it("student B cannot autosave using a guessed/nonexistent attempt id", async () => {
    await expect(
      autosaveAnswer(studentB.id, "00000000-0000-0000-0000-000000000000", "irrelevant", {
        flagged: true,
      })
    ).rejects.toBeInstanceOf(AttemptNotFoundError);
  });

  it("a submitted attempt's answer key snapshot is never visible before submit", async () => {
    const { question, test } = await createPublishedTest();
    const attempt = await startAttempt(studentA.id, test.id);

    const aqBeforeSubmit = await prisma.attemptQuestion.findUnique({
      where: { attemptId_questionId: { attemptId: attempt.id, questionId: question.id } },
    });
    expect(aqBeforeSubmit?.correctOptionIdsSnapshot).toEqual([]);
    expect(aqBeforeSubmit?.isCorrect).toBeNull();

    // Sanity: contentSnapshot itself must not carry isCorrect anywhere.
    const snapshotStr = JSON.stringify(aqBeforeSubmit?.contentSnapshot);
    expect(snapshotStr).not.toContain("isCorrect");
  });

  it("student A's own attempt still works end to end (control case)", async () => {
    const { question, test } = await createPublishedTest();
    const attempt = await startAttempt(studentA.id, test.id);

    await autosaveAnswer(studentA.id, attempt.id, question.id, {
      chosenOptionIds: [
        (await prisma.option.findFirstOrThrow({ where: { questionId: question.id, isCorrect: true } })).id,
      ],
    });

    const submitted = await submitAttempt(studentA.id, attempt.id);
    expect(submitted.status).toBe("SUBMITTED");
    expect(submitted.correctCount).toBe(1);
    expect(submitted.score).toBe(4);
  });
});

describe("Question review authorization (IDOR / role escalation)", () => {
  let pendingQuestionId: string;

  beforeEach(async () => {
    const q = await prisma.question.create({
      data: {
        type: QuestionType.SINGLE_CORRECT,
        stemEn: "Pending question",
        status: QStatus.DRAFT,
        subjectId,
        unitId,
        examTypes: [TargetExam.NEET],
        options: {
          create: [
            { label: "A", textEn: "opt a", orderIndex: 0, isCorrect: true },
            { label: "B", textEn: "opt b", orderIndex: 1, isCorrect: false },
          ],
        },
      },
    });
    await submitForReview(q.id);
    pendingQuestionId = q.id;
  });

  it("a STUDENT cannot publish a question, even one they didn't author", async () => {
    await expect(
      publishQuestion(studentA.id, pendingQuestionId)
    ).rejects.toBeInstanceOf(ReviewForbiddenError);

    const q = await prisma.question.findUnique({ where: { id: pendingQuestionId } });
    expect(q?.status).toBe(QStatus.PENDING_REVIEW);
  });

  it("a STUDENT cannot reject or retire a question", async () => {
    await expect(
      rejectQuestion(studentA.id, pendingQuestionId, "nice try")
    ).rejects.toBeInstanceOf(ReviewForbiddenError);
    await expect(retireQuestion(studentA.id, pendingQuestionId)).rejects.toBeInstanceOf(
      ReviewForbiddenError
    );
  });

  it("a STUDENT cannot list the review queue", async () => {
    await expect(getReviewQueue(studentA.id)).rejects.toBeInstanceOf(ReviewForbiddenError);
  });

  it("FACULTY can publish, and the row is attributable to them", async () => {
    const published = await publishQuestion(faculty.id, pendingQuestionId);
    expect(published.status).toBe(QStatus.PUBLISHED);
    expect(published.reviewedById).toBe(faculty.id);
    expect(published.reviewedAt).not.toBeNull();
  });
});
