import { createHash } from "node:crypto";
import {
  Prisma,
  PrismaClient,
  QStatus,
  QuestionType,
  TargetExam,
  TestType,
} from "@prisma/client";

const prisma = new PrismaClient();

type Database = Prisma.TransactionClient;

function hashContent(content: unknown): string {
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}

function allOrNothingScoring(correctMarks: number, incorrectMarks: number) {
  return {
    mode: "ALL_OR_NOTHING",
    correctMarks,
    incorrectMarks,
    unattemptedMarks: 0,
  };
}

async function seedSyllabus(db: Database) {
  const physics = await db.subject.upsert({
    where: { slug: "physics" },
    update: {
      nameEn: "Physics",
      nameTa: "இயற்பியல்",
      order: 1,
      examTypes: [TargetExam.NEET, TargetExam.JEE_MAIN, TargetExam.JEE_ADVANCED],
    },
    create: {
      slug: "physics",
      nameEn: "Physics",
      nameTa: "இயற்பியல்",
      order: 1,
      examTypes: [TargetExam.NEET, TargetExam.JEE_MAIN, TargetExam.JEE_ADVANCED],
    },
  });

  const chemistry = await db.subject.upsert({
    where: { slug: "chemistry" },
    update: {
      nameEn: "Chemistry",
      nameTa: "வேதியியல்",
      order: 2,
      examTypes: [TargetExam.NEET, TargetExam.JEE_MAIN, TargetExam.JEE_ADVANCED],
    },
    create: {
      slug: "chemistry",
      nameEn: "Chemistry",
      nameTa: "வேதியியல்",
      order: 2,
      examTypes: [TargetExam.NEET, TargetExam.JEE_MAIN, TargetExam.JEE_ADVANCED],
    },
  });

  const botany = await db.subject.upsert({
    where: { slug: "botany" },
    update: { nameEn: "Botany", nameTa: "தாவரவியல்", order: 3, examTypes: [TargetExam.NEET] },
    create: { slug: "botany", nameEn: "Botany", nameTa: "தாவரவியல்", order: 3, examTypes: [TargetExam.NEET] },
  });

  const zoology = await db.subject.upsert({
    where: { slug: "zoology" },
    update: { nameEn: "Zoology", nameTa: "விலங்கியல்", order: 4, examTypes: [TargetExam.NEET] },
    create: { slug: "zoology", nameEn: "Zoology", nameTa: "விலங்கியல்", order: 4, examTypes: [TargetExam.NEET] },
  });

  const mathematics = await db.subject.upsert({
    where: { slug: "mathematics" },
    update: {
      nameEn: "Mathematics",
      nameTa: "கணிதம்",
      order: 5,
      examTypes: [TargetExam.JEE_MAIN, TargetExam.JEE_ADVANCED],
    },
    create: {
      slug: "mathematics",
      nameEn: "Mathematics",
      nameTa: "கணிதம்",
      order: 5,
      examTypes: [TargetExam.JEE_MAIN, TargetExam.JEE_ADVANCED],
    },
  });

  const unitDefinitions = [
    { slug: "phy_01", nameEn: "Kinematics", subjectId: physics.id },
    { slug: "chem_01", nameEn: "Atomic Structure", subjectId: chemistry.id },
    { slug: "bot_01", nameEn: "Cell: The Unit of Life", subjectId: botany.id },
    { slug: "zoo_01", nameEn: "Animal Kingdom", subjectId: zoology.id },
    { slug: "math_01", nameEn: "Quadratic Equations", subjectId: mathematics.id },
  ];

  const units = await Promise.all(
    unitDefinitions.map((unit, index) =>
      db.unit.upsert({
        where: { slug: unit.slug },
        update: { nameEn: unit.nameEn, subjectId: unit.subjectId, order: index + 1, classLevel: 11 },
        create: { ...unit, order: index + 1, classLevel: 11 },
      }),
    ),
  );

  const topics = await Promise.all(
    [
      { slug: "phy_01_newtons_laws", nameEn: "Newton's Laws of Motion", unitId: units[0].id },
      { slug: "chem_01_atomic_number", nameEn: "Atomic Number", unitId: units[1].id },
      { slug: "bot_01_cell_organelles", nameEn: "Cell Organelles", unitId: units[2].id },
      { slug: "zoo_01_chordata", nameEn: "Chordata", unitId: units[3].id },
      { slug: "math_01_roots", nameEn: "Roots of Quadratic Equations", unitId: units[4].id },
    ].map((topic) =>
      db.topic.upsert({ where: { slug: topic.slug }, update: topic, create: topic }),
    ),
  );

  return { physics, chemistry, botany, zoology, mathematics, units, topics };
}

async function seedQuestions(db: Database, syllabus: Awaited<ReturnType<typeof seedSyllabus>>) {
  const [physicsUnit, chemistryUnit, botanyUnit, zoologyUnit, mathematicsUnit] = syllabus.units;
  const [physicsTopic, chemistryTopic, botanyTopic, zoologyTopic, mathematicsTopic] = syllabus.topics;

  const neetPhysics = await db.question.upsert({
    where: { contentHash: hashContent("demo-neet-physics-force-v1") },
    update: {
      stemEn: "A 2 kg object accelerates at 3 m/s². What is the net force on it?",
      type: QuestionType.SINGLE_CORRECT,
      status: QStatus.PUBLISHED,
      marks: 4,
      negativeMarks: 1,
      examTypes: [TargetExam.NEET, TargetExam.JEE_MAIN],
      subjectId: syllabus.physics.id,
      unitId: physicsUnit.id,
      topicId: physicsTopic.id,
      options: {
        deleteMany: {},
        create: [
          { label: "A", textEn: "1.5 N", orderIndex: 0 },
          { label: "B", textEn: "5 N", orderIndex: 1 },
          { label: "C", textEn: "6 N", orderIndex: 2, isCorrect: true },
          { label: "D", textEn: "9 N", orderIndex: 3 },
        ],
      },
    },
    create: {
      contentHash: hashContent("demo-neet-physics-force-v1"),
      stemEn: "A 2 kg object accelerates at 3 m/s². What is the net force on it?",
      explanationEn: "Use F = ma = 2 × 3 = 6 N.",
      type: QuestionType.SINGLE_CORRECT,
      status: QStatus.PUBLISHED,
      marks: 4,
      negativeMarks: 1,
      scoringConfig: allOrNothingScoring(4, -1),
      examTypes: [TargetExam.NEET, TargetExam.JEE_MAIN],
      source: "Lumen demonstration seed",
      publishedAt: new Date(),
      selectionBucket: 101,
      subjectId: syllabus.physics.id,
      unitId: physicsUnit.id,
      topicId: physicsTopic.id,
      options: {
        create: [
          { label: "A", textEn: "1.5 N", orderIndex: 0 },
          { label: "B", textEn: "5 N", orderIndex: 1 },
          { label: "C", textEn: "6 N", orderIndex: 2, isCorrect: true },
          { label: "D", textEn: "9 N", orderIndex: 3 },
        ],
      },
    },
  });

  const neetChemistry = await db.question.upsert({
    where: { contentHash: hashContent("demo-neet-chemistry-atomic-number-v1") },
    update: {
      stemEn: "The atomic number of an element equals the number of:",
      status: QStatus.PUBLISHED,
      examTypes: [TargetExam.NEET, TargetExam.JEE_MAIN, TargetExam.JEE_ADVANCED],
      subjectId: syllabus.chemistry.id,
      unitId: chemistryUnit.id,
      topicId: chemistryTopic.id,
      options: {
        deleteMany: {},
        create: [
          { label: "A", textEn: "Neutrons", orderIndex: 0 },
          { label: "B", textEn: "Protons", orderIndex: 1, isCorrect: true },
          { label: "C", textEn: "Nucleons only", orderIndex: 2 },
          { label: "D", textEn: "Electrons in every ion", orderIndex: 3 },
        ],
      },
    },
    create: {
      contentHash: hashContent("demo-neet-chemistry-atomic-number-v1"),
      stemEn: "The atomic number of an element equals the number of:",
      explanationEn: "Atomic number is defined as the number of protons in the nucleus.",
      type: QuestionType.SINGLE_CORRECT,
      status: QStatus.PUBLISHED,
      scoringConfig: allOrNothingScoring(4, -1),
      examTypes: [TargetExam.NEET, TargetExam.JEE_MAIN, TargetExam.JEE_ADVANCED],
      source: "Lumen demonstration seed",
      publishedAt: new Date(),
      selectionBucket: 202,
      subjectId: syllabus.chemistry.id,
      unitId: chemistryUnit.id,
      topicId: chemistryTopic.id,
      options: {
        create: [
          { label: "A", textEn: "Neutrons", orderIndex: 0 },
          { label: "B", textEn: "Protons", orderIndex: 1, isCorrect: true },
          { label: "C", textEn: "Nucleons only", orderIndex: 2 },
          { label: "D", textEn: "Electrons in every ion", orderIndex: 3 },
        ],
      },
    },
  });

  const neetBotany = await db.question.upsert({
    where: { contentHash: hashContent("demo-neet-botany-mitochondria-v1") },
    update: {
      stemEn: "Which organelle is the main site of ATP production in eukaryotic cells?",
      status: QStatus.PUBLISHED,
      subjectId: syllabus.botany.id,
      unitId: botanyUnit.id,
      topicId: botanyTopic.id,
      options: { deleteMany: {}, create: [
        { label: "A", textEn: "Ribosome", orderIndex: 0 },
        { label: "B", textEn: "Mitochondrion", orderIndex: 1, isCorrect: true },
        { label: "C", textEn: "Golgi apparatus", orderIndex: 2 },
        { label: "D", textEn: "Lysosome", orderIndex: 3 },
      ] },
    },
    create: {
      contentHash: hashContent("demo-neet-botany-mitochondria-v1"),
      stemEn: "Which organelle is the main site of ATP production in eukaryotic cells?",
      explanationEn: "Mitochondria generate most ATP through cellular respiration.",
      type: QuestionType.SINGLE_CORRECT,
      status: QStatus.PUBLISHED,
      scoringConfig: allOrNothingScoring(4, -1),
      examTypes: [TargetExam.NEET],
      source: "Lumen demonstration seed",
      publishedAt: new Date(),
      selectionBucket: 303,
      subjectId: syllabus.botany.id,
      unitId: botanyUnit.id,
      topicId: botanyTopic.id,
      options: { create: [
        { label: "A", textEn: "Ribosome", orderIndex: 0 },
        { label: "B", textEn: "Mitochondrion", orderIndex: 1, isCorrect: true },
        { label: "C", textEn: "Golgi apparatus", orderIndex: 2 },
        { label: "D", textEn: "Lysosome", orderIndex: 3 },
      ] },
    },
  });

  const neetZoology = await db.question.upsert({
    where: { contentHash: hashContent("demo-neet-zoology-notochord-v1") },
    update: {
      stemEn: "A defining feature of chordates at some stage of development is:",
      status: QStatus.PUBLISHED,
      subjectId: syllabus.zoology.id,
      unitId: zoologyUnit.id,
      topicId: zoologyTopic.id,
      options: { deleteMany: {}, create: [
        { label: "A", textEn: "Jointed appendages", orderIndex: 0 },
        { label: "B", textEn: "Notochord", orderIndex: 1, isCorrect: true },
        { label: "C", textEn: "Exoskeleton of chitin", orderIndex: 2 },
        { label: "D", textEn: "Radial symmetry", orderIndex: 3 },
      ] },
    },
    create: {
      contentHash: hashContent("demo-neet-zoology-notochord-v1"),
      stemEn: "A defining feature of chordates at some stage of development is:",
      explanationEn: "A notochord is a defining chordate feature.",
      type: QuestionType.SINGLE_CORRECT,
      status: QStatus.PUBLISHED,
      scoringConfig: allOrNothingScoring(4, -1),
      examTypes: [TargetExam.NEET],
      source: "Lumen demonstration seed",
      publishedAt: new Date(),
      selectionBucket: 404,
      subjectId: syllabus.zoology.id,
      unitId: zoologyUnit.id,
      topicId: zoologyTopic.id,
      options: { create: [
        { label: "A", textEn: "Jointed appendages", orderIndex: 0 },
        { label: "B", textEn: "Notochord", orderIndex: 1, isCorrect: true },
        { label: "C", textEn: "Exoskeleton of chitin", orderIndex: 2 },
        { label: "D", textEn: "Radial symmetry", orderIndex: 3 },
      ] },
    },
  });

  const jeeMainNumerical = await db.question.upsert({
    where: { contentHash: hashContent("demo-jee-main-quadratic-roots-v1") },
    update: {
      stemEn: "For x² − 5x + 6 = 0, enter the sum of the roots.",
      type: QuestionType.NUMERICAL,
      status: QStatus.PUBLISHED,
      numericalAnswer: new Prisma.Decimal(5),
      numericalTolerance: new Prisma.Decimal(0),
      numericalUnit: null,
      subjectId: syllabus.mathematics.id,
      unitId: mathematicsUnit.id,
      topicId: mathematicsTopic.id,
      options: { deleteMany: {} },
    },
    create: {
      contentHash: hashContent("demo-jee-main-quadratic-roots-v1"),
      stemEn: "For x² − 5x + 6 = 0, enter the sum of the roots.",
      explanationEn: "For ax² + bx + c = 0, the sum of roots is −b/a = 5.",
      type: QuestionType.NUMERICAL,
      status: QStatus.PUBLISHED,
      marks: 4,
      negativeMarks: 0,
      numericalAnswer: new Prisma.Decimal(5),
      numericalTolerance: new Prisma.Decimal(0),
      scoringConfig: allOrNothingScoring(4, 0),
      examTypes: [TargetExam.JEE_MAIN, TargetExam.JEE_ADVANCED],
      source: "Lumen demonstration seed",
      publishedAt: new Date(),
      selectionBucket: 505,
      subjectId: syllabus.mathematics.id,
      unitId: mathematicsUnit.id,
      topicId: mathematicsTopic.id,
    },
  });

  const jeeAdvancedMultiple = await db.question.upsert({
    where: { contentHash: hashContent("demo-jee-advanced-multiple-newton-v1") },
    update: {
      stemEn: "Select all statements that are correct according to Newton's laws.",
      type: QuestionType.MULTIPLE_CORRECT,
      status: QStatus.PUBLISHED,
      subjectId: syllabus.physics.id,
      unitId: physicsUnit.id,
      topicId: physicsTopic.id,
      options: { deleteMany: {}, create: [
        { label: "A", textEn: "Force equals the time rate of change of momentum.", orderIndex: 0, isCorrect: true },
        { label: "B", textEn: "Action and reaction act on the same body.", orderIndex: 1 },
        { label: "C", textEn: "An unbalanced force can change velocity.", orderIndex: 2, isCorrect: true },
        { label: "D", textEn: "Inertia is measured by acceleration alone.", orderIndex: 3 },
      ] },
    },
    create: {
      contentHash: hashContent("demo-jee-advanced-multiple-newton-v1"),
      stemEn: "Select all statements that are correct according to Newton's laws.",
      explanationEn: "A is Newton's second law in momentum form. C follows from F = ma. B and D are false.",
      type: QuestionType.MULTIPLE_CORRECT,
      status: QStatus.PUBLISHED,
      marks: 4,
      negativeMarks: 2,
      scoringConfig: { ...allOrNothingScoring(4, -2), mode: "PARTIAL", partialMarksByCorrectSelections: { "1": 1, "2": 4 } },
      examTypes: [TargetExam.JEE_ADVANCED],
      source: "Lumen demonstration seed",
      publishedAt: new Date(),
      selectionBucket: 606,
      subjectId: syllabus.physics.id,
      unitId: physicsUnit.id,
      topicId: physicsTopic.id,
      options: { create: [
        { label: "A", textEn: "Force equals the time rate of change of momentum.", orderIndex: 0, isCorrect: true },
        { label: "B", textEn: "Action and reaction act on the same body.", orderIndex: 1 },
        { label: "C", textEn: "An unbalanced force can change velocity.", orderIndex: 2, isCorrect: true },
        { label: "D", textEn: "Inertia is measured by acceleration alone.", orderIndex: 3 },
      ] },
    },
  });

  const jeeAdvancedMatching = await db.question.upsert({
    where: { contentHash: hashContent("demo-jee-advanced-matching-v1") },
    update: {
      stemEn: "Match each quantity with its SI unit.",
      type: QuestionType.MATCHING,
      status: QStatus.PUBLISHED,
      subjectId: syllabus.physics.id,
      unitId: physicsUnit.id,
      topicId: physicsTopic.id,
      options: { deleteMany: {} },
    },
    create: {
      contentHash: hashContent("demo-jee-advanced-matching-v1"),
      stemEn: "Match each quantity with its SI unit.",
      type: QuestionType.MATCHING,
      status: QStatus.PUBLISHED,
      marks: 4,
      negativeMarks: 0,
      interactionConfig: {
        leftItems: [
          { id: "l1", textEn: "Force" },
          { id: "l2", textEn: "Energy" },
        ],
        rightItems: [
          { id: "r1", label: "P", textEn: "joule" },
          { id: "r2", label: "Q", textEn: "newton" },
        ],
      },
      scoringConfig: {
        ...allOrNothingScoring(4, 0),
        answerMapping: { l1: "r2", l2: "r1" },
      },
      examTypes: [TargetExam.JEE_ADVANCED],
      source: "Lumen demonstration seed",
      publishedAt: new Date(),
      selectionBucket: 707,
      subjectId: syllabus.physics.id,
      unitId: physicsUnit.id,
      topicId: physicsTopic.id,
    },
  });

  return { neetPhysics, neetChemistry, neetBotany, neetZoology, jeeMainNumerical, jeeAdvancedMultiple, jeeAdvancedMatching };
}

async function seedDemoTests(db: Database, questions: Awaited<ReturnType<typeof seedQuestions>>) {
  const demoNames = ["__DEMO__ NEET Science Check", "__DEMO__ JEE Main Mathematics Check", "__DEMO__ JEE Advanced Physics Check"];
  await db.test.deleteMany({ where: { name: { in: demoNames } } });

  await db.test.create({
    data: {
      name: "__DEMO__ NEET Science Check",
      type: TestType.CUSTOM,
      examType: TargetExam.NEET,
      isPublished: true,
      durationSeconds: 900,
      questions: { create: [questions.neetPhysics, questions.neetChemistry, questions.neetBotany, questions.neetZoology].map((question, orderIndex) => ({ questionId: question.id, orderIndex })) },
    },
  });

  await db.test.create({
    data: {
      name: "__DEMO__ JEE Main Mathematics Check",
      type: TestType.CUSTOM,
      examType: TargetExam.JEE_MAIN,
      isPublished: true,
      durationSeconds: 300,
      questions: { create: [{ questionId: questions.jeeMainNumerical.id, orderIndex: 0 }] },
    },
  });

  const advancedTest = await db.test.create({
    data: {
      name: "__DEMO__ JEE Advanced Physics Check",
      type: TestType.CUSTOM,
      examType: TargetExam.JEE_ADVANCED,
      isPublished: true,
      durationSeconds: 600,
      sections: { create: { name: "Physics", orderIndex: 0, subjectId: questions.jeeAdvancedMultiple.subjectId, durationSeconds: 600 } },
    },
    include: { sections: true },
  });

  await db.testQuestion.createMany({
    data: [questions.jeeAdvancedMultiple, questions.jeeAdvancedMatching].map((question, orderIndex) => ({
      testId: advancedTest.id,
      sectionId: advancedTest.sections[0].id,
      questionId: question.id,
      orderIndex,
    })),
  });
}

async function main() {
  await prisma.$transaction(async (db) => {
    const syllabus = await seedSyllabus(db);
    const questions = await seedQuestions(db, syllabus);
    await seedDemoTests(db, questions);
  }, {
    maxWait: 10_000,
    timeout: 60_000,
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });

  console.log("Seed complete: 5 subjects, 5 units, 5 topics, 7 questions, and 3 demo tests.");
}

async function run() {
  try {
    await main();
  } catch (error: unknown) {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void run();
