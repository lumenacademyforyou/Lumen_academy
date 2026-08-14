// lib/services/test-assembler.ts
//
// The deterministic sampler referenced in the architecture doc: builds a
// Test + TestQuestion rows from a blueprint (how many questions per
// subject, optionally per unit/difficulty), sampling only from PUBLISHED
// questions. No LLM involved — this is pure selection logic, meant to be
// fast and boringly predictable, since it runs in the online/realtime path
// (e.g. building a fresh AI_REVISION test right after a student finishes
// an attempt).
//
// Sampling uses Question.selectionBucket (0-999, assigned at publish time)
// rather than `ORDER BY random()` — bucket-based sampling is index-friendly
// and avoids a full table sort under load, which matters when many
// students assemble a paper in the same exam-start window.

import { PrismaClient, TargetExam, TestType, Difficulty } from "@prisma/client";

const prisma = new PrismaClient();

export class BlueprintError extends Error {
  constructor(message: string, public shortfalls: ShortfallDetail[] = []) {
    super(message);
  }
}

type ShortfallDetail = {
  subjectSlug: string;
  unitSlug?: string;
  difficulty?: Difficulty;
  requested: number;
  available: number;
};

// A blueprint line targets a subject, optionally narrowed to a unit and/or
// difficulty. Lines are independent draws — the same question is never
// selected twice because each draw excludes ids already picked in this
// assembly (see `excludeIds` accumulation below).
export type BlueprintLine = {
  subjectSlug: string;
  unitSlug?: string;
  difficulty?: Difficulty;
  count: number;
};

export type AssembleTestInput = {
  name: string;
  type: TestType;
  examType: TargetExam;
  durationSeconds: number;
  blueprint: BlueprintLine[];
  ownerUserId?: string; // set for CUSTOM/AI_REVISION; null for official content-team tests
  sourceAttemptId?: string; // for AI_REVISION provenance
};

export async function assembleTest(input: AssembleTestInput) {
  const excludeIds: string[] = [];
  const picks: { questionId: string; unitSlug: string }[] = [];
  const shortfalls: ShortfallDetail[] = [];

  for (const line of input.blueprint) {
    const subject = await prisma.subject.findUniqueOrThrow({
      where: { slug: line.subjectSlug },
    });
    const unit = line.unitSlug
      ? await prisma.unit.findUniqueOrThrow({ where: { slug: line.unitSlug } })
      : null;

    const candidates = await prisma.question.findMany({
      where: {
        status: "PUBLISHED",
        examTypes: { has: input.examType },
        subjectId: subject.id,
        ...(unit && { unitId: unit.id }),
        ...(line.difficulty && { difficulty: line.difficulty }),
        id: { notIn: excludeIds },
      },
      // Sample via bucket first (cheap, index-backed), then trim to count.
      // Buckets are assigned once at publish time, so re-running the same
      // blueprint against a stable bank returns a stable-ish but not
      // identical set on each call — good enough for practice tests;
      // official PYQ-style tests should pin an explicit question list
      // instead of going through this path.
      orderBy: { selectionBucket: "asc" },
      take: line.count,
      select: { id: true, unit: { select: { slug: true } } },
    });

    if (candidates.length < line.count) {
      shortfalls.push({
        subjectSlug: line.subjectSlug,
        unitSlug: line.unitSlug,
        difficulty: line.difficulty,
        requested: line.count,
        available: candidates.length,
      });
    }

    for (const c of candidates) {
      picks.push({ questionId: c.id, unitSlug: c.unit.slug });
      excludeIds.push(c.id);
    }
  }

  if (shortfalls.length > 0) {
    throw new BlueprintError(
      `Question bank cannot fill this blueprint: ${shortfalls
        .map((s) => `${s.subjectSlug}${s.unitSlug ? "/" + s.unitSlug : ""} wanted ${s.requested}, has ${s.available}`)
        .join("; ")}`,
      shortfalls
    );
  }

  // Shuffle final order across subjects so e.g. all Botany questions don't
  // land contiguously just because the blueprint listed them together —
  // matters for CUSTOM/practice tests without sections. Sectioned tests
  // (FULL for JEE) should build TestSection rows and assign orderIndex
  // within each section instead; that's a v2 extension to this function.
  const shuffled = shuffle(picks);

  return prisma.test.create({
    data: {
      name: input.name,
      type: input.type,
      examType: input.examType,
      isPublished: true,
      durationSeconds: input.durationSeconds,
      ownerUserId: input.ownerUserId ?? null,
      sourceAttemptId: input.sourceAttemptId ?? null,
      focusUnitSlugs: [...new Set(shuffled.map((p) => p.unitSlug))],
      questions: {
        create: shuffled.map((p, i) => ({
          questionId: p.questionId,
          orderIndex: i,
        })),
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// AI_REVISION convenience wrapper — builds a blueprint automatically from
// an attempt's weak units (from UnitMastery, not just this one attempt),
// per Test.sourceAttemptId's comment: "recommended tests is a query, not
// a stored recommendation."
// ─────────────────────────────────────────────────────────────────────────

export async function assembleRevisionTest(
  userId: string,
  sourceAttemptId: string,
  totalQuestions = 20
) {
  const weakUnits = await prisma.unitMastery.findMany({
    where: { userId, attempted: { gte: 3 } }, // ignore units with too little data to be meaningful
    orderBy: { accuracy: "asc" },
    take: 5,
    include: { unit: { include: { subject: true } } },
  });

  if (weakUnits.length === 0) {
    throw new BlueprintError(
      "Not enough attempt history yet to build a targeted revision test",
      []
    );
  }

  const perUnit = Math.max(1, Math.floor(totalQuestions / weakUnits.length));
  const blueprint: BlueprintLine[] = weakUnits.map((um) => ({
    subjectSlug: um.unit.subject.slug,
    unitSlug: um.unit.slug,
    count: perUnit,
  }));

  const examType = (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).targetExam;

  return assembleTest({
    name: `Revision: ${weakUnits.map((u) => u.unit.nameEn).join(", ")}`,
    type: TestType.AI_REVISION,
    examType,
    durationSeconds: totalQuestions * 90, // ~90s/question, adjust to taste
    blueprint,
    ownerUserId: userId,
    sourceAttemptId,
  });
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
