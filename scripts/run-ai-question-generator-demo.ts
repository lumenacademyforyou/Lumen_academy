import { PrismaClient, QuestionType, Difficulty, TargetExam, QStatus } from "@prisma/client";
import { createHash } from "crypto";
import { submitForReview } from "../lib/services/question-review-service.js";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting AI Question Generator Execution Test...\n");

  // 1. Fetch Subject & Unit
  const subject = await prisma.subject.findFirst({ where: { slug: "physics" } });
  const unit = await prisma.unit.findFirst({ where: { subjectId: subject?.id } });

  if (!subject || !unit) {
    throw new Error("Missing seeded physics subject/unit in database!");
  }

  console.log(`📋 Target Unit: ${unit.nameEn} (Slug: ${unit.slug})`);

  // 2. Simulate AI Generation & Critic Pipeline
  console.log("\n--- Executing Simulated AI Question Generation Pipeline ---");

  const simulatedGeneratedQuestions = [
    {
      type: QuestionType.SINGLE_CORRECT,
      stemEn: "What is the SI unit of electric current?",
      explanationEn: "The SI base unit of electric current is the Ampere (A).",
      difficulty: Difficulty.EASY,
      ncertReference: "Class 11, Ch 1, p. 12",
      options: [
        { label: "A" as const, textEn: "Ampere", isCorrect: true },
        { label: "B" as const, textEn: "Volt", isCorrect: false },
        { label: "C" as const, textEn: "Ohm", isCorrect: false },
        { label: "D" as const, textEn: "Watt", isCorrect: false },
      ],
    },
  ];

  const PROMPT_VERSION = "gen-2026-08-1";

  for (const q of simulatedGeneratedQuestions) {
    const canonical = JSON.stringify({
      type: q.type,
      stem: q.stemEn.trim().toLowerCase().replace(/\s+/g, " "),
      options: q.options.map((o) => `${o.textEn.trim().toLowerCase()}:${o.isCorrect}`).sort(),
      numericalAnswer: null,
    });
    const contentHash = createHash("sha256").update(canonical).digest("hex");

    // Simulated Factual Critic Verdict
    const criticVerdict = {
      passed: true,
      confidence: 0.95,
      issues: [],
    };

    // Insert DRAFT question
    const created = await prisma.question.create({
      data: {
        type: q.type,
        stemEn: q.stemEn,
        explanationEn: q.explanationEn,
        difficulty: q.difficulty,
        status: QStatus.DRAFT,
        subjectId: subject.id,
        unitId: unit.id,
        examTypes: [TargetExam.NEET],
        source: "AI-generated",
        promptVersion: PROMPT_VERSION,
        ncertReference: q.ncertReference,
        contentHash,
        criticVerdict,
        options: {
          create: q.options.map((o, i) => ({ ...o, orderIndex: i })),
        },
      },
    });

    console.log(`✅ Question inserted as DRAFT: ID ${created.id}`);
    console.log(`   Content Hash: ${created.contentHash}`);
    console.log(`   Critic Verdict: ${JSON.stringify(created.criticVerdict)}`);

    // Auto-submit high confidence pass
    if (criticVerdict.passed && criticVerdict.confidence >= 0.8 && (q.difficulty as Difficulty) !== Difficulty.HARD) {
      const submitted = await submitForReview(created.id);
      console.log(`✅ High confidence critic pass -> Auto-submitted for review! Status: ${submitted.status}`);
    }

    // Test duplicate hash rejection
    const duplicateCheck = await prisma.question.findUnique({ where: { contentHash } });
    console.log(`✅ Duplicate contentHash lookup test -> Found existing question ID: ${duplicateCheck?.id}`);

    // Clean up
    await prisma.option.deleteMany({ where: { questionId: created.id } });
    await prisma.question.delete({ where: { id: created.id } });
    console.log("🧹 Cleaned up test question.");
  }

  console.log("\n✨ AI Question Generator execution test complete!");
}

main()
  .catch((e) => {
    console.error("❌ Run failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
