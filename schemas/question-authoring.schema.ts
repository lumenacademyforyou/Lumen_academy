/**
 * CL-1 — content authoring/import contract (LA-PLAN-002 Day 1, G1).
 * Frozen v1.0 25-08-2026 handoff to Prince; amendments land as v1.1+ in
 * this same file's header, never a silent edit.
 *
 * This is the schema content is authored against and CL-2's importer
 * validates against — one Zod schema serves both roles rather than a
 * separate declarative JSON Schema file plus a hand-synced TS validator.
 * Chosen because zod is already this project's validation convention
 * (db/config/env.ts) and no JSON-Schema library (ajv etc.) is a project
 * dependency — adding one just to duplicate what Zod already expresses
 * would be a second source of truth for the same contract (R-12).
 *
 * Every field maps to a real live column (docs/DB_STATE.md) — nothing here
 * assumes the brief's content_block/equation/next_lumen_id() model, which
 * TE-P0 confirmed does not exist in this schema.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// question_uid convention (replaces the brief's LMN-PHY-ROTMO-000001 scheme,
// which depended on a concept-tree/generator function this schema doesn't
// have — docs/OPEN_ITEMS.md). Format:
//
//   LMN-<SUBJECT_CODE>-<NODE_CODE>-<6-digit serial>
//
// SUBJECT_CODE = catalog.subject.subject_code, upper-case (PHY, CHEM, BOT, ZOO).
// NODE_CODE    = catalog.syllabus_node.tag_code, upper-cased with
//                underscores stripped (tag_code "phy_01" -> node code "PHY01").
// serial       = 000001-upward, unique per (SUBJECT_CODE, NODE_CODE) pair —
//                CL-2 assigns the next free serial at import time; authors
//                do not need to know the current max when writing a file.
//
// Example: LMN-PHY-PHY01-000001 — first Physics question tagged to node
// tag_code "phy_01" (Rotational Dynamics & Mechanics per db/scripts/seed/02_content.ts).
export const QUESTION_UID_PATTERN = /^LMN-[A-Z]+-[A-Z0-9]+-\d{6}$/;

export const StemFormat = z.enum(["plain", "markdown", "latex", "html"]);
export const SolutionFormat = z.enum(["plain", "markdown", "latex", "html"]);

// content.question.question_type check constraint, verbatim.
export const QuestionType = z.enum([
  "single_choice",
  "multi_choice",
  "integer",
  "numeric",
  "matrix_match",
  "assertion_reason",
  "true_false",
]);

// content.question.difficulty_band is free text with NO check constraint
// live (docs/DB_STATE.md §4.4) — this three-value vocabulary is a CONTRACT
// convention for authors, not a database constraint. If the DB gains a
// matching check constraint later, keep this in sync by hand.
export const DifficultyBand = z.enum(["easy", "medium", "hard"]);

export const OptionSchema = z.object({
  label: z.enum(["A", "B", "C", "D", "E", "F"]), // content.question_option.option_label
  text: z.string().min(1), // content.question_option.option_text
  isCorrect: z.boolean(), // content.question_option.is_correct
});

// A file reference the import folder must actually contain (CL-3's upload
// path resolves fileName -> a Supabase Storage object -> content.asset.storage_uri).
export const ImageReferenceSchema = z.object({
  fileName: z.string().min(1),
  altText: z.string().optional(), // content.asset.alt_text
  targetRole: z.enum(["stem", "option", "solution"]).default("stem"), // content.asset.target_role
  optionLabel: z.enum(["A", "B", "C", "D", "E", "F"]).optional(), // required when targetRole === "option"
});

// content.question_translation — one entry per non-English language variant.
// English itself is the top-level stemText/options, not a translations[] entry.
export const TranslationSchema = z.object({
  languageCode: z.string().min(2).max(5), // e.g. "ta"
  stemText: z.string().min(1),
  optionTexts: z.array(z.string().min(1)).optional(), // same order as the top-level options[]
});

export const QuestionAuthoringSchema = z
  .object({
    questionUid: z.string().regex(QUESTION_UID_PATTERN, "must follow LMN-<SUBJECT_CODE>-<NODE_CODE>-<6-digit serial>"),
    examCode: z.string().min(1), // resolved by the importer, e.g. "NEET"
    subjectCode: z.string().min(1), // catalog.subject.subject_code, e.g. "PHY"
    nodeTagCode: z.string().min(1), // catalog.syllabus_node.tag_code — importer resolves this to primary_node_id
    questionType: QuestionType,
    difficultyBand: DifficultyBand.nullable().default(null),
    originYear: z.number().int().min(1990).max(2100).nullable().optional(), // content.question.origin_year, for PYQ-sourced items

    stemFormat: StemFormat.default("latex"),
    stemText: z.string().min(1),

    options: z.array(OptionSchema).min(2).max(6).optional(), // required unless questionType is integer/numeric
    numericAnswer: z
      .string()
      .regex(/^-?\d+(\.\d+)?$/, "must be a NUMERIC-safe decimal string, never a float literal")
      .nullable()
      .optional(),
    answerTolerance: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "must be a non-negative NUMERIC-safe decimal string")
      .nullable()
      .optional(),

    solution: z.object({
      explanationText: z.string().min(1), // content.question_solution.explanation_text
      formulaReference: z.string().optional(), // e.g. an NCERT chapter/page reference
      solutionFormat: SolutionFormat.default("latex"),
    }),

    images: z.array(ImageReferenceSchema).default([]),
    translations: z.array(TranslationSchema).default([]),
  })
  .superRefine((q, ctx) => {
    const isNumeric = q.questionType === "integer" || q.questionType === "numeric";

    if (isNumeric) {
      if (q.numericAnswer == null) {
        ctx.addIssue({ code: "custom", message: "numericAnswer is required for integer/numeric questions", path: ["numericAnswer"] });
      }
      if (q.options && q.options.length > 0) {
        ctx.addIssue({ code: "custom", message: "integer/numeric questions must not carry options", path: ["options"] });
      }
    } else {
      if (!q.options || q.options.length < 2) {
        ctx.addIssue({ code: "custom", message: "at least 2 options are required for non-numeric question types", path: ["options"] });
      } else if (!q.options.some((o) => o.isCorrect)) {
        ctx.addIssue({ code: "custom", message: "at least one option must be marked isCorrect", path: ["options"] });
      }
      if (q.questionType === "single_choice" || q.questionType === "true_false" || q.questionType === "assertion_reason") {
        const correctCount = (q.options ?? []).filter((o) => o.isCorrect).length;
        if (correctCount !== 1) {
          ctx.addIssue({ code: "custom", message: `${q.questionType} must have exactly one correct option, found ${correctCount}`, path: ["options"] });
        }
      }
    }

    // questionUid's SUBJECT_CODE segment must agree with subjectCode, so a
    // copy-paste mismatch is caught before it ever reaches the importer.
    const uidSubject = q.questionUid.split("-")[1];
    if (uidSubject !== q.subjectCode.toUpperCase()) {
      ctx.addIssue({
        code: "custom",
        message: `questionUid's subject segment ("${uidSubject}") does not match subjectCode ("${q.subjectCode}")`,
        path: ["questionUid"],
      });
    }

    for (const img of q.images) {
      if (img.targetRole === "option" && !img.optionLabel) {
        ctx.addIssue({ code: "custom", message: "images with targetRole 'option' must specify optionLabel", path: ["images"] });
      }
    }

    for (const t of q.translations) {
      if (t.optionTexts && q.options && t.optionTexts.length !== q.options.length) {
        ctx.addIssue({
          code: "custom",
          message: `translation "${t.languageCode}" has ${t.optionTexts.length} optionTexts but the question has ${q.options.length} options`,
          path: ["translations"],
        });
      }
    }
  });

export type QuestionAuthoring = z.infer<typeof QuestionAuthoringSchema>;

// A batch file is a JSON array of questions — matches CL-2's per-row
// import_row tracking (one row per array element).
export const QuestionBatchSchema = z.array(QuestionAuthoringSchema).min(1);
export type QuestionBatch = z.infer<typeof QuestionBatchSchema>;
