# AUDIT.md — Test Layer Hardening, Phase 0

Read-only audit per `docs/test-layer-hardening-prompt.md` §1. Every answer below is sourced from reading the code and migrations directly (three parallel read-only research passes covering repetition/pool, session/attempt lifecycle, and blueprint/image/test-type areas respectively, cross-checked here). File:line citations are given wherever a claim is made; "NOT FOUND" is stated explicitly where nothing was found, not inferred.

No code was changed to produce this document.

---

## 1.1 Repetition control

**Where is uniqueness enforced — three layers, and they disagree with each other:**

1. **DB constraint, section-scoped only:** `db/migrations/011_assess_scope.sql:66-67`
   ```sql
   alter table assess.test_question add constraint uq_test_question_section_question
     unique (test_section_id, question_id);
   ```
   This is `UNIQUE(test_section_id, question_id)` — confirmed, not `UNIQUE(test_id, question_id)`.

2. **Attempt-scoped PK (the real serve-time gate):** `db/migrations/020_attempt_question.sql:16-25` — `assess.attempt_question` has `primary key (attempt_id, question_id)`. A question cannot be served twice within one attempt regardless of how it got into the candidate set.

3. **Application-layer dedup net:** `db/assess/test/attempt/attempt-flow.ts:199-212` — a `seenQuestionIds` Set drops a second occurrence of a question id while assembling the served paper, logging only `console.warn` (line 243), no error surfaced to the caller.

**Is there a `UNIQUE(test_id, question_id)` equivalent? Confirmed: no.** Grepped all 27 migration files — none exists. This is **Bug #1** as the prompt anticipates, and is genuinely reachable:

- `ingest-paper.ts:73-93`'s `ingestFixedPaper` path **does** guard against this at the application layer, with a `firstSeenAt` map declared outside the per-section loop so it catches a repeat across the *whole* paper, not just within one section.
- **But** the generic CRUD path `test_question.service.ts` / `test_question.repository.ts` (`insertRow`, `db/assess/test/test_section/test_question/test_question.repository.ts:42-44`) has **no cross-section check at all** — only the DB's section-scoped constraint applies. If anything calls this service directly (bypassing `ingestFixedPaper`), the same question can legally land in two sections of one test. No live HTTP route was found wired directly to this service within `db/`, but the gap is real at the data-access layer and one route change away from being exploitable.
- **Contradiction found in the code's own comments:** `assemble.ts:94-102` asserts "`ingestFixedPaper` only rejects duplicates within one section, not across the whole paper" — this is **false** against the actual `ingest-paper.ts` code read directly (which does check across the whole payload). Either the comment is stale (describing a since-fixed prior version) or refers to some other insertion path not found. Flagging as a doc/code mismatch to resolve, since it could mislead a future change.

**Anti-repeat window — real gap found: no window exists in the code that actually runs, despite a design doc claiming one does.**

- Table: `assess.user_question_seen` (`db/migrations/018_test_engine.sql:44-55`), scoped **per user, per question** — not per exam/test-type, not per node. PK `(user_id, question_id)`.
- `db/assess/test/generation/candidate-pool.sql:37-42` (marked "documentation only... keep in sync by hand") describes a hard 50-attempt exclusion window keyed on `attempt_seq`, hardcoded as the literal `50`.
- **The code that actually executes, `LINE_CANDIDATE_SQL` in `assemble.ts:121-146`, has no such window.** It does a soft `LEFT JOIN` against `user_question_seen` and only sorts (unseen-first, then oldest-`last_seen_at`-first) — a seen-once and a seen-fifty-times-ago question are both always eligible, never hard-excluded. This is intentional per an inline comment (`assemble.ts:72-85`, labelled "D-2": never a hard exclusion, to avoid failing a draw just because every remaining question has been seen before).
- **Conclusion: `candidate-pool.sql` and `assemble.ts` describe two different systems.** Anyone relying on the documented "50-attempt window" is relying on something that does not exist in the running code. No config/env var/constant governs a window in the live path — there isn't one to configure.

**Grouped questions (comprehension sets, assertion-reason pairs, common-stem clusters): NOT FOUND — the concept does not exist in the schema.** Grepped for `group_id`, `question_group`, `comprehension`, `common_stem`, `cluster`, `passage_id`, `linked_question` — no table, no column, no code path. `content.question.question_type` includes an `'assertion_reason'` enum value, but that is a single question's *format* (one row, stem + reason statement), not a linked cluster of separate rows. **Since there is no concept of a group, there is no code path where a group member could leak into another section — the risk is currently moot, not mitigated.** This should be flagged if the product intends real comprehension-passage clusters later, since none of today's assembly logic (`LINE_CANDIDATE_SQL`) treats any two questions as linked.

**Regenerate/retry — no orphan risk found, but for two different reasons depending on mode:**
- BLUEPRINT-mode attempts: every `startAttempt` mints a new `attempt_id`; `assess.attempt_question` is keyed by `(attempt_id, question_id)`, so a retry is a new attempt, never a mutation of a prior one — nothing to orphan. Confirmed by reading the whole of `attempt-flow.ts`; no delete-then-insert regenerate path exists for attempts at all.
- FIXED-mode paper re-ingestion: `ingest-paper.ts:117-131` does delete-then-insert per section, but both statements share the same transaction client (`begin` at line 42, `commit` at line 133, rollback on any thrown error at 135-138) — no orphan risk.

**Determinism — a seed exists but is never actually used for reproducibility in the live path:**
- `assembleForAttempt(testId, userId, seed?)` (`assemble.ts:174`) accepts an optional seed; if omitted, generates one via `crypto.randomBytes(7)` (lines 35-42).
- **`attempt-flow.ts:215` — the only real caller — never passes a seed.** The seed is persisted to `assess.attempt.generation_seed` (line 216) but nothing ever reads it back to reproduce a draw. So every real attempt gets a fresh random seed, and there is currently no way to regenerate a past attempt's exact paper for dispute resolution even though the plumbing to do so (the seed column, the seed parameter) already exists.
- Randomness in SQL is a seeded `md5(question_id || seed)` sort key (`assemble.ts:143`), not `ORDER BY random()` — deterministic given a seed and stable DB state, confirmed no `ORDER BY random()` anywhere in `db/` (grepped `random()`/`Math.random`/`shuffle`; only unrelated hits in a demo-seeding script).
- **Options are never shuffled at all**, despite schema support suggesting they should be: `assess.test_question.shuffle_seed` (`004_assess.sql:76`) and `assess.attempt_question.option_order` (`020_attempt_question.sql:21`) are both dead columns — never read or written anywhere in `db/`. Options are always served `order by display_order` (static) — `envelope.ts:136-144`, `attempt-flow.ts:888-894`.

**Shuffle-vs-uniqueness ordering:** correct where it matters — the `WHERE ... and not (question_id = any($4::uuid[]))` exclusion of already-picked questions (`assemble.ts:129`) runs before the `ORDER BY md5(...) LIMIT` shuffle/pick (lines 141-145). Moot for options since no shuffle exists there.

**`ORDER BY random()` / index-based collision risk: NOT FOUND.** `LINE_CANDIDATE_SQL` uses `group by q.question_id` (line 140) specifically to collapse multi-tag fan-out from `content.question_node_map` before ordering/limiting, plus the `$4::uuid[]` exclusion for questions already picked by prior lines in the same call — no path was found that could double-pick a question into one line's own result.

**Transaction/locking around selection — the most serious finding in this section, a real, currently-live deadlock risk:**
- `assembleForAttempt` uses the shared module-level `pool` directly for every query (`assemble.ts:177,183,197`) — it takes **no client parameter** and cannot participate in a caller's transaction.
- Its only caller, `startAttempt` (`attempt-flow.ts:103-283`), already holds a dedicated connection from `pool.connect()` (line 135) inside an open transaction, and calls `assembleForAttempt(testId, userId)` at **line 215** while that connection is still checked out.
- `db/shared/pool.ts:18` caps the pool at `max: 4`. This is **the exact same deadlock pattern the codebase's own comments already document as previously found and fixed elsewhere** (`attempt-flow.ts:65-76`, describing `loadSectionSchemes`'s identical bug, fixed by threading the transaction's `client` through as `(testId, client = pool)`). **That fix was not applied to `assembleForAttempt`.** Four or more concurrent BLUEPRINT-mode `startAttempt` calls will deadlock every one of them, indefinitely, the same way `loadSectionSchemes` did before its fix.
- No `SELECT ... FOR UPDATE` / serializable isolation exists anywhere around candidate selection — two concurrent `startAttempt` calls for the same user are not serialized against each other at the pool-selection level (uniqueness *within* one call's own paper is still safe via `globallyPicked`, but nothing prevents two independent concurrent generations from proceeding at once).
- Separately, the "one active attempt per user" check (`attempt-flow.ts:127-133`) runs as a plain query **before** `pool.connect()`/`begin` — a TOCTOU race: two near-simultaneous `startAttempt` calls can both pass this check before either commits.

---

## 1.2 Pool sufficiency

**Checked immediately after each blueprint line's own draw, not via an up-front global COUNT — but nothing is ever persisted before the check, so this is safe in effect:**
```ts
// assemble.ts:183-206
const res = await pool.query<{ question_id: string }>(LINE_CANDIDATE_SQL, [...]);
const questionIds = res.rows.map((r) => r.question_id);
if (questionIds.length < bp.pick_count) {
  const availableRes = await pool.query<{ available: string }>(LINE_AVAILABLE_SQL, [...]);
  throw new PoolInsufficientError(bp.blueprint_id, bp.test_section_id, bp.pick_count, Number(availableRes.rows[0].available));
}
```
`assemble.ts` is documented at its own top as read-only ("assembly is a database query, never a write"), so regardless of when the shortfall is discovered relative to the draw, no partial state is ever written at this stage — persistence happens later, atomically, inside `startAttempt`'s transaction.

**What actually happens on shortfall — traced through every caller, confirmed hard failure, no padding:**
- `PoolInsufficientError` (`db/shared/errors.ts:53-66`) carries `blueprintId`, `testSectionId`, `requested`, `available` — already a structured shortfall shape, close to what the prompt's Hard Rule #3 requires.
- It propagates out of `assembleForAttempt` into `startAttempt`'s `catch (err) { await client.query("rollback"); throw err; }` (`attempt-flow.ts:277-279`) — the whole transaction rolls back: no attempt row, no `attempt_question` rows, no `attempt_event` row survive.
- No caller anywhere in `db/` catches `PoolInsufficientError` and downgrades it into a partial/padded result — the only catches found are test harnesses and manual proving scripts that expect it as a legitimate outcome (`assemble.test.ts:106-124`, `db/scripts/manual/prove-te-p3-assembly.ts:163-168`, `db/scripts/manual/prove-c1-sessions.ts:66-67`, `db/scripts/demo/seed-demo-account.ts:236`).

**Filter relaxation on shortfall: NOT FOUND — confirmed by reading the whole selection path, not just grepping.** Grepped `relax`/`fallback`/`widen`/`expand scope`/`ignoreSeen`/`loosen` across `db/` — every hit was unrelated migration prose (e.g. "loosen to nullable"). `LINE_CANDIDATE_SQL` is a single fixed query shape; the only thing that changes on shortfall is that `LINE_AVAILABLE_SQL` (same filters, no `LIMIT`) runs afterward purely to report the `available` count in the thrown error — it does not retry with a loosened `difficulty_band`, `question_format`, node scope, or the seen-question sort. The one thing that could be mistaken for relaxation, the D-2 "never hard-exclude seen questions" behavior from §1.1, is an always-on soft-sort policy, not something that only activates on shortfall.

---

## 1.3 Session flow

**State machine location and values.** Lives in `db/assess/test/attempt/attempt-flow.ts` (all writes) + `db/assess/test/attempt/expiry.ts` (expiry-driven transitions). DB CHECK constraint (`db/migrations/018_test_engine.sql:111-113`) allows 5 values: `in_progress`, `paused`, `submitted`, `scored`, `abandoned`. **Only 3 are ever actually written by live app code**: `in_progress` (insert at `attempt-flow.ts:163`, resume at `:317`), `paused` (`:294`), `scored` (`:711`, the only terminal state — no intermediate `submitted` write exists). `submitted` and `abandoned` are schema-legal but dead in practice — confirmed via grep, only test fixtures write `abandoned`, and this is independently documented in `CONTEXT.md:28`.

| Transition | Function | Guard |
|---|---|---|
| → `in_progress` | `startAttempt` (`attempt-flow.ts:103-283`) | rejects if an active attempt exists (racy, see below) |
| `in_progress` → `paused` | `pauseAttempt` (`:288-296`) | must be `in_progress` |
| `paused` → `in_progress` | `resumeAttempt` (`:298-328`) | must be `paused`, plus an open `attempt_pause` row |
| `in_progress`/`paused` → `scored` | `submitAttempt` (`:504-755`) | must be `in_progress`/`paused` (already-`scored` short-circuits idempotently, not an error) |
| expiry → `scored` | `enforceExpiry` (`expiry.ts:12-29`) | calls `submitAttempt(..., "expiry")` once past deadline |

**Critical finding — the state machine is bypassable through a generic CRUD route.** `backend/src/routes/assess.routes.ts:46` mounts `makeOwnedCrudRouter(attemptRepository, "user_id")`. Its `PATCH /:id` (`backend/src/lib/dbCrudRouter.ts:118-132`) builds `update assess.attempt set <clientKey> = $1 ...` from **whatever keys the request body contains**, stripping only `user_id`. This route is live and owner-reachable — `PATCH /api/assess/attempts/:attemptId` with `{"attempt_state":"scored"}`, `{"server_deadline":"2099-01-01T..."}`, or `{"elapsed_seconds":0}` bypasses every state-machine guard in `attempt-flow.ts` entirely, including the "server-authoritative" deadline. **This is the single most serious gap found in the whole audit** — flagging for immediate bug derivation. `DELETE /api/assess/attempts/:id` from the same generic router lets a student delete their own attempt row outright (cascade behavior on `attempt_question`/`attempt_response`/`attempt_event` not verified in this audit pass).

**Endpoints guarding IN_PROGRESS:** `POST /assess/attempts/start` / `POST /assess/sessions` (via `startAttempt`'s active-attempt check); `PATCH .../responses/:questionId` and `PATCH .../responses` (batch) both require `in_progress`; `POST .../submit` requires `in_progress`/`paused`; `POST .../pause` requires `in_progress`; `POST .../resume` requires `paused`; `GET .../review` requires `scored`. `GET .../envelope` is intentionally unguarded by state (that's how a paused/in-progress attempt is viewed) but calls `enforceExpiry` first.

**Timer authority — genuinely server-authoritative for scoring, but only as long as the CRUD hole above isn't used.** Deadline set once (`attempt-flow.ts:161-165`, `server_deadline = now() + duration`). Remaining time always derived server-side from `server_deadline` + `paused_ms_total` (`envelope.ts:107-108`, `expiry.ts:14-17,26`). `submitAttempt` takes no client-submitted elapsed-time input; `evaluateResponse` (`db/assess/scoring/evaluate.ts:10`) only checks presence, and `attempt-flow.ts:644` hardcodes `answeredAt` — timing is deliberately irrelevant to scoring. Per-question `time_spent_seconds` is client-reported but used for analytics only, never scoring. Client-side countdown (`TestTakingView.tsx:168-181`) is UX-only and still routes zero-time auto-submit through the same server call. **However**, `server_deadline` and `paused_ms_total` are among the columns writable via the unguarded `PATCH` route above — so "server-authoritative" holds only in the read path, not the write path.

**Two active attempts / cross-device / cross-tab:**
- No DB-level unique constraint prevents two `in_progress`/`paused` rows for one user across different tests. Relevant unique indexes found (`uq_attempt_test_id_user_id_attempt_no`, `ux_attempt_pause_one_open`, `ux_attempt_response_attempt_question`, `ux_attempt_question_section_seq`) all scope to a single test/attempt, none to "one active attempt per user globally."
- Application check has a confirmed TOCTOU race: the active-attempt query (`attempt-flow.ts:127-133`) runs before `pool.connect()`/`begin` — two concurrent `startAttempt` calls (two tabs, a device plus a retry) can both pass before either inserts.
- `assess.attempt.device_fingerprint` exists as a column (`attempt.model.ts:19`) but is never set by the INSERT — dead column.
- `core.user_session` (`022_core_user_session.sql`) tracks one row per login/device by explicit design, with no cross-device conflict logic, and is fully decoupled from `assess.attempt`. Net: nothing but the racy check above stops two devices/tabs from each running a test concurrently.

**Abnormal-exit behavior, scenario by scenario:**
- **Refresh:** server-side answers are safe (autosaved), but see the resume-restoration gap below — the client never rehydrates them, so the student *sees* a blank paper. `currentIndex` also always resets to 0; there is no persistence of position at all.
- **Tab close:** `visibilitychange`/`pagehide` (`TestTakingView.tsx:146-156`) does a best-effort `flushDirty()`, not a confirmed exit — if the flush doesn't complete before the tab dies, that batch of unsaved answers is lost until the next periodic autosave succeeds (autosave interval 12s, `TestTakingView.tsx:37`).
- **Logout:** `App.tsx:462-467` best-effort pauses the attempt before signing out (errors swallowed); if the pause call fails (e.g. offline), the attempt is left `in_progress`, relying on later reconciliation.
- **Network drop mid-answer:** failed autosave ids go back into a dirty set for retry on the next interval — no permanent loss unless the tab dies before reconnect.
- **Timer expiry while offline — a real, confirmed gap: no automatic sweeper exists at all.** `db/scripts/sweep-expired-attempts.ts` is a standalone script whose own header says "no queue or cron infrastructure is wired up here... run manually or by a platform scheduler later" — grepped all `*.json`/`*.yml`/`*.yaml` for any invocation and found zero. The only enforcement is lazy, on-read reconciliation from three call sites (`getEnvelope`, `listOwnAttempts`, `startAttempt`). **If a user goes offline at expiry and never triggers one of those three paths again, and nobody runs the manual script, the attempt stays `in_progress` forever.**
- **Double-submit:** `submitAttempt` takes `select ... for update` on the attempt row (`attempt-flow.ts:530`) and short-circuits to an idempotent return if already `scored` (lines 535-557) — safe by construction, independent of the optional idempotency-key layer (which adds exact-response-replay on top).
- **Submit racing the sweeper:** serialized by the same row lock; backstopped further by `uq_scorecard_attempt_id` (`004_assess.sql:158`). The reconciler itself was previously found to deadlock under concurrency (documented in `expiry.ts:62-71`) and was fixed by making `reconcileUserAttempts` strictly sequential.

**Frontend session lockdown — client-only, and mostly absent, with zero server-side enforcement of navigation:**
- Tab visibility / pagehide: present, but only triggers an autosave flush, not any block or confirmation (`TestTakingView.tsx:146-156`).
- Browser back/forward interception: **NOT FOUND** — no `popstate` listener anywhere in `frontend/src`.
- Direct URL navigation blocking: **NOT FOUND** — `currentScreen` is plain React state, not router-enforced; nothing stops navigating away from the test screen.
- `beforeunload` confirmation: **NOT FOUND** — zero occurrences anywhere in `frontend/src`.
- Fullscreen request/exit detection: **NOT FOUND** — no `requestFullscreen`/`fullscreenchange` reference anywhere.
- **Net: this app currently has no session-lockdown/anti-navigation mechanism at all, client or server, beyond the exam timer itself.** Everything the prompt's Hard Rule #4 requires ("the only exits are Submit or explicit Exit") is unimplemented.

**Resume restoration — a second serious, concrete gap, confirmed field-by-field:**

| Data | Persisted server-side? | Restored on resume/refresh? |
|---|---|---|
| Selected answers | Yes — `attempt_response.option_id`/`numeric_answer`, returned in the envelope | **No.** `TestTakingView.tsx:73`'s `selectedAnswers` state always initializes to `{}`; no effect reads `session.responses` to seed it, despite the server already sending that data down. |
| Marked-for-review flags | Yes — `attempt_response.response_state`, returned in the envelope | **No** — same gap; `flaggedQuestions` always starts as an empty Set. |
| Current question index | **Not persisted anywhere** — no column, no event | **No** — always starts at 0. |
| Per-question time spent | Persisted (`time_spent_seconds`), but not included in the envelope response shape at all | **Not restorable even in principle** from the current envelope — `questionTimeMap` always starts empty. |

A student who refreshes or resumes after logout/crash sees every question as unanswered and unflagged from question 1, even though the server preserved everything and kept the clock running correctly. This directly contradicts the prompt's Hard Rule #5 ("no attempt is ever lost") in spirit — the attempt technically isn't lost server-side, but the user experience is indistinguishable from having lost it.

---

## 1.4 Blueprint / weightage

**Blueprint table: `assess.test_blueprint`** (`db/migrations/018_test_engine.sql:82-97`) — not named `exam_subject_format`/`blueprint_section`/`blueprint_weight` as the prompt's guessed names suggest; those names don't exist anywhere. Schema: one row per (test, subject/node) line — `subject_id`, optional `syllabus_node_id` + `include_descendants`, optional single `difficulty_band`, optional single `question_format` (checked against a fixed enum), and `pick_count`. **This encodes a per-line count/filter spec only — no difficulty *mix*, no question-type *mix* within a line, and no unit-level weightage.** A companion table `catalog.exam_pattern`/`catalog.pattern_section` (`001_catalog.sql:86-116`) adds section-level `question_count`/`total_marks`/`duration_minutes` — again counts only, no distribution.

**NEET unit weightage — the data model exists but is completely disconnected from assembly, confirmed dead:**
- `catalog.node_weightage` (`001_catalog.sql:143-153`) has exactly the shape needed — `pattern_id`, `node_id`, `weight_marks`, `expected_questions`, `priority_rank` — and is fully migrated and CRUD-wired (`db/catalog/exam/exam_cycle/exam_pattern/node_weightage/*`, mounted via `backend/src/routes/catalog.routes.ts:14`).
- **`assemble.ts` and `candidate-pool.sql` never reference `node_weightage` at all** (confirmed by grep — zero hits). Populating this table today would have zero effect on which questions get served — it's a fully-built, wired, but functionally inert table.
- **Separately, a hardcoded frontend array duplicates the same concept for display purposes only:** `frontend/src/data/syllabusData.ts:1-38`, a static 38-unit array with `weightageMarks`/`expectedQuestions`/`weightagePercent` per unit, used only by syllabus/study-plan UI, with no relationship to `catalog.node_weightage` and no connection to test assembly either. **Two independent, unsynchronized representations of "NEET unit weightage" exist, and neither drives the actual mock-test composition** — this is exactly the hardcoding bug the prompt anticipates (§1.4's second question), just doubled.
- Confirmed separately: full-mock assembly (`sessionController.ts`) builds exactly one blueprint line per subject with `pickCount = FULL_MOCK_QUESTIONS_PER_SUBJECT` (hardcoded `45`) — there is no per-unit line at all in a full mock today, so even a wired-up weightage table would have nowhere to plug into the current line structure.

**Marking scheme — genuinely table-driven, the one clean result in this section:** `catalog.marking_scheme` (`001_catalog.sql:38-47`) stores `correct_marks`/`incorrect_marks`/`unattempted_marks`/`partial_credit_rule`/`numeric_tolerance_pct` per scheme, resolved per-section via `catalog.v_section_marking` (`008_catalog_taxonomy.sql:173-179`) and actually consumed at attempt-start and scoring time (`attempt-flow.ts:77-87,601-627`). The one hardcoded piece is the *default scheme lookup key* `'NEET_STANDARD'` (`create-practice-test.ts:67`) — a soft coupling to a seed row's code, not a hardcoded mark value. Also noted: `voidDisposition` is hardcoded to `"EXCLUDED"` at every call site since the scheme table has no column for it (`attempt-flow.ts:626`) — a real gap if voided questions ever need scheme-driven handling.

---

## 1.5 Image questions

**Attachment mechanism: a dedicated `content.asset` table**, not a JSON block type or inline URL column. `content.asset` (base columns: `asset_id, question_id, document_id, asset_type, storage_uri, alt_text, render_hint`; extended in `010_content_rich.sql:140-164` with `option_id`, `group_id`, `target_role`, `mime_type`, `inline_payload`, plus CHECK constraints on `asset_type`/`target_role`/payload-presence/owner-presence). `storage_uri` is resolved to a public URL only via `db/content/asset-resolver.ts:224-228` (Supabase Storage) — never a raw inline URL.

**`has_image` exists and is manually set — confirmed to drift, with the codebase's own diagnostic scripts as proof it already has:**
- Column: `content.question.has_image boolean not null default false` (`010_content_rich.sql:57`) — a plain boolean, not a generated column, not backed by a view, not derived at query time.
- **Never written by the actual import path** — grepped `db/scripts/import/import-content.ts` for `has_image`: zero matches. Newly imported questions default to `false` regardless of whether an asset row is created alongside them.
- The only writer anywhere is a manual one-off script, `db/scripts/manual/verify-image-assets.ts:73`, run by a human with `--fix` after detecting drift.
- Two more manual scripts exist purely to detect this exact drift: `db/scripts/manual/audit-image-assets.ts:100-112` (finds `has_image=true` questions with no matching asset row) and `db/scripts/manual/verify-image-serving.ts:87-101` (checks the reverse). **Their existence is itself evidence this has already been a live, recurring problem**, not a hypothetical one.

**Eligibility and dead-asset checks:**
- **`content.v_question_eligibility` does not exist**, confirmed by the codebase's own comments (`db/learn/syllabus/availability.sql:7`, `db/learn/syllabus/tree.ts:12-13`: "No content.v_question_eligibility view exists in this schema"). This view name from the prompt is aspirational, not present.
- The real eligibility filter used by assembly (`LINE_CANDIDATE_SQL`, `assemble.ts:121-146`) checks `lifecycle_status='published'`, subject/node scope, difficulty_band, question_format, and prior-exposure — **`has_image` is never part of eligibility filtering**, so image and non-image questions are drawn identically (expected), but this also means a question with a broken image asset is exactly as eligible as one with a working image.
- **No reachability/liveness check on image asset URLs exists anywhere in the runtime path.** The only such check in the repo is the manual offline script `verify-image-serving.ts`. A deleted or renamed Supabase Storage object produces a broken image at attempt time with nothing to catch it beforehand.

---

## 1.6 Test types

**Nominally five types, only three reachable from the real product flow:**
```ts
// test-code.ts:22
export type TestTypeCode = "MOCK" | "SUBJ" | "CHAP" | "TOPIC" | "UNIT";
```
- `sessionController.ts` (the actual student-facing `POST /api/assess/sessions`) only ever emits `SUBJ`, `UNIT`, or `MOCK`.
- `CHAP`/`TOPIC` are only reachable via a raw admin-style endpoint (`POST /assess/tests/practice`, `assess.routes.ts:95`) and a manual proving script — **no product UI flow was found that drives them.** Effectively dead in the main journey.

| Type | Scope | Blueprint | Duration | Marking | Anti-repeat | Min pool |
|---|---|---|---|---|---|---|
| MOCK (full) | hardcoded: every subject, all descendants | one line/subject, `pickCount` hardcoded 45 | hardcoded 180 min | table-driven (`NEET_STANDARD`) | global ledger (soft-sort, no window — see §1.1) | generic `PoolInsufficientError` only, no NEET-specific minimum |
| MOCK (custom) | caller-supplied | caller-supplied | caller-supplied | same | same | same |
| SUBJ / UNIT | same code path, distinguished only by presence of a node id | single caller-supplied line | caller-supplied | same | same | same |
| CHAP / TOPIC | node-scoped, "chapter" vs "topic" not structurally distinguished (both just a `syllabusNodeId`; `catalog.syllabus_node.node_type` is free text and never checked) | caller-supplied | caller-supplied | same | same | same |

**No per-type configuration table or dispatch object exists — duration/marking/anti-repeat/min-pool are either global or purely caller-supplied per request**, except full-mock's duration and per-subject count, which are the only genuinely type-specific hardcoded values in the system.

**Table-driven or if/switch chain? Closer to the latter, and worse: it's duplicated ad hoc logic in at least three unsynchronized places**, not one dispatch table:
1. `sessionController.ts`'s `toLines()` (`:128-189`) — a 3-branch if-chain hand-building the `testType`/`scopeCode`/`lines` shape per mode.
2. `test-code.ts`'s `deriveSessionModeFromTestCode()` (`:37-44`) — the **reverse** mapping, a separate independent if-chain that must be kept in sync by hand with (1) — the file's own comment admits this.
3. `hasCompletedPracticeTest()` (`sessionController.ts:101-110`) — a **third** independent encoding of "practice vs mock," via a regex against the `test_code` string (`test_code !~ '^LMN-[A-Z]+-MOCK-'`).
4. `test-code.ts`'s own header comment states `test_type` "isn't a real column" — the entire taxonomy lives only inside a `test_code` string, parsed back out by regex (`TEST_CODE_PATTERN`) wherever needed.

**Files that would need editing to add one new test type**, confirmed by tracing every place the taxonomy is encoded: `test-code.ts` (union type + regex + reverse-mapping if-chain), `sessionController.ts` (`toLines()`'s if-chain, possibly `hasCompletedPracticeTest`'s regex), `assess.routes.ts` (the `z.enum([...])` allowlist), and likely frontend callers hardcoding mode strings (not traced further in this pass). This confirms the prompt's own flagged risk (§1.6, F4): every new type re-breaks or re-touches the flow across multiple files, not one.

---

## Findings carried forward into Phase 1 (bug derivation) — not exhaustive, the prompt expects more

Ranked roughly by how directly they violate the prompt's five Hard Rules:

1. **Hard Rule #4/#5 violation, systemic:** No session lockdown exists anywhere (no back/forward guard, no URL-navigation guard, no `beforeunload`, no fullscreen enforcement) — client or server. This is not a partial gap, it's total absence (§1.3).
2. **Authorization/state-machine bypass:** The generic `PATCH /api/assess/attempts/:attemptId` CRUD route lets an attempt's owner overwrite `attempt_state`, `server_deadline`, `paused_ms_total`, or any other column directly, bypassing every guard in `attempt-flow.ts` (§1.3). Same router's `DELETE` lets a user delete their own attempt row.
3. **Hard Rule #1 gap:** No `UNIQUE(test_id, question_id)` constraint; the generic `test_question` CRUD path has no cross-section duplicate check (only `ingestFixedPaper` does) (§1.1).
4. **Concurrency/deadlock:** `assembleForAttempt` doesn't participate in `startAttempt`'s transaction and will deadlock under concurrent load exactly like the already-fixed `loadSectionSchemes` bug (§1.1).
5. **Resume is functionally broken at the UI layer:** answers, flags, question index, and time-per-question are all discarded on refresh/resume despite being faithfully persisted server-side (§1.3).
6. **No automatic expiry sweeper is wired up anywhere** — only lazy on-read reconciliation, with a documented, unexecuted manual script as the only fallback (§1.3).
7. **Anti-repeat window: documentation (`candidate-pool.sql`, 50-attempt window) does not match reality (`assemble.ts`, no window at all)** — whichever behavior is intended, the two are currently out of sync (§1.1).
8. **`catalog.node_weightage` is fully built and wired but never read by assembly; a second, unsynchronized hardcoded weightage array exists in the frontend; neither drives actual mock composition** (§1.4).
9. **`has_image` is manually set and already known (via the codebase's own diagnostic scripts) to drift from real asset presence; no image-liveness check exists in the runtime eligibility path** (§1.5).
10. **Test-type taxonomy is encoded three separate times (`toLines()`, `deriveSessionModeFromTestCode()`, `hasCompletedPracticeTest()`) with no single source of truth**, plus `CHAP`/`TOPIC` are unreachable dead code in the main flow (§1.6).
11. **Generation seed is captured but never reused** — no way to reproduce a past attempt's exact draw for dispute resolution despite the plumbing existing (§1.1). Option shuffling is schema-supported (`shuffle_seed`, `option_order`) but entirely unimplemented — options are always static order.
12. **TOCTOU race on "one active attempt per user"** — the check runs before the transaction begins, with no advisory lock (§1.3).

These are leads for Phase 1, not the final bug list — Phase 1 (`BUGS.md`) will restate each with severity, reproduction steps, root cause, affected files, proposed fix, and blast radius, and is expected to find more beyond this list, per the prompt's own instruction.
