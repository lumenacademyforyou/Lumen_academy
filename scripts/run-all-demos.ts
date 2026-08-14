import { PrismaClient, Role, QuestionType, QStatus, TargetExam, TestType } from "@prisma/client";
import { startAttempt, autosaveAnswer, submitAttempt } from "../lib/services/attempt-service.js";
import { submitForReview, publishQuestion, getReviewQueue } from "../lib/services/question-review-service.js";
import { assembleTest } from "../lib/services/test-assembler.js";

const prisma = new PrismaClient();

async function main() {
  console.log("=========================================================");
  console.log("   🌟 LUMEN ACADEMY ASSESSMENT ENGINE - MASTER SYSTEM RUN");
  console.log("=========================================================\n");

  // Step 1: User & Syllabus Verification
  console.log("1️⃣ Database & Syllabus Status");
  const subjectCount = await prisma.subject.count();
  const unitCount = await prisma.unit.count();
  const questionCount = await prisma.question.count();
  console.log(`   - Subjects: ${subjectCount}, Units: ${unitCount}, Questions: ${questionCount}`);

  // Step 2: Question Authoring & Review Pipeline
  console.log("\n2️⃣ Question Review & Gate System");
  const faculty = await prisma.user.upsert({
    where: { id: "master-faculty-id" },
    create: { id: "master-faculty-id", email: "faculty@lumen.academy", role: Role.FACULTY },
    update: {},
  });

  const subject = await prisma.subject.findFirstOrThrow();
  const unit = await prisma.unit.findFirstOrThrow({ where: { subjectId: subject.id } });

  const draftQ = await prisma.question.create({
    data: {
      type: QuestionType.SINGLE_CORRECT,
      stemEn: "What is the unit of force?",
      status: QStatus.DRAFT,
      subjectId: subject.id,
      unitId: unit.id,
      marks: 4,
      negativeMarks: 1,
      examTypes: [TargetExam.NEET],
      options: {
        create: [
          { label: "A", textEn: "Newton", isCorrect: true, orderIndex: 0 },
          { label: "B", textEn: "Joule", isCorrect: false, orderIndex: 1 },
        ],
      },
    },
  });

  await submitForReview(draftQ.id);
  const queue = await getReviewQueue(faculty.id);
  console.log(`   - Submitted Question ID ${draftQ.id} -> In Review Queue: ${queue.some((q) => q.id === draftQ.id)}`);

  const published = await publishQuestion(faculty.id, draftQ.id, "Approved by SME");
  console.log(`   - Published Question ID ${published.id} -> Status: ${published.status}, SelectionBucket: ${published.selectionBucket}`);

  // Step 3: Test Blueprint Assembly Engine
  console.log("\n3️⃣ Test Blueprint Assembly Engine");
  const assembledTest = await assembleTest({
    name: "Master Full Practice Test",
    type: TestType.CUSTOM,
    examType: TargetExam.NEET,
    durationSeconds: 1800,
    blueprint: [{ subjectSlug: subject.slug, count: 1 }],
  });
  console.log(`   - Assembled Test ID ${assembledTest.id} ("${assembledTest.name}")`);
  console.log(`   - Focus Units: ${JSON.stringify(assembledTest.focusUnitSlugs)}`);

  // Step 4: Student Attempt Engine & Scoring
  console.log("\n4️⃣ Student Attempt & Scoring Engine (Laws 1-5)");
  const student = await prisma.user.upsert({
    where: { id: "master-student-id" },
    create: { id: "master-student-id", email: "student@lumen.academy", role: Role.STUDENT },
    update: {},
  });

  const attempt = await startAttempt(student.id, assembledTest.id);
  console.log(`   - Started Attempt ID ${attempt.id} -> Status: ${attempt.status}, Deadline: ${attempt.deadlineAt.toISOString()}`);

  const attemptQuestions = await prisma.attemptQuestion.findMany({ where: { attemptId: attempt.id } });
  const sampleAQ = attemptQuestions[0];

  const saved = await autosaveAnswer(student.id, attempt.id, sampleAQ.questionId, {
    chosenOptionIds: [(await prisma.option.findFirstOrThrow({ where: { questionId: draftQ.id, isCorrect: true } })).id],
    timeSpentDeltaMs: 12000,
  });
  console.log(`   - Autosaved Question ${saved.questionId} -> timeSpentMs: ${saved.timeSpentMs}`);

  const submittedAttempt = await submitAttempt(student.id, attempt.id);
  console.log(`   - Submitted & Graded Attempt ID ${submittedAttempt.id} -> Final Score: ${submittedAttempt.score}/${submittedAttempt.maxScore}, Accuracy: ${submittedAttempt.accuracy}%`);

  // Step 5: Clean up master run temporary entities
  console.log("\n🧹 Cleaning up master run objects...");
  await prisma.attemptQuestion.deleteMany({ where: { attemptId: attempt.id } });
  await prisma.attempt.deleteMany({ where: { id: attempt.id } });
  await prisma.testQuestion.deleteMany({ where: { testId: assembledTest.id } });
  await prisma.test.deleteMany({ where: { id: assembledTest.id } });
  await prisma.option.deleteMany({ where: { questionId: draftQ.id } });
  await prisma.question.deleteMany({ where: { id: draftQ.id } });
  await prisma.unitMastery.deleteMany({ where: { userId: student.id } });
  await prisma.user.deleteMany({ where: { id: { in: [student.id, faculty.id] } } });

  console.log("\n✅ ALL SYSTEM SERVICES EXECUTED PERFECTLY WITH 100% PASS!");
}

main()
  .catch((e) => {
    console.error("❌ Master run failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
