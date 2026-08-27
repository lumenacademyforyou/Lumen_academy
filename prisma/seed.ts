import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../backend/src/generated/prisma/client.js";
import { ALL_QUESTIONS } from "../database_sample/questions.js";
import { SYLLABUS_UNITS } from "../database_sample/syllabusData.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SUBJECTS = [
  { id: "physics", name: "Physics", displayOrder: 1 },
  { id: "chemistry", name: "Chemistry", displayOrder: 2 },
  { id: "botany", name: "Botany", displayOrder: 3 },
  { id: "zoology", name: "Zoology", displayOrder: 4 },
];

// The legacy question bank (src/database/questions.ts) tags each question with
// a free-text unit name rather than a real unit id, and some tags are reused
// loosely across topics that overlap (e.g. genetics vs. evolution). This maps
// each distinct free-text tag to the closest real unit id by subject matter —
// a one-time, best-effort mapping since the source data predates the schema.
const LEGACY_UNIT_TAG_TO_UNIT_ID: Record<string, string> = {
  "Molecular Basis of Inheritance": "bot_01",
  "Genetics & Evolution": "zoo_05",
  "Ecology & Environment": "bot_05",
  "Biotechnology & Applications": "zoo_06",
  "p-Block & Periodic Trends": "chem_02",
  "p-Block & Inorganic Chemistry": "chem_02",
  "Solutions & Physical Chemistry": "chem_06",
  "Coordination Compounds": "chem_02",
  "Organic Chemistry - Reactions": "chem_01",
  "Rotational Dynamics & Mechanics": "phy_01",
  "Electrostatics & Capacitance": "phy_02",
  "Modern Physics & Dual Nature": "phy_08",
  "Oscillations & SHM": "phy_05",
};

const OPTION_LABELS = ["A", "B", "C", "D"];

async function main() {
  for (const subject of SUBJECTS) {
    await prisma.subject.upsert({
      where: { id: subject.id },
      update: { name: subject.name, displayOrder: subject.displayOrder },
      create: subject,
    });
  }

  const perSubjectOrder: Record<string, number> = {};
  const unitCountBySubject: Record<string, number> = {};

  for (const unit of SYLLABUS_UNITS) {
    const displayOrder = perSubjectOrder[unit.subject] ?? 0;
    perSubjectOrder[unit.subject] = displayOrder + 1;

    await prisma.unit.upsert({
      where: { id: unit.id },
      update: {
        subjectId: unit.subject,
        name: unit.unitName,
        weightageMarks: unit.weightageMarks,
        displayOrder,
        ncertClass: unit.ncertClass,
        expectedQuestions: unit.expectedQuestions,
        weightagePercent: unit.weightagePercent,
        subtopics: unit.subtopics,
        keyFormulas: unit.keyFormulas,
        overview: unit.overview,
        highYieldNcertChapter: unit.highYieldNCERTChapter,
        badgeColor: unit.badgeColor,
      },
      create: {
        id: unit.id,
        subjectId: unit.subject,
        name: unit.unitName,
        weightageMarks: unit.weightageMarks,
        displayOrder,
        ncertClass: unit.ncertClass,
        expectedQuestions: unit.expectedQuestions,
        weightagePercent: unit.weightagePercent,
        subtopics: unit.subtopics,
        keyFormulas: unit.keyFormulas,
        overview: unit.overview,
        highYieldNcertChapter: unit.highYieldNCERTChapter,
        badgeColor: unit.badgeColor,
      },
    });

    unitCountBySubject[unit.subject] = (unitCountBySubject[unit.subject] ?? 0) + 1;
  }

  console.log(`Seeded ${SUBJECTS.length} subjects.`);
  for (const [subject, count] of Object.entries(unitCountBySubject)) {
    console.log(`  ${subject}: ${count} units`);
  }

  const questionCountByUnit: Record<string, number> = {};
  let skipped = 0;

  for (const question of ALL_QUESTIONS) {
    const unitTag = question.unit ?? "";
    const unitId = LEGACY_UNIT_TAG_TO_UNIT_ID[unitTag];

    if (!unitId) {
      console.warn(`  Skipping question ${question.id}: no unit mapping for tag "${unitTag}"`);
      skipped += 1;
      continue;
    }

    const questionId = `q_${question.id}`;

    await prisma.question.upsert({
      where: { id: questionId },
      update: {
        unitId,
        stemEn: question.text,
        stemTa: question.textTa,
        explanationEn: question.explanation,
      },
      create: {
        id: questionId,
        unitId,
        stemEn: question.text,
        stemTa: question.textTa,
        explanationEn: question.explanation,
      },
    });

    for (const [index, optionText] of question.options.entries()) {
      const label = OPTION_LABELS[index];
      const optionId = `${questionId}_${label}`;

      await prisma.questionOption.upsert({
        where: { id: optionId },
        update: {
          textEn: optionText,
          textTa: question.optionsTa?.[index],
          isCorrect: index === question.correctAnswerIndex,
          displayOrder: index,
        },
        create: {
          id: optionId,
          questionId,
          label,
          textEn: optionText,
          textTa: question.optionsTa?.[index],
          isCorrect: index === question.correctAnswerIndex,
          displayOrder: index,
        },
      });
    }

    questionCountByUnit[unitId] = (questionCountByUnit[unitId] ?? 0) + 1;
  }

  const loadedCount = ALL_QUESTIONS.length - skipped;
  console.log(`Seeded ${loadedCount} questions (${skipped} skipped for missing unit mapping).`);
  for (const [unitId, count] of Object.entries(questionCountByUnit)) {
    console.log(`  ${unitId}: ${count} questions`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
