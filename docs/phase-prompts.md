# Phase Prompt Pack — copy/paste into Claude Code, one per session

Each block below is a complete session. **Paste one block. Do not paste two.** Start a fresh session for every phase — a session that has already edited files should never be given a new phase.

Before first use, fill in the `FILL IN` fields in the Standing Block and save it somewhere you can paste quickly.

---

## Standing Block (prefix every prompt below with this)

```
PROJECT: Lumen Academy assessment tool.
STACK: <FILL IN — frontend, backend, DB, auth, hosting>
REPO ROOT: <FILL IN>
BRANCH: create a new branch named phase-<N>-<slug> off main.

SESSION RULES — follow these exactly:
1. Fix ONLY the scope given below. Nothing else.
2. Before writing code, read the files in scope and restate in <=5 bullets what
   the current behaviour actually is. Wait for my "go" before editing.
3. No refactors, no renames, no dependency changes, no formatting-only edits,
   no "while I was here" cleanups.
4. If a fix needs a schema change, stop and propose the migration first.
5. If a fix needs changes to the shared session model or the i18n layer and you
   are not in Phase 2 or Phase 5, stop and tell me instead.
6. If you notice a bug outside scope, add one line to DEFECT-BACKLOG.md.
   Do not fix it.
7. Commit messages must start with the BUG ID.
8. End your turn with: (a) file-by-file diff summary, (b) how you verified each
   acceptance criterion, (c) what you deliberately did not do and why.
9. Do not claim something works if you have not actually run it. Say
   "not verified" instead.
```

---

## PHASE 0 — Recon (produces a document, zero code changes)

```
SCOPE: Read-only investigation. Do not modify any application file.

TASK: Produce CONTEXT.md at the repo root documenting how this app actually
works today. Read the code to answer; do not infer from file names.

Required sections:
1. Route/page inventory — every route, its component, and the data it loads.
2. Data model — every table/collection with columns; mark columns never
   written to at runtime as (DEAD?).
3. Auth & session — where sessions are created, where stored (cookie /
   localStorage / JWT / server), expiry rules, who reads them.
4. Test attempt lifecycle — every status value that exists in code, every
   transition, the exact line where each transition happens, and what puts an
   attempt into "evaluating".
5. Question schema — full record shape including every language field, and
   which are nullable.
6. Question fetch path — endpoint -> query -> filter -> selection/shuffle ->
   response shape. Quote the selection code verbatim.
7. i18n today — determine precisely how Tamil is produced right now:
   (a) stored translations in the DB, (b) a browser/Google page-translate
   widget or script tag, or (c) runtime machine translation. Show the evidence.
8. Timer — is remaining time computed client-side, server-side, or both?
   Where is it persisted, if anywhere?
9. Dead code — anything unreferenced.

For each section, cite file paths and line numbers. Where you cannot determine
the answer from the code, write "UNKNOWN — needs runtime check" rather than
guessing.

Also create an empty DEFECT-BACKLOG.md with a table header:
| ID | Noticed during | Description | Triaged to |

ACCEPTANCE: CONTEXT.md committed. Sections 4, 6 and 7 each cite specific files
and lines. Zero changes to application code (git diff shows only the two new
files).
```

---

## PHASE 1 — Data reset & demo account

```
SCOPE: BUG-01 (wipe user data), BUG-02 (demo account lifecycle).

PRECONDITION — confirm before writing code: a full DB backup exists and has
been test-restored. If you cannot verify this, stop and tell me.

BUG-01 — Write scripts/reset-user-data.<ext>:
- Deletes in FK-safe order: attempt answers, attempts, results/evaluations,
  study plans, custom tasks, revision notes, pomodoro logs, dashboard
  aggregates/caches, sessions & refresh tokens, then users.
- MUST NOT touch content tables: questions, options, subjects, topics,
  syllabus, media.
- Idempotent — running twice leaves the same state.
- Refuses to run unless an explicit --i-know flag is passed AND the target env
  is not production.
- Ends by seeding exactly one demo user.
- Prints a row-count summary of what it deleted.

BUG-02 — Demo account, using ephemeral session scoping (Option A):
- Add is_demo on users, and a demo_session_id (or shared owner-scope column)
  on every user-owned table.
- On demo login: mint a new demo_session_id. All reads for the demo user
  filter by the current id, so prior data is invisible immediately.
- Add a sweeper that hard-deletes rows from previous demo sessions.
- Demo user is barred from: account deletion, outbound email, data export.
- Display a persistent badge: "Demo mode — your progress isn't saved."
- IMPORTANT: do not delete an attempt at the moment it is submitted. The
  results screen must remain viewable for the rest of that demo session.

ACCEPTANCE:
1. Script run twice -> identical clean state; content tables untouched
   (row counts before/after are equal).
2. Demo login -> take a test -> see results -> log out -> log back in ->
   dashboard is empty, no residue.
3. Two demo sessions concurrently do not see each other's data.
```

---

## PHASE 2 — Session & test-state integrity (largest phase; expect 2 sessions)

```
SCOPE: BUG-03 ghost test, BUG-04 cross-user leakage, BUG-05 tab/nav loss,
BUG-06 resume, BUG-07 exit control, BUG-08 tests that won't start.

MODEL TO IMPLEMENT — read this before touching code. The attempt is
server-owned; the client is only a view onto it.

States: created -> in_progress -> paused -> in_progress -> submitted ->
        evaluating -> completed
        (in_progress|paused) --time out--> expired -> evaluating -> completed

Fields: id, user_id, test_id, status, started_at, expires_at,
        time_remaining_ms, last_heartbeat_at, question_ids[] (ordered,
        fixed at creation), answers[], current_index.

Rules:
- Time is authoritative on the SERVER. The client renders a countdown but
  never decides completion.
- At most ONE attempt per user in in_progress or paused. Enforce with a DB
  unique partial index, not application logic alone.

BUG-03: Attempts are created ONLY on explicit POST /attempts from the Start
button. Never on page render, never on login, never in a mount effect. Add a
reconciler: any attempt past expires_at while in_progress|paused becomes
expired -> evaluated -> completed. Nothing may sit in "evaluating" past one
reconciler cycle. Never auto-open an attempt on login.

BUG-04 (HIGHEST SEVERITY — data isolation): Audit EVERY query touching
user-owned data for an owner predicate. List them in your report with a
pass/fail per query. Audit every cache key, memo and module-level mutable
variable for user scoping; remove any server-side global holding request data.
On submit/exit, explicitly clear client-side attempt state (store, context,
localStorage). Add an automated test: user A completes a test, user B logs in
on the same server instance, B sees none of A's data.

BUG-05: In-app navigation away from a running test -> confirm dialog ->
transition to paused and persist. Never lose, never auto-submit. Browser tab
switch (visibilitychange) -> do NOT navigate or destroy state; log the blur
event. TIMER POLICY ON BLUR: <FILL IN — keep running / pause>.

BUG-06: On app load, GET /attempts/active. If one exists, show a resume banner
on Dashboard and in Previous Tests: "Test in progress — MM:SS remaining.
Resume / Submit." Persist answers server-side on every selection (debounced
~500ms) and on every question navigation. Mirror to localStorage keyed
attempt:{id} as a crash backstop; on resume, server wins except for answers
the server has never seen. Session cookie: HttpOnly, Secure, SameSite=Lax,
sliding expiry.

BUG-07: Keep Exit but make it pause-and-leave behind a confirm:
"Exit and pause? Your time will be paused and you can resume from Previous
Tests." Separately, "Submit and finish" is the only terminal action. One
accidental click must never end an attempt.

BUG-08: Investigate in this order and report findings before fixing —
(1) a stale in_progress attempt silently blocking a new start,
(2) question pool smaller than the test's configured count,
(3) a missing language variant throwing on fetch,
(4) failed media blocking render.
Every start failure must surface a specific human-readable reason. Never a
blank screen or an endless spinner. Add validation at test-config save time:
a test cannot be published if the pool can't satisfy its blueprint.

ACCEPTANCE — run all 12 rows of the Session Matrix in the plan document and
report pass/fail for each. Row 8 (cross-user isolation) must be covered by an
automated test, not a manual check.
```

---

## PHASE 3 — Test console layout

```
SCOPE: BUG-09 (full view only), BUG-10 (fixed height, internal scroll, image
frame).

BUG-09: The attempt route renders in its OWN full-screen layout — a separate
layout component, not the standard app shell with the sidebar hidden by CSS.
No sidebar, no top nav, no other section chrome. Optionally request the
Fullscreen API on start; if the user leaves fullscreen, show a non-blocking
prompt to return. DO NOT auto-submit on fullscreen exit.

BUG-10: Console shell is 100dvh (not 100vh — 100vh breaks under mobile browser
chrome) with overflow:hidden. Three regions:
- Header (fixed): test name, question counter, timer, submit.
- Body (scrollable): question text, image, options. overflow-y:auto AND
  min-height:0 on the flex child — omitting min-height:0 is the usual reason a
  nested flex scroll silently fails.
- Footer (fixed): Previous / Next / Mark for review / palette toggle.
Question palette gets its own independent scroll container.
Images: fixed-aspect frame, centered on both axes, object-fit:contain, neutral
background, space reserved before load so there is no layout shift. Add
click-to-zoom for dense diagrams. Long option text wraps; no horizontal
overflow anywhere.

ACCEPTANCE: build a test question with ~800 words plus a tall portrait image.
At 1920px, 1366px and 390px widths, verify header and footer stay pinned, the
window itself never scrolls, only the body region does. Report all 9
combinations (3 questions x 3 widths).
```

---

## PHASE 4 — Question content correctness

```
SCOPE: BUG-11 Tamil fetch, BUG-12 repeats, BUG-13 wrong questions/options,
BUG-15 partial Tamil. (BUG-14 is deferred — do not attempt it.)

BUG-11: First determine which it is — (a) no Tamil rows exist, (b) rows exist
but the query filters them out, (c) an encoding problem, (d) the API throws on
null. Report before fixing. Verify DB/column collation is utf8mb4 (or
equivalent) — a latin1 column silently destroys Tamil. Ensure the font stack
includes a Tamil-capable face (e.g. Noto Sans Tamil) with explicit fallback.
Never throw on a missing translation — fall back to English and flag the
record. Add GET /admin/content-health returning counts of: questions missing
Tamil stem, missing Tamil options, option-count mismatch between languages.

BUG-12: Question selection happens ONCE, at attempt creation; persist the
resulting ordered id list on the attempt. Never re-select or re-shuffle on
render (this also fixes questions changing when navigating back). Selection
uses DISTINCT on question id and asserts len(set(ids)) == len(ids) before
saving — fail loudly if not. Then run a one-off duplicate scan on the question
bank by normalised text hash and report candidates (do not auto-merge).

BUG-13: Options must be entities with stable ids. The correct answer
references an OPTION ID — never an array index, never option text. If options
are shuffled, shuffle once per attempt and persist that order. List rendering
must key on option id, not index. Add a unit test: shuffle options, submit,
assert score unchanged.

BUG-15: Language completeness is per-question and all-or-nothing — stem, all
options, explanation and any caption must exist for that question to be served
in that language. Add a computed has_complete_ta flag maintained on write.
Tamil/bilingual mode serves only complete records, or falls back to English
for the WHOLE question. Never mix languages within one question. Ship the
incomplete-records list in the content-health endpoint.

ACCEPTANCE: 20 generated attempts contain zero repeats; content-health reports
zero option-count mismatches; scoring matches a hand-marked key with options
shuffled; no question renders with mixed languages.
```

---

## PHASE 5 — App-wide EN/TA language system

```
SCOPE: BUG-16 (replace page translation with real i18n), BUG-17 (separate app
language from question display mode).

CONTEXT: CONTEXT.md section 7 identified how Tamil is currently produced. If
it is a browser/Google page-translate widget, that is the cause of the frozen
UI — the widget rewrites DOM text nodes the framework then cannot reconcile.
It must be REMOVED, not patched.

BUG-16:
- Remove the page-translation mechanism entirely (script tags, wrappers,
  triggers).
- Add a real i18n layer: lang state ('en' | 'ta'), persisted to localStorage
  and a cookie, applied to <html lang>.
- Move ALL user-visible chrome strings into en.json / ta.json. No hardcoded
  user-visible strings anywhere.
- Content (questions, syllabus) uses stored per-record translations from
  Phase 4, not runtime translation.
- One global toggle in the header. It re-renders; it must never reload the
  page or mutate the DOM outside the framework.
- Choice persists across navigation, refresh and login.

BUG-17: Separate two concepts and name them distinctly in code:
- ui_lang ('en'|'ta') — all chrome, everywhere, always available.
- question_lang ('en'|'ta'|'bilingual') — question rendering only, available
  ONLY in test and practice contexts.
"Bilingual" is a question-rendering option, never an app-wide mode. Once
separated, the leak into other sections disappears by construction.

ACCEPTANCE: click through every route in Tamil — no untranslated strings, no
freeze, no broken layout. Tamil strings run longer than English: check buttons,
tabs and table headers specifically for overflow. Bilingual toggle appears
only inside test/practice. Refresh preserves both settings independently.
```

---

## PHASE 6 — Syllabus module

```
SCOPE: BUG-18 (View and Download both broken).

FIRST, before any code: verify the syllabus files actually exist in storage
for each subject. This bug is frequently "the asset was never uploaded"
rather than a code fault. Report what you find.

Then:
- View: render in-app — PDF viewer for documents, structured list for topic
  trees. Explicit loading, empty and error states.
- Download: Content-Disposition: attachment, correct Content-Type, clean
  filename Syllabus-<Subject>-<Year>.pdf. If using signed URLs, generate per
  request with a short TTL.
- Missing asset -> "Not available yet", never a dead button.
- Check CORS if assets are served from a different origin.

ACCEPTANCE: for every subject, view opens inline and download produces a
valid openable file — verified on desktop Chrome and on mobile.
```

---

## PHASE 7 — Study plan, tasks, notes, pomodoro

```
SCOPE: BUG-19 study plan, BUG-20 custom tasks, BUG-21 revision notes,
BUG-22 pomodoro.

BUG-19: One active plan per user, enforced by a DB unique partial index
(user_id where status='active'), not a hidden button. If a plan exists, the
create route redirects to edit. Edit supports add/remove/reorder items and
date changes, with a real save confirmation. Track updated_at. Provide an
explicit "Reset plan" (archive current, create new) so a bad first attempt
isn't permanent.

BUG-20: Full CRUD for custom study tasks — create, list, edit, complete,
delete. Persisted server-side, not component state. Inline validation errors.
Completing a task updates any dashboard counter that references it. Empty
state invites creation rather than showing a blank panel.

BUG-21: Full CRUD for revision notes with debounced autosave and a visible
"Saved" indicator. Strictly user-scoped — re-verify against BUG-04. Support
attaching a note to a subject/topic, and searching notes. Sanitise rich text
server-side against stored XSS.

BUG-22: The pomodoro completion panel and session log get their own scroll
container (same fixed-height + overflow-y:auto pattern as BUG-10). Every
completed session writes a log row: started_at, duration, task_id (nullable),
completed. Show scrollable history. Demo-user logs are swept per BUG-02.

ACCEPTANCE: for plan, task and note independently — create, edit, complete,
delete, then refresh; state survives every time. Pomodoro history shows the
last 20 sessions and scrolls without stretching the page.
```

---

## PHASE 8 — Dashboard, analytics, reports

```
SCOPE: BUG-23 tests-taken count, BUG-24 subject performance, BUG-25 overview,
BUG-26 PDF report.

PRECONDITION: Phase 2 is merged. Several of these are wrong because attempt
records were wrong — re-measure before assuming a separate bug exists.

BUG-23: Define the metric and write the definition into CONTEXT.md:
Tests Taken = count of attempts with status 'completed' for this user.
Excludes created, in_progress, paused, abandoned, and expired-with-zero-
answers. Compute from one source of truth; if a denormalised counter exists,
either delete it or rebuild it from attempts inside the submit transaction.

BUG-24: Per-subject aggregation over completed attempts — attempted, correct,
accuracy %, average time per question, trend across the last N attempts.
Requires subject_id on each answer row; denormalise at write time if the join
is expensive. Zero-data case gets a real empty state, not a broken chart.

BUG-25: Overview currently renders empty. It must show: overall accuracy,
tests completed, current streak, strongest 3 topics, weakest 3 topics
("lowest scoring — focus here"), and one suggested next action linked to the
study plan. Require a minimum sample (>=5 answered questions in a topic)
before labelling it weak. Copy framing: "Focus areas", not "worst subjects".

BUG-26: PDF report generation — SERVER-SIDE, specifically because client-side
PDF libraries routinely drop Tamil glyphs. Embed a Tamil-capable font
explicitly or Tamil renders as boxes.
Content: student name, period, tests completed, overall accuracy, per-subject
table, focus areas, attempt history.
BRANDING — must match the existing question-paper PDFs:
- Heading "LUMEN ACADEMY"
- Lumen Academy logo (mountain / graduation cap / sun, tagline
  "Empowering Futures through Learning") inserted into the document
- Teal/navy blue and orange/gold colour scheme throughout
Long generations run async with visible progress; never a spinner with no
feedback.

ACCEPTANCE: seed 5 attempts with hand-computed scores. Every dashboard number
matches the hand calculation exactly — show your working. PDF opens correctly
in Acrobat, macOS Preview and Chrome, with Tamil rendering as text (selectable,
not boxes).
```

---

## PHASE 9 — Access control & policy

```
SCOPE: BUG-27 remove delete-account, BUG-28 gate full tests.

BUG-27: Remove the Delete Account control from all user-facing UI AND protect
the endpoint with a server-side admin role check. Removing only the button
leaves the API exposed — verify by calling the endpoint directly with a normal
user's token and confirming a 403. Provide an admin-side path for legitimate
deletion requests. Prefer soft-delete + anonymise over hard delete.

BUG-28: Gate Full Tests. RULE: <FILL IN — recommended: accounts with no
completed practice test cannot start a full test>. Enforce SERVER-SIDE on the
start endpoint; hiding the button is not sufficient. The UI shows the
requirement and progress toward it — "Complete 1 practice test to unlock Full
Tests" — never a silently disabled button with no explanation.

ACCEPTANCE: direct API call to delete-account as a normal user returns 403;
direct API call to start a full test from an ineligible account returns a
clear error; eligible accounts are unaffected.
```

---

## PHASE 10 — Copy, wording, caching

```
SCOPE: BUG-29 internal jargon, BUG-30 negative loading copy, BUG-31 caching.

BUG-29: Sweep en.json / ta.json (all strings live there after Phase 5) for
internal vocabulary: database, sync, fetching records, API, null, cache,
session token, payload, raw error codes, table names. Replace:
  "Syncing with database..."  -> "Getting things ready..."
  "Failed to fetch data"      -> "We couldn't load this. Try again."
  "No records found"          -> "Nothing here yet."
  "Session invalid"           -> "Please sign in again."
Raw technical errors go to logs only, never to the screen. Report every string
you changed with its file and key.

BUG-30: The exact current string shown during slow loads is: <FILL IN>.
Replace with neutral/positive phrasing — "Almost there...", "Working on it...",
"Just a moment...". Add skeleton loaders so a slow load looks intentional
rather than broken.

BUG-31: Static assets — long-lived cache with content-hashed filenames.
API — ETag / Cache-Control on rarely-changing content (syllabus, question
metadata). CRITICAL: never cache attempt state or user-scoped data at the CDN
or shared-cache layer; doing so would re-introduce BUG-04. Cookies: session
cookie HttpOnly + Secure + SameSite=Lax; preferences (language, theme) in a
readable cookie or localStorage. Cache question media so revisiting a question
does not re-download images.

ACCEPTANCE: grep the resource files for the banned word list and show zero
hits. Verify with DevTools that no user-scoped API response carries a public
cache header.
```

---

## Final regression session (after all phases merge)

```
SCOPE: Verification only. Do not fix anything — log failures to
DEFECT-BACKLOG.md and report.

Run and report pass/fail with evidence for:
1. All 12 rows of the Session Matrix (plan doc section 13.1).
2. Content checklist (13.2): no repeats, no mixed-language questions, option
   counts match, scoring correct under shuffle, Tamil renders in app and PDF.
3. Layout checklist (13.3): 3 question types x 3 viewport widths.
4. Every route in both languages with no untranslated strings.
5. Demo account full cycle twice — fresh both times.
6. Cross-user isolation test.
7. PDF report opens in three readers with Tamil intact and Lumen Academy
   branding present.

Output a single table: check | pass/fail | evidence.
```

---

## Notes on running these

- **Phase 2 will likely need two sessions.** If so, split at BUG-04/05 — finish and commit the attempt-lifecycle work first, then start a fresh session for navigation and resume, re-pasting the model description.
- **If the agent starts explaining rather than reading files**, stop it and re-paste rule 2. That is the earliest visible symptom of drift.
- **Never accept "this should now work."** Rule 9 exists for that; hold it to "verified by X" or "not verified".
- **Merge order matters** for Phase 8 — its numbers depend on Phase 2's data being correct. Running it early means fixing the same metric twice.
