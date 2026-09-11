# CONTEXT.md — Assessment Tool Recon (Phase 0 of docs/assessment-tool-debug-plan.md)

Produced by reading the live code (not by trusting older docs, several of which claim these exact subsystems were already fixed). Every claim below cites a file and line. Where something couldn't be settled from static reading, it's marked `UNKNOWN — needs runtime check`.

STACK: React 19 + Vite frontend, Express backend, PostgreSQL (Supabase-hosted) accessed via raw `pg` + a partially-legacy Prisma layer, Supabase Auth/Storage.
REPO ROOT: `P:\Project_lumen\LUMEN_ACADEMY\NEET-assessment-tool-CSK`
ENVIRONMENTS: local dev only in this sandbox (`.env` present, live Supabase DB reachable via `npx tsx db/scripts/query.ts`). No staging/prod distinction found in code beyond `NODE_ENV`.

---

## 1. Route / Page Inventory

**Backend** (`backend/src/routes/`):
- `api.ts` — top-level mount: `/me`, `/auth/session/*`, sub-routers below, `/health`, retired `/submit-attempt` and `/ai/*` (410 stubs), `/questions`, `/syllabus`, `/analytics/dashboard`, `/admin/stats`.
- `assess.routes.ts` — `/attempts/*` (start/responses/submit/pause/resume/envelope/review/irt/cohort), `/sessions` (one-call session creation), `/tests/practice`.
- `admin.routes.ts` — invitations + user-lifecycle admin, permission-gated.
- `catalog.routes.ts` — exams/subjects/syllabus/marking schemes/patterns (read-open).
- `content.routes.ts` — question lifecycle (review/publish/retire) + read CRUD (options/solutions/translations/assets).
- `core.routes.ts` — user-owned subscriptions/enrollments.
- `learn.routes.ts` — study plans/tasks, sessions, topic mastery, flashcards, error log, notifications, unit materials.

**Frontend** (`frontend/src/pages/`): `LandingView` → `DashboardView`/`TestListView`/`CourseAreaView`/`CoursesView` (portal) → `SystemCheckView` → `LobbyView` → `TestTakingView` → `EvaluatingView` → `AttemptReviewView`/`MyResultsView`. Plus `AnalyticsView`, `StudyPlanView`, `ProfileView`/`ProfileCard`, `AdminView`.

---

## 2. Attempt Lifecycle (highest-severity section — read this before touching P2)

**Status values**: live check constraint is `('in_progress','paused','submitted','scored','abandoned')` (`db/migrations/018_test_engine.sql:111-113`, replacing an older 4-value constraint in `012_domain_checks.sql:19-20`). Live code only ever writes `in_progress`, `paused`, `scored` — `submitted`/`abandoned` are allowed by the constraint but no write path was found for them.

**Root cause of BUG-03 (ghost test / 0:00 evaluating) — found, not guessed:**
1. `db/assess/test/attempt/expiry.ts:12` (`enforceExpiry`) is dead code. Its own comment says "TE-P6 wires this into middleware" but it is **never called from any route or controller** (zero matches for `enforceExpiry` under `backend/src`). The only callers are manual proof scripts.
2. `db/scripts/sweep-expired-attempts.ts` (force-submits expired attempts) is real but **manual-only** — its own header says no cron/queue wires it up, and nothing in `package.json` or `backend/src/server.ts` invokes it.
3. `frontend/src/App.tsx:385-401` runs on every authenticated app load: calls `getActiveSession()` (`frontend/src/services/sessionApi.ts:110-120`, `GET /assess/attempts`) and if any `in_progress`/`paused` attempt exists, **auto-navigates straight into `test_taking` with no resume prompt** (`setCurrentScreen("test_taking")`).
4. Net effect: an attempt whose deadline has already passed is never server-closed, sits "active" forever, and the next login drops the user directly into it. The client's own countdown (`TestTakingView.tsx:109-122`) computes a deadline already in the past, hits ≤0 almost immediately, and auto-submits into `EvaluatingView` — this is the literal "0:00 evaluating" symptom.

**No multi-active-attempt guard**: `startAttempt()` (`db/assess/test/attempt/attempt-flow.ts:89-140`) never checks for an existing `in_progress`/`paused` attempt before creating a new one. The only relevant unique index (`ux_attempt_pause_one_open`, `018_test_engine.sql:65`) only prevents duplicate *pause* rows on one attempt, not multiple concurrent attempts. `getActiveSession()` just takes the most-recently-started one — an older orphaned attempt is invisible thereafter.

**BUG-07 (Exit control during an active attempt) — found, concrete:**
`frontend/src/pages/TestTakingView.tsx:488-497` renders a button labeled **"Exit Lobby"** — but it sits in the live question-palette sidebar, right next to the Submit button, i.e. it renders *during active question-answering*, not in any lobby screen. Its handler:
```js
onClick={() => { if (confirm("Are you sure you want to exit the test? Your current progress will be lost.")) onCancel(); }}
```
`onCancel` → `handleCancelSession` (`frontend/src/App.tsx:487-490`) is **100% client-side** — `setActiveSession(null); setCurrentScreen("portal")`. No pause API call, no server notification at all. This is a direct path to an orphaned `in_progress` attempt (feeds BUG-03/06 too), and it's exactly the "Exit Test available while attending" complaint (item 10).

---

## 3. Cross-user data isolation (BUG-04)

**Backend is correctly user-scoped everywhere checked**: `requireAuth.ts:29-70` re-derives identity from the verified token per request (no module-level identity cache); `attempt-flow.ts`'s `loadAttemptForUser`/`pauseAttempt`/`resumeAttempt`/`upsertResponse`/`submitAttempt`/`getReview`/`listAttempts` all filter by `user_id`; `middleware/ownership.ts:20-33` enforces `user_id` on attempts/plans/decks; `analyticsController.ts:14` scopes to `req.user.appUserId`. Module-level mutable state found (`lib/permissions.ts:17`, `lib/supabaseAdmin.ts:16`) is config/client-instance caching, not per-user data — safe.

**Real frontend bleed found, independent of any backend bug**: `frontend/src/App.tsx:138-139` — `attempts`/`activeAttemptId` are plain in-memory SPA state, **never fetched from the server** and **never cleared by `endSession`** (`App.tsx:412-431`, which resets auth/session/screen state but not these two). Because sign-out/sign-in is a client-side route change, not a hard reload, User A finishing a test and signing out followed by User B logging into the *same browser tab* can render User A's just-completed attempt on User B's Dashboard until a real page reload happens. This is a genuine, fixable instance of "state bleeding into other users' accounts."

**The other, more likely explanation for reported cross-user bleed is the demo account — see §7.**

---

## 4. Tab-switch / navigation loses the test (BUG-05)

Confirmed: zero `visibilitychange`/`beforeunload`/`pagehide` listeners anywhere in `frontend/src`. Answers live only in local component state (`TestTakingView.tsx:46-49`) and flush to the server on a 12s `AUTOSAVE_INTERVAL_MS` timer (line 37, effect at 92-97) or on explicit submit — never immediately per answer, never on unload. Unmounting `TestTakingView` (any navigation away, including the BUG-07 exit button) discards whatever hasn't been flushed yet.

---

## 5. Question schema

`content.question` (`db/migrations/003_content.sql:75-91`): `question_id`, `question_uid`, `primary_node_id`, `stem_text` (not null), `numeric_answer`, `answer_tolerance`, `lifecycle_status`. Options in `content.question_option` (stable `option_id`, `is_correct`, `display_order`) — answer key already references option id, not index or position (good; matches BUG-13's requirement already). Translations in `content.question_translation` (`003_content.sql:133-143`): `question_id`, `language_code`, `stem_text`, `option_texts jsonb`, `review_status`.

**Live data check (run this session):**
```
content.question:             1400 rows
content.question_translation: 1280 rows, language_code = 'ta' only, review_status = 'unreviewed' (100%)
```
→ 120/1400 questions (~8.6%) have **no** Tamil row at all. `review_status` is never filtered on by the serving query, so "unreviewed" doesn't block anything.

---

## 6. Question fetch / translation-serving path

`db/assess/test/attempt/envelope.ts:157-174`: fetches `content.question_translation where question_id = any($1) and language_code = 'ta'`, joins `stem_text` and positionally matches `option_texts[i]` onto each already-fetched option. Missing translation → the row is simply absent from the map, loop `continue`s (line 169) — **no throw, ever**, for a fully-missing translation. But `option_texts[i] ?? null` (line 171) means a *partial* `option_texts` array (fewer entries than real options) silently leaves the remaining options untranslated within the same question — this is a real, concrete path to BUG-15's "questions partially in Tamil," not just a hypothetical.

Frontend rendering (`TestTakingView.tsx:309,341`) shows Tamil only when both `language === "ta"` and the field is truthy — stacked beneath the English text (a bilingual-by-default display, not a replace). Missing translation renders nothing extra, with **no fallback message or indicator** — for the 120 gap questions in Tamil mode, this likely reads as "can't fetch the material" (BUG-11) even though nothing is actually erroring.

---

## 7. i18n today (determines all of Phase 5)

**Confirmed: NOT a browser/Google translate widget.** `index.html` has no translate script/meta tag; zero matches for `translate.google`/`GoogleTranslate` anywhere in the repo.

Two real, separate mechanisms exist:
1. **App-chrome strings**: `frontend/src/contexts/LanguageContext.tsx:12-476` — a large hardcoded `Record<string, {en, ta}>` dictionary, looked up via `t(key)` which falls back to the raw English key if untranslated (line 487-489). `LanguageProvider` wraps the **entire app** (`frontend/src/main.tsx:21-28`), and `useLanguage()`/`t()` is consumed in 23 files across the whole app (Header, Dashboard, Analytics, etc. — confirmed by grep), so this genuinely is an app-wide layer already, not per-screen. State is a plain `useState('en')` (`LanguageContext.tsx:481`) — **not persisted** to localStorage/cookie, resets to English on every reload.
2. **Question content**: real per-record DB translations (§5/§6 above), not runtime machine translation.

**Root cause of BUG-17 (bilingual leaking app-wide) — found, concrete:** the *only* control that calls `toggleLanguage()` in the entire frontend is inside `TestTakingView.tsx:264`. Since `LanguageProvider`'s state is global, flipping that one in-test toggle changes chrome text everywhere else in the app too (Header, Dashboard, etc. all read the same `language` value) — there is only one `language` state, not the `ui_lang` (app-wide) / `question_lang` (test-only) split the plan calls for. This isn't a "leak" in the sense of a bug in isolation logic; it's that no such isolation was ever built — one flag serves two purposes.

**BUG-16's "freezes and becomes unchangeable"**: given there's no DOM-rewriting widget, `UNKNOWN — needs runtime check`. Plausible causes to check live: the user's own browser-level "Translate this page" prompt (Chrome offers this automatically on pages it detects as non-English once Tamil text is visible — this would indeed crash React's reconciliation, and the app doesn't have a `translate="no"` / `<meta name="google" content="notranslate">` guard against it), or a Tamil-font/layout issue in a specific browser. Recommend checking for the `notranslate` guard as a cheap, safe first fix regardless of the exact cause.

---

## 8. Timer

Server sets `assess.attempt.server_deadline` once at `startAttempt` (`attempt-flow.ts:129-133`, `now() + duration`). `envelope.ts` computes `remainingSeconds`/`serverNow` server-side at fetch time (confirmed fields returned, ~line 205-206) — so the number the client *starts* from is server-authoritative. From there, `TestTakingView.tsx:109-122` ticks it down with a plain client `setInterval`, and **auto-submit-at-zero is entirely client-triggered** (`handleSubmitAnyway()`, line 111). `submitAttempt` (`attempt-flow.ts:472-723`) does **not** independently check the deadline before accepting a submission — it accepts any `in_progress`/`paused` attempt unconditionally. So if a backgrounded/throttled tab's interval doesn't fire, nothing else forces submission on that path (only the dead `enforceExpiry`/manual sweep script would ever catch it — see §2).

---

## 9. Demo account (BUG-01/02 context)

`frontend/src/services/demoSession.ts:1-45` — the "Quick Demo" button signs into **one single fixed account** (`DEMO_EMAIL = "demo.student@lumenacademy.dev"`, hardcoded password) via `ensureDemoSession()`. There is **no `is_demo` column, no `demo_session_id`, no per-login scoping anywhere** (zero matches across `backend`/`db`). `db/scripts/manual/cleanup-demo-account-attempts.ts:4-13`'s own header comment already documents the consequence: this account is shared across every manual/E2E run, and leftover `in_progress`/`paused` attempts from those get picked up by the same `getActiveSession()` auto-resume (§2) — real production users doing the same demo login will see each other's leftovers. **This fully explains reported "demo account not resetting" / apparent cross-account bleed via the demo flow**: it isn't state bleeding between separate identities — every "Quick Demo" click *is* the same identity. Cleanup is a manual-only script, never scheduled.

---

## Dead code relevant to the above

`prisma/schema.prisma` defines a full parallel legacy attempt schema (`TestAttempt`/`AttemptAnswer`/`AttemptQuestion`/`AttemptSectionState` in `public.*`) structurally competing with `assess.attempt`/`assess.attempt_response`/`assess.attempt_question`. Traced: no live controller/service reads or writes any of these Prisma models for attempts — the one controller conceptually tied to that shape (`attemptController.ts:14-23`) is a hardcoded 410 stub. Confirmed dead **at the code level**; `UNKNOWN` whether stale rows still physically exist in those tables from a pre-migration era (not checked at the data level).

`enforceExpiry` (`db/assess/test/attempt/expiry.ts`) — written, documented as wired, never actually called. Either wire it in (P2) or delete it; leaving it as dead-but-documented code is itself a drift risk for the next person who trusts the comment.

---

## Open questions this recon resolved from the plan's own §14 list

- **BUG-30** (exact "lagging" string): there is no loading-state string matching "lagging" anywhere in the frontend. The only match is the Dashboard's **"Where You're Lagging"** section heading (`DashboardView.tsx:734`). Recommend treating this as the actual target — rename to something like "Focus Areas," which also satisfies BUG-25's own copy guidance ("Focus areas" rather than "worst subjects").
- **BUG-07**: exists and is reachable during an active attempt (see §2) — recommend option (b) from the plan (pause-and-leave with a real server call), not full removal, since the control itself (minus the mislabeling and missing server call) is reasonable UX.
- **BUG-05** (tab-switch timer policy): still needs a product decision (keep running vs. pause) — not resolved by code reading, this is a policy call for whoever owns exam integrity rules.
- **BUG-14, BUG-28**: not addressed by this recon — BUG-14 still needs the screenshot+question-id the plan itself asks for; BUG-28's gating rule (new-account vs. time-based) is a product decision, not a code question.
