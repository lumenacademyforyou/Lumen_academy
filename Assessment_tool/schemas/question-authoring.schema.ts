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

// ---------------------------------------------------------------------------
// MATH NOTATION CONTRACT (v1.1, added 10-09-2026 — docs/latex-rendering-fix-prompt.md)
//
// The whole bank is authored as math *inline inside prose*, in English and in
// the Tamil translations[], with no $...$ delimiters. The renderer
// (frontend/src/components/ui/MathText.tsx) turns ^ and _ into real <sup>/<sub>
// and hands genuine LaTeX commands to KaTeX. That only works if the notation
// is written the way below. The original 1140-question load was authored
// informally and had to be repaired in bulk by
// db/scripts/normalize-latex-new-content.mjs — these rules exist so it never
// needs repairing again. db/scripts/audit-latex-new-content.mjs is the check.
//
// Required, in every text field: stemText, options[].text,
// solution.explanationText, translations[].stemText and
// translations[].optionTexts[].
//
//   1. BRACE every exponent and subscript longer than one character.
//        "10^15"        -> "10^{15}"          (a bare ^15 superscripts only the 1)
//        "m^-1"         -> "m^{-1}"
//        "SO4^2-"       -> "SO4^{2-}"
//        "Z_AB"         -> "Z_{AB}"
//        "V_rms"        -> "V_{rms}"
//      Single-character scripts may stay bare: "x^2", "Cl^-", "R_H".
//      Brace a single-character exponent anyway when a letter follows it, so
//      the boundary is explicit: "d^{2}U/dx^2", "_{92}U^{238}".
//
//   2. NEVER use parentheses for grouping a script. They are not grouping
//      syntax and render as literal brackets.
//        "e^(rt)"          -> "e^{rt}"
//        "e^(-Ea / RT)"    -> "e^{-E_a / RT}"
//        "f_(n+1)"         -> "f_{n+1}"
//
//   3. NEVER write sqrt as a function call. Use the LaTeX command.
//        "sqrt(6)"           -> "\\sqrt{6}"
//        "sqrt(l(l + 1))"    -> "\\sqrt{l(l + 1)}"
//
//   4. NEVER spell a symbol out in words inside a math expression — use the
//      real LaTeX command (or the Unicode character, which is also accepted).
//        "1 / lambda"    -> "1 / \\lambda"
//        "h / (2 pi)"    -> "h / (2 \\pi)"
//      This applies only inside math. Ordinary prose keeps its ordinary
//      words: "pi bonds", "pi-electrons" and "delta cells" are English, not
//      notation, and must NOT be converted.
//
//   5. Set stemFormat AND solution.solutionFormat to "latex" on any question
//      carrying math notation in ANY of its fields — including when the only
//      math is in the solution or in a translation. "plain" asserts the text
//      has no notation in it, and is what the audit checks against.
//
//   6. Apply all of the above to translations[] identically. The Tamil entries
//      repeat the same formulae verbatim; a formula fixed only in English is
//      still broken for every student reading the paper in Tamil.
//
//   7. CHEMICAL FORMULAE carry explicit markup too (v1.2) — a bare digit in a
//      formula renders full-size, and a bare sign reads as a hyphen.
//        "H2O"          -> "H_2O"             "C12H22O11" -> "C_{12}H_{22}O_{11}"
//        "(CH3)3N"      -> "(CH_3)_3N"        "SO4^{2-}"  -> "SO_4^{2-}"
//        "NH4+"         -> "NH_4^+"           "Cl-"       -> "Cl^-"
//        "Cu2+"         -> "Cu^{2+}"          (monatomic: the digit is the CHARGE)
//        "O2+" (MO)     -> "O_2^+"            (molecular: the digit is the COUNT)
//        "[CoF6]3-"     -> "[CoF_6]^{3-}"     "6 e-"      -> "6 e^-"
//      Never mark up names or variables that only look like formulae: "SN2",
//      "C4 plants", "P700", "F1 generation", "K1", "V2", "IP3", "Rh+" blood
//      groups. Where plain text is ambiguous, write the markup that says what
//      you mean: oxide is "O^{2-}", superoxide is "O_2^-".
//
//   8. SYMBOLS are typed as the symbol itself (v1.3), never as ASCII stand-ins:
//        "->" "<=>" "<->" "=>"   -> "→" "⇌" "↔" "⇒"      ">=" "<=" "!=" -> "≥" "≤" "≠"
//        "6.6 * 10^{-34}"        -> "6.6 × 10^{-34}"    (same for "x"; "π*"/"σ*" orbitals keep *)
//        "Delta H", "beta-globin", "pi bonds" -> "ΔH", "β-globin", "π bonds"
//      Chemistry: electron configurations "3d^5 4s^1", "2p_x^1", "(n-1)d^{10}";
//      hybridisation "sp^3", "sp^{3}d^2"; constants "K_{sp}", "pK_a", "E_a",
//      "E°_{cell}", "t_{1/2}", "log_{10}", "[A]_0".
//      Indexed variables carry a subscript: "P_1 = P_2", "U_{12}", "k_1", "T_2".
//      Biology names printed with one in NCERT: "F_1", "G_1 phase", "C_4 plants",
//      "GA_3", "B_{12}", "T_3", "IP_3", "NAD^+". Names printed without one stay
//      plain: "T2 phage", "H3 histone", "P700", "C7 vertebra", "E2 elimination".
// ---------------------------------------------------------------------------

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
