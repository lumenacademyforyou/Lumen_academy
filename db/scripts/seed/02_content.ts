import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_QUESTIONS } from "../../../database_sample/questions.js";
import { pool } from "../../shared/pool.js";
import { getSupabaseAdmin } from "../../../backend/src/lib/supabaseAdmin.js";

// STAGE 2 — migrate database_sample/questions.ts into content.question /
// question_option / question_solution / question_translation.
//
// Resolution rule: a question resolves to a syllabus_node via
// LEGACY_UNIT_TAG_TO_UNIT_ID below — a human-curated mapping copied from
// prisma/seed.ts (can't import it directly: that file runs its whole Prisma
// seed as a top-level side effect). The first pass of this script matched
// legacy `unit` strings against syllabus_node titles exactly and got 0/20 —
// that mapping was the actual fix (someone already resolved the ambiguity;
// this script just needed to use it instead of re-guessing). Anything not in
// the table still goes to unmapped_questions.json rather than being guessed.
//
// Validation before insert: non-empty stem, 2-6 options, correctAnswerIndex
// in range. Failures go to invalid_questions.json.
//
// Idempotent: upsert on content.question's real AK (question_uid), built
// from the legacy numeric id as "LEGACY-<id>".
//
// job_id: every content.question row needs a real
// content.ai_generation_job.requested_by -> core.app_user, which needs a
// real auth.users row. This script creates ONE system import user via
// Supabase's Auth Admin API (not raw SQL) — requires SUPABASE_SERVICE_ROLE_KEY.
//
// Usage: npx tsx db/scripts/seed/02_content.ts [--dry-run]

const DRY_RUN = process.argv.includes("--dry-run");
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = path.resolve(SCRIPT_DIR, "..", "..", "reports");

// Copied from prisma/seed.ts's LEGACY_UNIT_TAG_TO_UNIT_ID — keep in sync if
// that table changes. Maps a legacy free-text unit tag to a real
// catalog.syllabus_node.tag_code (same ids as the Prisma `Unit.id` values).
const LEGACY_UNIT_TAG_TO_TAG_CODE: Record<string, string> = {
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

interface LegacyQuestion {
  id: number;
  text: string;
  textTa: string;
  options: string[];
  optionsTa: string[];
  correctAnswerIndex: number;
  subject: string;
  unit: string;
  ncertReference: string;
  explanation: string;
}

interface UnmappedEntry {
  legacyId: number;
  subject: string;
  unit: string;
  reason: string;
}

interface InvalidEntry {
  legacyId: number;
  reason: string;
}

async function loadSyllabusNodeIndex(): Promise<Map<string, string>> {
  // key: tag_code -> node_id
  const res = await pool.query<{ tag_code: string; node_id: string }>(
    `select tag_code, node_id from catalog.syllabus_node`
  );
  const index = new Map<string, string>();
  for (const row of res.rows) {
    index.set(row.tag_code, row.node_id);
  }
  return index;
}

function validate(q: LegacyQuestion): string | null {
  if (!q.text || q.text.trim().length === 0) return "empty stem";
  if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) {
    return `option count out of bounds (${q.options?.length})`;
  }
  if (q.correctAnswerIndex < 0 || q.correctAnswerIndex >= q.options.length) {
    return `correctAnswerIndex ${q.correctAnswerIndex} out of range for ${q.options.length} options`;
  }
  return null;
}

async function main() {
  console.log(DRY_RUN ? "--- DRY RUN: no writes will happen ---" : "--- LIVE RUN ---");

  const nodeIndex = await loadSyllabusNodeIndex();
  const unmapped: UnmappedEntry[] = [];
  const invalid: InvalidEntry[] = [];
  const mapped: { q: LegacyQuestion; nodeId: string }[] = [];

  for (const q of ALL_QUESTIONS as unknown as LegacyQuestion[]) {
    const invalidReason = validate(q);
    if (invalidReason) {
      invalid.push({ legacyId: q.id, reason: invalidReason });
      continue;
    }
    const tagCode = LEGACY_UNIT_TAG_TO_TAG_CODE[q.unit];
    const nodeId = tagCode ? nodeIndex.get(tagCode) : undefined;
    if (!nodeId) {
      unmapped.push({
        legacyId: q.id,
        subject: q.subject,
        unit: q.unit,
        reason: tagCode
          ? `LEGACY_UNIT_TAG_TO_TAG_CODE maps "${q.unit}" -> "${tagCode}", but no syllabus_node has that tag_code`
          : `"${q.unit}" is not in LEGACY_UNIT_TAG_TO_TAG_CODE`,
      });
      continue;
    }
    mapped.push({ q, nodeId });
  }

  console.log(`\n${ALL_QUESTIONS.length} legacy questions:`);
  console.log(`  mapped:   ${mapped.length}`);
  console.log(`  unmapped: ${unmapped.length}`);
  console.log(`  invalid:  ${invalid.length}`);

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORTS_DIR, "unmapped_questions.json"), JSON.stringify(unmapped, null, 2));
  fs.writeFileSync(path.join(REPORTS_DIR, "invalid_questions.json"), JSON.stringify(invalid, null, 2));
  console.log(`\nwrote db/reports/unmapped_questions.json (${unmapped.length} entries)`);
  console.log(`wrote db/reports/invalid_questions.json (${invalid.length} entries)`);

  if (mapped.length === 0) {
    console.log("\nNothing to insert — 0 questions resolved to a real syllabus_node.");
    await pool.end();
    return;
  }

  if (DRY_RUN) {
    console.log(`\nWould insert ${mapped.length} questions (+ options + solution + ta translation each).`);
    await pool.end();
    return;
  }

  // Real run: needs a system import user.
  const admin = getSupabaseAdmin(); // throws clearly if SUPABASE_SERVICE_ROLE_KEY is unset
  const IMPORT_EMAIL = "legacy-import@lumen.internal";
  let authUserId: string;

  const listResult = await admin.auth.admin.listUsers();
  if (listResult.error) throw new Error(`failed to list users: ${listResult.error.message}`);
  const users = listResult.data.users as { id: string; email?: string }[];
  const found = users.find((u) => u.email === IMPORT_EMAIL);
  if (found) {
    authUserId = found.id;
    console.log(`\nreusing existing system import user -> ${authUserId}`);
  } else {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: IMPORT_EMAIL,
      email_confirm: true,
      user_metadata: { purpose: "legacy_question_import", system: true },
    });
    if (error || !created.user) throw new Error(`failed to create system import user: ${error?.message}`);
    authUserId = created.user.id;
    console.log(`\ncreated system import user -> ${authUserId}`);
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    // core.app_user.institution_id is nullable (0..1, per
    // docs/design/02_conceptual_er_high_level_revA.md) — the system import
    // user deliberately has none; institutions are out of scope here.
    const appUserRes = await client.query<{ user_id: string }>(
      `insert into core.app_user (auth_user_id, email, mobile_number, full_name, user_role, status)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (auth_user_id) do update set auth_user_id = excluded.auth_user_id
       returning user_id`,
      [authUserId, IMPORT_EMAIL, "0000000000", "Legacy Import System", "system", "active"]
    );
    const appUserId = appUserRes.rows[0].user_id;
    console.log(`app_user (system): ${appUserId}`);

    const jobRes = await client.query<{ job_id: string }>(
      `insert into content.ai_generation_job (requested_by, job_type, provider_name, job_status)
       values ($1, $2, $3, $4)
       returning job_id`,
      [appUserId, "manual_import", "legacy_question_bank", "completed"]
    );
    const jobId = jobRes.rows[0].job_id;
    console.log(`ai_generation_job: ${jobId}`);

    let inserted = 0;
    for (const { q, nodeId } of mapped) {
      const questionUid = `LEGACY-${q.id}`;
      const questionRes = await client.query<{ question_id: string }>(
        `insert into content.question
           (question_uid, primary_node_id, job_id, question_type, stem_text, usage_count, lifecycle_status)
         values ($1, $2, $3, 'single_choice', $4, 0, 'published')
         on conflict (question_uid) do update set stem_text = excluded.stem_text
         returning question_id`,
        [questionUid, nodeId, jobId, q.text]
      );
      const questionId = questionRes.rows[0].question_id;

      await client.query(`delete from content.question_option where question_id = $1`, [questionId]);
      const labels = ["A", "B", "C", "D", "E", "F"];
      for (let i = 0; i < q.options.length; i++) {
        await client.query(
          `insert into content.question_option (question_id, option_label, option_text, is_correct, display_order)
           values ($1, $2, $3, $4, $5)`,
          [questionId, labels[i], q.options[i], i === q.correctAnswerIndex, i + 1]
        );
      }

      await client.query(
        `insert into content.question_solution (question_id, explanation_text, formula_reference)
         values ($1, $2, $3)
         on conflict (question_id) do update set explanation_text = excluded.explanation_text, formula_reference = excluded.formula_reference`,
        [questionId, q.explanation, q.ncertReference]
      );

      if (q.textTa) {
        await client.query(
          `insert into content.question_translation (question_id, language_code, stem_text, option_texts, review_status)
           values ($1, 'ta', $2, $3, 'unreviewed')
           on conflict (question_id, language_code) do update set stem_text = excluded.stem_text, option_texts = excluded.option_texts`,
          [questionId, q.textTa, JSON.stringify(q.optionsTa ?? [])]
        );
      }

      inserted++;
    }

    await client.query("commit");
    console.log(`\ninserted/updated ${inserted} questions.`);
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("02_content seed failed:", err);
  process.exitCode = 1;
});
