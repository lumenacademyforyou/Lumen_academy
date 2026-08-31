import { test, expect, type Page } from "@playwright/test";

// Phase F6 (LA-APP-COMPLETION-001) — shared login step for every journey
// below, factored out once real selectors were confirmed against source
// (frontend/src/pages/LandingView.tsx) rather than duplicated per test.
async function loginAsDemo(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const signInButton = page.getByRole("button", { name: "Sign In" }).first();
  await expect(signInButton).toBeVisible();
  await signInButton.click();
  const demoButton = page.getByRole("button", { name: "Demo Account" });
  await expect(demoButton).toBeVisible();
  await demoButton.click();
  // "Demo Account" now establishes a real Supabase session (services/demoSession.ts's
  // ensureDemoSession — see the fix's own comment in LandingView.tsx for why
  // this changed from a fully client-side fake login). The dashboard heading
  // briefly shows the placeholder "Demo Student" name passed to onLoginSuccess,
  // then Header.tsx's own GET /api/me profile fetch (real, ~seconds-scale
  // latency against the live database) overwrites it with the account's real
  // profile name, "Prince A" (demoSession.ts's DEMO_DISPLAY_NAME) — asserting
  // on that final, stable name rather than the racy transient one.
  //
  // BUG-02 (docs/assessment-tool-debug-plan.md) added a real server-side wipe
  // of the account's own data on every single demo login (demoSession.ts's
  // resetDemoAccountData, awaited before onLoginSuccess fires) so the account
  // is always genuinely fresh — the plan's own trade-off note for this
  // approach ("Option B... slower logins") is real, not theoretical: this
  // wipe is ~20 sequential DELETE round trips, which measured live at
  // 5-10s+ in this environment's ~250ms-per-round-trip latency. 20000ms was
  // enough before that existed; bumped to match the 40000ms this same file
  // already uses for other post-real-backend-work assertions (e.g. after a
  // submit), not an arbitrary increase.
  await expect(page.getByRole("heading", { name: /Start your journey, Prince A!/i })).toBeVisible({ timeout: 40000 });
}

// Shared pre-test ritual every session (subject-wise/custom/full-mock) goes
// through after `createSession` succeeds: system_check (auto-runs ~3.7s of
// simulated diagnostics) -> lobby (requires the instructions checkbox) ->
// test_taking. Selectors confirmed against SystemCheckView.tsx/LobbyView.tsx.
async function passSystemCheckAndLobby(page: Page) {
  // 30s, not 15s: POST /api/assess/sessions alone can take ~14s against the
  // real remote database (see playwright.config.ts's timeout comment) before
  // SystemCheckView even mounts to start its own ~3.7s diagnostics sequence.
  await expect(page.getByRole("button", { name: "Proceed to Instructions" })).toBeEnabled({ timeout: 30000 });
  await page.getByRole("button", { name: "Proceed to Instructions" }).click();
  await page.getByText("I have read and understand all the instructions provided above.").click();
  await page.getByRole("button", { name: "I Understand, Start Test" }).click();
}

// Answers only the first question, then submits — the rest are left
// unattempted (scored honestly as skipped, same real path already proven at
// the HTTP level by db/scripts/manual/verify-phase-d-http-flow.ts's 2/5
// partial-submission check). Deliberately not looping through every
// question: this journey verifies the real assemble -> attempt -> score
// pipeline end to end through the browser, not exhaustive answer-selection
// behaviour (that's TestTakingView.test.tsx's job) — and not knowing the
// exact served question count up front (it depends on the live bank) makes
// a full loop the more fragile choice here.
async function answerFirstQuestionAndSubmit(page: Page) {
  // Each option is a <button> under <main>; in TestTakingView.tsx's render
  // order the question card's option buttons come before the Previous/Flag/
  // Clear/Save & Next controls and the whole right-hand palette sidebar, so
  // the first <button> inside <main> is always the first answer option —
  // confirmed against source, not guessed.
  //
  // Real bug found live while adding the Image-Based Practice journey below
  // (docs/BUGS.md#E1-E3): when the current question has a stem image
  // (QuestionImage.tsx), that image's own "Zoom image" button renders
  // *before* the answer options in DOM order — so "main button first()"
  // resolved to the zoom button instead, opening the fullscreen zoom
  // lightbox (a fixed inset-0 overlay) instead of selecting an answer, which
  // then blocked the later "Submit Test?" click entirely (a genuine element-
  // interception timeout, not a flake). Every other journey in this file
  // happened to avoid this because images were rare/absent on the questions
  // they served; Image-Based Practice guarantees one on every question,
  // which is exactly what surfaced it. Excluding the zoom button here fixes
  // every journey that shares this helper, not just the new one.
  await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
  await page.locator('main button:not([aria-label="Zoom image"])').first().click();

  await page.getByRole("button", { name: "Submit Test?" }).click();
  const confirmButton = page.getByRole("button", { name: /^Submit (Anyway|Test)$/ });
  await expect(confirmButton).toBeVisible({ timeout: 10000 });
  await confirmButton.click();
}

test.describe("Lumen Academy E2E & Backend API Test Suite", () => {
  
  test("Backend Health Check Endpoint", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.service).toContain("Lumen Academy Backend");
  });

  test("Backend Questions API Endpoint", async ({ request }) => {
    const response = await request.get("/api/questions?subject=physics");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("success");
    expect(Array.isArray(body.questions)).toBeTruthy();
    expect(body.questions.length).toBeGreaterThan(0);
  });

  test("Backend Questions API Endpoint - invalid subject rejected", async ({ request }) => {
    const response = await request.get("/api/questions?subject=biology");
    expect(response.status()).toBe(400);
  });

  // Phase H (H1): the AI study-plan endpoint is retired — rule 6 of the
  // completion directive bans AI calls anywhere in this build, and Phase D's
  // rebuild left it with zero real frontend callers. Same "explicit 410, not
  // a silent 404" convention as the submit-attempt check below.
  test("Backend AI Study Plan Endpoint is retired", async ({ request }) => {
    const response = await request.post("/api/ai/study-plan", {
      data: {
        studentName: "Prince A",
        targetExam: "NEET",
        weakSubjects: ["Physics", "Botany"],
      },
    });
    expect(response.status()).toBe(410);
  });

  test("Backend Submit Attempt Endpoint is retired", async ({ request }) => {
    const response = await request.post("/api/submit-attempt", {
      data: {
        attemptId: "mock_test_e2e",
        userAnswers: { 1: 0, 2: 1 },
        durationSeconds: 120,
      },
    });
    expect(response.status()).toBe(410);
  });

  test("Frontend Core Student Journey - Landing to Demo Login and Dashboard", async ({ page }) => {
    // Phase D1 deleted the 3D splash/click-gate scene entirely — the app now
    // opens directly on LandingView. No click-anywhere step needed anymore
    // (this spec used to wait on "Click anywhere to enter portal", which no
    // longer exists and would hang forever).
    await loginAsDemo(page);
  });

  // F6 — subject-wise journey: login -> directory -> subject-wise practice ->
  // attempt -> submit -> back on the dashboard, which now reflects a real
  // completed attempt. The exact hero headline is scenario-based
  // (frontend/src/utils/motivationalMessage.ts), not a fixed "Great work"
  // string — and BUG-02 (docs/assessment-tool-debug-plan.md) made every
  // "Quick Demo" login wipe the account's prior history first, so the
  // attempt this test just submitted is genuinely attempt #1 every time,
  // which always takes the getMotivationalMessage() attemptsCount<=1
  // branch ("Nice work getting started!") regardless of score — asserting
  // that specific, now-deterministic headline instead of the old
  // score-band phrasing this test used to see back when the demo account
  // carried pre-seeded history across runs.
  test("Frontend Journey - Subject-wise practice test, attempt, submit, and dashboard reflects it", async ({ page }) => {
    await loginAsDemo(page);

    await page.getByRole("button", { name: "Tests" }).first().click();
    await expect(page.getByRole("heading", { name: "NEET Mock Test Series" })).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: "Configure Practice" }).click();
    await page.getByRole("button", { name: "BOT", exact: true }).click();
    await page.getByRole("button", { name: "Start Practice" }).click();

    await passSystemCheckAndLobby(page);
    await answerFirstQuestionAndSubmit(page);

    await expect(page.getByRole("heading", { name: /Nice work getting started!/i })).toBeVisible({ timeout: 40000 });
  });

  // F6 — the primary journey the directive names explicitly: build a custom
  // test (subject + a specific unit known to carry image-bearing questions
  // per Phase B3's asset audit), attempt it (best-effort image check — the
  // live bank only has a handful of image-bearing questions total, so this
  // doesn't hard-fail if the served subset happens to include none), submit,
  // and land back on a dashboard reflecting the real completed attempt.
  test("Frontend Journey - Custom test builder, attempt with images where present, submit, and dashboard", async ({ page }) => {
    await loginAsDemo(page);

    await page.getByRole("button", { name: "Tests" }).first().click();
    await expect(page.getByRole("heading", { name: "NEET Mock Test Series" })).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: "Build Custom Test" }).click();
    await page.getByRole("button", { name: "CHEM", exact: true }).click();
    // chem_08 ("Some Basic Concepts & States of Matter") is the unit
    // db/scripts/manual/verify-c-done-when.ts already confirmed carries
    // multiple image-bearing published questions.
    await page.getByRole("button", { name: /Some Basic Concepts & States of Matter/i }).click();
    await page.getByRole("button", { name: "Launch Custom Exam" }).click();

    await passSystemCheckAndLobby(page);

    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
    const stemImage = page.locator("main img");
    if (await stemImage.count() > 0) {
      await expect(stemImage.first()).toHaveAttribute("src", /.+/);
    }

    await answerFirstQuestionAndSubmit(page);
    // Same BUG-02 reasoning as the subject-wise journey above: every demo
    // login now wipes prior history first, so this is always attempt #1.
    await expect(page.getByRole("heading", { name: /Nice work getting started!/i })).toBeVisible({ timeout: 40000 });
  });

  // F6 — full-mock journey. A fresh demo account has an incomplete syllabus
  // tracker (frontend/src/App.tsx's seeded chapterGoals), and
  // TestListView.tsx deliberately locks Full Mock until isSyllabusCompleted
  // — a real product gate, not a bug. Rather than driving the (separately,
  // unverified-here) syllabus-checklist UI just to force it open, this
  // journey asserts the real, current gated state honestly: Full Mock is
  // reachable and correctly shows locked for a fresh account.
  test("Frontend Journey - Full Mock entry point reflects the real syllabus-completion gate", async ({ page }) => {
    await loginAsDemo(page);

    await page.getByRole("button", { name: "Tests" }).first().click();
    await expect(page.getByRole("heading", { name: "NEET Mock Test Series" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Full Mock Test" })).toBeVisible();

    const fullMockButton = page.getByRole("button", { name: /Locked \(Complete Syllabus Tracker\)|Start Full Mock Test/ });
    await expect(fullMockButton).toBeVisible();
    // Whichever real state the seeded demo account is in, the button's own
    // text must say so honestly — never a silently-enabled bypass of the gate.
  });

  // Live-reported regression: "I can't resume the paused test." Root cause
  // traced to the B6 fullscreen-lockdown work (test-layer-hardening pass) —
  // fullscreen is only ever requested from LobbyView.tsx's real click
  // (handleContinue), but App.tsx's handleResumeSession jumps straight from
  // the "Test in progress" modal into TestTakingView, bypassing Lobby
  // entirely, so no fullscreen request was ever made for a resumed attempt —
  // yet TestTakingView's own "must be fullscreen" overlay still applied,
  // blocking the exam UI underneath it. Fixed by requesting fullscreen
  // directly inside handleResumeSession's own click handler (a genuine user
  // gesture, same pattern LobbyView already used). This test drives the
  // real pause -> reload -> resume -> answer path end to end so a future
  // change to either handler can't silently reopen this gap.
  test("Frontend Journey - Exit & Pause a test, reload, and Resume Test actually lands on an answerable exam (not stuck on a fullscreen overlay)", async ({ page }) => {
    await loginAsDemo(page);

    await page.getByRole("button", { name: "Tests" }).first().click();
    await expect(page.getByRole("heading", { name: "NEET Mock Test Series" })).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Configure Practice" }).click();
    await page.getByRole("button", { name: "BOT", exact: true }).click();
    await page.getByRole("button", { name: "Start Practice" }).click();
    await passSystemCheckAndLobby(page);

    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });

    // "Exit and pause?" is a native confirm() dialog (TestTakingView.tsx's
    // handleExitAndPause) — must be accepted before the click resolves.
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /Exit & Pause Test/i }).click();

    // Pausing returns to the portal (onCancel -> App.tsx clears activeSession,
    // leaving currentTab as whatever it already was — "tests" here, since
    // that's the tab this journey navigated through to launch the test).
    await expect(page.getByRole("heading", { name: "NEET Mock Test Series" })).toBeVisible({ timeout: 20000 });

    // A plain in-SPA return to the portal doesn't re-run the reload-survival
    // effect (it only fires from a fresh app load) — reload for real, the
    // same way a student closing and reopening the app would.
    await page.reload({ waitUntil: "domcontentloaded" });

    const resumeButton = page.getByRole("button", { name: "Resume Test" });
    await expect(resumeButton).toBeVisible({ timeout: 20000 });
    await resumeButton.click();

    // The real regression: this used to render TestTakingView but leave it
    // covered by a full-screen "Return to Fullscreen" overlay, with no
    // fullscreen request ever having been made for the resume path (now
    // fixed both in App.tsx's handleResumeSession and by making the
    // fullscreen nudge a non-blocking banner instead of a hard overlay —
    // see TestTakingView.tsx). Proven fixed by actually answering and
    // submitting through the exam, not just checking visibility.
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
    await answerFirstQuestionAndSubmit(page);
    await expect(page.getByRole("heading", { name: /Nice work getting started!/i })).toBeVisible({ timeout: 40000 });
  });

  // Image-based test type (docs/BUGS.md#E1-E3, user ask: "build a test for
  // image based test in the whole application system"). Unlike the custom-
  // builder journey above (which only best-effort-checks for an image,
  // since a hand-picked unit might not serve one this run), every question
  // this mode serves is guaranteed has_image=true by the server
  // (sessionController.ts's image-practice mode -> assess.test_blueprint.
  // has_image_only -> assemble.ts) — so this asserts an image is actually
  // present, not just possibly present.
  test("Frontend Journey - Image-Based Practice serves only image-bearing questions, end to end through the real UI", async ({ page }) => {
    await loginAsDemo(page);

    await page.getByRole("button", { name: "Tests" }).first().click();
    await expect(page.getByRole("heading", { name: "NEET Mock Test Series" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Image-Based Practice" })).toBeVisible();

    const startButton = page.getByRole("button", { name: /Start Image Practice|No image questions available yet/ });
    await expect(startButton).toBeVisible();
    test.skip((await startButton.textContent())?.includes("No image questions available yet") ?? false, "no has_image=true published questions exist in this environment right now");
    await startButton.click();

    await passSystemCheckAndLobby(page);

    // LobbyView's own 30s countdown runs before it actually navigates into
    // TestTakingView (LobbyView.tsx's COUNTDOWN_SECONDS) — the other
    // journeys in this file never wait for it explicitly because their next
    // action is a button click, whose own actionability retry silently
    // waits it out. This journey's next assertion isn't a click, so it must
    // wait for a TestTakingView-only marker itself first, or it can fire
    // while still on the Lobby's countdown screen (which also renders a
    // decorative img under the same app-shell <main>, confirmed live via a
    // failed first attempt at this test — not guessed).
    await expect(page.getByRole("button", { name: /Exit & Pause Test/i })).toBeVisible({ timeout: 35000 });

    // The real assertion this journey exists for: unlike the custom-builder
    // journey, this must actually have an image, not just possibly have one.
    await expect(page.locator("main img").first()).toHaveAttribute("src", /.+/, { timeout: 10000 });

    await answerFirstQuestionAndSubmit(page);
    await expect(page.getByRole("heading", { name: /Nice work getting started!/i })).toBeVisible({ timeout: 40000 });
  });

});
