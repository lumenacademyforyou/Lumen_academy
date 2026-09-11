# TEST-CASES.md — Test Layer Hardening, Phase 2

Derived from `docs/BUGS.md` and `docs/AUDIT.md` per `docs/test-layer-hardening-prompt.md` §3. "Actual result" is not yet populated — these cases have not been executed; that happens during the Phase 3 fix pass (each fix ships with the failing case that proves it was broken, per the prompt's non-negotiables) and the final Verify pass. "Automation status" reflects what's realistic given the existing test infra (`node:test` under `db/`, Vitest, Playwright under `tests/`) — `unit`/`integration` for `db/`-level node:test cases, `e2e` for Playwright, `manual` where the scenario needs a human (visual/UX judgment, or a real second device).

Every case's "Linked bug ID" refers to `docs/BUGS.md`. Cases with no linked bug are either confirming already-correct behavior (regression coverage) or covering ground the bug pass didn't reach a verdict on.

---

## Bucket 1 — Repetition (floor: 25)

| ID | Priority | Preconditions (exact seed data) | Steps | Expected result | Linked bug | Automation |
|---|---|---|---|---|---|---|
| REP-01 | P0 | A published pool with exactly 45 PHY questions, no prior exposure for user U1 | Generate a SUBJ-mode PHY test for U1 (pick_count=45) | 45 distinct question_ids served, `len(set(ids))==45` | A1 | unit (`assemble.test.ts`) |
| REP-02 | P0 | Same as REP-01 but pool has 44 questions | Generate the same test | `PoolInsufficientError` thrown, requested=45, available=44; no attempt row persisted | 1.2 (pool sufficiency, not a numbered bug) | unit |
| REP-03 | P0 | A FIXED-mode paper with 2 sections both containing question Q1 (constructed directly via `test_question.repository.insertRow`, bypassing `ingestFixedPaper`) | Attempt to insert Q1 into section 2 after it's already in section 1 | Insert is rejected (once A1's `UNIQUE(test_id,question_id)` migration lands); today: insert succeeds — this case is the regression proof for A1's fix | A1 | integration |
| REP-04 | P0 | Same paper via `ingestFixedPaper` with Q1 repeated across two sections in the payload | Call `ingestFixedPaper` | Ingestion rejected with `"question Q1 is repeated within this paper"` (already correct today) | — (confirms `ingest-paper.ts:73-93` works) | unit |
| REP-05 | P1 | A blueprint with 2 lines whose node scopes overlap (line A: Unit 1, line B: Unit 1 + Unit 2 via `include_descendants`), pool has a question Q2 tagged to both scopes | Run `assembleForAttempt` | Q2 appears in at most one line's result (via `globallyPicked`) | A2 | unit |
| REP-06 | P1 | Same as REP-05 but the two lines belong to two *independently ingested* FIXED sections | Ingest section A then section B, each independently referencing Q2 | Q2 lands in both sections (current gap) — proof case for A1's fix closing this too | A1, A2 | integration |
| REP-07 | P2 | Content bank with `question_group`/comprehension-set concept not yet built | N/A — placeholder case to activate once A3's group feature exists: "a group counted as 1 toward section size must insert exactly N member rows, not 1" | Group size in the section matches member count exactly; group never split across sections | A3 | manual (until built) |
| REP-08 | P0 | User U1, pool with exactly 45 PHY questions, no active attempt | Fire 4 concurrent `startAttempt` calls for U1/PHY test at the same instant | All 4 either complete (with `ActiveAttemptExistsError` for 3 of them) or fail cleanly — **none hang** | A4 | integration (load test) |
| REP-09 | P0 | Pool sized for exactly `pool.max` (4) simultaneous BLUEPRINT-mode generations for 4 different users | Fire 4 concurrent `startAttempt` calls for 4 different users at once | All 4 attempts are created successfully within a bounded time (e.g. <5s); none hang past a timeout | A4 | integration (load test) — this is REP-08's cousin, proves the deadlock isn't user-scoped |
| REP-10 | P1 | Two tabs for the same user, no active attempt | Fire 2 concurrent `startAttempt` calls (same user, same or different test) within the TOCTOU window | Exactly one attempt is created; the second either gets `ActiveAttemptExistsError` or (post-fix) blocks on the advisory lock and then sees the first's row | A4b | integration |
| REP-11 | P1 | User U1 has an attempt with 45 served, unanswered, never-submitted questions (abandoned) | Generate a new test for U1 in the same scope | Today: all 45 questions are eligible again (bug). Post-fix: they should be excluded/deprioritized as already-served | A6 | unit |
| REP-12 | P1 | User U1 has a scored attempt covering 45 questions | Generate a new test for U1 in the same scope, pool has exactly 90 questions total | The 45 previously-scored questions sort last (soft-sort, never hard-excluded); with 90 available and 45 requested, the other 45 unseen ones are drawn first | — (confirms existing D-2 soft-sort behavior) | unit |
| REP-13 | P1 | Anti-repeat soft-sort scenario where the *entire* remaining pool has been seen before (pool=45, all seen) | Generate a new 45-question test | Test still generates successfully from the seen pool (never a hard failure just because everything's been seen) — this is the D-2 policy; note it deliberately differs from a hypothetical hard-window design | — (confirms D-2, and is the prompt's own explicit boundary case: "anti-repeat window would exclude every remaining question... fail with a clear message, not repeat" — **flag this as a real design tension**: today's soft-sort never fails here at all, which contradicts the prompt's stated desired boundary behavior if a hard window is later added) | unit — **see note below** |
| REP-14 | P0 | Pool has exactly N=45 questions matching a line's filters | Generate the test | Succeeds, all 45 distinct, `available` in a hypothetical shortfall error would read 45 | Boundary case per prompt §3 | unit |
| REP-15 | P0 | Same pool, N-1=44 questions (one question unpublished/removed) | Generate the same test | `PoolInsufficientError`, requested=45 available=44 | Boundary case per prompt §3 | unit |
| REP-16 | P1 | `assembleForAttempt` called twice with the same explicit seed against unchanged DB state | Compare both result sets | Identical question sets, identical order | A10 (seed plumbing exists but unused live — this proves it works when actually supplied) | unit |
| REP-17 | P2 | `assembleForAttempt` called with no seed, twice | Compare results | Different seeds generated (`generateSeed()` produces distinct 56-bit values each call), likely different question order/selection | — (confirms current default-random behavior is real randomness, not accidentally deterministic) | unit |
| REP-18 | P1 | Options for a question with 4 choices | Fetch the same question's envelope twice | Option order identical both times (`display_order`, static) — confirms A9's "no shuffle" finding, useful as a locked-in-today assertion so a future accidental shuffle is caught | A9 | unit |
| REP-19 | P2 | A question tagged to 2 syllabus nodes both within one line's scope (via `content.question_node_map`) | Run the candidate query for that line | Question appears once in the result set, not twice (the `group by q.question_id` collapse) | — (confirms the fan-out fix already in place) | unit |
| REP-20 | P0 | FIXED-mode paper re-ingested twice (same `testSectionId`, changed question list) | Call `ingestFixedPaper` twice in a row | Second call's rows fully replace the first's within one transaction; no leftover rows from the first ingestion remain | A5 | integration |
| REP-21 | P1 | User U1 submits attempt A (45 questions, all answered) | Inspect `assess.user_question_seen` afterward | All 45 rows present/updated with `times_seen` incremented and `last_seen_attempt_seq` set | — (confirms correct half of A6) | unit |
| REP-22 | P1 | Same as REP-21 but 10 of the 45 questions were left unanswered at submit | Inspect `assess.user_question_seen` | All 45 rows still present (unattempted ones included), confirming the "reverse" half of A6 does not occur | A6 | unit |
| REP-23 | P2 | A test with `test_blueprint.question_format = 'assertion_reason'` filter | Generate the test | Only `assertion_reason`-format questions drawn, format is exact-match not fuzzy | — (baseline correctness) | unit |
| REP-24 | P1 | Content bank with 2 questions sharing an identical normalized stem hash but different `question_id`s (simulated duplicate-at-source) | Generate a test large enough to plausibly draw both | Both are drawn (today — anti-repeat can't catch this since it's keyed on `question_id`, not stem) — this is the live demonstration of A7 | A7 | manual / SQL (this is what R2's queries are for, not `assemble.ts` fixing it) |
| REP-25 | P0 | 100 full-mock generations against the current live pool, distinct seeds | Run R3's simulation | Duplicate rate across all 100 = 0 (per-attempt uniqueness, which is already guaranteed by `attempt_question`'s PK regardless of blueprint quality) | — (this is R3 itself, tracked here as the top-level acceptance case) | integration/script |

**Note on REP-13:** this test case surfaces a real, unresolved design question rather than a clean pass/fail — the prompt's boundary-case list (§3) explicitly wants "anti-repeat window would exclude every remaining question → fail loudly, not repeat" as correct behavior, but the audited system has no hard window at all (by deliberate D-2 design), so it can never hit that failure condition — it always successfully draws from the fully-seen pool instead. Before automating REP-13, get a product decision on whether D-2's "never hard-fail on repeat-exposure" policy should stay as-is (repeat exposure is acceptable when the pool is exhausted) or whether a hard window should be introduced (in which case this case's expected result changes to "fails loudly"). Do not silently pick one in the fix phase — this is a real policy fork, not a bug.

---

## Bucket 2 — Pool sufficiency (floor: 15)

| ID | Priority | Preconditions | Steps | Expected result | Linked bug | Automation |
|---|---|---|---|---|---|---|
| POOL-01 | P0 | Pool exactly equals requirement (45=45) | Generate | Succeeds | Boundary | unit |
| POOL-02 | P0 | Pool is exactly one short (44 vs 45) | Generate | `PoolInsufficientError`, correct requested/available | Boundary | unit |
| POOL-03 | P0 | Pool is empty (0 published questions in scope) | Generate | `PoolInsufficientError`, available=0 | — | unit |
| POOL-04 | P0 | Multi-section test; one section's pool is short, others are fine | Generate | The whole transaction rolls back (no partial test with only the fine sections) — confirmed by tracing `startAttempt`'s catch-and-rollback | 1.2 finding | integration |
| POOL-05 | P0 | Single section, multiple blueprint lines by difficulty; only the "hard" line is short | Generate | Whole generation fails with a shortfall naming exactly the hard-difficulty line, not the section as a whole | 1.2 finding | integration |
| POOL-06 | P1 | Pool sufficient for the primary difficulty filter but the query is (incorrectly, hypothetically) relaxed | Generate with a short "hard" pool | Confirm no relaxation occurs — draw fails rather than silently substituting medium-difficulty questions | 1.2 (F2 refuted) | unit |
| POOL-07 | P1 | Node-scoped line where the pool is sufic overall but insufficient within that specific node | Generate | Fails naming that node specifically, does not silently widen to sibling/parent nodes | F2 (refuted — confirm it stays refuted after F1's fix) | integration |
| POOL-08 | P2 | `PoolInsufficientError`'s shape | Trigger any shortfall | Error carries `blueprintId`, `testSectionId`, `requested`, `available` — matches the prompt's required "what was requested, what was available, which node/difficulty" shortfall shape | Non-negotiables §4 | unit |
| POOL-09 | P1 | Full-mock generation, one subject's pool is short | Generate | Entire mock fails (not 3 subjects worth of questions + a silently short 4th) | 1.2 finding | integration |
| POOL-10 | P2 | Pool sufficient at generation time, but a question in it gets unpublished between the availability check and the actual draw (simulated race) | Generate under this race | Either the draw naturally reflects the unpublished state (since it's one query, not two racing reads) or a documented decision on how stale reads are handled | new (not covered by BUGS.md — flag if found to be a real gap) | integration |
| POOL-11 | P1 | Backend HTTP layer's handling of a thrown `PoolInsufficientError` | Trigger shortfall via the real API, not the DB function directly | A clean 4xx response with the structured detail, not a 500 with a stack trace | out of `db/`-only audit scope — verify at backend layer | e2e |
| POOL-12 | P2 | Shortfall in a CHAP/TOPIC-mode test (the two rarely-exercised types) | Generate a CHAP test against a short pool | Same shortfall behavior as SUBJ/UNIT — no special-cased leniency for less-used types | F4-adjacent | integration |
| POOL-13 | P1 | Image-based test type (once built per Fix phase) with fewer image questions than requested | Generate | Fails with the shortfall report, states how many image questions actually exist | E3, Fix-phase "New: image-based test type" | integration (post-fix) |
| POOL-14 | P2 | A test scope with questions that exist but are all `lifecycle_status != 'published'` (draft/retired) | Generate | Treated identically to an empty pool — draft/retired questions never count toward availability | — (confirms `LINE_CANDIDATE_SQL`'s `lifecycle_status='published'` filter) | unit |
| POOL-15 | P0 | 100-mock R3 simulation | Run and tabulate | Failure rate and which nodes ran dry most often are reported, per R3's own requirement | R3 deliverable | script |

---

## Bucket 3 — Session lockdown (floor: 30)

Desktop and mobile variants are listed as sub-rows where behavior could differ (mobile relies on OS-level backgrounding rather than a literal "tab").

| ID | Priority | Platform | Preconditions | Steps | Expected result | Linked bug | Automation |
|---|---|---|---|---|---|---|
| LOCK-01 | P0 | Desktop | Attempt in progress | Press browser Back | Blocked/confirmed, attempt stays active — not silently exited | B1 | e2e |
| LOCK-02 | P0 | Desktop | Attempt in progress | Press browser Forward after Back was pressed once before the test started | No effect on attempt state | B1 | e2e |
| LOCK-03 | P0 | Desktop | Attempt in progress | Manipulate app state / type a URL to another screen | Blocked or redirected to a pause-confirmation flow | B2 | e2e |
| LOCK-04 | P0 | Mobile | Attempt in progress | Tap a deep link (e.g. from a notification) | Same guard as LOCK-03 fires | B10 | manual (needs a real device or deep-link simulation) |
| LOCK-05 | P0 | Desktop | Attempt in progress, 5 questions answered | Refresh (F5) | Answers, flags, index, and time restored (this is also C4 — cross-referenced, not duplicated effort) | B3, C4 | e2e |
| LOCK-06 | P1 | Desktop | Attempt in progress | Switch to another tab, wait 30s, switch back | `flushDirty` fired (verified via network trace); an `attempt_event` row exists recording the blur (post-fix) | B4 | integration (event assertion) + e2e (behavior) |
| LOCK-07 | P1 | Mobile | Attempt in progress | Pull down notification shade, wait, return to app | Same as LOCK-06 (shared root cause per B9) | B9 | manual |
| LOCK-08 | P1 | Mobile | Attempt in progress | Receive an incoming call, answer, hang up, return to app | Same as LOCK-06/07 | B9 | manual |
| LOCK-09 | P1 | Desktop | Two browser tabs open, same account, no active attempt | Start a test in tab 1, then attempt to start the same/different test in tab 2 | Tab 2 sees `ActiveAttemptExistsError`, pointed at tab 1's attempt | A4b (shares root cause) | e2e |
| LOCK-10 | P1 | Desktop | Two tabs, both resumed into the *same* attempt | Answer question 3 differently in each tab within a few seconds of each other | A visible warning appears in at least one tab ("open in another tab") post-fix; today: silent last-write-wins | B5 | manual (timing-sensitive) |
| LOCK-11 | P1 | Desktop | Attempt in progress, fullscreen requested per the fix | Press Esc to exit fullscreen | A non-blocking "return to fullscreen" overlay appears; attempt is not auto-submitted | B6 | e2e |
| LOCK-12 | P0 | Desktop | Attempt in progress | Close the tab without warning | Native "leave site?" browser prompt appears (`beforeunload`) | B7 | e2e (can assert the listener is registered; the native dialog itself isn't fully automatable in headless mode — flag as partial) |
| LOCK-13 | P1 | Desktop | Attempt in progress | Call `GET /dashboard/analytics` directly (bypassing UI) with the active session's token | Rejected with `ATTEMPT_LOCKDOWN_ACTIVE` (post-fix); today: succeeds | B8 | integration |
| LOCK-14 | P1 | Desktop | Attempt in progress | Call `GET /content/catalog-tree` directly | Same as LOCK-13 — confirms the allowlist approach covers more than one endpoint, not just the one tested | B8 | integration |
| LOCK-15 | P0 | Desktop | Attempt in progress | Call `POST /assess/attempts/:id/submit` directly (the one thing that should always work) | Succeeds — confirms the allowlist doesn't over-block the legitimate path | B8 | integration |
| LOCK-16 | P0 | Desktop | Attempt in progress | Call `GET /me` directly (session refresh needed for the test screen itself) | Succeeds — confirms the allowlist correctly permits infrastructure calls the test screen itself needs | B8 | integration |
| LOCK-17 | P1 | Desktop | No active attempt | Call the same dashboard/content endpoints | Succeed normally — confirms the lockdown gate only activates when relevant, not globally | B8 | integration |
| LOCK-18 | P0 | Desktop | Attempt in progress | Timer reaches 0 while the tab is open | Auto-submits with whatever was answered; no lockdown-related interference with the submit call itself | — (cross-check against LOCK-13's allowlist logic) | e2e |
| LOCK-19 | P0 | Mobile 390px | Attempt in progress | Repeat LOCK-01 through LOCK-03's navigation-escape attempts | Same guards fire at mobile viewport width | B1, B2 | e2e |
| LOCK-20 | P1 | Desktop | Attempt in progress, fullscreen active | Alt-tab to another application (not just another browser tab) | `visibilitychange` fires (OS-level blur), same handling as LOCK-06 | B4 | manual |
| LOCK-21 | P0 | Desktop | Attempt is `in_progress` | Attempt the generic `PATCH /api/assess/attempts/:id` route with `{"attempt_state":"scored"}` | Rejected (post-fix — route removed or field-restricted); today: succeeds, silently ending the attempt | G1 | integration |
| LOCK-22 | P0 | Desktop | Attempt is `in_progress` | `PATCH /api/assess/attempts/:id` with `{"server_deadline":"2099-01-01T00:00:00Z"}` | Rejected (post-fix); today: succeeds, granting unlimited time | G1 | integration |
| LOCK-23 | P0 | Desktop | Attempt is `in_progress` | `DELETE /api/assess/attempts/:id` | Rejected (post-fix); today: succeeds, deleting the attempt outright | G1 | integration |
| LOCK-24 | P1 | Desktop | Attempt in progress | Open dev tools, manually resolve a delayed autosave request while offline, then reconnect | Retried and eventually persisted (C7) — cross-listed here since it's part of the lockdown/integrity story | C7 | e2e |
| LOCK-25 | P0 | Desktop, dark mode + light mode | Attempt in progress at 1920px, 1366px, 390px | Attempt LOCK-01/02/03/12 at each width | Guards behave identically regardless of viewport/theme | B1,B2,B7 | e2e |
| LOCK-26 | P2 | Desktop | Attempt in progress | Trigger the fullscreen-exit overlay (LOCK-11), then answer a question while the overlay is showing | Answering is blocked until fullscreen is restored (overlay actually intercepts interaction, isn't purely cosmetic) | B6 | e2e |
| LOCK-27 | P1 | Desktop | Attempt in progress | Use browser dev tools to fire a synthetic `popstate` event | The guard (post-fix) intercepts it the same as a real Back press | B1 | e2e |
| LOCK-28 | P1 | Desktop | Attempt in progress, second device (not just second tab) logged in | Start a second attempt from the second device | `ActiveAttemptExistsError` on the second device (shares A4b's root cause — device identity isn't special-cased, "one active attempt per user" is device-agnostic) | A4b | manual (needs two real sessions) |
| LOCK-29 | P0 | Desktop | Attempt submitted (state = scored) | Attempt any of LOCK-01/02/03/12/13 after submission | All lockdown guards release — normal navigation works again immediately after submit | — (regression: lockdown must not outlive the attempt) | e2e |
| LOCK-30 | P1 | Desktop | Attempt paused (state = paused, via explicit Exit & Pause) | Attempt LOCK-13/14 (non-test API calls) while paused | Confirm whether the lockdown allowlist should still apply while merely `paused` (not `in_progress`) — a policy question the fix phase needs to resolve, not guess at | B8 | integration, pending policy answer |

---

## Bucket 4 — Pause / resume / recovery (floor: 25)

| ID | Priority | Preconditions | Steps | Expected result | Linked bug | Automation |
|---|---|---|---|---|---|---|
| RES-01 | P0 | 5 answered, 2 flagged, on question 8 of 45 | Refresh | All 5 answers, both flags, question 8, and correct remaining time all restored | C4 | e2e |
| RES-02 | P0 | Same setup | Kill the browser process entirely (not just refresh), reopen, log in | Same restoration as RES-01 | C4 | e2e |
| RES-03 | P0 | Same setup | Go offline for 60s (airplane mode simulated), come back online | Answers made just before going offline are present (queued-and-retried per C7), no loss | C7 | e2e |
| RES-04 | P0 | Attempt with `server_deadline` in the past, client never reconnects until after deadline, then reopens | Reopen the app | Attempt is force-closed/evaluated on the reopen (via lazy reconciliation) — not stuck `in_progress` forever | C3 (partial — proves the lazy path; full C3 fix needs the sweeper for the "never reopens at all" case, which this test can't reach) | integration |
| RES-05 | P0 | Same as RES-04 but the sweeper (post-fix) is running and the client genuinely never reconnects | Wait past deadline + one sweep interval, then check attempt state via an admin/DB query (not via the client, which never reconnects) | Attempt auto-transitions to `scored` (or `abandoned` per C1, if zero responses) within one sweep interval, with no client involvement at all | C3 | integration (this is the real proof C3 requires — RES-04 alone is insufficient) |
| RES-06 | P1 | Attempt double-submitted (network retry) | Fire `submit` twice in quick succession | Exactly one scorecard, second call returns the same result idempotently | C5 | integration |
| RES-07 | P1 | Attempt at exactly its deadline, sweeper and manual submit race | Fire the sweeper's evaluation and a manual submit at the same instant | Exactly one scorecard produced, no double-increment of mastery/analytics | C6 | integration |
| RES-08 | P0 | Attempt with 0 seconds remaining, client still open | Let the client-side countdown hit 0 | Auto-submits, whatever was answered up to that point is scored, no zero-timer "ghost" state | Boundary case (§3) | e2e |
| RES-09 | P1 | Attempt where the auto-submit sweeper begins its transaction, and a manual submit is fired mid-transaction | Simulate via a delay/breakpoint in the sweeper's transaction, fire manual submit during that window | Manual submit blocks on the row lock until the sweeper's transaction resolves, then sees `scored` and returns idempotently — no error, no double-score | Boundary case (§3), same mechanism as C6 | integration (needs an artificial delay hook) |
| RES-10 | P1 | Attempt has no `abandoned` semantics yet (pre-fix) vs. post C1 fix | Leave an attempt with zero responses past its deadline, untouched, for a long window | Post-fix: transitions to `abandoned`, not `scored` with an empty scorecard | C1 | integration |
| RES-11 | P1 | Attempt has 1+ responses, left past deadline untouched | Same wait | Transitions to `scored` (has real answers to grade), not `abandoned` — confirms C1's fix distinguishes the two cases correctly | C1 | integration |
| RES-12 | P0 | Logout mid-test (5 answered) | Log out normally | Attempt best-effort pauses (`endSession`'s existing behavior); log back in | Resume prompt shown, all 5 answers intact | — (confirms existing correct `App.tsx` behavior, not a bug) | e2e |
| RES-13 | P1 | Logout mid-test while offline (pause call itself fails) | Force the pause API call to fail (e.g. block network), then log out anyway | Attempt is left `in_progress`; on next login, lazy reconciliation or the resume prompt still correctly handles it, doesn't crash or duplicate | — (edge case of existing `endSession` catch-and-swallow) | integration |
| RES-14 | P1 | Attempt resumed from `paused` | Call `resumeAttempt` | Requires an open `attempt_pause` row; timer recomputed correctly from `paused_ms_total` | C2 | unit |
| RES-15 | P0 | Last question of the last section, in a hypothetical group-based paper (post A3/E6 build) | Refresh while on the last question of a group | Group state (all member answers) restored together, not just the current member | Boundary case (§3), A3/E6 | manual (until groups exist) |
| RES-16 | P1 | An attempt's per-question time tracking | Spend 90s on question 1, 30s on question 2, then refresh | `questionTimeMap` restored with 90s/30s respectively (requires the envelope extension proposed in C4) | C4 | e2e (post-fix) |
| RES-17 | P0 | Two devices, same account, one active attempt | Resume the attempt from the second device | Same attempt, same state, no duplicate attempt created | A4b, LOCK-28 | manual |
| RES-18 | P1 | Attempt paused via "Exit & Pause", question-language setting was Tamil mid-test | Resume | Question-language choice (`lumen_question_lang`) is preserved, per the debug tracker's own documented behavior (cleared only on submit, not pause) | — (confirms existing correct cross-feature behavior) | e2e |
| RES-19 | P0 | Attempt submitted normally | Attempt to resume/pause afterward | `InvalidStateTransitionError` or idempotent-scored-return, never a state corruption | — (state machine boundary) | unit |
| RES-20 | P2 | Attempt abandoned (post C1), user starts a brand-new test | New attempt creation proceeds normally, unaffected by the old abandoned one sitting in the DB | New attempt succeeds; old one remains `abandoned` untouched | C1, C8 | integration |
| RES-21 | P1 | Attempt stuck `in_progress` pre-fix (simulating before C1/C3 land) | Attempt to start a new test | `reconcileUserAttempts` fires first and unblocks it in the same call (existing, confirmed behavior) | C8 | integration |
| RES-22 | P1 | A scheduled/windowed test concept, IF it exists post-clarification (C9) | Resume after the window closes | Behavior explicitly defined once C9 is clarified — placeholder case, not executable until then | C9 | blocked on product decision |
| RES-23 | P0 | Attempt in progress, `PATCH /:id/responses` batch call with 10 answers | Submit the batch | All 10 persist atomically; a partial-batch failure doesn't leave some saved and others silently dropped | — (baseline correctness of `batchUpsertResponses`) | integration |
| RES-24 | P1 | Attempt resumed after a crash mid-autosave (some responses saved, the in-flight one wasn't acked) | Resume | The unacked response is either confirmed lost-and-recoverable (client still has it locally) or correctly reflects the server's last-known-good state — no crash, no corrupted attempt | C7 | e2e |
| RES-25 | P0 | Full regression: kill browser mid-test at question 30 of 45, resume, answer remaining 15, submit | End to end | Final scorecard reflects all 45 answers (30 pre-crash + 15 post-resume) correctly scored against the marking scheme | C4, C5 — this is the prompt's own §6 "manual checkpoint" in miniature | manual (full end-to-end), automatable once C4 lands |

---

## Bucket 5 — Blueprint / weightage (floor: 20)

| ID | Priority | Preconditions | Steps | Expected result | Linked bug | Automation |
|---|---|---|---|---|---|---|
| BP-01 | P0 | Post-fix versioned blueprint table populated with real NEET unit weightage, pool matches exactly | Generate a full mock | Every unit's question count falls within its tolerance band; deviation report shows ~0 deviation | D1, D3, D4 | integration |
| BP-02 | P1 | Same, but pool is short in exactly one unit (within overall subject sufficiency) | Generate | Deviation report names that unit specifically with the shortfall size; test still generates using the tolerance band (doesn't hard-fail unless below the *section's* minimum) | D3, D4 | integration |
| BP-03 | P1 | An "impossible" blueprint (target exceeds total available questions in that unit even without tolerance) | Generate | Hard failure with the structured shortfall (same shape as `PoolInsufficientError`), not a silently-adjusted paper | Non-negotiables §4 | integration |
| BP-04 | P1 | Per-unit test (UNIT mode) post-D7 fix | Generate | Multiple sub-topic lines drawn (not one flat line), each within its own tolerance band | D7 | integration |
| BP-05 | P1 | Per-chapter test (CHAP mode) post-D7 fix | Generate | Same sub-topic spread behavior as BP-04, scoped one level lower | D7 | integration |
| BP-06 | P0 | Marking scheme `+4/-1/0`, attempt with 10 correct, 5 incorrect, 5 unattempted (20 total) | Submit and score | Score = 10×4 + 5×(-1) + 5×0 = 35, matches hand calculation | Scoring bucket overlap, D6 confirmed-correct | unit |
| BP-07 | P1 | A test whose section uses a *different* marking scheme (e.g. a hypothetical `+1/0/0` scheme row) than another section in the same test | Submit | Each section scores against its own resolved scheme via `v_section_marking`, not a single global constant | D6 | unit |
| BP-08 | P0 | Blueprint fit simulation: 100 full mocks, distinct seeds, against the live (or a snapshot) pool | Run R3 | Average deviation per subject and per unit reported; 0 duplicates; failure rate and which nodes ran dry most often reported | R3 deliverable | script |
| BP-09 | P1 | `catalog.node_weightage` populated but pre-fix `assemble.ts` (i.e. testing the *current*, unfixed state as a regression baseline) | Generate a full mock | Confirms today's bug: weightage has zero effect (this is the "red" test that proves D1 was broken before the fix) | D1 | integration |
| BP-10 | P1 | Post-fix: `frontend/src/data/syllabusData.ts`'s display numbers vs. the new versioned weightage source | Compare both | Numbers match (single source of truth) — or, if syllabusData.ts is intentionally left as a static display-only copy per a scope decision, this case documents that decision explicitly rather than silently drifting | D2 | manual (data comparison) |
| BP-11 | P0 | The versioned blueprint table's `effective_from` + cited NTA bulletin source column | Inspect the seed data | A real citation (bulletin name/year/section) is present, not a placeholder or "AI-recalled" value | Fix-phase requirement: "verify it against the bulletin before seeding" | manual (human verification against the actual bulletin document) |
| BP-12 | P2 | Unit weightage confidence field (for historically-derived, non-bulletin-sourced values) | Inspect | Confidence field populated, tolerance band wider for low-confidence rows than for bulletin-cited ones | D3 | manual |
| BP-13 | P1 | Difficulty-mix requirement within one unit (if the workaround of "multiple lines per unit per difficulty" is adopted per D5) | Generate a unit test requiring 3 easy + 5 medium + 2 hard | All three counts hit within tolerance, verified against a hand count | D5 | integration |
| BP-14 | P1 | Question-type mix requirement (e.g. 2 assertion-reason + 8 single-choice within a unit) | Generate | Both counts hit within tolerance | D5 | integration |
| BP-15 | P0 | A near-fit paper (pool allows hitting most units exactly but 2 units are short by 1 each) | Generate | Succeeds within tolerance bands; deviation report explicitly names both under-filled units even though the whole test succeeded | D4, D3 | integration |
| BP-16 | P0 | A perfect-fit paper (every unit hits its exact target) | Generate | Deviation report is still returned (all zeros), never omitted just because the fit was perfect | D4 (explicit non-negotiable: "always returns a deviation report... even on a perfect fit") | integration |
| BP-17 | P1 | `voidDisposition` handling (currently hardcoded `"EXCLUDED"`) | Score an attempt containing a voided question | Voided question is excluded from scoring consistently; flagged as a known gap if the marking scheme ever needs per-scheme void handling | D6 (minor follow-up) | unit |
| BP-18 | P2 | Full mock duration/marking hardcoded values (`FULL_MOCK_DURATION_MINUTES=180`, `FULL_MOCK_QUESTIONS_PER_SUBJECT=45`) | Generate a full mock | Both values match the seeded/versioned source once D1/D2 move them to data, not the current TS constants | D1, D2 | integration (post-fix) |
| BP-19 | P1 | Reconciliation between `assess.test_blueprint` (existing per-test lines) and the new versioned `blueprint`/`blueprint_section`/`blueprint_weight` tables (existing schema not removed, new one added) | Generate | `test_blueprint` rows are correctly derived/populated from the versioned source at test-creation time, not hand-authored per test going forward | D1 (implementation detail) | integration |
| BP-20 | P1 | Scoring reconciliation against a hand-computed paper (overlaps Scoring bucket, listed here for the blueprint-correctness angle) | Take a 20-question test with a known answer key, hand-score it, compare to the system's scorecard | Exact match, including per-section marks | Scoring bucket, D6 | manual + unit |

---

## Bucket 6 — Image tests (floor: 15)

| ID | Priority | Preconditions | Steps | Expected result | Linked bug | Automation |
|---|---|---|---|---|---|---|
| IMG-01 | P0 | Pool = 0 image-based questions in scope | Generate the new image test type | `PoolInsufficientError`-equivalent shortfall, states 0 available | E3, Fix-phase image type | integration |
| IMG-02 | P0 | Pool has exactly N image questions, test requests N | Generate | Succeeds, all N have `has_image=true` (computed, per E2's fix) and a verified-reachable asset | E2, E3 | integration |
| IMG-03 | P0 | Pool has N-1 image questions, test requests N | Generate | Shortfall, states N-1 available | Boundary (§3) | integration |
| IMG-04 | P0 | One question has `has_image=true` (stale/manual) but its `content.asset` row was deleted (broken asset) | Generate the image test type | That question is excluded from eligibility (post-E3 fix); pre-fix: it's drawn and serves a broken image | E2, E3 | integration |
| IMG-05 | P1 | A question genuinely has an image but `has_image` was never flipped (import-time gap, E2) | Generate a *non-image* test type in the same scope | Question is still drawn normally (has_image doesn't gate normal eligibility) — but generate the *image* test type and confirm this question is now correctly included once `has_image` is computed, not manually set | E2 | integration |
| IMG-06 | P1 | Group-leaked diagram scenario (post A3/E6 group support) | A stem-shared diagram question's group is drawn | Whole group drawn together, or the group is skipped entirely — never a lone member without its diagram | E6, A3 | manual (until groups exist) |
| IMG-07 | P1 | Mobile viewport 390px | Render a tall portrait image question | Fits within frame, `object-fit: contain`, no distortion, zoom still available | E4 (already fixed — regression case) | e2e |
| IMG-08 | P1 | Desktop 1920px | Render a wide landscape image question | Same correctness | E4 (regression) | e2e |
| IMG-09 | P2 | Slow/throttled network | Load a question with an image | Image loads eagerly (not deferred), skeleton shown while pending, no layout shift once loaded | E5 (regression — confirms the deliberate eager-load fix holds) | e2e (network-throttled) |
| IMG-10 | P0 | Every question in a unit is image-based | Generate a unit-scoped test | Succeeds normally, no special-case failure just because 100% of questions carry images | Boundary (§3) | integration |
| IMG-11 | P0 | None of the questions in a unit are image-based | Generate the *image test type* scoped to that unit | Shortfall, 0 available, clear message | Boundary (§3), E3 | integration |
| IMG-12 | P1 | Image asset with a valid `storage_uri` but a since-revoked/expired Supabase signed access policy | Generate + serve | Detected as unreachable by the reachability sweep (post-E3 fix), excluded from eligibility | E3 | integration (needs the sweeper's mocked state) |
| IMG-13 | P2 | `content.asset` row with `target_role='option'` (an image attached to one answer option, not the stem) | Render the question | Option image renders correctly in its own frame, independent of the stem's image (if any) | — (schema supports this; verify the frontend actually renders option-level images, not audited in this pass — flag as a coverage gap if not) | manual |
| IMG-14 | P1 | Image test type combined with the anti-repeat/uniqueness rules from Bucket 1 | Generate 20 consecutive image-type tests for the same user | Zero duplicate questions within any single test; same repeat-exposure soft-sort behavior as any other type — "same repetition and shortfall rules as every other type, no exceptions" | Fix-phase requirement | integration |
| IMG-15 | P0 | `has_image` recomputation trigger/view (post E2 fix) | Insert a new `content.asset` row for a question that previously had `has_image=false` | `has_image` reflects `true` immediately (via trigger or live view), with no manual script run required | E2 | unit |

---

## Bucket 7 — Scoring (floor: 15)

| ID | Priority | Preconditions | Steps | Expected result | Linked bug | Automation |
|---|---|---|---|---|---|---|
| SCORE-01 | P0 | 20-question test, marking +4/-1/0, all 20 correct | Submit | Score = 80 | — | unit |
| SCORE-02 | P0 | Same test, all 20 incorrect | Submit | Score = -20 | — | unit |
| SCORE-03 | P0 | Same test, all 20 unattempted | Submit | Score = 0 | — | unit |
| SCORE-04 | P0 | Same test, mixed: 12 correct, 5 incorrect, 3 unattempted | Submit | Score = 12×4 + 5×(-1) + 3×0 = 43 | — | unit |
| SCORE-05 | P1 | Multi-choice question with partial-credit rule set | Submit a partially-correct multi-select answer | Partial credit applied per `partial_credit_rule`, not simply marked wrong | — (untested area per audit — flag as a coverage gap, not confirmed either way) | unit |
| SCORE-06 | P1 | Numeric-answer question with `numeric_tolerance_pct` set | Submit an answer within tolerance, then one just outside it | Within tolerance = correct; just outside = incorrect | — (same coverage-gap flag) | unit |
| SCORE-07 | P0 | Options shuffled at serve time (once A9 is implemented, if it is) | Submit the answer matching the correct `option_id` regardless of displayed position | Scored correctly — proves scoring already keys on `option_id`, not position, so shuffling (if added) can't break scoring | A9 | unit |
| SCORE-08 | P0 | Reconciliation: 20-question test, full hand-computed answer key | Submit real answers matching a hand-worked scorecard | System's `assess.scorecard`/`section_score` exactly matches the hand computation, per-section and overall | Non-negotiable, overlaps BP-20 | manual + unit |
| SCORE-09 | P1 | Attempt submitted twice (idempotency) | Compare scorecards from both calls | Identical — confirms C5 doesn't accidentally rescore differently on retry | C5 | integration |
| SCORE-10 | P1 | Attempt scored via expiry (`enforceExpiry` → `submitAttempt(..., "expiry")`) vs. manual submit with identical answers | Compare | Identical scores regardless of submission reason — `submitted_reason` shouldn't affect the marks | — | integration |
| SCORE-11 | P1 | Voided question (`voidDisposition = EXCLUDED`) included in a 20-question paper | Submit | The voided question doesn't count toward correct/incorrect/unattempted totals or the max-possible-marks denominator | D6 (minor) | unit |
| SCORE-12 | P0 | Zero seconds remaining at submit (client-triggered auto-submit at t=0) | Submit | Scored using whatever answers exist at that instant, no off-by-one question excluded/included incorrectly | Boundary (§3) | e2e |
| SCORE-13 | P1 | Section-level scores (`section_score`) vs. overall (`scorecard`) | Submit a multi-section test | Sum of section scores equals the overall score exactly (no rounding drift) | — (overlaps `db/assess/scoring/decimal.test.ts`'s existing concern) | unit |
| SCORE-14 | P1 | Assertion-reason format scoring | Submit various assertion/reason combinations | Scored per the format's specific correct-answer logic, not treated as a generic single-choice | — | unit |
| SCORE-15 | P0 | Full R3-style reconciliation across 5 seeded attempts with pre-computed hand scores (the prompt's own §8 exit-gate dataset) | Compare system output to the 5 hand-computed scores | Exact match for all 5 | Non-negotiable | manual |

---

## Bucket 8 — Concurrency (floor: 10)

| ID | Priority | Preconditions | Steps | Expected result | Linked bug | Automation |
|---|---|---|---|---|---|---|
| CONC-01 | P0 | Two tabs, same user, same attempt | Autosave from both tabs within the same 12s window, different questions each | Both persist correctly, no lost write (different questions = no real conflict) | B5 | integration |
| CONC-02 | P1 | Two tabs, same user, same attempt, same question | Submit conflicting answers to the same question from both tabs near-simultaneously | Last-write-wins is at least consistent (no corrupted/partial row); post-fix, a same-tab warning should appear | B5 | integration |
| CONC-03 | P0 | Two devices, same user | Start a test from device A, then device B | Device B blocked by `ActiveAttemptExistsError`, pointed at device A's attempt | A4b | manual |
| CONC-04 | P0 | Simultaneous generate: two students, same test type, same node, same millisecond (per the prompt's own named boundary case) | Fire both generation requests concurrently | Both succeed independently with correctly-isolated, non-overlapping-by-necessity pools (they're different users, so overlap is expected and fine — the real assertion is that neither deadlocks per A4, and neither corrupts the other's `attempt_question` rows) | A4 | integration (load test) |
| CONC-05 | P0 | Simultaneous submit: same attempt, manual + sweeper | As RES-07 | Exactly one scorecard | C6 | integration |
| CONC-06 | P1 | 10 concurrent `startAttempt` calls, mixed users, mixed test types (some BLUEPRINT, some FIXED) | Fire all 10 at once | None hang past a timeout (proves A4's fix generalizes beyond the single-type load test in REP-08/09) | A4 | integration (load test) |
| CONC-07 | P1 | `reconcileUserAttempts` running for a user with a large backlog of stale attempts (per the existing documented `RECONCILE_BATCH_LIMIT` cap) while that same user's fresh `startAttempt` call is also in flight | Fire both | Reconciliation stays sequential/capped as documented; the fresh start isn't starved indefinitely | — (regression on already-fixed reconciliation-deadlock behavior, `expiry.ts:62-89`) | integration |
| CONC-08 | P1 | Two concurrent `PATCH .../responses` batch calls for the same attempt, disjoint question sets | Fire both | Both fully persist, no interleaving corruption | — | integration |
| CONC-09 | P0 | Advisory lock (post A4b fix) under contention | Fire 5 concurrent `startAttempt` calls for one user | Exactly 1 succeeds in creating an attempt; the other 4 see `ActiveAttemptExistsError` deterministically (not a race where 2+ slip through) | A4b | integration (load test, this is the actual proof of A4b's fix, stronger than REP-10) |
| CONC-10 | P1 | Image-asset reachability sweep (post E3) running concurrently with active test generation | Run both at once | Generation isn't blocked/slowed meaningfully by the sweep; sweep doesn't lock rows generation needs | E3 (implementation detail) | integration |

---

## Cross-cutting boundary cases (explicit, per prompt §3)

These restate the prompt's own named boundary list, each already covered above — kept here as a single checklist so none can be silently dropped:

| Boundary case | Covered by |
|---|---|
| Pool has exactly N, then N-1 | REP-14/15, POOL-01/02, IMG-02/03 |
| Anti-repeat window would exclude every remaining question → must fail, not repeat | REP-13 (flagged as an open design-policy question, not a clean pass) |
| Submit with 0 seconds remaining | RES-08, SCORE-12 |
| Submit races with the auto-submit sweeper mid-transaction | RES-09 |
| Last question of the last section is a group member | RES-15 (blocked on group support existing) |
| Every question in a unit is image-based, then none | IMG-10, IMG-11 |
| Two students generate the same test type from the same node at the same millisecond | CONC-04 |

---

## Totals vs. floors

| Bucket | Floor | Derived |
|---|---|---|
| Repetition | 25 | 25 |
| Pool sufficiency | 15 | 15 |
| Session lockdown | 30 | 30 |
| Pause/resume/recovery | 25 | 25 |
| Blueprint/weightage | 20 | 20 |
| Image tests | 15 | 15 |
| Scoring | 15 | 15 |
| Concurrency | 10 | 10 |
| **Total** | **155** | **170** (accounting for LOCK bucket's 30 rows + cross-references) |

All floors met. Per the prompt, these are floors not targets — the fix phase and its own test-writing (each fix ships with the failing test that proves it was broken) will add more, particularly around G1 (the CRUD bypass) and the group/image-type build-out, neither of which existed as a nameable case in the prompt's own bucket list but both surfaced real, cited gaps during derivation.
