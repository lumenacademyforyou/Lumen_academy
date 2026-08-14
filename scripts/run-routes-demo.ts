import { NextRequest } from "next/server";
import { PrismaClient, Role, QuestionType, QStatus, TargetExam } from "@prisma/client";
import { POST as startAttemptRoute } from "../app/api/attempts/route.js";
import { PATCH as autosaveRoute } from "../app/api/attempts/[attemptId]/answers/[questionId]/route.js";
import { POST as submitAttemptRoute } from "../app/api/attempts/[attemptId]/submit/route.js";
import { POST as submitForReviewRoute } from "../app/api/questions/[questionId]/submit-for-review/route.js";
import { POST as publishRoute } from "../app/api/questions/[questionId]/publish/route.js";
import { POST as rejectRoute } from "../app/api/questions/[questionId]/reject/route.js";
import { POST as retireRoute } from "../app/api/questions/[questionId]/retire/route.js";
import { GET as reviewQueueRoute } from "../app/api/questions/review-queue/route.js";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting API Routes Execution Test...\n");

  // 1. Unauthenticated Request Verification (Checks route handling & auth layer)
  console.log("--- 1. Testing Unauthenticated Route Rejection ---");
  const reqStartUnauth = new NextRequest("http://localhost:3000/api/attempts", {
    method: "POST",
    body: JSON.stringify({ testId: "00000000-0000-0000-0000-000000000000" }),
  });
  const resStartUnauth = await startAttemptRoute(reqStartUnauth);
  console.log(`✅ Unauthenticated POST /api/attempts -> Status: ${resStartUnauth.status}`);
  console.log(`   Response: ${JSON.stringify(await resStartUnauth.json())}`);

  const reqQueueUnauth = new NextRequest("http://localhost:3000/api/questions/review-queue?limit=10");
  const resQueueUnauth = await reviewQueueRoute(reqQueueUnauth);
  console.log(`✅ Unauthenticated GET /api/questions/review-queue -> Status: ${resQueueUnauth.status}`);
  console.log(`   Response: ${JSON.stringify(await resQueueUnauth.json())}`);

  // 2. Setup Test Data (Subject, Unit, Question, Test)
  const subject = await prisma.subject.create({
    data: { slug: `route-subject-${Date.now()}`, nameEn: "Route Test Subject", examTypes: [TargetExam.NEET] },
  });

  const unit = await prisma.unit.create({
    data: { slug: `route-unit-${Date.now()}`, nameEn: "Route Test Unit", subjectId: subject.id, examTypes: [TargetExam.NEET] },
  });

  const question = await prisma.question.create({
    data: {
      type: QuestionType.SINGLE_CORRECT,
      stemEn: "What is 5 + 5?",
      status: QStatus.DRAFT,
      subjectId: subject.id,
      unitId: unit.id,
      marks: 4,
      negativeMarks: 1,
      examTypes: [TargetExam.NEET],
      options: {
        create: [
          { label: "A", textEn: "10", isCorrect: true, orderIndex: 0 },
          { label: "B", textEn: "20", isCorrect: false, orderIndex: 1 },
        ],
      },
    },
  });

  console.log(`\n--- 2. Testing Question Review Routes ---`);
  // Route: Submit for Review
  const reqSubmitReview = new NextRequest(`http://localhost:3000/api/questions/${question.id}/submit-for-review`, {
    method: "POST",
  });
  const resSubmitReview = await submitForReviewRoute(reqSubmitReview, { params: { questionId: question.id } });
  console.log(`✅ POST /api/questions/${question.id}/submit-for-review -> Status: ${resSubmitReview.status}`);

  // Route: Publish (requires FACULTY/ADMIN)
  const reqPublish = new NextRequest(`http://localhost:3000/api/questions/${question.id}/publish`, {
    method: "POST",
    body: JSON.stringify({ reviewNotes: "Looks good" }),
  });
  const resPublish = await publishRoute(reqPublish, { params: { questionId: question.id } });
  console.log(`✅ Unauthenticated POST /api/questions/${question.id}/publish -> Status: ${resPublish.status} (Protected)`);

  // Route: Retire
  const reqRetire = new NextRequest(`http://localhost:3000/api/questions/${question.id}/retire`, {
    method: "POST",
  });
  const resRetire = await retireRoute(reqRetire, { params: { questionId: question.id } });
  console.log(`✅ Unauthenticated POST /api/questions/${question.id}/retire -> Status: ${resRetire.status} (Protected)`);

  // Clean up test data
  console.log("\n🧹 Cleaning up route test data...");
  await prisma.option.deleteMany({ where: { questionId: question.id } });
  await prisma.question.delete({ where: { id: question.id } });
  await prisma.unit.delete({ where: { id: unit.id } });
  await prisma.subject.delete({ where: { id: subject.id } });
  console.log("✨ Cleaned up route test data.");
}

main()
  .catch((e) => {
    console.error("❌ Run failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
