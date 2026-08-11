import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [subjects, units, topics, questions, options, testSections, testQuestions, tests, questionsByType] =
    await prisma.$transaction([
      prisma.subject.count(),
      prisma.unit.count(),
      prisma.topic.count(),
      prisma.question.count(),
      prisma.option.count(),
      prisma.testSection.count(),
      prisma.testQuestion.count(),
      prisma.test.findMany({
        where: { name: { startsWith: "__DEMO__" } },
        select: {
          name: true,
          examType: true,
          isPublished: true,
          _count: { select: { questions: true } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.question.groupBy({
        by: ["type"],
        _count: { _all: true },
        orderBy: { type: "asc" },
      }),
    ]);

  console.log(
    JSON.stringify(
      {
        counts: { subjects, units, topics, questions, options, testSections, testQuestions },
        tests,
        questionsByType,
      },
      null,
      2,
    ),
  );
}

async function run() {
  try {
    await main();
  } finally {
    await prisma.$disconnect();
  }
}

void run();
