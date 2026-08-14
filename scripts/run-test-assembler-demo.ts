import { PrismaClient, TargetExam, TestType, Role } from "@prisma/client";
import {
  assembleTest,
  assembleRevisionTest,
  BlueprintError,
} from "../lib/services/test-assembler.js";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting Test Assembler Execution Test...\n");

  // 1. Setup Test User
  let user = await prisma.user.findFirst({
    where: { role: Role.STUDENT },
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: "test-assembler-user-id",
        email: "assembler-user@lumen.academy",
        displayName: "Assembler Test Student",
        role: Role.STUDENT,
        targetExam: TargetExam.NEET,
      },
    });
  }

  // 2. Test assembleTest with custom blueprint
  console.log("--- 1. Testing assembleTest ---");
  const subjects = await prisma.subject.findMany({ take: 2 });
  if (subjects.length === 0) {
    throw new Error("No subjects found in database!");
  }

  const blueprint = [
    { subjectSlug: "physics", count: 1 },
    { subjectSlug: "botany", count: 1 },
  ];

  try {
    const assembledTest = await assembleTest({
      name: "Custom Practice Test #1",
      type: TestType.CUSTOM,
      examType: TargetExam.NEET,
      durationSeconds: 1800,
      blueprint,
      ownerUserId: user.id,
    });

    console.log(`✅ Test assembled successfully! ID: ${assembledTest.id}`);
    console.log(`   Name: "${assembledTest.name}"`);
    console.log(`   Type: ${assembledTest.type}`);
    console.log(`   Exam Type: ${assembledTest.examType}`);
    console.log(`   Focus Units: ${JSON.stringify(assembledTest.focusUnitSlugs)}`);

    // Clean up test
    await prisma.testQuestion.deleteMany({ where: { testId: assembledTest.id } });
    await prisma.test.delete({ where: { id: assembledTest.id } });
  } catch (err) {
    if (err instanceof BlueprintError) {
      console.log(`⚠️ Blueprint shortfall: ${err.message}`);
    } else {
      throw err;
    }
  }

  // 3. Test Blueprint Shortfall Error
  console.log("\n--- 2. Testing Blueprint Shortfall Error ---");
  try {
    await assembleTest({
      name: "Impossible Test",
      type: TestType.CUSTOM,
      examType: TargetExam.NEET,
      durationSeconds: 1800,
      blueprint: [{ subjectSlug: "physics", count: 9999 }],
    });
    console.error("❌ Failed: BlueprintError should have been thrown!");
  } catch (err) {
    if (err instanceof BlueprintError) {
      console.log(`✅ Caught expected BlueprintError: "${err.message}"`);
      console.log(`   Shortfalls detail: ${JSON.stringify(err.shortfalls)}`);
    } else {
      console.error("❌ Unexpected error:", err);
    }
  }

  // 4. Test assembleRevisionTest
  console.log("\n--- 3. Testing assembleRevisionTest ---");
  const physicsUnit = await prisma.unit.findFirst({
    where: { subject: { slug: "physics" } },
  });

  if (physicsUnit) {
    // Seed mock UnitMastery record
    await prisma.unitMastery.upsert({
      where: { userId_unitId: { userId: user.id, unitId: physicsUnit.id } },
      create: {
        userId: user.id,
        unitId: physicsUnit.id,
        attempted: 5,
        correct: 1,
        wrong: 4,
        accuracy: 20,
      },
      update: {
        attempted: 5,
        accuracy: 20,
      },
    });

    try {
      const revisionTest = await assembleRevisionTest(user.id, "mock-source-attempt-id", 2);
      console.log(`✅ AI Revision Test assembled successfully! ID: ${revisionTest.id}`);
      console.log(`   Name: "${revisionTest.name}"`);
      console.log(`   Type: ${revisionTest.type}`);
      console.log(`   Source Attempt ID: ${revisionTest.sourceAttemptId}`);
      console.log(`   Focus Units: ${JSON.stringify(revisionTest.focusUnitSlugs)}`);

      // Clean up revision test
      await prisma.testQuestion.deleteMany({ where: { testId: revisionTest.id } });
      await prisma.test.delete({ where: { id: revisionTest.id } });
    } catch (err) {
      if (err instanceof BlueprintError) {
        console.log(`⚠️ Revision blueprint shortfall: ${err.message}`);
      } else {
        throw err;
      }
    } finally {
      await prisma.unitMastery.deleteMany({ where: { userId: user.id } });
    }
  }

  console.log("\n✨ Test Assembler execution test complete!");
}

main()
  .catch((e) => {
    console.error("❌ Run failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
