import { PrismaClient, QuestionType, QStatus, Role, Difficulty, TargetExam } from "@prisma/client";
import {
  submitForReview,
  publishQuestion,
  rejectQuestion,
  retireQuestion,
  getReviewQueue,
  ForbiddenError,
  ValidationError,
  NotFoundError,
} from "../lib/services/question-review-service.js";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting Question Review Service Execution Test...\n");

  // 1. Setup Reviewer User (FACULTY or ADMIN)
  let facultyUser = await prisma.user.findFirst({
    where: { role: { in: [Role.FACULTY, Role.ADMIN] } },
  });
  if (!facultyUser) {
    facultyUser = await prisma.user.create({
      data: {
        id: "test-faculty-reviewer-id",
        email: "faculty-reviewer@lumen.academy",
        displayName: "Dr. Faculty Reviewer",
        role: Role.FACULTY,
      },
    });
    console.log(`Created test faculty reviewer user: ${facultyUser.id}`);
  } else {
    console.log(`Using existing faculty reviewer: ${facultyUser.displayName || facultyUser.id} (${facultyUser.role})`);
  }

  // Setup Student User (for testing role guard)
  let studentUser = await prisma.user.findFirst({
    where: { role: Role.STUDENT },
  });
  if (!studentUser) {
    studentUser = await prisma.user.create({
      data: {
        id: "test-student-user-id",
        email: "student-user@lumen.academy",
        displayName: "Student User",
        role: Role.STUDENT,
      },
    });
  }

  // 2. Fetch subject and unit for creating test questions
  const subject = await prisma.subject.findFirst();
  const unit = await prisma.unit.findFirst();
  if (!subject || !unit) {
    throw new Error("Missing subject or unit in database for creating questions!");
  }

  // 3. Create a DRAFT Question (SINGLE_CORRECT)
  console.log("\n--- Creating DRAFT Question ---");
  const draftQuestion = await prisma.question.create({
    data: {
      subjectId: subject.id,
      unitId: unit.id,
      type: QuestionType.SINGLE_CORRECT,
      status: QStatus.DRAFT,
      stemEn: "What is the speed of light in vacuum?",
      marks: 4,
      negativeMarks: 1,
      difficulty: Difficulty.EASY,
      examTypes: [TargetExam.NEET],
      options: {
        create: [
          { label: "A", textEn: "3 x 10^8 m/s", isCorrect: true, orderIndex: 0 },
          { label: "B", textEn: "3 x 10^6 m/s", isCorrect: false, orderIndex: 1 },
          { label: "C", textEn: "3 x 10^5 m/s", isCorrect: false, orderIndex: 2 },
          { label: "D", textEn: "3 x 10^7 m/s", isCorrect: false, orderIndex: 3 },
        ],
      },
    },
  });
  console.log(`✅ Draft question created: ${draftQuestion.id} (Status: ${draftQuestion.status})`);

  // 4. Test submitForReview
  console.log("\n--- Executing submitForReview ---");
  const submittedQ = await submitForReview(draftQuestion.id);
  console.log(`✅ Question submitted for review! Status: ${submittedQ.status}`);

  // 5. Test getReviewQueue
  console.log("\n--- Executing getReviewQueue ---");
  const queue = await getReviewQueue(facultyUser.id);
  console.log(`✅ Review queue fetched successfully! Items count: ${queue.length}`);
  const inQueue = queue.some((q) => q.id === draftQuestion.id);
  console.log(`   Target question present in queue: ${inQueue}`);

  // 6. Test Role Guard (Student trying to publish)
  console.log("\n--- Testing Role Security Guard ---");
  try {
    await publishQuestion(studentUser.id, draftQuestion.id);
    console.error("❌ Failed: Student was allowed to publish!");
  } catch (err) {
    if (err instanceof ForbiddenError) {
      console.log(`✅ Role guard passed: Caught ${err.constructor.name} - "${err.message}"`);
    } else {
      console.error("❌ Unexpected error:", err);
    }
  }

  // 7. Test publishQuestion
  console.log("\n--- Executing publishQuestion ---");
  const publishedQ = await publishQuestion(
    facultyUser.id,
    draftQuestion.id,
    "Reviewed and approved — excellent standard question."
  );
  console.log(`✅ Question published successfully!`);
  console.log(`   Status: ${publishedQ.status}`);
  console.log(`   Published At: ${publishedQ.publishedAt?.toISOString()}`);
  console.log(`   Content Hash: ${publishedQ.contentHash}`);
  console.log(`   Selection Bucket: ${publishedQ.selectionBucket}`);
  console.log(`   Reviewed By: ${publishedQ.reviewedById}`);

  // 8. Test Duplicate Content Detection
  console.log("\n--- Testing Duplicate Content Detection ---");
  const duplicateDraft = await prisma.question.create({
    data: {
      subjectId: subject.id,
      unitId: unit.id,
      type: QuestionType.SINGLE_CORRECT,
      status: QStatus.PENDING_REVIEW,
      stemEn: "  What is the speed of light in vacuum?  ", // whitespace padded
      marks: 4,
      negativeMarks: 1,
      examTypes: [TargetExam.NEET],
      options: {
        create: [
          { label: "A", textEn: "3 x 10^8 m/s ", isCorrect: true, orderIndex: 0 },
          { label: "B", textEn: "3 x 10^6 m/s", isCorrect: false, orderIndex: 1 },
          { label: "C", textEn: "3 x 10^5 m/s", isCorrect: false, orderIndex: 2 },
          { label: "D", textEn: "3 x 10^7 m/s", isCorrect: false, orderIndex: 3 },
        ],
      },
    },
  });

  try {
    await publishQuestion(facultyUser.id, duplicateDraft.id);
    console.error("❌ Failed: Allowed duplicate question to publish!");
  } catch (err) {
    if (err instanceof ValidationError) {
      console.log(`✅ Duplicate detection passed: Caught ${err.constructor.name} - "${err.message}"`);
    } else {
      console.error("❌ Unexpected error:", err);
    }
  }

  // Clean up duplicate draft
  await prisma.option.deleteMany({ where: { questionId: duplicateDraft.id } });
  await prisma.question.delete({ where: { id: duplicateDraft.id } });

  // 9. Test rejectQuestion
  console.log("\n--- Testing rejectQuestion ---");
  const badQuestion = await prisma.question.create({
    data: {
      subjectId: subject.id,
      unitId: unit.id,
      type: QuestionType.SINGLE_CORRECT,
      status: QStatus.PENDING_REVIEW,
      stemEn: "Flawed question stem",
      marks: 4,
      negativeMarks: 1,
      examTypes: [TargetExam.NEET],
      options: {
        create: [
          { label: "A", textEn: "Option 1", isCorrect: false, orderIndex: 0 },
          { label: "B", textEn: "Option 2", isCorrect: false, orderIndex: 1 },
        ],
      },
    },
  });

  const rejectedQ = await rejectQuestion(
    facultyUser.id,
    badQuestion.id,
    "Rejected: No correct option specified among options."
  );
  console.log(`✅ Question rejected successfully! Status: ${rejectedQ.status}`);
  console.log(`   Review Notes: "${rejectedQ.reviewNotes}"`);

  // Clean up bad question
  await prisma.option.deleteMany({ where: { questionId: badQuestion.id } });
  await prisma.question.delete({ where: { id: badQuestion.id } });

  // 10. Test retireQuestion
  console.log("\n--- Executing retireQuestion ---");
  const retiredQ = await retireQuestion(facultyUser.id, draftQuestion.id);
  console.log(`✅ Question retired successfully! Status: ${retiredQ.status}`);
  console.log(`   Retired At: ${retiredQ.retiredAt?.toISOString()}`);

  // Clean up test published/retired question
  console.log("\n🧹 Cleaning up test question data...");
  await prisma.option.deleteMany({ where: { questionId: draftQuestion.id } });
  await prisma.question.delete({ where: { id: draftQuestion.id } });
  console.log("✨ All test questions cleaned up.");
}

main()
  .catch((e) => {
    console.error("❌ Run failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
