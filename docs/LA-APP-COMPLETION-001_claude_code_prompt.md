# LA-APP-COMPLETION-001 — Full Application Completion Directive

**Project:** Lumen Academy — NEET/JEE Assessment Tool
**Scope:** Frontend + Backend + Database, end to end
**Mode:** Autonomous, sequential execution. Do not stop between phases to ask which phase to do next.
**Prepared:** 28-08-2026

---

## 0. Operating rules

1. Execute the phases below in order. Phase N is not started until Phase N-1 satisfies its **Done when** clause. Report at each phase boundary in three lines: what changed, what was verified, what is next. Then continue without waiting for approval.
2. Ask a question only when proceeding would require inventing a business rule that is not recoverable from the codebase, the database, or this document. Everything else: infer from the existing code and state the assumption in the phase report.
3. Do not split, defer, or hand off work. There is no second developer picking up the remainder.
4. Do not introduce new dependencies without naming the dependency and the reason in the phase report. No new UI framework, no new state library, no new ORM.
5. Preserve the existing design system: Tailwind semantic tokens (`navy`, `navy-text`, `muted`, `teal`, `gold`, `orange`, `aqua`, `ivory`, `cyan-light`, `border-soft`, `track`, `progress-complete`), component classes (`.card`, `.btn` and its variants), teal underline tabs, `SUBJECT_META`, `ACTIVITY_LABEL`, the shared `Modal` from `components/layout`. New screens must be indistinguishable in style from existing ones.
6. No AI calls anywhere in this build. Question assembly is deterministic database retrieval. Scoring is arithmetic.
7. No mock data, no seeded arrays, no placeholder questions, no `# TODO` stubs left behind in any file you touch.
8. Every schema change goes through a forward-only migration in `db/migrations/` with a matching verify script. No ad-hoc SQL against the live database except for read-only inspection.
9. Before editing a file, read it. Do not reformat or restructure files outside the scope of the current phase.
10. Maintain a running plan file at `docs/APP_COMPLETION_PLAN.md` with one row per work item: ID, phase, description, status, evidence (command run + result). Update it as you go. This is the single source of truth for progress across sessions.

---

## 1. Starting state (from the previous session's audit — treat as verified fact, but re-verify counts)

**Content**
- 1,380 questions imported, 0 rejected: Physics 330, Chemistry 330, Botany 300, Zoology 300, Multi-Subject 120.
- The audit states 1,260 of them sit at `lifecycle_status = 'draft'`. 1,380 and 1,260 do not reconcile. **Resolve this discrepancy first** — query the database, produce the true count per subject per lifecycle status, and record it in the plan file before anything is published.
- `GET /api/questions` serves only `published` rows, so none of the imported content is visible to the app.
- `db/scripts/bulk-publish-draft-questions.ts` exists and drives draft → review → published through the real state machine. It has not been run.

**Tests**
- `tests/happy-path.spec.ts` has two provably failing backend assertions: it calls the retired `/api/submit-attempt` expecting 200 (endpoint now returns 410 by design), and calls `/api/questions?subject=biology` when the schema accepts only `physics|chemistry|botany|zoology` (returns 400).
- The frontend journey test is wrapped in `if (isVisible())` guards, so it passes without asserting anything.
- `backend/src/services/{attempt,pdfReport}.service.test.ts` and `ai/**/*.test.ts` run under `npm run test:unit`.
- `db/assess/scoring/{aggregate,decimal,evaluate,rules}.test.ts` exist but are never executed — `test:unit`'s glob is `backend/src/**/*.test.ts`. This is the scoring and marking logic.
- `db/scripts/prove-*.ts` and `db/scripts/e2e/*.ts` (12 files) are one-off hand-run verification scripts against a live database; several mutate live data. They are not a regression suite.
- `.github/workflows/ci.yml` runs `prisma generate` → typecheck → build. No test step.
- Frontend has no test tooling at all — no Vitest, no RTL, no `*.test.tsx`.

**Backend**
- Two parallel data tracks coexist: legacy Prisma (`public.*`, powering `/api/questions/count` and `/api/tests/*`) and the real domain layer (`db/`, powering `/api/questions`, `/api/catalog`, others). `getQuestionCount` counts `prisma.question`, not `content.question`, so count and list endpoints can disagree.
- `backend/src/middleware/tenancyScope.ts` is dead code, wired nowhere.
- Six Decimal-vs-number type errors remain in `attempt.service.ts` and `aiExplanation.service.ts` (flagged in `RESTRUCTURE_PLAN.md`). `tsc` is not clean.

**Frontend**
- `App.tsx` defaults to the legacy mock-quiz path (`lib/testApi.ts`) unless `VITE_USE_REAL_API=true`.
- The mock question arrays (`BIOLOGY_QUESTIONS` and siblings) are empty by design, so the legacy path renders an empty test screen.
- A 3D logo/splash scene runs before the landing page.
- The custom test builder does not expose the full unit list.

**Database**
- `db/reports/*.json` (180+ files) are git-tracked run artifacts, unlike `backend/src/generated/prisma`, which is gitignored.
- Two migration systems coexist (`db/migrations/` and `prisma/migrations/`) — pre-existing duality.

---

## 2. Phase A — Repair the audited defects

**Objective:** Bring the repository to a clean, honest baseline before building anything new.

**Work items**

A1. Reconcile the 1,380 / 1,260 question discrepancy. Produce a per-subject, per-lifecycle-status count from the live database and record it.

A2. Fix `tests/happy-path.spec.ts`: assert 410 on `/api/submit-attempt` (it is retired by design — the test is wrong, not the endpoint); replace `subject=biology` with the schema-valid subjects and add a negative case asserting 400 for an invalid subject.

A3. Remove the `if (isVisible())` guards from the frontend journey test. A test that can pass without clicking is not a test. Replace with explicit waits and hard assertions.

A4. Widen the `test:unit` glob so `db/assess/scoring/*.test.ts` runs. Confirm all four scoring suites pass; fix the code, not the tests, if any fail.

A5. Resolve the six Decimal-vs-number type errors in `attempt.service.ts` and `aiExplanation.service.ts`. Decide one contract — Prisma `Decimal` at the boundary, `number` inside the service, converted once at a named helper — and apply it consistently. `npx tsc --noEmit` must exit clean.

A6. Fix `getQuestionCount` to count `content.question` with the same filter semantics as `GET /api/questions`, so count and list can never disagree. Add a test that asserts count equals the length of an unpaginated list for the same filter.

A7. Either wire `backend/src/middleware/tenancyScope.ts` into the routes that need it or delete it. Dead middleware in an auth path is a liability. State which you chose and why.

A8. Add `db/reports/` to `.gitignore` and remove the tracked artifacts from the index (keep the files on disk).

A9. Move `db/scripts/prove-*.ts` and `db/scripts/e2e/*.ts` into `db/scripts/manual/` with a README stating they are hand-run, non-idempotent, and mutate live data. They must not be picked up by any test glob.

A10. Add a test step to `.github/workflows/ci.yml`: `typecheck` → `test:unit` → `test:e2e` (E2E against a seeded test database or a skip guard with an explicit reason, never a silent pass).

**Done when:** `npx tsc --noEmit`, `npm run test:unit`, and `npm run test:e2e` all pass locally; CI runs all three; the plan file records the true question counts.

---

## 3. Phase B — Publish the content

**Objective:** Make the imported bank live.

B1. Run `db/scripts/bulk-publish-draft-questions.ts` through the real state machine (draft → review → published). Do not bypass the state machine with a direct UPDATE.

B2. Verify against the database, not the script's output: count published rows per subject, per unit, per difficulty, and confirm `GET /api/questions` returns them.

B3. Verify image-bearing questions. For every question with an attached asset, confirm the asset row exists in `content.asset`, the Supabase Storage object exists, and the API response carries a resolvable URL. List any orphans and fix them.

B4. Record the published inventory per subject and per unit in the plan file. This inventory is the input to Phase D's blueprint validation.

**Done when:** `GET /api/questions` returns the full published bank with working image URLs, and published counts match the Phase A1 reconciliation.

---

## 4. Phase C — Session-scoped assembly engine (backend)

**Objective:** The server assembles every paper from the database on demand. Nothing is precomputed, nothing is hardcoded, nothing repeats inside a session.

C1. **Assembly endpoint.** `POST /api/assess/sessions` accepts a blueprint: mode (`subject-wise` | `full-mock` | `custom`), subject/unit/topic selectors, difficulty mix, question count, and duration. It returns a session with its question set already fixed and stored server-side.

C2. **Randomisation.** Selection is random per request and seeded per session, so two users requesting the same blueprint at the same moment receive different papers, and a given session is reproducible on reload. Persist the seed and the resolved question ID list on the session row.

C3. **No repetition within a session.** Enforce uniqueness at the database level on the session-question join (unique constraint on `(session_id, question_id)`), not only in application code.

C4. **Per-user exposure ledger.** Record every question served to every user with a timestamp. Assembly prefers unseen questions for that user and falls back to least-recently-seen only when the pool is exhausted. This implements the agreed product rule that questions do not repeat in early usage.

C5. **Category shuffling.** Questions are shuffled within category (subject, then unit) and the categories themselves are interleaved according to the blueprint, so a subject-wise paper is not served in insertion order and a full mock is not served subject-block by subject-block unless the blueprint says so.

C6. **Answer keys never leave the server** during an attempt. The question payload sent to the client carries stem, options, assets, and metadata only. Correct answers are attached only after submission.

C7. **Attempt lifecycle.** Start, autosave responses, submit, score (+4 / -1 per the stored key), and persist a scorecard with section scores. Reuse `attempt-flow.ts` and the `db/assess/scoring/` logic; do not write a second scoring path.

C8. **Insufficient-pool handling.** If a blueprint requests more questions than the published pool holds for a filter, return a structured error naming the shortfall per unit. Never silently return a shorter paper.

C9. **Console assembly harness.** A runnable script that assembles a paper for each mode, prints the composition (per subject, per unit, per difficulty), and asserts zero duplicates. This is the manual verification tool, and its assertions become automated tests in Phase F.

**Done when:** all three modes assemble from live data, two concurrent requests for the same blueprint produce different question sets, duplicates are impossible, and images resolve.

---

## 5. Phase D — Frontend rebuild of the test layer

**Objective:** Every category in the database has a frontend element, and every frontend element is fed by the API.

D1. **Remove the 3D logo scene.** The application opens directly on the landing page. Delete the scene component, its route, its assets, and any timers or preload logic gating the landing page. Do not leave it behind a feature flag.

D2. **Delete the legacy mock test path.** Remove `lib/testApi.ts`, the empty `BIOLOGY_QUESTIONS`-style arrays, the mock test-series screens, and the `VITE_USE_REAL_API` flag. The real API path becomes the only path. Remove the flag from `.env` files and documentation.

D3. **Test directory.** Build the directory screen with the three entry points: subject-wise practice, full mock test, and custom test builder. Every card is populated from `/api/catalog` — no hardcoded subject or unit lists anywhere in the frontend.

D4. **Subject-wise flow.** Subject → module → unit → chapter drill-down rendered from the catalog, showing the live published question count at each node. Every unit that exists in the database must be reachable in the UI. Cross-check against the Phase B4 inventory and fail loudly if the UI can reach fewer nodes than the database holds.

D5. **Full mock test.** Full NEET pattern paper assembled by the backend, with section structure, timer, and per-section navigation.

D6. **Custom test builder.** Multi-select across the complete unit tree, question count, difficulty mix, and duration. The current builder exposes a partial unit list — the replacement must be generated from the catalog, so it is complete by construction and stays correct as content grows.

D7. **Test workspace.** Question palette with answered / unanswered / marked-for-review states, previous and next navigation, clear response, mark for review, countdown timer with autosave, and image rendering for image-bearing questions.

D8. **Submission and result.** Submit posts to the attempt endpoint and renders the scorecard returned by the server. The client performs no scoring arithmetic.

D9. **Course/learn layer wiring.** Connect the study-plan Build Test handoff (`TestConfig`) so a chapter or topic in the course layer launches an assembled test for exactly that node, and the completed attempt feeds progress back into the study plan.

D10. **Error and empty states.** Insufficient pool, network failure, expired session, and empty category each render a specific message. No blank screens, no infinite spinners.

**Done when:** every published unit is reachable and attemptable through the UI, no mock data remains in the frontend bundle, and a full attempt can be completed end to end in the browser.

---

## 6. Phase E — Session management and auto logout

E1. Server-side session records with issue time, last-activity time, and expiry. Attempt state is bound to the session and survives a page reload.

E2. Idle timeout with a warning modal before expiry and a countdown; activity resets the timer. Default idle window 30 minutes and absolute session cap 12 hours unless the existing auth layer already defines values — in that case follow those and say so.

E3. On expiry: invalidate the token server-side, clear client state, redirect to login with a message explaining why. An expired token must be rejected by the API, not merely hidden by the UI.

E4. An in-progress attempt is preserved across an idle logout. On re-login the user resumes the same attempt with the same question set and the remaining time correctly recomputed from server timestamps, never from client clocks.

**Done when:** a session expires on schedule, the API rejects the stale token, and an interrupted attempt resumes intact.

---

## 7. Phase F — Test layer

**Objective:** Coverage that would actually have caught the defects listed in Section 1.

F1. **Frontend test tooling.** Install Vitest + React Testing Library + jsdom. Add `test:frontend` and include it in `test:unit`'s composite script and in CI.

F2. **Component and hook tests** for the test directory, subject drill-down, custom builder, workspace navigation, timer, palette state, and result screen. Assert real behaviour, not that a component renders.

F3. **Assembly tests** (from the Phase C9 harness): no duplicates within a session; two sessions from one blueprint differ; category shuffling holds; blueprint composition is respected per subject, unit, and difficulty; insufficient pool returns the structured error.

F4. **Scoring tests** — the `db/assess/scoring/` suites now run, plus cases for +4 / -1 marking, unattempted questions, multi-section aggregation, and Decimal boundary values.

F5. **Integration tests** across the API surface: catalog, assembly, attempt lifecycle, submission, scorecard, auth, session expiry.

F6. **End-to-end** Playwright journey with no visibility guards: login → directory → build custom test → attempt with images → submit → scorecard → dashboard. Plus a subject-wise journey and a full-mock journey.

F7. **CI gate.** All of the above run in CI and block merge on failure.

**Done when:** the full suite passes in CI and deliberately reintroducing any Section 1 defect makes it fail.

---

## 8. Phase G — Dashboard and analytics

Start only after Phase F is green.

G1. Persist every attempt, response, and scorecard with the timing and metadata analytics needs. Add indexes for the query patterns below before writing the queries.

G2. Backend analytics endpoints: attempt history, score trend over time, per-subject and per-unit accuracy, per-difficulty accuracy, time-per-question distribution, weakest units, and unattempted-question rate. Aggregation happens in SQL, not in the browser.

G3. Dashboard frontend in the existing design system: recent tests, trend chart, subject breakdown, unit-level strength and weakness, and time analysis. Reuse the existing Recharts setup rather than adding a charting library.

G4. Per-attempt review screen: question, the user's response, the correct answer, and the time spent, filterable by correct, incorrect, and unattempted.

G5. Feed unit-level performance back into the study plan's progress views, closing the loop between the test layer and the course layer.

**Done when:** the dashboard renders live data from real attempts with no client-side aggregation and no seeded values.

---

## 9. Phase H — Consolidation

H1. Retire the legacy Prisma `public.*` track once no route depends on it, or document precisely why it must remain. Two data tracks are the root cause of the count-versus-list divergence in Section 1.

H2. Decide the migration duality (`db/migrations/` versus `prisma/migrations/`): converge on one, or write down the boundary and enforce it in CI.

H3. Update `README.md`, `RESTRUCTURE_PLAN.md`, and `docs/APP_COMPLETION_PLAN.md` to the final state. Remove instructions for deleted paths, including the `VITE_USE_REAL_API` flag.

H4. Final verification: clean clone, install, migrate, publish content, run the full suite, run the app, complete one attempt of each mode, confirm the dashboard reflects it.

---

## 10. Global acceptance criteria

- No mock, seed, demo, or hardcoded question data anywhere in the shipped application.
- Every subject, module, unit, chapter, and topic present in the database is reachable in the UI.
- Question sets are assembled from the database on every request, never cached across users, never repeated within a session, and preferentially unseen per user.
- Images referenced by questions render in the workspace and in review.
- `npx tsc --noEmit` is clean; lint is clean; the full test suite passes in CI.
- Sessions expire on schedule, the API enforces expiry, and in-progress attempts survive it.
- The application opens on the landing page with no intermediate scene.

---

## 11. Deferred

Learning material ingestion (books, PDFs, video resources for the learn layer) is out of scope for this run. Source links will be supplied separately. Leave the `learn.resource` schema and its routes untouched unless a phase above requires a change, and note any such change in the plan file.
