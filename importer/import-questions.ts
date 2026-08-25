/**
 * import-questions.ts
 *
 * Task 4 of the delivery plan: takes a finished question in the v3
 * block-storage shape (the same shape generate-questions.ts writes to
 * gemini-question-gen/generated/*.json), checks it is well-formed, checks
 * it is tagged to a real, reachable topic, and loads it into the database
 * for real — or, with --dry-run, does every one of those checks and
 * reports what would happen without writing a single row.
 *
 * USAGE
 *   tsx import-questions.ts --file <path-to-questions.json> [--dry-run] [--report <path>]
 *
 * Every run — dry or real — produces the same per-question verdict:
 * IMPORTED / WOULD_IMPORT / REJECTED, with the exact reasons for a
 * rejection. Nothing is ever partially imported: each question is one
 * transaction, so a mid-question failure rolls that question back and
 * moves on to the next one rather than leaving orphaned rows.
 *
 * WHAT "WELL-FORMED" MEANS HERE (checked with zod, no database needed):
 *   - every required top-level field is present and the right type/enum
 *   - every content block is one of the four confirmed shapes (text/latex,
 *     equation, table/dataset, visual-with-asset) and carries what that
 *     shape's own block-template.sql demo actually inserts
 *   - a visual block always carries alt_text (image.block-template.sql's
 *     own comment: "enforced by constraint")
 *   - block seq within a lane is a contiguous 1..N sequence
 *   - option displayOrder is a contiguous 1..N with unique labels
 *   - MCQ_SINGLE has exactly one correct option; MCQ_MULTIPLE has 1..N-1
 *   - every LATEX-bearing block actually parses under KaTeX (the database
 *     cannot check this — latex.block-template.sql's own comment calls
 *     this out as the importer's job)
 *
 * WHAT "TAGGED TO A REAL TOPIC" MEANS HERE (checked against the live DB):
 *   - conceptPath resolves to a real catalog.concept_node row and that
 *     node is_taggable (a question can tag a chapter or a topic, never a
 *     branch — see any *.concept-tree.sql header)
 *   - that concept is actually reachable from the question's examCode,
 *     i.e. catalog.map_node_concept has run for it (checked via
 *     catalog.v_concept_coverage) — otherwise the question would import
 *     successfully and then never surface to a single student
 *   - baseFormat is legal for this exam+subject per
 *     catalog.exam_subject_format (NEET is always MCQ_SINGLE; JEE offers
 *     more)
 *   - lumenId (if supplied) isn't already in content.question
 *
 * ============================================================================
 * OPEN ITEMS — same four this whole kit has been carrying, still not
 * confirmed against the real 010_question_model.sql (see the warning
 * header on 010_question_model.RECONSTRUCTED.sql, which this importer runs
 * against). Each is isolated to one spot below:
 *   1. content.question_concept (search "OPEN ITEM 1") — the real
 *      question-to-concept tagging table's name/shape is unconfirmed; this
 *      importer writes to the reconstruction's best guess.
 *   2. block_role = 'EXPLANATION' (search "OPEN ITEM 2") — only STEM and
 *      OPTION are demonstrated anywhere in the kit.
 *   3. NUMERICAL / MATCHING_LIST answer storage (search "OPEN ITEM 3") —
 *      no template demonstrates either shape. Both are refused rather than
 *      guessed, exactly like generate-questions.ts refuses to generate
 *      them.
 *   4. content.question.author_id (search "OPEN ITEM 4") — accepted if
 *      present, but nothing validates it against an author table because
 *      no such table has ever been confirmed to exist.
 * ============================================================================
 */

import { Client } from "pg";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import katex from "katex";

// ------------------------------------------------------------------
// 0. CLI args
// ------------------------------------------------------------------
function getArg(name: string, fallback?: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  const val = idx !== -1 ? process.argv[idx + 1] : undefined;
  if (val === undefined) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required --${name}`);
  }
  return val;
}
function getOptionalArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}
function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const filePath = getArg("file");
const dryRun = hasFlag("dry-run");
const reportPathArg = getOptionalArg("report");

// ------------------------------------------------------------------
// 1. Enums
// ------------------------------------------------------------------
const EXAM_CODES = ["NEET-UG", "JEE-MAIN", "JEE-ADV"] as const;
const BASE_FORMATS = ["MCQ_SINGLE", "MCQ_MULTIPLE", "NUMERICAL", "MATCHING_LIST"] as const;
// OPEN ITEM 3: only these two are actually importable right now.
const SUPPORTED_BASE_FORMATS = ["MCQ_SINGLE", "MCQ_MULTIPLE"] as const;
const DIFFICULTIES = ["L1", "L2", "L3", "L4", "L5"] as const;
const COGNITIVE_SKILLS = [
  "RECALL",
  "UNDERSTAND",
  "APPLY",
  "ANALYZE",
  "EVALUATE",
  "MULTI_STEP_REASONING",
] as const;
// INFERRED — 010_question_model.RECONSTRUCTED.sql leaves review_status as
// a bare text column with no check constraint, since no template demo ever
// showed a value other than 'DRAFT'. This whitelist exists purely to catch
// typos; loosen it once the real enum (if there is one) is confirmed.
const REVIEW_STATUSES = ["DRAFT", "APPROVED", "REJECTED", "NEEDS_REVISION"] as const;
const TEXT_FORMATS = ["PLAIN", "MARKDOWN", "HTML", "LATEX"] as const;
const TEXT_BLOCK_TYPES = ["TEXT", "LATEX"] as const;
const TABLE_BLOCK_TYPES = ["TABLE", "DATASET"] as const;
// Every visual type ever named across the block-template kit and
// PROMPT_TEMPLATE.md's "do not emit" list.
const VISUAL_BLOCK_TYPES = [
  "IMAGE",
  "DIAGRAM",
  "GRAPH",
  "CIRCUIT",
  "CHEMICAL_STRUCTURE",
  "REACTION_SCHEME",
  "EXPERIMENTAL_SETUP",
  "GEOMETRY_FIGURE",
  "COORDINATE_FIGURE",
  "LABELLED_DIAGRAM",
  "BIOLOGICAL_STRUCTURE",
] as const;

// ------------------------------------------------------------------
// 2. Zod schema for one content_block, by family. A question's stem,
//    each option, and its explanation are each an independent "lane
//    object" ({en: Block[], ta: Block[], ...}) — see BlockLanesSchema.
// ------------------------------------------------------------------
const TextOrLatexBlockSchema = z
  .object({
    seq: z.number().int().min(1),
    blockType: z.enum(TEXT_BLOCK_TYPES),
    textFormat: z.enum(TEXT_FORMATS),
    textContent: z.string().min(1),
  })
  .strict()
  .refine((b) => (b.blockType === "LATEX") === (b.textFormat === "LATEX"), {
    message: "A LATEX block must have textFormat LATEX, and vice versa (see latex.block-template.sql).",
  });

const EquationBlockSchema = z
  .object({
    seq: z.number().int().min(1),
    blockType: z.literal("EQUATION"),
    caption: z.string().optional(),
    equation: z.object({
      equationName: z.string().min(1),
      latexSource: z.string().min(1),
      displayMode: z.enum(["DISPLAY", "INLINE"]),
      variables: z
        .array(
          z.object({
            symbol: z.string().min(1),
            meaning: z.string().min(1),
            siUnit: z.string().optional(),
            sortOrder: z.number().int().optional(),
          }),
        )
        .default([]),
    }),
  })
  .strict();

const TableBlockSchema = z
  .object({
    seq: z.number().int().min(1),
    blockType: z.enum(TABLE_BLOCK_TYPES),
    caption: z.string().optional(),
    table: z.object({
      tableKind: z.enum(["TABLE", "MATCHING_GRID", "DATASET"]),
      columnDefs: z.array(z.any()).min(1),
      rowData: z.array(z.any()).min(1),
      units: z.array(z.any()).optional(),
    }),
  })
  .strict();

const VisualBlockSchema = z
  .object({
    seq: z.number().int().min(1),
    blockType: z.enum(VISUAL_BLOCK_TYPES),
    // CONFIRMED requirement — image.block-template.sql's own comment:
    // "alt_text is compulsory and is enforced by constraint."
    altText: z.string().min(1, "alt_text is required on every visual block"),
    caption: z.string().optional(),
    asset: z.object({
      assetKind: z.string().min(1),
      storageUri: z.string().min(1),
      mimeType: z.string().min(1),
      byteSize: z.number().int().nonnegative().optional(),
      widthPx: z.number().int().positive().optional(),
      heightPx: z.number().int().positive().optional(),
      checksumSha256: z
        .string()
        .regex(/^[0-9a-f]{64}$/i, "checksumSha256 must be 64 hex characters (sha256)"),
    }),
  })
  .strict();

const ContentBlockSchema = z.union([
  TextOrLatexBlockSchema,
  EquationBlockSchema,
  TableBlockSchema,
  VisualBlockSchema,
]);
type ContentBlock = z.infer<typeof ContentBlockSchema>;

// A lane object always has "en" and may have any number of other language
// lanes (the schema only pins language_code as a free-text column — see
// content.content_block — so this does not hardcode "ta" the way
// generate-questions.ts's BlockLanesSchema does).
const BlockLanesSchema = z
  .record(z.string(), z.array(ContentBlockSchema))
  .refine((lanes) => Array.isArray(lanes.en) && lanes.en.length > 0, {
    message: "Every block-lane object must include a non-empty 'en' language lane.",
  });
type BlockLanes = z.infer<typeof BlockLanesSchema>;

const OptionSchema = z
  .object({
    label: z.string().min(1).max(2),
    displayOrder: z.number().int().min(1),
    isCorrect: z.boolean(),
    blocks: BlockLanesSchema,
  })
  .strict();

const ReadyQuestionSchema = z
  .object({
    lumenId: z.string().min(1).optional(),
    // subjectId/conceptId, if present, are NOT trusted — see "Note on
    // subjectId/conceptId" below. Accepted but ignored so a caller who
    // passes generate-questions.ts's raw output isn't rejected for it.
    subjectId: z.string().optional(),
    conceptId: z.string().optional(),
    conceptPath: z
      .string()
      .regex(/^[A-Z]+(\/[A-Z0-9]+){1,3}$/, "conceptPath must look like SUBJ/.../CODE in frozen uppercase codes"),
    examCode: z.enum(EXAM_CODES),
    baseFormat: z.enum(BASE_FORMATS),
    cognitiveSkill: z.enum(COGNITIVE_SKILLS),
    baseDifficulty: z.enum(DIFFICULTIES),
    isNumerical: z.boolean(),
    conceptCount: z.number().int().min(1),
    source: z.string().min(1),
    sourceReference: z.string().min(1),
    stemBlocks: BlockLanesSchema,
    options: z.array(OptionSchema).min(2),
    explanationBlocks: BlockLanesSchema.optional(),
    authorId: z.string().uuid().optional(), // OPEN ITEM 4
    reviewStatus: z.enum(REVIEW_STATUSES).default("DRAFT"),
    isActive: z.boolean().default(false),
  })
  .superRefine((q, ctx) => {
    const correctCount = q.options.filter((o) => o.isCorrect).length;
    if (q.baseFormat === "MCQ_SINGLE" && correctCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `MCQ_SINGLE must have exactly 1 correct option, found ${correctCount}.`,
        path: ["options"],
      });
    }
    if (q.baseFormat === "MCQ_MULTIPLE" && (correctCount < 1 || correctCount >= q.options.length)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `MCQ_MULTIPLE must have between 1 and ${q.options.length - 1} correct options, found ${correctCount}.`,
        path: ["options"],
      });
    }

    const orders = [...q.options.map((o) => o.displayOrder)].sort((a, b) => a - b);
    const expectedOrders = q.options.map((_, i) => i + 1);
    if (JSON.stringify(orders) !== JSON.stringify(expectedOrders)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `option displayOrder must be a contiguous 1..${q.options.length} sequence, got [${orders.join(",")}].`,
        path: ["options"],
      });
    }
    const labels = q.options.map((o) => o.label);
    if (new Set(labels).size !== labels.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `option labels must be unique, got [${labels.join(",")}].`,
        path: ["options"],
      });
    }

    const checkLaneSeqs = (lanes: BlockLanes, where: string) => {
      for (const [lang, blocks] of Object.entries(lanes)) {
        const seqs = blocks.map((b) => b.seq).sort((a, b) => a - b);
        const expected = blocks.map((_, i) => i + 1);
        if (JSON.stringify(seqs) !== JSON.stringify(expected)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${where} (${lang}) block seq must be a contiguous 1..N sequence, got [${seqs.join(",")}].`,
            path: [where, lang],
          });
        }
      }
    };
    checkLaneSeqs(q.stemBlocks, "stemBlocks");
    if (q.explanationBlocks) checkLaneSeqs(q.explanationBlocks, "explanationBlocks");
    q.options.forEach((o, i) => checkLaneSeqs(o.blocks, `options[${i}:${o.label}].blocks`));
  });
type ReadyQuestion = z.infer<typeof ReadyQuestionSchema>;

// ------------------------------------------------------------------
// 3. Legacy-shape detection — a friendlier rejection than a wall of
//    "required field missing" zod errors when someone hands the importer
//    a file in the old flat Prisma-era shape (stemEn/options[]-of-strings/
//    examType/questionType/unitName), which this schema was deliberately
//    rewritten away from. See PROMPT_TEMPLATE.md's "What changed" table.
// ------------------------------------------------------------------
const LEGACY_SHAPE_MARKERS = ["stemEn", "examType", "questionType", "unitName", "chapterName", "topicName"];
function detectLegacyShape(raw: unknown): boolean {
  if (typeof raw !== "object" || raw === null) return false;
  const obj = raw as Record<string, unknown>;
  const hasLegacyMarker = LEGACY_SHAPE_MARKERS.some((k) => k in obj);
  const hasV3Marker = "stemBlocks" in obj && "conceptPath" in obj;
  return hasLegacyMarker && !hasV3Marker;
}

// ------------------------------------------------------------------
// 4. KaTeX validation — the database cannot check whether LaTeX parses;
//    latex.block-template.sql's own comment says this is the importer's
//    job. Blocks mix prose and $...$-delimited math (see any example
//    fixture), so each $...$ span is parsed independently; a block with no
//    $ delimiters at all is parsed whole (an EQUATION's latex_source, or a
//    LATEX block that is pure notation).
// ------------------------------------------------------------------
function findLatexErrors(source: string, where: string): string[] {
  const errors: string[] = [];
  const spans = [...source.matchAll(/\$([^$]+)\$/g)].map((m) => m[1]);
  const toCheck = spans.length > 0 ? spans : [source];
  for (const expr of toCheck) {
    try {
      katex.renderToString(expr, { throwOnError: true, strict: "ignore" });
    } catch (err) {
      errors.push(`${where}: KaTeX could not parse "${expr}" — ${(err as Error).message}`);
    }
  }
  return errors;
}

function validateLatexInLanes(lanes: BlockLanes | undefined, where: string): string[] {
  if (!lanes) return [];
  const errors: string[] = [];
  for (const [lang, blocks] of Object.entries(lanes)) {
    for (const b of blocks) {
      if (b.blockType === "LATEX") {
        errors.push(...findLatexErrors(b.textContent, `${where} (${lang}, seq ${b.seq})`));
      }
      if (b.blockType === "EQUATION") {
        errors.push(...findLatexErrors(b.equation.latexSource, `${where} (${lang}, seq ${b.seq}) equation.latexSource`));
      }
    }
  }
  return errors;
}

function validateAllLatex(q: ReadyQuestion): string[] {
  const errors: string[] = [];
  errors.push(...validateLatexInLanes(q.stemBlocks, "stemBlocks"));
  errors.push(...validateLatexInLanes(q.explanationBlocks, "explanationBlocks"));
  q.options.forEach((o, i) => {
    errors.push(...validateLatexInLanes(o.blocks, `options[${i}:${o.label}].blocks`));
  });
  return errors;
}

// ------------------------------------------------------------------
// 5. Semantic (DB-backed) validation
// ------------------------------------------------------------------
interface Resolved {
  subjectId: string;
  subjectCode: string;
  conceptId: string;
  conceptName: string;
  lastPathSegment: string;
}

async function semanticValidate(
  db: Client,
  q: ReadyQuestion,
): Promise<{ errors: string[]; resolved?: Resolved }> {
  const errors: string[] = [];
  const subjectCode = q.conceptPath.split("/")[0];

  if (!SUPPORTED_BASE_FORMATS.includes(q.baseFormat as (typeof SUPPORTED_BASE_FORMATS)[number])) {
    errors.push(
      `baseFormat "${q.baseFormat}" is not yet importable — its answer/option storage shape is unconfirmed ` +
        `against 010_question_model.sql (OPEN ITEM 3). Only ${SUPPORTED_BASE_FORMATS.join(", ")} are supported today.`,
    );
    // No point resolving further against the DB for a format we will
    // never import — but still report every other structural finding.
  }

  const subjectRow = await db.query(`select subject_id from catalog.subject where subject_code = $1`, [
    subjectCode,
  ]);
  if (subjectRow.rowCount === 0) {
    errors.push(`No subject with code "${subjectCode}" (derived from conceptPath "${q.conceptPath}").`);
    return { errors };
  }
  const subjectId = subjectRow.rows[0].subject_id as string;

  const conceptRow = await db.query(
    `select concept_id, concept_name, is_taggable
       from catalog.concept_node
      where subject_id = $1 and concept_path = $2`,
    [subjectId, q.conceptPath],
  );
  if (conceptRow.rowCount === 0) {
    errors.push(
      `No concept at path "${q.conceptPath}" — check catalog.v_concept_tree, the path is case- and slash-exact.`,
    );
    return { errors };
  }
  const { concept_id: conceptId, concept_name: conceptName, is_taggable: isTaggable } = conceptRow.rows[0];
  if (!isTaggable) {
    errors.push(`Concept "${q.conceptPath}" (${conceptName}) is a branch node, not a chapter/topic — cannot tag a question to it.`);
  }

  const coverageRow = await db.query(
    `select 1 from catalog.v_concept_coverage where concept_path = $1 and exam_code = $2`,
    [q.conceptPath, q.examCode],
  );
  if (coverageRow.rowCount === 0) {
    errors.push(
      `Concept "${q.conceptPath}" has no mapped syllabus node under exam "${q.examCode}" (catalog.v_concept_coverage) — ` +
        `importing would produce a question that exam can never surface.`,
    );
  }

  const formatRows = await db.query(
    `select distinct esf.question_format
       from catalog.exam_subject_format esf
       join catalog.exam_subject es on es.exam_subject_id = esf.exam_subject_id
       join catalog.exam e on e.exam_id = es.exam_id
       join catalog.subject s on s.subject_id = es.subject_id
      where e.exam_code = $1 and s.subject_code = $2`,
    [q.examCode, subjectCode],
  );
  const legalFormats: string[] = formatRows.rows.map((r) => r.question_format);
  if (legalFormats.length === 0) {
    errors.push(`No exam_subject_format rows for exam "${q.examCode}" / subject "${subjectCode}" — has that exam-template file been run?`);
  } else if (!legalFormats.includes(q.baseFormat)) {
    errors.push(`baseFormat "${q.baseFormat}" is not legal for ${q.examCode}/${subjectCode}. Legal formats here: ${legalFormats.join(", ")}.`);
  }

  if (q.lumenId) {
    const dupRow = await db.query(`select 1 from content.question where lumen_id = $1`, [q.lumenId]);
    if ((dupRow.rowCount ?? 0) > 0) {
      errors.push(`lumenId "${q.lumenId}" already exists in content.question — refusing to import a duplicate.`);
    }
  }

  errors.push(...validateAllLatex(q));

  if (errors.length > 0) return { errors };
  return {
    errors: [],
    resolved: {
      subjectId,
      subjectCode,
      conceptId,
      conceptName,
      lastPathSegment: q.conceptPath.split("/").slice(-1)[0],
    },
  };
}

// ------------------------------------------------------------------
// 6. Import (real writes only — never called in --dry-run)
// ------------------------------------------------------------------
async function insertBlock(
  db: Client,
  parent: { questionId?: string; optionId?: string },
  blockRole: "STEM" | "OPTION" | "EXPLANATION",
  languageCode: string,
  block: ContentBlock,
): Promise<void> {
  if ("textContent" in block) {
    await db.query(
      `insert into content.content_block
         (question_id, option_id, block_role, seq, block_type, text_content, text_format, language_code)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [parent.questionId ?? null, parent.optionId ?? null, blockRole, block.seq, block.blockType, block.textContent, block.textFormat, languageCode],
    );
    return;
  }

  if ("equation" in block) {
    const eq = await db.query(
      `insert into content.equation (latex_source, display_mode, equation_name)
       values ($1,$2,$3) returning equation_id`,
      [block.equation.latexSource, block.equation.displayMode, block.equation.equationName],
    );
    const equationId = eq.rows[0].equation_id as string;
    for (const [i, v] of block.equation.variables.entries()) {
      await db.query(
        `insert into content.equation_variable (equation_id, symbol, meaning, si_unit, sort_order)
         values ($1,$2,$3,$4,$5)`,
        [equationId, v.symbol, v.meaning, v.siUnit ?? null, v.sortOrder ?? i + 1],
      );
    }
    await db.query(
      `insert into content.content_block
         (question_id, option_id, block_role, seq, block_type, equation_id, caption, language_code)
       values ($1,$2,$3,$4,'EQUATION',$5,$6,$7)`,
      [parent.questionId ?? null, parent.optionId ?? null, blockRole, block.seq, equationId, block.caption ?? null, languageCode],
    );
    return;
  }

  if ("table" in block) {
    const t = await db.query(
      `insert into content.data_table (table_kind, caption, column_defs, row_data, units)
       values ($1,$2,$3,$4,$5) returning table_id`,
      [
        block.table.tableKind,
        block.caption ?? null,
        JSON.stringify(block.table.columnDefs),
        JSON.stringify(block.table.rowData),
        block.table.units ? JSON.stringify(block.table.units) : null,
      ],
    );
    const tableId = t.rows[0].table_id as string;
    await db.query(
      `insert into content.content_block
         (question_id, option_id, block_role, seq, block_type, table_id, caption, language_code)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [parent.questionId ?? null, parent.optionId ?? null, blockRole, block.seq, block.blockType, tableId, block.caption ?? null, languageCode],
    );
    return;
  }

  // Visual block: dedupe by checksum before inserting a new asset row —
  // "the same figure used in twelve questions is one row in content.asset"
  // (image.block-template.sql).
  const existing = await db.query(`select asset_id from content.asset where checksum_sha256 = $1`, [
    block.asset.checksumSha256,
  ]);
  let assetId: string;
  if ((existing.rowCount ?? 0) > 0) {
    assetId = existing.rows[0].asset_id as string;
  } else {
    const ins = await db.query(
      `insert into content.asset (asset_kind, storage_uri, mime_type, byte_size, width_px, height_px, checksum_sha256)
       values ($1,$2,$3,$4,$5,$6,$7) returning asset_id`,
      [
        block.asset.assetKind,
        block.asset.storageUri,
        block.asset.mimeType,
        block.asset.byteSize ?? null,
        block.asset.widthPx ?? null,
        block.asset.heightPx ?? null,
        block.asset.checksumSha256,
      ],
    );
    assetId = ins.rows[0].asset_id as string;
  }
  await db.query(
    `insert into content.content_block
       (question_id, option_id, block_role, seq, block_type, asset_id, alt_text, caption, language_code)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [parent.questionId ?? null, parent.optionId ?? null, blockRole, block.seq, block.blockType, assetId, block.altText, block.caption ?? null, languageCode],
  );
}

async function insertLanes(
  db: Client,
  parent: { questionId?: string; optionId?: string },
  blockRole: "STEM" | "OPTION" | "EXPLANATION",
  lanes: BlockLanes,
): Promise<void> {
  for (const [lang, blocks] of Object.entries(lanes)) {
    for (const block of blocks) {
      await insertBlock(db, parent, blockRole, lang, block);
    }
  }
}

async function importQuestion(db: Client, q: ReadyQuestion, resolved: Resolved): Promise<string> {
  await db.query("begin");
  try {
    const lumenId = q.lumenId ?? (await db.query(`select content.next_lumen_id($1,$2) as id`, [resolved.subjectCode, resolved.lastPathSegment])).rows[0].id;

    const qRow = await db.query(
      `insert into content.question
         (lumen_id, subject_id, base_format, cognitive_skill, base_difficulty, review_status,
          is_numerical, concept_count, source, source_reference, author_id, is_active)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       returning question_id`,
      [
        lumenId,
        resolved.subjectId,
        q.baseFormat,
        q.cognitiveSkill,
        q.baseDifficulty,
        q.reviewStatus,
        q.isNumerical,
        q.conceptCount,
        q.source,
        q.sourceReference,
        q.authorId ?? null, // OPEN ITEM 4
        q.isActive,
      ],
    );
    const questionId = qRow.rows[0].question_id as string;

    // OPEN ITEM 1: writing to the reconstruction's best-guess tagging table.
    await db.query(
      `insert into content.question_concept (question_id, concept_id, is_primary) values ($1,$2,true)`,
      [questionId, resolved.conceptId],
    );

    await insertLanes(db, { questionId }, "STEM", q.stemBlocks);
    // OPEN ITEM 2: block_role 'EXPLANATION' is inferred, not confirmed.
    if (q.explanationBlocks) await insertLanes(db, { questionId }, "EXPLANATION", q.explanationBlocks);

    for (const o of q.options) {
      const optRow = await db.query(
        `insert into content.question_option (question_id, option_label, is_correct, display_order)
         values ($1,$2,$3,$4) returning option_id`,
        [questionId, o.label, o.isCorrect, o.displayOrder],
      );
      const optionId = optRow.rows[0].option_id as string;
      await insertLanes(db, { optionId }, "OPTION", o.blocks);
    }

    await db.query("commit");
    return questionId;
  } catch (err) {
    await db.query("rollback");
    throw err;
  }
}

// ------------------------------------------------------------------
// 7. Per-question orchestration + report shape
// ------------------------------------------------------------------
type Verdict = "IMPORTED" | "WOULD_IMPORT" | "REJECTED";
interface QuestionResult {
  index: number;
  lumenId: string | null;
  conceptPath: string | null;
  examCode: string | null;
  verdict: Verdict;
  questionId?: string;
  reasons: string[];
}

async function processOne(db: Client, index: number, raw: unknown): Promise<QuestionResult> {
  if (detectLegacyShape(raw)) {
    return {
      index,
      lumenId: (raw as any)?.lumenId ?? null,
      conceptPath: null,
      examCode: null,
      verdict: "REJECTED",
      reasons: [
        "This looks like the old flat/legacy shape (stemEn/options/examType/questionType/unitName), " +
          "not the v3 block-storage shape this importer accepts. See PROMPT_TEMPLATE.md's " +
          '"What changed" table — it needs a conversion pass (stemEn -> stemBlocks.en[TEXT], ' +
          "examType NEET -> examCode NEET-UG, unitName/chapterName/topicName -> conceptPath, " +
          "questionType -> baseFormat) before this importer can validate it at all.",
      ],
    };
  }

  const parsed = ReadyQuestionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      index,
      lumenId: typeof (raw as any)?.lumenId === "string" ? (raw as any).lumenId : null,
      conceptPath: typeof (raw as any)?.conceptPath === "string" ? (raw as any).conceptPath : null,
      examCode: typeof (raw as any)?.examCode === "string" ? (raw as any).examCode : null,
      verdict: "REJECTED",
      reasons: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }

  const q = parsed.data;
  const { errors, resolved } = await semanticValidate(db, q);
  if (errors.length > 0 || !resolved) {
    return {
      index,
      lumenId: q.lumenId ?? null,
      conceptPath: q.conceptPath,
      examCode: q.examCode,
      verdict: "REJECTED",
      reasons: errors,
    };
  }

  if (dryRun) {
    return {
      index,
      lumenId: q.lumenId ?? null,
      conceptPath: q.conceptPath,
      examCode: q.examCode,
      verdict: "WOULD_IMPORT",
      reasons: [],
    };
  }

  try {
    const questionId = await importQuestion(db, q, resolved);
    return {
      index,
      lumenId: q.lumenId ?? null,
      conceptPath: q.conceptPath,
      examCode: q.examCode,
      verdict: "IMPORTED",
      questionId,
      reasons: [],
    };
  } catch (err) {
    return {
      index,
      lumenId: q.lumenId ?? null,
      conceptPath: q.conceptPath,
      examCode: q.examCode,
      verdict: "REJECTED",
      reasons: [`Import transaction failed and was rolled back: ${(err as Error).message}`],
    };
  }
}

// ------------------------------------------------------------------
// 8. Main
// ------------------------------------------------------------------
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("Set DATABASE_URL in your environment (see .env.example).");

  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const items: unknown[] = Array.isArray(raw) ? raw : [raw];

  const db = new Client({ connectionString: databaseUrl });
  await db.connect();

  console.log(`${dryRun ? "[DRY RUN] " : ""}Importing ${items.length} question(s) from ${filePath}...`);

  const results: QuestionResult[] = [];
  for (let i = 0; i < items.length; i++) {
    results.push(await processOne(db, i, items[i]));
  }

  await db.end();

  const imported = results.filter((r) => r.verdict === "IMPORTED").length;
  const wouldImport = results.filter((r) => r.verdict === "WOULD_IMPORT").length;
  const rejected = results.filter((r) => r.verdict === "REJECTED").length;

  console.log("");
  for (const r of results) {
    const label = r.lumenId ?? `(no lumenId, index ${r.index})`;
    console.log(`[${r.verdict}] ${label}${r.conceptPath ? ` — ${r.conceptPath} / ${r.examCode}` : ""}`);
    for (const reason of r.reasons) console.log(`    - ${reason}`);
  }
  console.log("");
  console.log(
    `Summary: ${items.length} total — ${imported} imported, ${wouldImport} would-import, ${rejected} rejected.`,
  );

  const reportPath =
    reportPathArg ??
    path.join(path.dirname(filePath), `import-report-${dryRun ? "dryrun-" : ""}${Date.now()}.json`);
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ file: filePath, dryRun, generatedAt: new Date().toISOString(), summary: { total: items.length, imported, wouldImport, rejected }, results }, null, 2),
  );
  console.log(`Report written to ${reportPath}`);

  if (rejected > 0 && !dryRun) {
    // Real-mode runs still exit 0 for the questions that DID import — a
    // mixed batch is a normal outcome, not a failure of the run itself.
    // Exit non-zero only if literally everything was rejected.
    if (imported === 0 && wouldImport === 0) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
