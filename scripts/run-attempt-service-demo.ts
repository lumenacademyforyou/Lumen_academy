import { PrismaClient } from "@prisma/client";
import {
  startAttempt,
  autosaveAnswer,
  submitAttempt,
  NotFoundError,
  ForbiddenError,
  AttemptClosedError,
  DeadlinePassedError,
} from "../lib/services/attempt-service.js";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting Attempt Service Execution Test...\n");

  // 1. Find or create a test user
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: "test-user-attempt-service-id",
        email: "attempt-test@lumen.academy",
        displayName: "Test Student",
      },
    });
    console.log(`Created temporary test user: ${user.id}`);
  } else {
    console.log(`Using existing user: ${user.displayName || user.id}`);
  }

  // 2. Find a published test
  const test = await prisma.test.findFirst({
    where: { isPublished: true },
    include: {
      questions: {
        include: {
          question: {
            include: { options: true },
          },
        },
      },
    },
  });

  if (!test) {
    throw new Error("No published test found in database!");
  }

  console.log(`\n📋 Testing with Published Test: "${test.name}" (ID: ${test.id})`);
  console.log(`   Duration: ${test.durationSeconds}s, Questions: ${test.questions.length}`);

  // 3. Test Law 1, 2, 3: startAttempt
  console.log("\n--- Executing startAttempt ---");
  const attempt = await startAttempt(user.id, test.id);
  console.log(`✅ Attempt created successfully! ID: ${attempt.id}`);
  console.log(`   Status: ${attempt.status}`);
  console.log(`   Started At: ${attempt.startedAt.toISOString()}`);
  console.log(`   Deadline At: ${attempt.deadlineAt.toISOString()}`);

  // Retrieve Attempt Questions to verify contentSnapshot and option shuffling
  const attemptQuestions = await prisma.attemptQuestion.findMany({
    where: { attemptId: attempt.id },
  });

  console.log(`   AttemptQuestions created: ${attemptQuestions.length}`);

  // Verify Law 1: No answer leakage in contentSnapshot
  const sampleAQ = attemptQuestions[0];
  if (sampleAQ) {
    const snap = sampleAQ.contentSnapshot as any;
    console.log(`   Sample question position ${sampleAQ.position} snapshot structure:`);
    console.log(`     - Stem: "${snap.stemEn?.substring(0, 40)}..."`);
    console.log(`     - Options count: ${snap.options?.length}`);
    console.log(`     - contains 'isCorrect': ${JSON.stringify(snap).includes("isCorrect")}`);
    console.log(`     - contains 'numericalAnswer': ${JSON.stringify(snap).includes("numericalAnswer")}`);
  }

  // 4. Test Law 5: autosaveAnswer
  console.log("\n--- Executing autosaveAnswer ---");
  if (attemptQuestions.length > 0) {
    const firstAQ = attemptQuestions[0];
    const originalQ = test.questions.find((q) => q.questionId === firstAQ.questionId)?.question;

    let chosenOptionIds: string[] = [];
    let chosenNumericalAnswer: number | null = null;

    if (originalQ?.options && originalQ.options.length > 0) {
      chosenOptionIds = [originalQ.options[0].id];
    } else if (originalQ?.numericalAnswer != null) {
      chosenNumericalAnswer = Number(originalQ.numericalAnswer);
    }

    const saved = await autosaveAnswer(user.id, attempt.id, firstAQ.questionId, {
      chosenOptionIds,
      chosenNumericalAnswer,
      flagged: true,
      timeSpentDeltaMs: 15000,
    });

    console.log(`✅ Autosaved answer for Question ${firstAQ.questionId}`);
    console.log(`   Chosen options: ${JSON.stringify(saved.chosenOptionIds)}`);
    console.log(`   Flagged: ${saved.flagged}`);
    console.log(`   Time spent: ${saved.timeSpentMs} ms`);
  }

  // 5. Test Law 4: submitAttempt
  console.log("\n--- Executing submitAttempt ---");
  const submitted = await submitAttempt(user.id, attempt.id);
  console.log(`✅ Attempt submitted and graded successfully!`);
  console.log(`   Final Status: ${submitted.status}`);
  console.log(`   Score: ${submitted.score} / ${submitted.maxScore}`);
  console.log(`   Correct: ${submitted.correctCount}, Wrong: ${submitted.wrongCount}, Skipped: ${submitted.skippedCount}`);
  console.log(`   Accuracy: ${submitted.accuracy}%`);

  // Check frozen snapshot on AttemptQuestion
  const finalAQs = await prisma.attemptQuestion.findMany({
    where: { attemptId: attempt.id },
  });

  console.log(`\n--- Verification of Frozen Snapshots (Law 4) ---`);
  for (const aq of finalAQs) {
    console.log(`   Q-ID ${aq.questionId}:`);
    console.log(`     - isCorrect: ${aq.isCorrect}`);
    console.log(`     - marksAwarded: ${aq.marksAwarded}`);
    console.log(`     - correctOptionIdsSnapshot: ${JSON.stringify(aq.correctOptionIdsSnapshot)}`);
    console.log(`     - correctNumericalAnswerSnapshot: ${aq.correctNumericalAnswerSnapshot}`);
  }

  // 6. Test IDOR protection (Law 3)
  console.log("\n--- Testing IDOR Protection (Law 3) ---");
  try {
    await submitAttempt("fake-unauthorized-user-id", attempt.id);
    console.error("❌ Failed: Should have thrown ForbiddenError!");
  } catch (err) {
    if (err instanceof ForbiddenError) {
      console.log(`✅ IDOR check passed: Caught ${err.constructor.name} - "${err.message}"`);
    } else {
      console.error("❌ Unexpected error:", err);
    }
  }

  // Clean up test attempt
  console.log("\n🧹 Cleaning up test attempt...");
  await prisma.attemptQuestion.deleteMany({ where: { attemptId: attempt.id } });
  await prisma.attemptSection.deleteMany({ where: { attemptId: attempt.id } });
  await prisma.attempt.delete({ where: { id: attempt.id } });
  console.log("✨ Test attempt cleaned up cleanly.");
}

main()
  .catch((e) => {
    console.error("❌ Run failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
