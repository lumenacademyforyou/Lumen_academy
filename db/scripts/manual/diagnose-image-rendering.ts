import { pool } from "../../shared/pool.js";
import { createPracticeTest } from "../../assess/test/definition/create-practice-test.js";
import { startAttempt } from "../../assess/test/attempt/attempt-flow.js";
import { chromium } from "@playwright/test";

// Real browser diagnostic that found and confirmed the fix for a live user
// report: "the supabase image link is properly working but the image is not
// loading in the console" (the test-taking screen). Root cause (now fixed
// in frontend/src/components/ui/QuestionImage.tsx): the <img> was hidden via
// display:none (a Tailwind "hidden" class) until its onLoad fired, but it
// also had loading="lazy" — and a display:none element has no layout box,
// so the browser's native lazy-loading can never observe it as "near the
// viewport" to start fetching it. The two mechanisms deadlocked: the image
// needed to load to become visible, but needed to already be visible (have
// geometry) for lazy-loading to ever fetch it. Confirmed live, before and
// after removing loading="lazy": before, the network tab showed zero
// requests for the image and el.currentSrc stayed empty; after, a real 200
// PNG response and el.complete/naturalWidth populate within ~500ms.
//
// Deterministic by construction, not by chance: an earlier version of this
// script drove the real "Build Custom Test" UI and repeatedly found zero
// image questions even at large pick counts — not a fluke, but the
// exposure-ledger's own by-design LRU ordering (LA-APP-COMPLETION-001 C4)
// deprioritizing the handful of image-bearing questions this exact demo
// account had just been served repeatedly by this same diagnostic. Fixed by
// requesting every published question in chem_08 (queried live, never
// hardcoded) so nothing is ever excluded regardless of seen-status, then
// creating that session directly and letting the real browser's normal
// resume-in-progress-attempt effect (App.tsx's getActiveSession()) land in
// TestTakingView for it.
//
// Usage: npx tsx db/scripts/manual/cleanup-demo-account-attempts.ts (clear
// any stale in_progress attempt first, or this may resume the wrong one)
// then npx tsx db/scripts/manual/diagnose-image-rendering.ts, against a
// running `npm run start` on :4000.

const DEMO_EMAIL = "demo.student@lumenacademy.dev";

async function createGuaranteedImageSession(): Promise<void> {
  const examRes = await pool.query<{ exam_id: string; exam_code: string }>(`select exam_id, exam_code from catalog.exam where is_active = true limit 1`);
  const { exam_id: examId, exam_code: examCode } = examRes.rows[0];
  const subjectRes = await pool.query<{ subject_id: string }>(`select subject_id from catalog.subject where subject_code = 'CHEM' and exam_id = $1`, [examId]);
  const subjectId = subjectRes.rows[0].subject_id;
  const nodeRes = await pool.query<{ node_id: string }>(`select node_id from catalog.syllabus_node where tag_code = 'chem_08'`);
  const nodeId = nodeRes.rows[0].node_id;
  const userRes = await pool.query<{ user_id: string }>(`select user_id from core.app_user where email = $1`, [DEMO_EMAIL]);
  if (userRes.rowCount === 0) throw new Error(`no core.app_user found for ${DEMO_EMAIL}`);
  const userId = userRes.rows[0].user_id;

  const countRes = await pool.query<{ n: string }>(
    `select count(distinct q.question_id) as n
       from content.question q
       join content.question_node_map qnm on qnm.question_id = q.question_id
       join catalog.syllabus_node sn on sn.node_id = qnm.node_id
      where sn.tag_code = 'chem_08' and q.lifecycle_status = 'published'`
  );
  const pickCount = Number(countRes.rows[0].n);
  console.log(`chem_08 published pool (live): ${pickCount} — requesting all of it, so nothing is excluded`);

  const created = await createPracticeTest({
    examId,
    examCode,
    testType: "UNIT",
    scopeCode: `DIAG-IMG-${Date.now()}`,
    title: "diagnose-image-rendering",
    durationMinutes: 60,
    createdBy: userId,
    lines: [{ subjectId, syllabusNodeId: nodeId, includeDescendants: false, pickCount, sectionName: "CHEM" }],
  });
  await pool.query(`update assess.test set test_status = 'published' where test_id = $1`, [created.testId]);
  await startAttempt(created.testId, userId);
  console.log(`created and started attempt for test ${created.testId}`);
}

async function driveAndInspect(): Promise<void> {
  const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--disable-dev-shm-usage"] });
  try {
    const page = await browser.newPage();
    const consoleMessages: string[] = [];
    page.on("console", (msg) => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
    page.on("pageerror", (err) => consoleMessages.push(`[pageerror] ${err.message}`));
    const imageResponses: { url: string; status: number; contentType: string | null }[] = [];
    page.on("response", (res) => {
      if (res.url().includes("content-assets") || res.url().includes("supabase.co/storage")) {
        imageResponses.push({ url: res.url(), status: res.status(), contentType: res.headers()["content-type"] ?? null });
      }
    });

    await page.goto("http://localhost:4000/", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.getByRole("button", { name: "Sign In" }).first().click();
    await page.getByRole("button", { name: "Demo Account" }).click();
    console.log("signed in — waiting for the resume-in-progress-attempt effect to land in the console");

    // Wait for something that only exists in TestTakingView, not the
    // generic <main> (the dashboard has one too — an earlier version of
    // this script raced ahead of the async resume effect against that
    // weaker check and searched the dashboard for "Next" buttons instead).
    await page.getByText(/Question \d+ of \d+/).waitFor({ timeout: 30000 });
    console.log("landed in TestTakingView (resumed the guaranteed-image attempt)");

    let found = false;
    for (let i = 0; i < 65; i++) {
      const imgCount = await page.locator("main img").count();
      if (imgCount > 0) {
        found = true;
        const img = page.locator("main img").first();
        const src = await img.getAttribute("src");
        console.log(`\nFound question ${i + 1} with an image: ${src}`);

        let elapsed = 0;
        for (const step of [500, 500, 1000, 2000]) {
          await page.waitForTimeout(step);
          elapsed += step;
          const cls = await img.evaluate((el: HTMLImageElement) => el.className);
          const complete = await img.evaluate((el: HTMLImageElement) => el.complete);
          console.log(`  +${elapsed}ms: className="${cls}" complete=${complete}`);
        }

        const dims = await img.evaluate((el: HTMLImageElement) => ({
          naturalWidth: el.naturalWidth,
          naturalHeight: el.naturalHeight,
          complete: el.complete,
          computedDisplay: getComputedStyle(el).display,
          className: el.className,
          currentSrc: el.currentSrc,
        }));
        console.log("final img element state:", JSON.stringify(dims, null, 2));
        break;
      }
      const nextBtn = page.getByRole("button", { name: /Save & Next|Next/i }).first();
      if ((await nextBtn.count()) === 0) break;
      await nextBtn.click();
      await page.waitForTimeout(250);
    }
    if (!found) console.log("\nNo image question found in this session — unexpected, since it was built from every published chem_08 question.");

    console.log("\n--- image-related network responses ---");
    for (const r of imageResponses) console.log(`${r.status}  ${r.contentType}  ${r.url}`);
    console.log("\n--- console messages ---");
    for (const m of consoleMessages) console.log(m);
  } finally {
    await browser.close();
  }
}

async function main() {
  await createGuaranteedImageSession();
  await pool.end();
  await driveAndInspect();
}

main().catch((err) => {
  console.error("diagnose-image-rendering failed:", err);
  process.exitCode = 1;
});
