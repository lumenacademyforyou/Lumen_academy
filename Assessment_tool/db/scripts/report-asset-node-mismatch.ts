/**
 * report-asset-node-mismatch — finds images attached to the wrong question.
 *
 * THE LOGIC, AND WHY IT WORKS
 * ---------------------------
 * Authored image filenames encode subject + topic:
 *
 *     CHE_SOMBAS_DIAG_0001.png   Chemistry / Some Basic Concepts
 *     PHY_NLM_DIAG_0002.png      Physics   / Newton's Laws of Motion
 *     ZOO_BREAND_DIAG_0001.png   Zoology   / Breathing and Exchange of Gases
 *     BOT_PHOIN_DIAG_0001.png    Botany    / Photosynthesis
 *     CHE_CHEBON_DIAG_0003.png   Chemistry / Chemical Bonding
 *
 * Migration 024 renamed these to id-based paths, but content.asset_rename_log
 * preserved every original name — so the authored topic is still recoverable
 * and can be cross-checked against the syllabus node of the question the image
 * is actually attached to.
 *
 * On this bank that check found 14 of 15 in agreement and exactly one
 * disagreement, and the disagreement was a real content bug: the
 * limiting-reagent diagram (CHE_SOMBAS) was attached to LEGACY-13, a
 * boiling-point-elevation question filed under Electrochemistry whose stem
 * references no diagram at all. Migration 042 removed that attachment.
 *
 * Three signals are reported. A fourth — matching the filename's TOPIC code
 * against the question's node title — was implemented, measured, and REMOVED:
 * the codes abbreviate NCERT chapter names (PHOIN = PHOtosynthesis IN higher
 * plants, NLM = Newton's Laws of Motion, BREAND = BREathing AND exchange of
 * gases) while catalog.syllabus_node holds 38 composite UNIT titles ("Plant
 * Physiology & Photosynthesis", "Kinematics & Laws of Motion"). The catalog
 * simply does not carry chapter names, so the check produced 6 false positives
 * and 0 true positives on this bank. A report that cries wolf six times out of
 * six teaches people to ignore it, so it is gone rather than tuned.
 *
 * What is left actually discriminates:
 *   1. SUBJECT mismatch — the filename's subject prefix vs the question's
 *      subject. Unambiguous: a CHE_ image on a Physics question is always wrong.
 *   2. SHARED IMAGE — the same file is the stem of more than one question.
 *      This is what caught LEGACY-13. Now also enforced by
 *      content.uq_asset_stem_checksum, so it should always report zero; it is
 *      kept as the visible check in case the index is ever dropped.
 *   3. UNREFERENCED DIAGRAM — has_image is true but the stem text never
 *      mentions a diagram/figure/graph/circuit. This is the signal that
 *      characterised the real bug: LEGACY-13's stem ("Which of the following
 *      solutions will have the highest boiling point elevation?") refers to no
 *      image at all, yet carried one and qualified for Image Only Practice.
 *
 * Reports only. Nothing is modified or deleted.
 *
 *   npx tsx db/scripts/report-asset-node-mismatch.ts [--json]
 */
import "dotenv/config";
import { pool } from "../shared/pool.js";

const asJson = process.argv.includes("--json");

const SUBJECT_PREFIX: Record<string, string> = { CHE: "CHEM", CHEM: "CHEM", PHY: "PHY", BOT: "BOT", ZOO: "ZOO" };

interface Row {
  question_uid: string;
  original_name: string | null;
  storage_uri: string | null;
  subject_code: string;
  node_title: string;
  attached: boolean;
}

async function main(): Promise<void> {
  const res = await pool.query<Row>(
    `select q.question_uid,
            regexp_replace(l.old_path, '^.*/', '') as original_name,
            a.storage_uri,
            s.subject_code,
            sn.title as node_title,
            (a.asset_id is not null) as attached
       from content.asset_rename_log l
       join content.question q on q.question_id = l.question_id
       join catalog.syllabus_node sn on sn.node_id = q.primary_node_id
       join catalog.subject s on s.subject_id = sn.subject_id
       left join content.asset a on a.asset_id = l.asset_id
      order by 2`
  );

  const findings: { question_uid: string; original_name: string; issue: string; detail: string }[] = [];

  for (const r of res.rows) {
    if (!r.original_name) continue;
    const m = /^([A-Z]+)_/.exec(r.original_name);
    if (!m) continue;
    const subjPrefix = m[1];

    const expectedSubject = SUBJECT_PREFIX[subjPrefix];
    if (expectedSubject && expectedSubject !== r.subject_code) {
      findings.push({
        question_uid: r.question_uid,
        original_name: r.original_name,
        issue: "SUBJECT_MISMATCH",
        detail: `filename says ${subjPrefix} (${expectedSubject}) but the question is ${r.subject_code}`,
      });
    }
  }

  // Signal 2 — the same image as the stem of more than one question.
  const shared = await pool.query<{ checksum_sha256: string; uids: string }>(
    `select a.checksum_sha256, string_agg(q.question_uid, ', ' order by q.question_uid) as uids
       from content.asset a join content.question q on q.question_id = a.question_id
      where a.target_role = 'stem' and a.checksum_sha256 is not null
      group by a.checksum_sha256 having count(*) > 1`
  );
  for (const s2 of shared.rows) {
    findings.push({
      question_uid: s2.uids,
      original_name: s2.checksum_sha256.slice(0, 16),
      issue: "SHARED_IMAGE",
      detail: "one image file is the stem of more than one question — at most one of them can be right",
    });
  }

  // Signal 3 — carries an image its stem never refers to.
  const unref = await pool.query<{ question_uid: string; stem: string }>(
    `select q.question_uid, left(q.stem_text, 90) as stem
       from content.question q
      where q.has_image = true
        and q.lifecycle_status = 'published'
        and q.stem_text !~* '(diagram|figure|fig\.|graph|image|shown|circuit|below|picture|trace|chart|label)'
      order by q.question_uid`
  );
  for (const u of unref.rows) {
    findings.push({
      question_uid: u.question_uid,
      original_name: "(stem text)",
      issue: "UNREFERENCED_DIAGRAM",
      detail: `has_image is true but the stem never refers to one: "${u.stem}"`,
    });
  }

  if (asJson) {
    console.log(JSON.stringify({ checked: res.rowCount, findings }, null, 2));
    return;
  }

  console.log(`report-asset-node-mismatch — checked ${res.rowCount} renamed image(s)\n`);
  if (findings.length === 0) {
    console.log("Clean: no subject mismatch, no image shared between questions, no question carrying a diagram its stem never refers to.");
  } else {
    for (const f of findings) {
      console.log(`${f.issue}  ${f.original_name}  -> ${f.question_uid}`);
      console.log(`   ${f.detail}`);
    }
    console.log(`\n${findings.length} finding(s). Review each — an image on the wrong question is a content bug, not a storage one.`);
  }

  const detached = res.rows.filter((r) => !r.attached);
  if (detached.length > 0) {
    console.log(`\n${detached.length} rename-log entr(ies) whose asset row no longer exists (removed by a dedup pass):`);
    for (const d of detached) console.log(`   ${d.original_name} -> ${d.question_uid}`);
  }
  console.log("\nNothing was modified by this script.");
}

main()
  .catch((err) => {
    console.error("report failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
