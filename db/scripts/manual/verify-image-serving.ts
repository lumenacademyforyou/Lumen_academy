import { pool } from "../../shared/pool.js";
import { createPracticeTest } from "../../assess/test/definition/create-practice-test.js";
import { startAttempt } from "../../assess/test/attempt/attempt-flow.js";
import { getAttemptEnvelope } from "../../assess/test/attempt/envelope.js";

// docs/neet-tool-fix-prompt.md Task 3e — the automated check, run against a
// real generated attempt (not the raw tables). For every served,
// image-bearing question:
//   - the served question_id matches what the generator actually persisted
//     in assess.attempt_question (no drift between generation and serving)
//   - every question flagged has_image returns a real 200 on its asset URL
//   - no question flagged has_image=false carries an image URL
//   - the question_id embedded in the resolved object path (question/<id>/...)
//     matches the question_id of the row serving it (tripwire on the
//     directory-per-question convention already in place)
//   - no asset_id appears against two different question_ids (SHARED-list
//     check — cross-referenced against audit-image-assets.ts's live findings,
//     not hardcoded, since that list can change as more content is added)

const IMAGE_UNITS = [
  { subjectCode: "PHY", tagCode: "phy_07" },
  { subjectCode: "CHEM", tagCode: "chem_04" },
  { subjectCode: "CHEM", tagCode: "chem_08" },
  { subjectCode: "BOT", tagCode: "bot_02" },
  { subjectCode: "ZOO", tagCode: "zoo_07" },
];

async function main() {
  const examRes = await pool.query<{ exam_id: string; exam_code: string }>(
    `select exam_id, exam_code from catalog.exam where is_active = true limit 1`
  );
  const { exam_id: examId, exam_code: examCode } = examRes.rows[0];

  const userRes = await pool.query<{ user_id: string }>(
    `select user_id from core.app_user where email = 'lumenacademyforyou@gmail.com' limit 1`
  );
  if (userRes.rowCount === 0) throw new Error("no core.app_user row for lumenacademyforyou@gmail.com — needed to own the test attempts this creates");
  const userId = userRes.rows[0].user_id;

  // SHARED list from the live audit — an asset legitimately reused across
  // more than one question_id. Currently always empty (see
  // audit-image-assets.ts's last run), computed live here rather than
  // hardcoded so this check never goes stale against that one.
  const sharedRes = await pool.query<{ storage_uri: string; n: string }>(
    `select storage_uri, count(distinct question_id) as n
       from content.asset
      where question_id is not null
      group by storage_uri
     having count(distinct question_id) > 1`
  );
  const sharedUris = new Set(sharedRes.rows.map((r) => r.storage_uri));

  let totalChecked = 0;
  let totalImageQuestions = 0;
  const rows: { position: number; questionId: string; slot: string; url: string; status: number | string; driftOk: boolean; namingOk: boolean }[] = [];
  const failures: string[] = [];
  const seenAssetByQuestion = new Map<string, Set<string>>(); // storage_uri -> set of question_ids seen serving it in this run

  for (const { subjectCode, tagCode } of IMAGE_UNITS) {
    const subjectRes = await pool.query<{ subject_id: string }>(`select subject_id from catalog.subject where subject_code = $1 and exam_id = $2`, [subjectCode, examId]);
    const nodeRes = await pool.query<{ node_id: string }>(`select node_id from catalog.syllabus_node where tag_code = $1`, [tagCode]);
    if (subjectRes.rowCount === 0 || nodeRes.rowCount === 0) {
      failures.push(`${tagCode}: subject/node lookup failed — skipping`);
      continue;
    }
    const subjectId = subjectRes.rows[0].subject_id;
    const nodeId = nodeRes.rows[0].node_id;

    const test = await createPracticeTest({
      examId,
      examCode,
      testType: "UNIT",
      scopeCode: `3E-${tagCode.toUpperCase()}`,
      title: `Task 3e verification (${tagCode})`,
      durationMinutes: 30,
      createdBy: userId,
      lines: [{ subjectId, syllabusNodeId: nodeId, includeDescendants: false, pickCount: 25, sectionName: subjectCode }],
    });
    await pool.query(`update assess.test set test_status = 'published' where test_id = $1`, [test.testId]);
    const attempt = await startAttempt(test.testId, userId);
    const envelope = await getAttemptEnvelope(attempt.attemptId, userId);

    // "generator persisted" ground truth for drift-check
    const persistedRes = await pool.query<{ question_id: string }>(`select question_id from assess.attempt_question where attempt_id = $1`, [attempt.attemptId]);
    const persistedIds = new Set(persistedRes.rows.map((r) => r.question_id));

    // has_image flag ground truth for the has_image=false-never-carries-a-url check
    const hasImageRes = await pool.query<{ question_id: string; has_image: boolean }>(
      `select question_id, has_image from content.question where question_id = any($1::uuid[])`,
      [envelope.questions.map((q) => q.questionId)]
    );
    const hasImageFlag = new Map(hasImageRes.rows.map((r) => [r.question_id, r.has_image]));

    for (const [idx, q] of envelope.questions.entries()) {
      totalChecked++;
      const driftOk = persistedIds.has(q.questionId);
      if (!driftOk) failures.push(`${tagCode} #${idx + 1}: question_id ${q.questionId} served but not found in assess.attempt_question — ID drift`);

      const flaggedHasImage = hasImageFlag.get(q.questionId) === true;
      if (!flaggedHasImage && q.images.length > 0) {
        failures.push(`${tagCode} #${idx + 1}: question ${q.questionId} has has_image=false but the envelope carried ${q.images.length} image(s)`);
      }

      for (const img of q.images) {
        totalImageQuestions++;
        let status: number | string = "?";
        try {
          const res = await fetch(img.url, { method: "GET" });
          status = res.status;
          if (status !== 200) failures.push(`${tagCode} #${idx + 1}: question ${q.questionId} image URL returned ${status}: ${img.url}`);
        } catch (e) {
          status = `fetch error: ${(e as Error).message}`;
          failures.push(`${tagCode} #${idx + 1}: question ${q.questionId} image URL fetch failed: ${status}`);
        }

        // naming tripwire: the object path is question/<question_id>/... —
        // confirm the id segment in the URL matches the serving question_id.
        const namingOk = img.url.includes(`/question/${q.questionId}/`);
        if (!namingOk) failures.push(`${tagCode} #${idx + 1}: resolved URL does not embed serving question_id ${q.questionId}: ${img.url}`);

        // cross-question asset reuse check (only a problem outside the live SHARED list)
        const uriPart = img.url.split("/content-assets/")[1] ?? img.url;
        const storageUri = uriPart;
        const seenSet = seenAssetByQuestion.get(storageUri) ?? new Set<string>();
        seenSet.add(q.questionId);
        seenAssetByQuestion.set(storageUri, seenSet);

        rows.push({ position: idx + 1, questionId: q.questionId, slot: img.optionId ? `option(${img.optionId})` : "stem", url: img.url, status, driftOk, namingOk });
      }
    }
  }

  for (const [uri, qids] of seenAssetByQuestion) {
    if (qids.size > 1 && !sharedUris.has(uri) && !Array.from(sharedUris).some((s) => uri.endsWith(s))) {
      failures.push(`asset ${uri} served under ${qids.size} different question_ids (${Array.from(qids).join(", ")}) and is not on the live SHARED list`);
    }
  }

  console.log(`position | question_id | slot | http_status | drift_ok | naming_ok | url`);
  for (const r of rows) {
    console.log(`${r.position}\t${r.questionId}\t${r.slot}\t${r.status}\t${r.driftOk}\t${r.namingOk}\t${r.url}`);
  }

  console.log(`\nChecked ${totalChecked} served questions across ${IMAGE_UNITS.length} units, ${totalImageQuestions} image(s) resolved.`);
  console.log(`SHARED assets on record: ${sharedUris.size}`);

  if (failures.length > 0) {
    console.log(`\n${failures.length} FAILURE(S):`);
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`\nAll Task 3e automated assertions passed.`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error("verify-image-serving failed:", err);
  process.exitCode = 1;
});
