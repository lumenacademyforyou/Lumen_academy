// lib/services/ai-question-generator.ts
//
// The offline/batch half of the architecture — the only place in the app
// that calls an LLM to *write* exam content. Everything downstream of this
// file (question-review-service, test-assembler, attempt-service) runs
// with zero LLM calls, per the original design: "Offline AI builds the
// question bank, online test delivery runs without any LLM."
//
// Pipeline per call to generateQuestions():
//   1. Build a grounded prompt from the target unit/topic (no retrieval
//      store wired in here — see note below).
//   2. Call the LLM, parse+validate its JSON output with Zod.
//   3. Insert each valid item as a DRAFT Question, computing contentHash
//      immediately so exact dupes are caught before a human ever sees them.
//   4. Run a second LLM call as a factual critic; store the verdict.
//   5. Only a question the critic passed gets auto-submitted into the
//      PENDING_REVIEW queue (question-review-service.submitForReview) —
//      anything it flags stays in DRAFT with criticVerdict attached so a
//      human can decide whether it's worth fixing or discarding.
//
// A real deployment would run step 1's context through a retriever (vector
// search over NCERT chunks, per the architecture doc's pgvector step) —
// that store is explicitly out of scope for the transactional app database
// per the schema's own comment, so it's stubbed here as buildContext() for
// you to wire to wherever that retrieval actually lives.

import { PrismaClient, QuestionType, Difficulty, TargetExam, QStatus } from "@prisma/client";
import { createHash } from "crypto";
import { z } from "zod";
import { submitForReview } from "./question-review-service.js";

const prisma = new PrismaClient();

const PROMPT_VERSION = "gen-2026-08-1";
const GENERATION_MODEL = "claude-sonnet-5";
const CRITIC_MODEL = "claude-sonnet-5";

export class GenerationError extends Error {}

// ─────────────────────────────────────────────────────────────────────────
// Shape the LLM must return. Deliberately strict: a field the model omits
// fails validation loudly here rather than reaching the database as a
// silent null and failing publishQuestion's checks days later.
// ─────────────────────────────────────────────────────────────────────────

const generatedOptionSchema = z.object({
  label: z.enum(["A", "B", "C", "D"]),
  textEn: z.string().min(1),
  isCorrect: z.boolean(),
});

const generatedQuestionSchema = z.object({
  type: z.nativeEnum(QuestionType),
  stemEn: z.string().min(10),
  explanationEn: z.string().min(10),
  difficulty: z.nativeEnum(Difficulty),
  ncertReference: z.string().min(1),
  options: z.array(generatedOptionSchema).optional(), // SINGLE/MULTIPLE_CORRECT
  numericalAnswer: z.number().optional(), // NUMERICAL
  numericalTolerance: z.number().optional(),
  numericalUnit: z.string().optional(),
});

const generationResponseSchema = z.object({
  questions: z.array(generatedQuestionSchema),
});

export type GenerateQuestionsInput = {
  subjectSlug: string;
  unitSlug: string;
  topicSlug?: string;
  difficulty: Difficulty;
  examType: TargetExam;
  count: number;
};

export type GenerateQuestionsResult = {
  createdQuestionIds: string[];
  autoSubmittedCount: number;
  rejectedDuplicateCount: number;
  criticFailedCount: number;
};

// ─────────────────────────────────────────────────────────────────────────
// STEP 1 — context. Stub: replace with your actual retriever
// (vector search over NCERT chunks + few-shot examples of already-approved
// questions for this unit, per the architecture doc).
// ─────────────────────────────────────────────────────────────────────────

async function buildContext(unitSlug: string, topicSlug?: string): Promise<string> {
  const unit = await prisma.unit.findUniqueOrThrow({
    where: { slug: unitSlug },
    include: { subject: true, topics: true },
  });
  const topic = topicSlug ? unit.topics.find((t) => t.slug === topicSlug) : null;

  // In production this return value is: retrieved NCERT chunks for this
  // unit/topic + 2-3 already-PUBLISHED questions from the same unit as
  // style few-shot examples. Left as chapter-level context only here.
  return [
    `Subject: ${unit.subject.nameEn}`,
    `Chapter: ${unit.nameEn}${topic ? ` — Topic: ${topic.nameEn}` : ""}`,
    `Class level: ${unit.classLevel ?? "11/12"}`,
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────
// STEP 2 — generation call.
// ─────────────────────────────────────────────────────────────────────────

async function callGenerationModel(
  context: string,
  input: GenerateQuestionsInput
): Promise<z.infer<typeof generationResponseSchema>> {
  const systemPrompt = `You write NEET/JEE exam questions grounded strictly in the NCERT syllabus.
Return ONLY a JSON object matching this shape, nothing else:
{
  "questions": [{
    "type": "SINGLE_CORRECT" | "MULTIPLE_CORRECT" | "NUMERICAL",
    "stemEn": string,
    "explanationEn": string,
    "difficulty": "EASY" | "MEDIUM" | "HARD",
    "ncertReference": string (e.g. "Class 11, Ch 13, pp. 210-214"),
    "options": [{ "label": "A"|"B"|"C"|"D", "textEn": string, "isCorrect": boolean }],
    "numericalAnswer": number,        // NUMERICAL type only
    "numericalTolerance": number,     // NUMERICAL type only
    "numericalUnit": string           // NUMERICAL type only
  }]
}
Every SINGLE_CORRECT question needs exactly one isCorrect: true option.
Every fact must be traceable to the given context — do not introduce content outside it.`;

  const userPrompt = `Context:\n${context}\n\nGenerate ${input.count} ${input.difficulty} difficulty question(s) for ${input.examType}.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: GENERATION_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    throw new GenerationError(`Generation call failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const text = data.content?.find((b: { type: string }) => b.type === "text")?.text;
  if (!text) throw new GenerationError("No text content in generation response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    throw new GenerationError("Generation response was not valid JSON");
  }

  const result = generationResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new GenerationError(`Generation response failed schema: ${result.error.message}`);
  }
  return result.data;
}

// ─────────────────────────────────────────────────────────────────────────
// STEP 4 — factual critic. A separate call, deliberately not reusing the
// generation call's context window, so it evaluates the question fresh
// rather than continuing a conversation that already committed to an answer.
// ─────────────────────────────────────────────────────────────────────────

const criticVerdictSchema = z.object({
  passed: z.boolean(),
  confidence: z.number().min(0).max(1),
  issues: z.array(z.string()),
});

async function runFactualCritic(
  question: z.infer<typeof generatedQuestionSchema>
): Promise<z.infer<typeof criticVerdictSchema>> {
  const systemPrompt = `You are a strict fact-checker for NEET/JEE exam questions. Given a question,
its options, and its claimed answer, verify factual correctness against NCERT-level science.
Return ONLY JSON: { "passed": boolean, "confidence": number (0-1), "issues": string[] }.
passed must be false if there is any factual error, ambiguous wording, more than one defensible
correct option, or a numerical answer that doesn't follow from correct physics/chemistry.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CRITIC_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: JSON.stringify(question) }],
    }),
  });

  if (!response.ok) {
    // Fail closed: a critic call that errors out should never be treated as
    // a pass. The question stays in DRAFT for a human either way.
    return { passed: false, confidence: 0, issues: [`critic call failed: ${response.status}`] };
  }

  const data = await response.json();
  const text = data.content?.find((b: { type: string }) => b.type === "text")?.text ?? "";
  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    return criticVerdictSchema.parse(parsed);
  } catch {
    return { passed: false, confidence: 0, issues: ["critic response was not valid JSON"] };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// contentHash — same canonicalization as question-review-service, kept in
// sync deliberately rather than imported, since generation runs against
// unpublished DRAFT content and review's hash check runs at publish time
// against PUBLISHED content; duplicating the pure function avoids coupling
// this worker to review-service's internals.
// ─────────────────────────────────────────────────────────────────────────

function computeContentHash(q: {
  type: string;
  stemEn: string;
  options: { textEn: string; isCorrect: boolean }[];
  numericalAnswer?: number;
}) {
  const canonical = JSON.stringify({
    type: q.type,
    stem: q.stemEn.trim().toLowerCase().replace(/\s+/g, " "),
    options: [...q.options]
      .map((o) => `${o.textEn.trim().toLowerCase()}:${o.isCorrect}`)
      .sort(),
    numericalAnswer: q.numericalAnswer ?? null,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────

export async function generateQuestions(
  input: GenerateQuestionsInput
): Promise<GenerateQuestionsResult> {
  const subject = await prisma.subject.findUniqueOrThrow({ where: { slug: input.subjectSlug } });
  const unit = await prisma.unit.findUniqueOrThrow({ where: { slug: input.unitSlug } });
  const topic = input.topicSlug
    ? await prisma.topic.findUnique({ where: { slug: input.topicSlug } })
    : null;

  const context = await buildContext(input.unitSlug, input.topicSlug ?? undefined);
  const generated = await callGenerationModel(context, input);

  const result: GenerateQuestionsResult = {
    createdQuestionIds: [],
    autoSubmittedCount: 0,
    rejectedDuplicateCount: 0,
    criticFailedCount: 0,
  };

  for (const q of generated.questions) {
    const options = q.options ?? [];
    const contentHash = computeContentHash({
      type: q.type,
      stemEn: q.stemEn,
      options,
      numericalAnswer: q.numericalAnswer,
    });

    const existing = await prisma.question.findUnique({ where: { contentHash } });
    if (existing) {
      result.rejectedDuplicateCount++;
      continue; // never insert a row for a dupe — nothing to review
    }

    const critic = await runFactualCritic(q);

    const created = await prisma.question.create({
      data: {
        type: q.type,
        stemEn: q.stemEn,
        explanationEn: q.explanationEn,
        difficulty: q.difficulty,
        status: QStatus.DRAFT,
        subjectId: subject.id,
        unitId: unit.id,
        topicId: topic?.id ?? null,
        examTypes: [input.examType],
        source: "AI-generated",
        promptVersion: PROMPT_VERSION,
        ncertReference: q.ncertReference,
        contentHash,
        criticVerdict: critic,
        numericalAnswer: q.numericalAnswer ?? null,
        numericalTolerance: q.numericalTolerance ?? null,
        numericalUnit: q.numericalUnit ?? null,
        options: options.length
          ? { create: options.map((o, i) => ({ ...o, orderIndex: i })) }
          : undefined,
      },
    });

    result.createdQuestionIds.push(created.id);

    if (critic.passed && critic.confidence >= 0.8 && q.difficulty !== Difficulty.HARD) {
      // Matches the SME routing logic from question-review-service's design
      // notes: hard/biology/numerical/low-confidence always goes to a human;
      // this is the narrow auto-submit lane, not an auto-publish lane —
      // it still lands in PENDING_REVIEW, never PUBLISHED, on its own.
      await submitForReview(created.id);
      result.autoSubmittedCount++;
    } else {
      result.criticFailedCount += critic.passed ? 0 : 1;
      // Left in DRAFT either way when it doesn't meet the auto-submit bar —
      // a human decides whether to submit it manually after reviewing
      // criticVerdict.issues.
    }
  }

  return result;
}
