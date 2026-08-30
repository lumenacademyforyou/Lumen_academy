# Assessment Tool — Phased Debugging & Remediation Plan

**Purpose:** fix every reported defect without the coding agent drifting, half-finishing, or silently re-breaking something it already fixed.

**How this document is used:** one phase per agent session. Never paste the whole document into a coding session — paste the *Standing Context* block plus the single phase you are working on. Close the session when the phase's exit gate passes.

---

## 0. Standing Context (paste at the top of EVERY agent session)

```
PROJECT: Assessment / test-prep tool (Lumen Academy).
STACK: <fill in: frontend framework, backend, DB, auth, hosting>
REPO ROOT: <fill in>
ENVIRONMENTS: <local / staging / prod>

RULES FOR THIS SESSION:
1. You are fixing ONLY the phase given below. Do not touch files outside the
   "Files in scope" list without saying why first and waiting for approval.
2. Before writing any code, read the listed files and restate in 5 bullets
   what the current behaviour actually is. Do not guess.
3. No refactors, no dependency upgrades, no renaming, no "while I was here"
   cleanups. Bug fixes only.
4. Every fix must reference its BUG ID in the commit message.
5. At the end, output: (a) diff summary per file, (b) how you verified each
   acceptance criterion, (c) anything you deliberately did NOT fix and why.
6. If a fix requires a schema/migration change, stop and propose it before
   applying it.
7. If a fix requires touching the shared session model or the i18n layer,
   stop — those are owned by Phase 2 and Phase 5 respectively.
```

**Anti-drift rules for the human:**
- One phase = one branch = one PR. Never combine phases.
- Do not let the agent start a new phase in a session where it already edited files.
- Re-run the regression checklist (Section 13) before merging each PR, not just at the end.
- If the agent says "I also noticed X" — log X in Section 12, do not let it fix X now.

---

## 1. Phase Map

| Phase | Theme | Reported items covered | Blocking? |
|---|---|---|---|
| P0 | Recon & knowledge capture | — | Blocks everything |
| P1 | Data reset + demo account lifecycle | "delete all users", demo user | Blocks clean QA |
| P2 | Session & test-state integrity | 10, 16, 22, tab-switch, resume, cross-user leakage | Highest severity |
| P3 | Test console UX & layout | 9, 23 | After P2 |
| P4 | Question content correctness | 2, 3, 4, 6, 7, 16 | Independent |
| P5 | App-wide EN/TA language system | 5, 8, 11 | After P4 |
| P6 | Syllabus module | 1 | Independent |
| P7 | Study plan, tasks, notes, pomodoro | 13, 14, 15, 24 | Independent |
| P8 | Dashboard, analytics, reports | 12, 17, 18, 20 | After P2 (data depends on session fix) |
| P9 | Access control & policy | 19, 21 | Independent |
| P10 | Copy, wording & polish | internal jargon, "lagging" wording | Last |

Severity order if you have limited time: **P0 → P1 → P2 → P4 → P8 → P3 → P5 → rest.**

---

## 2. Phase 0 — Recon & Knowledge Capture

**Do not fix anything in this phase.** The output is a document, not a diff. This is what prevents drift later: every subsequent phase quotes from it.

### Deliverable: `CONTEXT.md` in the repo root

The agent must produce it by *reading the code*, not by assuming. Required sections:

1. **Route/page inventory** — every route, the component that renders it, and what data it loads.
2. **Data model** — every table/collection, its columns, and which ones are actually written to at runtime (flag dead columns).
3. **Auth & session** — where the user session is created, stored (cookie/localStorage/JWT/server), how it expires, and who reads it.
4. **Test attempt lifecycle** — the exact states an attempt can be in (`not_started`, `in_progress`, `paused`, `submitted`, `evaluating`, `completed`, `abandoned` — or whatever exists today), where each transition happens, and what triggers "evaluating".
5. **Question schema** — the full shape of a question record, including every language field (`question_en`, `question_ta`, `options_en`, `options_ta`, or whatever exists), and which fields are nullable.
6. **Question fetching path** — API endpoint → query → filter logic → shuffle/selection logic → response shape.
7. **i18n today** — exactly how Tamil is currently produced. Confirm whether it is (a) stored translations, (b) a browser/Google page-translate widget, or (c) runtime machine translation. This answer determines the whole of P5.
8. **Timer implementation** — client-side, server-side, or both. Where "remaining time" is computed and persisted.
9. **Known dead code** — anything unreferenced.

### Exit gate
- `CONTEXT.md` exists, is committed, and a human has read section 4, 6 and 7 and agrees they match reality.

---

## 3. Phase 1 — Data Reset & Demo Account

### BUG-01 — Wipe all users and user data, start fresh
**Reported as:** "delete all the users in the db we can start fresh"

**Before anything:**
- Take a full DB backup and store it off the server. Confirm the backup restores into a scratch DB. Do not skip this.
- Confirm with the product owner in writing that real user data is expendable.

**Fix spec**
- Write a single idempotent script (`scripts/reset-user-data.ts|py`) — not manual SQL run by hand.
- It deletes, in FK-safe order: test attempts, attempt answers, results/evaluations, study plans, custom tasks, revision notes, pomodoro logs, dashboard aggregates/caches, sessions/refresh tokens, then users.
- It must NOT delete content: questions, subjects, syllabus, topics, media.
- It ends by seeding exactly one demo user.
- The script refuses to run against production unless an explicit `--i-know` flag plus an env check passes.

**Done when:** running the script twice in a row leaves the DB in the same clean state; content tables are untouched; app loads with zero users besides demo.

---

### BUG-02 — Demo account must always open fresh and self-clean
**Reported as:** "keep a demo user but do not store any data in it… must be fresh… automatically delete the data whenever completing a task"

**Design decision to make first (pick one, write it in `CONTEXT.md`):**

- **Option A — Ephemeral session scoping (recommended).** The demo user's data is namespaced by a per-login `demo_session_id`. On login, a new id is minted; all reads filter by it, so previous data is invisible instantly. A nightly job hard-deletes rows from old demo sessions. Fast, safe, no destructive deletes on the request path.
- **Option B — Delete-on-login.** On demo login, hard-delete all rows owned by the demo user, then proceed. Simpler, but slow logins and a race risk if two people demo simultaneously.

Option A is the better fit because "whenever opens the demo account it must be fresh" and concurrent demo users are likely.

**Fix spec**
- Add `is_demo` on users and `demo_session_id` on every user-owned table (or a shared owner-scope column).
- Demo account is barred from anything irreversible or outbound: no account deletion, no email sends, no export of other users' data.
- After a task completes (test submitted, plan finished, pomodoro logged), the demo record is marked disposable and swept — but only *after* the user has seen the result screen. Do not delete the attempt the moment it's submitted or the results page will 404.
- Show a small persistent badge: "Demo mode — your progress isn't saved."

**Done when:** log into demo, take a test, log out, log back in → dashboard is empty, no leftover attempts, and the results page was viewable during the first session.

### Exit gate for P1
- Clean DB, demo login works twice in a row with no residue, content intact.

---

## 4. Phase 2 — Session & Test-State Integrity (highest severity)

This is the cluster causing the most visible damage. Fix it as one coherent model, not as five patches.

### The model to implement (write this down before coding)

An **attempt** is server-owned. The client is a view onto it.

```
States: created → in_progress → paused → in_progress → submitted → evaluating → completed
                                      ↘ expired (time ran out) → evaluating → completed
```

- `attempt.id`, `user_id`, `test_id`, `status`, `started_at`, `expires_at`, `time_remaining_ms`, `last_heartbeat_at`, `answers[]`, `current_question_index`.
- **Time is authoritative on the server.** The client renders a countdown but never decides completion. On every resume, the server returns `time_remaining_ms`.
- A user may have **at most one** attempt in `in_progress` or `paused` at a time. Enforce with a DB unique partial index, not application logic alone.

### BUG-03 — Ghost test appears on login, then shows "evaluating" with 0:00 remaining
**Reported as:** item 22

**Likely root causes:** attempts are created eagerly (on page render or on login) rather than on explicit "Start"; and/or a stale `in_progress` attempt whose `expires_at` has passed is never reconciled, so the UI renders it with a zero timer and the evaluator picks it up.

**Fix spec**
- Attempts are created **only** on an explicit user action (`POST /attempts` from the Start button). Never on render, never on login, never on a `useEffect` that runs on mount.
- Add a reconciler (cron or on-read): any attempt where `now > expires_at` and status is `in_progress|paused` → `expired`, then evaluate with whatever answers exist, then `completed`. It must never sit in `evaluating` indefinitely.
- Never auto-open an attempt on login. Instead, show a resume prompt (see BUG-06).
- Guard against double-submission with an idempotency key.

**Done when:** logging in never spawns a test; killing the app mid-test and returning shows a resume prompt, not a zero-timer evaluating screen; no attempt can remain in `evaluating` for more than one reconciler cycle.

---

### BUG-04 — Sessions left active after a test; state bleeds into other users' accounts
**Reported as:** "you left the sessions active after completing… it also reflects in other users accounts"

This is the most serious item on the list — it is a data isolation bug, not a UX bug.

**Likely root causes:** attempt/test state held in a module-level variable, a singleton, a server-side global, or a cache key that omits `user_id`; or an unscoped query (`SELECT * FROM attempts WHERE test_id = ?` with no user filter).

**Fix spec**
- Audit every query touching user data for a `user_id` (or owner-scope) predicate. No exceptions.
- Audit every cache key, memo, and in-memory store for user scoping. Any module-level mutable state holding request data must be removed.
- Add a repository-level guard: user-scoped models can only be read through a function that requires an authenticated user id.
- On submit/exit, explicitly clear client-side attempt state (store, context, localStorage keys) — do not rely on the next login overwriting it.
- Add an automated test: user A takes a test, user B logs in on the same server instance, B's dashboard shows nothing of A's.

**Done when:** the cross-user test passes, and a grep for user-data queries shows an owner predicate on every one.

---

### BUG-05 — Navigating to another tab/section kills the running test
**Reported as:** "if i move into another tab while attending the test… it is gone"

**Fix spec**
- Two distinct behaviours, don't conflate them:
  - **In-app navigation** (clicking Dashboard while a test runs): intercept with a confirm dialog — "You have a test in progress. Leaving will pause it." If they proceed, transition to `paused` and persist. The attempt stays resumable; it is not lost, not submitted, not abandoned.
  - **Browser tab switch / minimise** (`visibilitychange`): do **not** navigate away and do not destroy state. Depending on exam policy, either keep the timer running (typical for proctored) or pause it. Decide and document. Log the blur event either way for integrity reporting.
- The test must remain reachable from a persistent "Resume test" affordance until it is submitted or explicitly exited.

**Done when:** navigating to Dashboard and back returns you to the same question with the correct remaining time and all answers intact.

---

### BUG-06 — Resume after refresh, crash, or logout
**Reported as:** "the session must be saved like it paused… accidentally refreshed or logged out"

**Fix spec**
- On app load, `GET /attempts/active`. If one exists, show a resume banner on Dashboard and in "Previous Tests": *"Test in progress — 18:42 remaining. Resume / Submit."*
- The active attempt row is written on every answer selection (debounced ~500ms) and on every navigation between questions. Do not buffer answers only in memory.
- Client-side: mirror answers to `localStorage` keyed by `attempt:{id}` as a crash backstop, and reconcile with the server on resume (server wins on conflict, except for answers the server has never seen).
- Cookies: session cookie must be `HttpOnly`, `Secure`, `SameSite=Lax`, with a sensible sliding expiry so a refresh doesn't log the user out in the first place.
- Timer pauses on `paused`, resumes on resume. `time_remaining_ms` is recomputed and persisted at each transition.

**Done when:** hard-refresh mid-test, close the browser, log out and back in — all three return you to the same attempt with correct remaining time.

---

### BUG-07 — "Exit Test" is available while attending
**Reported as:** item 10

Clarify the intent, because two readings are possible:
- **(a)** Exit should not exist at all during an attempt → remove the control, make submit the only way out.
- **(b)** Exit exists but must not silently discard the attempt → keep it, gate it behind a confirmation, and treat it as pause-and-leave, not delete.

**Recommended:** (b) with a hard confirm — "Exit and pause? Your time will be paused and you can resume from Previous Tests." Plus a separate, clearly destructive "Submit and finish". This satisfies both item 10 and the resume requirement.

**Done when:** a single accidental click can never end an attempt; exiting always leaves a resumable record.

---

### BUG-08 — Some tests do not start
**Reported as:** item 16

**Investigate in this order:**
1. Is the blocker the unique-active-attempt rule (a stale `in_progress` attempt silently blocks a new start)? Most likely cause given BUG-03.
2. Does the test have fewer available questions than its configured question count → selection query returns empty → silent failure?
3. Missing language variant causing the fetch to throw (overlaps BUG-10).
4. Missing/failed media asset blocking render.

**Fix spec**
- Every start failure must surface a specific, human-readable reason — never a blank screen or an infinite spinner.
- Add server-side validation at test-config save time: a test cannot be published if the question pool can't satisfy its blueprint.

**Done when:** every test in the catalogue starts, or fails with an explicit message naming the reason.

### Exit gate for P2
Run the full Session Matrix (Section 13.1). All rows pass.

---

## 5. Phase 3 — Test Console UX & Layout

### BUG-09 — Test must run only in full view
**Reported as:** item 9

**Fix spec**
- The attempt route renders in a dedicated full-screen layout: no app sidebar, no top nav, no other section chrome. It is its own layout, not the standard shell with things hidden by CSS.
- Optionally request the Fullscreen API on start; if the user exits fullscreen, show a non-blocking prompt to return. Do not auto-submit on fullscreen exit — that punishes accidental keypresses.
- Small screens: the console must still be usable; "full view" means full viewport, not a fixed desktop width.

---

### BUG-10 — Console stretches with question length; needs fixed height + internal scroll; images need a proper frame
**Reported as:** item 23

**Fix spec**
- Console shell: fixed viewport height (`100dvh`, not `100vh` — avoids mobile browser chrome bugs), `overflow: hidden`.
- Three regions inside it:
  - **Header** (fixed): test name, question counter, timer, submit.
  - **Body** (scrollable): question text + image + options. `overflow-y: auto`, `min-height: 0` on the flex child — this is the classic reason a nested flex scroll silently fails.
  - **Footer** (fixed): Previous / Next / Mark for review / palette toggle.
- The question palette gets its own independent scroll container.
- **Images:** wrap in a fixed-aspect frame (e.g. `aspect-ratio: 16/9` or a max-height box), centered both axes, `object-fit: contain`, neutral background, no distortion, no layout shift while loading (reserve the space). Add a lightbox/zoom for dense diagrams.
- Long option text wraps; options never overflow horizontally.

**Done when:** a question with 800 words and a tall image renders with the timer and nav still visible without any page scroll; the browser window never scrolls, only the body region does.

### Exit gate for P3
Test three questions — very long text, tall portrait image, wide landscape image — at 1920px, 1366px, and 390px widths. Header and footer stay pinned in all nine combinations.

---

## 6. Phase 4 — Question Content Correctness

Fix data before UI here — several "UI bugs" in this list are actually content bugs.

### BUG-11 — Tamil questions fail: "can't fetch the material"
**Reported as:** item 2

**Investigate:** is the failure (a) no Tamil rows exist for those questions, (b) rows exist but the query filters them out, (c) an encoding problem (Tamil rendered as `???` or mojibake), or (d) the API errors when `question_ta` is null?

**Fix spec**
- DB, connection, and API responses must all be UTF-8 / `utf8mb4`. Verify the column collation explicitly — `latin1` columns are a common silent killer for Tamil.
- Font stack must include a Tamil-capable font (e.g. Noto Sans Tamil) with an explicit fallback; do not rely on the system default.
- Never throw on a missing translation. Fall back to English and flag the record.
- Add `GET /admin/content-health` returning counts of questions missing Tamil text, missing Tamil options, or with option-count mismatch between languages.

---

### BUG-12 — Repeated questions within a single test
**Reported as:** item 3

**Likely root causes:** random selection with replacement; a JOIN fanning out rows; duplicate rows in the question bank; or shuffle applied per-render instead of once per attempt.

**Fix spec**
- Question selection happens **once**, at attempt creation, and the resulting ordered id list is persisted on the attempt. Never re-select or re-shuffle on render — that also fixes questions changing when you navigate back.
- Selection query uses `DISTINCT` on question id and asserts `len(set(ids)) == len(ids)` before saving; fail loudly if not.
- Run a one-off dedupe on the question bank: find near-duplicates by normalised text hash, review, merge.

**Done when:** 20 consecutive generated attempts contain zero repeats, and revisiting question 3 shows the identical question and option order.

---

### BUG-13 — Wrong questions / wrong options displayed
**Reported as:** item 4

**Likely root causes:** index vs. id confusion (using array position as the key), option order shuffled after the correct-answer index was recorded, or the answer key stored as a position rather than an option id.

**Fix spec**
- Options must be entities with stable ids. The correct answer references an **option id**, never an index, never text.
- If options are shuffled, shuffle once per attempt and persist the order alongside the attempt.
- React/Vue lists must key on option id, not array index.
- Add a scoring unit test: shuffle options, submit, assert the score is unchanged.

---

### BUG-14 — "That case is showing in the Question sections"
**Reported as:** item 6 — **ambiguous, needs clarification before work starts**

Possible readings: raw escape sequences/HTML entities leaking into rendered text; letter-case problems (ALL CAPS or lowercase question text); a "test case"/placeholder record visible in the live bank; or a switch-case/debug label rendered by mistake.

**Action:** capture one screenshot with the section name and question id before assigning this. Do not let the agent guess — a guessed fix here is how drift starts.

---

### BUG-15 — Questions partially in Tamil
**Reported as:** item 7

**Fix spec**
- Language completeness is per-question, all-or-nothing: stem, all options, explanation, and any image caption must exist in a language for that question to be served in it.
- Add a computed `has_complete_ta` flag, maintained on write.
- Bilingual/Tamil mode only serves questions where the flag is true, or falls back to English for the *whole* question — never mixes within one question.
- Ship an admin report listing every incomplete record so content staff can fill gaps.

### Exit gate for P4
`content-health` reports zero option-count mismatches; 20 sampled attempts show no repeats, no mixed-language questions, and correct scoring against a hand-marked key.

---

## 7. Phase 5 — App-Wide English/Tamil Language System

### BUG-16 — Enabling Tamil translates the whole page and freezes it
**Reported as:** items 8, 5, 11

The symptom (page becomes "unchangeable") strongly suggests a **browser/machine page-translation layer** is in use, which rewrites DOM text nodes that the framework then can't reconcile — a well-known cause of crashes and frozen UI in React/Vue apps.

**Fix spec — replace, don't patch**
- Remove the page-translation mechanism entirely.
- Introduce a real i18n layer: a `lang` value (`en` | `ta`) in app state, persisted to `localStorage` and a cookie, applied via `<html lang>`.
- All UI chrome strings move to `en.json` / `ta.json` resource files. No hardcoded user-visible strings.
- Content (questions, syllabus) uses the stored per-record translations from P4, not runtime translation.
- A single global language toggle in the header. It re-renders; it never reloads the page and never mutates the DOM out from under the framework.
- Language choice persists across navigation, refresh, and login.

### BUG-17 — Bilingual mode leaks into sections where it doesn't belong
**Reported as:** item 11

Distinguish two concepts and name them differently in code:
- **App language** (`ui_lang`): affects all chrome, everywhere. Always available.
- **Question display mode** (`question_lang`: `en` | `ta` | `bilingual`): affects question rendering only, and is available only in test and practice contexts.

"Bilingual" (both languages stacked in one view) must be a question-rendering option, not an app-wide mode. Once separated, the leak disappears by construction.

**Done when:** switching app language changes menus and labels everywhere with no freeze; bilingual toggle appears only inside test/practice; refreshing preserves both settings independently.

### Exit gate for P5
Full click-through of every route in Tamil with no untranslated strings, no frozen UI, no layout breakage from longer Tamil strings (Tamil text typically runs longer than English — check buttons and table headers).

---

## 8. Phase 6 — Syllabus Module

### BUG-18 — Syllabus View and Download both broken
**Reported as:** item 1

**Investigate:** does the API return the file/list at all? Is it a storage path issue (file missing, wrong bucket, expired signed URL), a CORS/content-disposition issue, or a frontend handler that never fires?

**Fix spec**
- **View:** render syllabus in-app (PDF viewer for documents, structured list for topic trees). Handle loading, empty, and error states explicitly.
- **Download:** serve with `Content-Disposition: attachment`, correct `Content-Type`, and a clean filename (`Syllabus-<Subject>-<Year>.pdf`). If using signed URLs, generate them per request with a short TTL.
- Verify the files actually exist in storage — this bug is very often "the asset was never uploaded", not "the code is wrong". Check that first, it takes two minutes.
- If a syllabus asset is missing, show "Not available yet" rather than a dead button.

**Done when:** view opens inline and download saves a valid, openable file on desktop and mobile, for every subject.

---

## 9. Phase 7 — Study Plan, Custom Tasks, Notes, Pomodoro

### BUG-19 — Study Plan: create once, edit anytime
**Reported as:** item 13

**Fix spec**
- Enforce one active plan per user with a DB constraint (unique partial index on `user_id where status = 'active'`), not just a hidden button.
- If a plan exists, the create route redirects to edit.
- Edit supports adding/removing/reordering items and changing dates, with optimistic UI and a real save confirmation.
- Keep an `updated_at` and a simple version/history if plans drive analytics.
- Provide an explicit "Reset plan" (archive current, create new) so users aren't permanently stuck with a bad first attempt.

### BUG-20 — Custom Study Task not working
**Reported as:** item 14

**Fix spec:** full CRUD — create, list, edit, complete, delete. Persist server-side (not component state). Validate required fields with inline errors. Completing a task must update whatever dashboard counters reference it (see P8). Empty state should invite creation, not show a blank panel.

### BUG-21 — Personal Revision Note not working
**Reported as:** item 15

**Fix spec:** full CRUD with autosave (debounced, with a visible "Saved" indicator). Notes are strictly user-scoped — re-check against BUG-04. Support attaching a note to a subject/topic and searching notes. Sanitise any rich-text input server-side to prevent stored XSS.

### BUG-22 — Pomodoro: add scroll on finish and log it
**Reported as:** item 24

**Fix spec:** the completion panel and session log get their own scroll container (same fixed-height + `overflow-y: auto` pattern as BUG-10). Every completed session writes a log row (`started_at`, `duration`, `task_id?`, `completed`). Show the log as a scrollable history. For demo users this log is swept per BUG-02.

### Exit gate for P6/P7
Create → edit → complete → delete works for plan, task, and note; each survives a refresh; pomodoro log shows the last 20 sessions and scrolls.

---

## 10. Phase 8 — Dashboard, Analytics & Reports

Do this after P2 — several of these are wrong *because* attempt records are wrong.

### BUG-23 — "Tests Taken" count is wrong
**Reported as:** item 17

**Fix spec:** define the metric precisely and put the definition in `CONTEXT.md`: *Tests Taken = count of attempts with status `completed` for this user.* Exclude `created`, `in_progress`, `paused`, `abandoned`, and expired-with-zero-answers. Compute from a single source of truth — if there's a denormalised counter, either remove it or rebuild it from attempts and keep it in a transaction with the submit. Ghost attempts from BUG-03 are a likely contributor; verify the count after P2 before assuming a separate bug.

### BUG-24 — Subject Performance not working
**Reported as:** item 18

**Fix spec:** per-subject aggregation over completed attempts: attempted, correct, accuracy %, average time per question, trend over last N attempts. Requires each answer row to carry `subject_id` (denormalise at write time if the join is expensive). Handle the zero-data case with a real empty state, not a broken chart.

### BUG-25 — Overview section is empty; should show "least marks to score"
**Reported as:** item 12

**Interpretation to confirm:** the user wants the *weakest areas* surfaced — the subjects/topics where the student scores lowest, so they know what to fix.

**Fix spec**
- Overview shows: overall accuracy, tests completed, current streak, strongest 3 topics, **weakest 3 topics** ("lowest scoring — focus here"), and one suggested next action linked to the study plan.
- Requires a minimum sample (e.g. ≥5 answered questions in a topic) before calling it weak — otherwise a single unlucky question labels a topic as a weakness.
- Frame it constructively in the copy: "Focus areas" rather than "Your worst subjects".

### BUG-26 — Cannot download PDF report
**Reported as:** item 20

**Fix spec**
- Decide server-side vs client-side generation. Server-side is more reliable for Tamil text and consistent output; client-side avoids infra. **Server-side is recommended here specifically because of Tamil font embedding** — client-side PDF libraries routinely drop non-Latin glyphs.
- The PDF must embed a Tamil-capable font, or Tamil content renders as boxes.
- Content: student name, period, tests completed, overall accuracy, per-subject table, focus areas, attempt history.
- **Branding:** carry the Lumen Academy identity through — "LUMEN ACADEMY" heading, the logo (mountain / graduation cap / sun, tagline "Empowering Futures through Learning"), and the teal/navy + orange/gold palette, matching the question-paper PDFs.
- Long generations run async with a progress state; never leave the button spinning with no feedback.

### Exit gate for P8
Seed a known dataset (e.g. 5 attempts with hand-computed scores). Every dashboard number matches the hand calculation. PDF opens in Acrobat, Preview, and Chrome with Tamil rendering correctly.

---

## 11. Phase 9 — Access Control & Policy

### BUG-27 — Remove "Delete Account" from user-facing UI
**Reported as:** item 21

**Fix spec:** remove the UI control **and** protect the endpoint — an admin-only route with a role check server-side. Removing the button alone leaves the API exposed. Provide an admin path for legitimate deletion requests, and consider soft-delete + anonymise rather than hard delete, since account deletion requests may carry legal obligations depending on your jurisdiction — worth a quick check with whoever handles compliance.

### BUG-28 — Block Full Test immediately after signup/login
**Reported as:** item 19

**Clarify the rule before implementing** — "just now logged in" could mean:
- (a) brand-new accounts (no practice history) can't take a full test yet, or
- (b) nobody can start a full test within N minutes of logging in.

(a) is the sensible product rule; (b) punishes returning users. Recommend (a): require some readiness signal (e.g. ≥1 completed practice test, or account age > X hours). Enforce server-side on the start endpoint, not just by hiding the button. The UI shows the requirement and progress toward it — "Complete 1 practice test to unlock Full Tests" — never a silently disabled button.

---

## 12. Phase 10 — Copy, Wording & Polish

### BUG-29 — Remove internal/technical wording from the UI
**Reported as:** "remove unwanted wordings in the frontend like referencing… database sync"

**Fix spec:** sweep every user-visible string for internal vocabulary — "database", "sync", "fetching records", "API", "null", "cache", "session token", "payload", table names, error codes shown raw. Replace with user-language equivalents:

| Instead of | Use |
|---|---|
| "Syncing with database…" | "Getting things ready…" |
| "Failed to fetch data" | "We couldn't load this. Try again." |
| "No records found" | "Nothing here yet." |
| "Session invalid" | "Please sign in again." |

Raw technical errors go to logs, never to the screen. Since all strings move into `en.json`/`ta.json` during P5, do this pass *on the resource files* — that guarantees you catch every one.

### BUG-30 — Replace negative wording during slow loads
**Reported as:** "remove the word whenever you are lagging and add a non negative adjective"

Find the literal string currently shown during slow/degraded states (likely "lagging", "slow", "delayed") and replace with neutral or positive phrasing: "Almost there…", "Working on it…", "Just a moment…". Add a lightweight skeleton loader so a slow load looks intentional rather than broken. **Capture the exact current string before this ticket is assigned** — don't have the agent hunt for a word that may be phrased differently in code.

### BUG-31 — Browser cache & cookies for a smoother experience
**Reported as:** "it must use cache and cookies for better browser experience"

**Fix spec**
- Static assets: long-lived cache with content-hashed filenames.
- API: sensible `ETag`/`Cache-Control` on content that rarely changes (syllabus, question metadata). **Never cache attempt state or user data at the CDN layer** — that risks re-introducing BUG-04.
- Cookies: session cookie `HttpOnly + Secure + SameSite=Lax`; preferences (language, theme) in a readable cookie or `localStorage`.
- Client cache for question media so revisiting a question doesn't re-download images.

---

## 13. Regression Checklists

### 13.1 Session Matrix (run after P2, and before every merge thereafter)

| # | Scenario | Expected |
|---|---|---|
| 1 | Log in fresh | No test auto-opens; no ghost attempt created |
| 2 | Start test, hard-refresh | Resumes same question, correct time remaining |
| 3 | Start test, navigate to Dashboard | Confirm dialog; attempt pauses; resumable |
| 4 | Start test, switch browser tab, return | State intact; documented timer behaviour |
| 5 | Start test, log out, log back in | Resume prompt shown; answers intact |
| 6 | Start test, close browser, reopen next day | Either resumable or cleanly expired+evaluated — never stuck in `evaluating` |
| 7 | Submit test | Result shown once; attempt is `completed`; no lingering active session |
| 8 | User A takes test → user B logs in | B sees none of A's data anywhere |
| 9 | Try to start a second test while one is active | Blocked with a clear message offering resume or submit |
| 10 | Let timer hit zero while on the page | Auto-submits with answers so far; evaluates; no zero-timer ghost |
| 11 | Let timer expire while offline/closed | Reconciler expires and evaluates it |
| 12 | Demo user: full cycle, logout, login | Completely fresh |

### 13.2 Content Checklist (after P4/P5)
- No repeated question in any generated attempt.
- No question mixing Tamil and English within itself.
- Option counts match across languages for every served question.
- Correct answers score correctly with options shuffled.
- Tamil renders correctly in the app, in generated PDFs, and after a refresh.

### 13.3 Layout Checklist (after P3)
- Header/footer pinned at 1920 / 1366 / 390 px widths.
- Long question + tall image: body scrolls, page does not.
- Images centered in frame, no distortion, no layout shift.
- Question palette scrolls independently.

---

## 14. Open Questions — resolve before the relevant phase starts

1. **BUG-14** — what exactly is "that case"? Screenshot + section + question id needed.
2. **BUG-30** — the exact current string shown when the app is slow.
3. **BUG-28** — which gating rule: new-account-based or time-since-login?
4. **BUG-07** — should Exit be removed entirely, or kept as pause-and-leave?
5. **BUG-05** — during a browser tab switch, does the exam timer keep running or pause? (Policy decision, affects fairness.)
6. Is there any real user data worth preserving before the P1 wipe?
7. Does "Overview → least marks to score" mean weakest topics (assumed), or a target/minimum passing score the student should aim for?

---

## 15. Defect Backlog (things noticed mid-fix — do NOT fix in the current phase)

| ID | Noticed during | Description | Triaged to |
|---|---|---|---|
| | | | |

Add rows here whenever the agent spots something outside scope. This table is what keeps a phase from expanding into a rewrite.

---

## 16. Suggested Sequencing

**Week 1:** P0 recon → P1 data reset → P2 session integrity (the largest and most valuable block).
**Week 2:** P4 content correctness → P8 dashboard/reports (they depend on clean attempt data).
**Week 3:** P3 console layout → P5 language system.
**Week 4:** P6 syllabus → P7 study tools → P9 access control → P10 polish → full regression.

Ship each phase to staging and QA it against its exit gate before starting the next. The single biggest cause of the drift you've been seeing is starting phase N+1 while phase N is unverified.
