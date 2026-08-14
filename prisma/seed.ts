// prisma/seed.ts
//
// Seeds Subject → Unit → Topic. Slugs here are permanent once anything is
// published against them (Question.unitId, analytics, etc.), so this file
// is meant to be the single source of truth — keep it in sync with
// database/syllabusData.ts rather than editing rows by hand in the DB.
//
// Run with: npx prisma db seed
// (wire "prisma": { "seed": "ts-node prisma/seed.ts" } into package.json)
//
// This is intentionally a small, illustrative slice (a few Physics and
// Botany chapters) rather than the full 79-chapter NEET taxonomy — extend
// the SUBJECTS/UNITS/TOPICS arrays below with the rest of your syllabus
// data. The upsert pattern means re-running this file is always safe.

import { PrismaClient, TargetExam } from "@prisma/client";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────
// SUBJECTS
// ─────────────────────────────────────────────────────────────────────────

const SUBJECTS = [
  { slug: "physics", nameEn: "Physics", nameTa: "இயற்பியல்", order: 1, examTypes: [TargetExam.NEET, TargetExam.JEE_MAIN, TargetExam.JEE_ADVANCED] },
  { slug: "chemistry", nameEn: "Chemistry", nameTa: "வேதியியல்", order: 2, examTypes: [TargetExam.NEET, TargetExam.JEE_MAIN, TargetExam.JEE_ADVANCED] },
  { slug: "botany", nameEn: "Botany", nameTa: "தாவரவியல்", order: 3, examTypes: [TargetExam.NEET] },
  { slug: "zoology", nameEn: "Zoology", nameTa: "விலங்கியல்", order: 4, examTypes: [TargetExam.NEET] },
  { slug: "mathematics", nameEn: "Mathematics", nameTa: "கணிதம்", order: 5, examTypes: [TargetExam.JEE_MAIN, TargetExam.JEE_ADVANCED] },
] as const;

// ─────────────────────────────────────────────────────────────────────────
// UNITS (chapters) — slug, subjectSlug, classLevel, weightage%, topics
// weightage is the % of the paper this chapter typically draws from,
// used to build blueprint-driven test assembly later.
// ─────────────────────────────────────────────────────────────────────────

const UNITS: {
  slug: string;
  subjectSlug: (typeof SUBJECTS)[number]["slug"];
  nameEn: string;
  nameTa?: string;
  classLevel: 11 | 12;
  weightage: number;
  topics: { slug: string; nameEn: string; nameTa?: string }[];
}[] = [
  {
    slug: "phy_01",
    subjectSlug: "physics",
    nameEn: "Physical World and Measurement",
    classLevel: 11,
    weightage: 2.5,
    topics: [
      { slug: "phy_01_units_dimensions", nameEn: "Units and Dimensions" },
      { slug: "phy_01_error_analysis", nameEn: "Error Analysis" },
    ],
  },
  {
    slug: "phy_02",
    subjectSlug: "physics",
    nameEn: "Kinematics",
    classLevel: 11,
    weightage: 4.0,
    topics: [
      { slug: "phy_02_motion_straight_line", nameEn: "Motion in a Straight Line" },
      { slug: "phy_02_motion_plane", nameEn: "Motion in a Plane" },
      { slug: "phy_02_projectile", nameEn: "Projectile Motion" },
    ],
  },
  {
    slug: "phy_13",
    subjectSlug: "physics",
    nameEn: "Kinetic Theory",
    classLevel: 11,
    weightage: 3.0,
    topics: [
      { slug: "phy_13_gas_laws", nameEn: "Behaviour of Gases" },
      { slug: "phy_13_kinetic_theory_ideal_gas", nameEn: "Kinetic Theory of an Ideal Gas" },
    ],
  },
  {
    slug: "bot_04",
    subjectSlug: "botany",
    nameEn: "Plant Physiology",
    classLevel: 11,
    weightage: 5.5,
    topics: [
      { slug: "bot_04_transport_in_plants", nameEn: "Transport in Plants" },
      { slug: "bot_04_photosynthesis", nameEn: "Photosynthesis in Higher Plants" },
      { slug: "bot_04_respiration", nameEn: "Respiration in Plants" },
      { slug: "bot_04_plant_growth", nameEn: "Plant Growth and Development" },
    ],
  },
  {
    slug: "zoo_05",
    subjectSlug: "zoology",
    nameEn: "Human Physiology",
    classLevel: 11,
    weightage: 6.0,
    topics: [
      { slug: "zoo_05_digestion", nameEn: "Digestion and Absorption" },
      { slug: "zoo_05_breathing", nameEn: "Breathing and Exchange of Gases" },
      { slug: "zoo_05_circulation", nameEn: "Body Fluids and Circulation" },
    ],
  },
  {
    slug: "chem_04",
    subjectSlug: "chemistry",
    nameEn: "Chemical Bonding and Molecular Structure",
    classLevel: 11,
    weightage: 4.5,
    topics: [
      { slug: "chem_04_ionic_bond", nameEn: "Ionic Bond" },
      { slug: "chem_04_covalent_bond", nameEn: "Covalent Bond" },
      { slug: "chem_04_vsepr", nameEn: "VSEPR Theory" },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────
// SEED
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding subjects...");
  const subjectIdBySlug = new Map<string, string>();

  for (const s of SUBJECTS) {
    const row = await prisma.subject.upsert({
      where: { slug: s.slug },
      update: {
        nameEn: s.nameEn,
        nameTa: s.nameTa,
        order: s.order,
        examTypes: [...s.examTypes],
      },
      create: {
        slug: s.slug,
        nameEn: s.nameEn,
        nameTa: s.nameTa,
        order: s.order,
        examTypes: [...s.examTypes],
      },
    });
    subjectIdBySlug.set(s.slug, row.id);
  }
  console.log(`  ${SUBJECTS.length} subjects OK`);

  console.log("Seeding units and topics...");
  let unitCount = 0;
  let topicCount = 0;

  for (const u of UNITS) {
    const subjectId = subjectIdBySlug.get(u.subjectSlug);
    if (!subjectId) {
      throw new Error(`Unit ${u.slug} references unknown subject ${u.subjectSlug}`);
    }

    const unitRow = await prisma.unit.upsert({
      where: { slug: u.slug },
      update: {
        nameEn: u.nameEn,
        nameTa: u.nameTa,
        classLevel: u.classLevel,
        weightage: u.weightage,
        subjectId,
      },
      create: {
        slug: u.slug,
        nameEn: u.nameEn,
        nameTa: u.nameTa,
        classLevel: u.classLevel,
        weightage: u.weightage,
        subjectId,
      },
    });
    unitCount++;

    for (const t of u.topics) {
      await prisma.topic.upsert({
        where: { slug: t.slug },
        update: { nameEn: t.nameEn, nameTa: t.nameTa, unitId: unitRow.id },
        create: { slug: t.slug, nameEn: t.nameEn, nameTa: t.nameTa, unitId: unitRow.id },
      });
      topicCount++;
    }
  }
  console.log(`  ${unitCount} units, ${topicCount} topics OK`);

  // Sanity check: every unit's weightage per subject should sum to
  // something plausible (~100% once the full syllabus is seeded). With
  // only this illustrative slice loaded it won't yet — this just flags the
  // math so a typo (e.g. 50 instead of 5.0) is obvious at seed time.
  const bySubject = new Map<string, number>();
  for (const u of UNITS) {
    bySubject.set(u.subjectSlug, (bySubject.get(u.subjectSlug) ?? 0) + u.weightage);
  }
  for (const [slug, total] of bySubject) {
    console.log(`  ${slug}: ${total.toFixed(1)}% weightage seeded so far`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
