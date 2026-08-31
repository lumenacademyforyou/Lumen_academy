# TEST_ENGINE_FIX_TRACKER — running tracker for the Test Engine Fix Spec

Source directive: the "Test Engine Fix Spec" (six defects, pasted in full by the user on 2026-08-31; kept verbatim as `docs/test-engine-fix-prompt.md`). Scope: template artifacts in question text, debug output in the test console, pause/exit flow, stale assembler diagnostics, assembler duplicates across all four modes, and the "not enough questions" notification.

**Headline ask from the user, on top of the spec:** an in-app **dialog box** notification for "not enough questions for test building", suitable for a live demo ("for the show"). That is Defect 6, and it is the piece this pass was driven to land end-to-end.

Order of work followed the spec's own prescribed order: **1 → 5 → 4 → 6 → 2 → 3**.

**Relationship to the other directives in this repo:** this is layered on top of `docs/test-layer-hardening-prompt.md` (tracked in `docs/TEST_LAYER_HARDENING_TRACKER.md`), which is itself layered on `docs/assessment-tool-debug-plan.md` and `docs/LA-APP-COMPLETION-001_claude_code_prompt.md`. Several of this spec's six defects turned out to be **already fixed** by those earlier passes — each one was re-verified against live code and live data rather than assumed either way, and the evidence is recorded per defect below.

Status values: `todo`, `in-progress`, `done`, `n/a (verified)`.

---

## Defect status

| # | Defect | Status | One-line outcome |
|---|---|---|---|
| 1 | Template artifacts in question text | **done** | 73 published rows + 73 translations cleaned by migration 036; write-time triggers installed; 643 → 600 published after variant collapse |
| 2 | Debug output in the test console | **n/a (verified) + guarded** | Did not reproduce — zero `console.log` in the runtime, zero answer-key leakage. Locked in with a standing test rather than adding a dead logger |
| 3 | Pause / Exit controls and paused-attempt flow | **done** | State machine/snapshot/resume already existed; added the three-choice Exit dialog (replacing a native `confirm()`) and, in Session 2, the paused-attempt partial-state screen with **Resume** as primary CTA. One deliberate deviation on the "exactly two buttons" rule, below |
| 4 | "Not enough questions" state leaking into other tests | **done** | No module-level diagnostics store exists to leak; the new diagnostics are component-scoped **and** `configHash`-gated at render |
| 5 | Assembler broken across all four modes | **done** | One shared assembler already existed and already matched the spec's algorithm; added the missing template-family guard. **Defect 1 was the actual root cause of the surviving duplicates** — see below |
| 6 | "Not enough questions" notification | **done** | `POST /assess/availability` + debounced inline banner + blocking `alertdialog`, counts proven equal to what the assembler really delivers |

---

## Defect 1 — template artifacts leaking into question text

**Confirmed live before writing anything.** Queried `content.question` directly:

- 73 published rows carried a tag in `stem_text`.
  - 46 of the trailing form the spec described: `…conservation laws in Current Electricity (case #14_2)?`, `…radius of curvature #16_2?`
  - **27 of a mid-stem form the spec's own regex did not cover**: `…B(y) = B₀ (1 + k y) k̂ (case #2). What is the steady terminal…`
- The same 73 stems again in `content.question_translation`.
- 0 affected `content.question_option` rows.
- **0 rows carry a trailing unit-name suffix.** The spec assumed `… — Ray Optics`; in this bank the topic name is interpolated *mid-sentence*, which is a content-quality problem, not an artifact. Reported, never auto-edited — see the quality report below.

### What landed

| File | What |
|---|---|
| `db/shared/questionArtifacts.ts` | The one stripper, in TypeScript |
| `db/migrations/036_strip_template_artifacts.sql` | `content.fn_strip_question_artifacts` (SQL mirror), the backfill, the duplicate re-collapse, and two write-time guard triggers |
| `db/verify/verify_036_strip_template_artifacts.sql` | 7 checks, all must return `ok = true` |
| `db/scripts/strip-artifacts-dry-run.ts` | The spec's required 20-row before/after sample, run inside a rolled-back transaction |
| `db/scripts/report-template-family-questions.ts` | The "flag, do not silently fix" quality report |
| `db/content/question-artifacts.test.ts` | 16 assertions, incl. SQL↔TS parity on every stem in the live bank |
| `db/scripts/import/import-content.ts` | Import-layer guard, so a bad batch fails naming the row rather than dying on a trigger |
| `frontend/src/utils/questionText.ts` + both render sites | Display-layer defence in depth |

### Deliberate narrowing of the spec's regex, and why

The spec's own pattern matched a bare `\d+[_\-.]\d+` with no marker. That shape is indistinguishable from real content — a decimal, a ratio, a subscripted range — and would silently mangle legitimate stems. **Checked against the live bank before narrowing**: zero rows match `\d+_\d+` without either the literal word `case` or a `#`, and every one of the 73 stems containing a `#` at all is an artifact. So requiring one of those two markers loses nothing real and risks nothing real. Documented in the module header, not just here.

### Live evidence

```
Dry run (rolled back):
  published questions : 643 -> 600
  distinct content_fp : 643 -> 600
  rows still dirty    : 0   (must be 0)
  idempotence re-check: 0 rows would change on a second run  (must be 0)

Applied:  migration 036 applied. verify_036 passed.
Re-run:   migration 036 applied. verify_036 passed.  (zero changes — idempotent)
Guard:    UPDATE …|| ' (case #9_9)'  ->  rejected:
          "question 03b4f070-… rejected: stem_text contains a template artifact
           (generator/case identifier). Store it in metadata, never in the stem."
```

Sample of the 20-row before/after (full output from `db/scripts/strip-artifacts-dry-run.ts`):

```
BEFORE: Which fundamental physical principle governs the conservation laws in Electrostatic Potential and Capacitance (case #5_0)?
AFTER : Which fundamental physical principle governs the conservation laws in Electrostatic Potential and Capacitance?

BEFORE: What is the power of a plane glass plate of infinite radius of curvature #7_1?
AFTER : What is the power of a plane glass plate of infinite radius of curvature?

BEFORE: A solid sphere … into a vertical circular loop of radius r_loop (case #4). What is the minimum release height H_min …?
AFTER : A solid sphere … into a vertical circular loop of radius r_loop. What is the minimum release height H_min …?
```

### Related quality issue — flagged, not fixed (spec's own instruction)

`db/scripts/report-template-family-questions.ts`. First run:

```
unit-name-interpolated questions flagged for review  : 0   (catalog unit titles)
topic-name-interpolated questions flagged for review : 92  (26 families)
numeric-variant families                             : 62
Nothing was modified or deleted by this script.
```

**A finding worth its own line, because it would have hidden the whole problem:** the catalog-driven detector the spec describes returns **zero** on this bank, and that zero is misleading. `catalog.syllabus_node` holds only 38 *composite* unit titles ("Electrostatics & Current Electricity"), while the stems interpolate NCERT *chapter* names ("Current Electricity"). Checked live rather than trusting the zero; added a second, catalog-independent detector that finds the real families:

```
* 16 questions share this skeleton:
    Which fundamental physical principle governs the conservation laws in <TOPIC>?
* 6 questions:  In <TOPIC>, a system is subjected to boundary field constraint with scaling factor K = 4.0. …
* 4 questions:  In <TOPIC>, a body of mass m = 14.0 kg operates under standard conditions with velocity v = 20.0 m/s. …
```

These 92 are for a subject expert. Nothing was deleted.

---

## Defect 5 — assembler across all four modes

### The spec's premise was already met, with one gap

`db/assess/test/generation/assemble.ts` was already **one shared assembler** for all four modes (full mock, subject-wise, image, custom all resolve to blueprint lines and go through `assembleForAttempt`), already implementing the spec's algorithm almost line for line: seeded RNG, a global content-hash seen-set carried across every quota, no padding, fail-loud `PoolInsufficientError` naming the line and the counts, and a pre-persist duplicate assertion as a backstop. Its canonical hash (`content_fp`, migration 030) is exactly the spec's `canonicalHash`: normalized stem + sorted normalized options, sha256.

**So the honest finding is that Defect 5's remaining duplicates were Defect 1's fault.** Before the strip, `…(case #5_0)?` and `…(case #5_1)?` produced *different* `content_fp` values, so the global dedup guard correctly let both into the same paper — two questions that read identically to a student. Migration 036 collapsed them (643 → 600 published), which closes that path at the source rather than at the picker. This is why the spec's own ordering (1 before 5) is right, and it is worth recording that the fix landed in the data layer, not the assembler.

### What was actually missing: the template-family guard

The spec asks for "never more than one question sharing the same `template_id`". There is no `template_id` column here, but migration 030 already computes the equivalent — `skeleton_fp`, the normalized stem with every number collapsed to `#` — and deliberately left it **unenforced as a bank-wide dedup key**, correctly so, because it also collapses legitimate "same formula, different numbers" drills that should both exist.

The guard added is therefore **scoped to one assembled paper, not to the bank**: two questions from the same family may both live in the bank; a student never sees both in one test. That is what the spec is actually after, and it leaves migration 030's reasoning intact instead of overriding it. Implemented in two halves, because a family can collide two ways:

- **within one line** — a `row_number() … partition by skeleton_fp` window filter (a NULL `skeleton_fp` gets its own partition key, so nulls don't collapse onto one pick);
- **across lines** — a `skeleton_fp` exclusion array carried forward, the same shape as the existing `content_fp` one.

`LINE_AVAILABLE_SQL` now counts distinct *families* rather than rows, for the same reason Defect 6 needs it to.

### The guard's real cost, measured rather than assumed

The full unit suite caught this, and it is worth recording in full rather than as a test tweak. `concurrent-shared-pool.test.ts` began failing with a **correct** `PoolInsufficientError`: it draws 10 questions from unit *Mechanics & Rotational Dynamics*, which holds 19 published rows — but only **5 distinct families**. Inspected the actual rows before touching anything:

```
[8x] family 347c4de8…
   A solid sphere of mass M = 10.0 kg and radius R = 0.20 m rolls … at speed v = 10.0 m/s. What is its total …
   A solid sphere of mass M = 14.0 kg and radius R = 0.20 m rolls … at speed v = 25.0 m/s. …
   A solid sphere of mass M =  6.0 kg and radius R = 0.20 m rolls … at speed v = 30.0 m/s. …            (+5 more)

[8x] family 5910b00a…
   In System of Particles and Rotational Motion, a parameter of magnitude 74.0 units is coupled with factor 5.0. …
   In System of Particles and Rotational Motion, a parameter of magnitude 84.0 units is coupled with factor 3.0. …  (+6 more)
```

The second family is generator filler and collapsing it is obviously right. The first is the genuinely hard case migration 030 flagged — legitimate numeric drill variants that *should* both exist in the bank. **They should not both appear in one 10-question test**, which is exactly the "repeating questions" complaint Defect 5 opens with. So the guard is behaving correctly and the fixture had become an over-ask.

**Checked that this does not break any real test mode before accepting it** — measured usable families per subject against the full mock's 45-per-subject requirement:

```
BOT    published   87   usable families   87   full-mock(45): OK
CHEM   published  136   usable families   93   full-mock(45): OK
PHY    published  294   usable families  178   full-mock(45): OK
ZOO    published   83   usable families   83   full-mock(45): OK
```

Full mock and subject-wise are unaffected. The reduction only bites on **narrow unit scopes**, where the pool was already thin (several units hold 1-2 published questions regardless of this guard). For a student, that case now produces Defect 6's banner and dialog instead of a raw error — the two fixes meeting where they should.

The fixture was fixed by **deriving** its count from the live pool (same expression `LINE_AVAILABLE_SQL` uses, null-skeleton fallback included) rather than re-hardcoding a smaller number, so it keeps proving its real property and will not silently break again when content changes on either side.

### Verified

- `db/assess/test/generation/assemble.test.ts` — 7/7 passing after the change (no duplicates within a paper, pickCount respected, two assemblies differ, structured insufficiency, no answer-key leakage, overlapping-scope lines never collide).
- `db/assess/test/attempt/concurrent-shared-pool.test.ts` — passing again after the fixture fix above.

---

## Defect 4 — stale "not enough questions" state

**The root cause the spec predicts does not exist in this codebase.** Grepped for module-level mutable state in `frontend/src`: the only four hits are unrelated auth/profile caches (`demoSession.ts`, `googleOneTap.ts`, `meApi.ts` ×2). There is no assembler-diagnostics singleton to leak.

Rather than treat that as "nothing to do", the new diagnostics were built so the bug is **structurally impossible**, two ways at once:

1. They live in `TestListView`'s own component state — unmounting the screen throws them away.
2. `QuestionAvailabilityBanner` still refuses to paint unless `availability.configHash === currentConfigHash`, checked at render, at the last possible moment. Even if a caller forgot to clear its state, a stale banner cannot appear.

Cleared explicitly on every transition the spec lists (config-screen mount, mode change, navigating away from a builder) via the `view` effect. Covered by the test *"renders nothing when the config on screen is not the one that was measured"*.

---

## Defect 6 — the "not enough questions" notification ← **the user's headline ask**

### Backend

| File | What |
|---|---|
| `db/assess/test/generation/availability.ts` | `checkAvailability()` — the pre-flight pool check |
| `backend/src/controllers/sessionController.ts` | `getAvailability` |
| `backend/src/routes/assess.routes.ts` | `POST /assess/availability` |
| `db/assess/test/generation/availability.test.ts` | 6 assertions against the live bank |

**The one rule that makes it worth building:** the number must come from the same predicate the assembler will actually run. `availability.ts` therefore *imports* `LINE_CANDIDATE_SQL` and `LINE_AVAILABLE_SQL` from `assemble.ts` — same joins, same lifecycle filter, same `content_fp` clone dedup, same `skeleton_fp` family guard, same running cross-line exclusion. It is literally the same string, so the two cannot drift. It walks the lines in the same order with the same accumulating exclusions, so two lines over one unit can't both claim the whole pool.

It routes through the same `toLines()` that `createSession` uses, so a mode's blueprint cannot differ between "what we told you was available" and "what we will try to build".

**Two documented deviations from the spec, both deliberate:**

1. **`POST` instead of `GET …?configHash=`.** A GET keyed only by a hash needs a server-side store mapping hashes back to configs — a new stateful surface built purely to satisfy a URL shape. This POSTs the config itself, on the same schema `createSession` validates against, and returns the canonical `configHash` the server computed *from the config it really measured*. The client compares that to the config on screen before rendering. That is the guarantee Defect 4 actually asks for, and it is stronger this way: the hash is never asserted by the client.
2. **`EXCLUDED_RECENTLY_ATTEMPTED` is defined but never emitted.** This app's anti-repeat policy (D-2) is a *soft sort*, never a hard exclusion — a previously-seen question is deprioritised but always still eligible. Nothing is ever excluded for having been attempted recently, so a truthful check can never attribute a shortfall to it. The code stays in the union so the contract matches the spec and so the reason is already wired end to end the day a hard window is introduced. This is stated in the module, not hidden.

### Frontend

| File | What |
|---|---|
| `frontend/src/components/ui/QuestionAvailabilityBanner.tsx` | Inline, persistent, `role="status"` / `aria-live="polite"`, collapsed to one line, expandable |
| `frontend/src/components/ui/InsufficientQuestionsDialog.tsx` | **The dialog box the user asked for** — `role="alertdialog"`, focus trapped, focus returned to the Start button |
| `frontend/src/pages/TestListView.tsx` | 300 ms debounce, configHash scoping, and the blocking Start gate |
| `frontend/src/services/sessionApi.ts`, `frontend/src/types/index.ts` | `checkAvailability()` + types |
| `frontend/src/components/ui/QuestionAvailability.test.tsx` | 10 assertions |

Copy is the spec's, verbatim, with the numbers substituted:

> **Not enough questions for this test**
> You asked for 90 questions. Only 74 are available with these settings.
> *Show details*
>
> Electrostatic Potential and Capacitance — 6 of 15 available
> Ray Optics — 0 of 10 available (no questions with a usable image)

**Where the dialog appears in the demo:** Test Directory → *Subject-wise Practice* or *Custom Mock Builder* → pick a narrow unit and a large question count. The banner appears ~300 ms after the last change; pressing Start opens the blocking dialog with **Build with N** / **Change settings** / **Cancel**. A Full Mock Test that cannot meet its blueprint shows the same dialog **without** *Build with N* — a blueprint is never silently reduced.

**Hard rules, enforced:**

- `launchGuarded()` runs the availability check as a **final blocking check on Start**, even when the debounced check already ran, because the pool can change between screens. There is no code path that starts a short test without an explicit tap.
- Never pads with repeats — the assembler physically cannot (that is Defect 5's guard).
- Never fires mid-attempt: `/assess/availability` is not on the B8 attempt-lockdown allowlist, so it is `423`-refused while an attempt is in progress, which is the correct behaviour.
- A failed availability probe drops the banner rather than showing a count no longer trusted; the server's `PoolInsufficientError` remains the final backstop.

### Verified live

```
✔ a satisfiable config reports zero shortfall and no per-unit rows
✔ an unsatisfiable config reports the real post-dedup number, not the raw row count
✔ availability equals what the assembler really delivers        <- the parity check
✔ configHash is stable for the same config and differs when the config differs
✔ two lines over the same scope do not both claim the whole pool
```

The parity check is the important one: it asks availability for a number, then asks the **real assembler** to build exactly that many. An inflated count throws `PoolInsufficientError`; a deflated one returns more than promised. Equality is asserted, not a bound.

---

## Defect 2 — debug output in the test console

**Did not reproduce.** Verified rather than assumed:

- `grep -rn "console\.log" frontend/src` → **0 results**, repo-wide. The only `console.*` calls in the frontend are `console.error` on genuine failures.
- Answer keys never reach the client: `db/assess/test/attempt/envelope.ts:148` — *"option_id/label/text ONLY — is_correct is never selected"* — and the existing live test *"no answer-key leakage in an assembled, unsubmitted envelope"* passes.
- The three server-side `console.warn`/`console.error` calls in `db/assess/test/attempt/` are Node-process operational logs, not the browser console the spec is about, and carry no question content or answer keys.

**Deliberate decision, not an omission:** the spec asks for a debug-flag-gated logger. Adding one with nothing to log would be dead code that itself becomes the risk. The fix shipped instead is `frontend/src/test/testRuntimeLogging.test.ts`, which fails the moment a `console.log`/`debug`/`info`/`table`/`dir` is added back to any exam-runtime file — which is the acceptance criterion the spec actually names, made permanent.

---

## Defect 3 — pause / exit controls and the paused-attempt flow

Most of this was already built by the earlier passes and was re-verified rather than rebuilt: the server-side state machine (`in_progress` / `paused` / `submitted` / `abandoned`, migration 018 + C1), server-persisted `remaining_seconds` and pause/resume, full snapshot restoration of answers/flags/time/current-index on resume (C4), the 60 s expiry sweeper (C3), the browser-Back guard (B1), and the server-side API lockdown (B8).

### What was genuinely missing, and is now fixed

`handleExitAndPause` used a **native `confirm()`** — a two-way yes/no about *pausing only*. A student who actually wanted to finish had to cancel out and hunt for Submit, and a native dialog cannot be translated, styled, or tested. Replaced with a real dialog offering the spec's three choices — **Submit and exit** / **Save and exit** / **Cancel** — non-dismissible by backdrop click or Escape, because a stray click during a live exam must not resolve a decision about the student's attempt.

The browser-Back handler (B1) now opens that same dialog instead of resolving the attempt itself; it still re-pushes history *immediately*, before the student chooses, so a second Back press cannot escape the exam while the dialog is open. Its test was updated to assert the new behaviour, including that **nothing is paused or abandoned until a choice is made**.

### Deviation, flagged rather than silently applied

The spec says the header shows **exactly two** buttons, `Pause` and `Exit`, and to remove anything else. This app keeps **Submit** alongside **Exit & Pause** in the footer. That Submit control was added deliberately by an earlier fix (BUG-10: "Submit must stay reachable without opening the palette"), and removing it would be a regression, not a cleanup. Every path the spec requires still exists — Exit's dialog now carries *Submit and exit*, *Save and exit* and *Cancel* — so the spec's actual behaviour is satisfied without deleting a control a previous pass added on purpose. Raising it here rather than deciding it silently.

### Paused attempts in View Results (Session 2)

The remaining half of Defect 3. Before this, a paused row's only action was a **View** button *disabled* with the tooltip "Available once scored" — the student could see the test existed and had no way to act on it from this screen at all.

| File | What |
|---|---|
| `frontend/src/pages/PausedAttemptPanel.tsx` | The partial-state screen: answered / unanswered / marked-for-review counts, time left, a progress bar, **Resume Test** primary and **Submit now** secondary |
| `frontend/src/pages/MyResultsView.tsx` | A **Resume** button directly on each paused row, and `View` now routes a paused attempt to the panel instead of the scored report |
| `frontend/src/services/sessionApi.ts` | `resumeSessionById()` |
| `frontend/src/App.tsx` | `enterResumedSession()`, now shared by both resume entry points |
| `frontend/src/pages/MyResultsView.test.tsx` | 8 assertions |

Two entry points, each doing exactly what its label says: **Resume** on the row goes straight back into the test for a student who already knows they want to carry on; **View** opens the panel for one who wants to see where they left off first. Full scoring UI stays gated to `scored`, per the spec.

**Three things worth recording, because each was a decision rather than a detail:**

1. **Opening the panel never resumes the attempt.** `getEnvelope` deliberately freezes the clock at `paused_at` for a paused attempt (`envelope.ts`'s `referenceNowMs`), so checking your own progress costs none of your remaining time. Asserted directly — the test proves `resumeAttempt` is *not* called when the panel opens, not merely that the counts render.
2. **`resumeSessionById` re-reads state from the server before deciding to resume**, rather than trusting the list row that rendered the button. `resumeAttempt` throws `InvalidStateTransitionError` on anything that is not `paused` (`attempt-flow.ts:452`), and a results list is easily seconds stale — the attempt may have been resumed in another tab or closed by the expiry sweeper since it was fetched.
3. **`enterResumedSession` was extracted, not copied.** The portal's existing "Resume Test" prompt carries a `requestFullscreen()` call that exists because of a real past regression (B6: resuming bypasses `LobbyView`, the only place fullscreen was ever requested, and students hit a "must be fullscreen" overlay they could not clear — reported live as "can't resume the test"). A second copied resume path would have been the obvious place for that call to go missing. Both paths now share one function.

**Submit now** asks for confirmation and names what will be skipped before committing, since submitting is irreversible and easy to hit by accident on a test the student meant to return to. After it succeeds the list refetches, so the row stops claiming to be paused and View/Download unlock on it.

---

## Duplicate buggy logic — the note the spec asks for

The spec predicted "likely duplication between the test player and the PDF/print path". **Checked; it does not exist here.** `frontend/src/services/pdfExport.ts` is an `html2canvas`/`jsPDF` capture of the already-rendered results page — it never renders question stems itself, so there is no second copy of the stem-rendering logic to fix. Confirmed by grep: zero `stem` references in that file.

The real duplications found were different, and are recorded because they matter more:

1. **Two independent normalizers/strippers, by design, in two languages.** `db/shared/normalizeStem.ts` ↔ `content.fn_normalize_stem`, and now `db/shared/questionArtifacts.ts` ↔ `content.fn_strip_question_artifacts`. This is deliberate (the DB needs it for the trigger and the backfill; TypeScript needs it for the importer), and it is the pre-existing convention here. Both pairs are held together by tests that compare them across **every real row in the bank**, not fixtures alone.
2. **A third copy of the artifact patterns** now lives in `frontend/src/utils/questionText.ts`, because `frontend/` builds through Vite and does not import from `db/`. Called out in that file's header with an explicit "change one, change the other".
3. **Availability vs. the assembler — the duplication that was deliberately *avoided*.** The obvious implementation of Defect 6 would have been a second "count the rows in this unit" query. That is precisely what makes the notification lie. `availability.ts` imports the assembler's own SQL constants instead.

---

## Verification (whole pass)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run build` | clean (frontend + backend bundle; only pre-existing chunk-size warnings) |
| Vitest | **69/69** (up from 44 — 10 availability UI, 7 runtime-logging guards, 8 paused-attempt/Resume, 2 popstate tests rewritten) |
| `node:test` | **123/123** (was 82 before this pass — +41 new assertions). First full run was 122/123; the one failure was the family-guard finding under Defect 5, fixed, and the re-run is green |
| Migration 036 | applied live, `verify_036` passed, re-run produced zero changes |
| Write-time guard | proven live to reject an artifact-bearing update (rolled back) |

---

## Still open

- **The 92 flagged template-family questions** — need a subject expert. `db/scripts/report-template-family-questions.ts` produces the list; nothing should be deleted automatically.
- **Image mode's `has_valid_image`** — the spec wants a resolved HEAD/existence check cached at import time. Migration 028 makes `has_image` trigger-maintained from real `content.asset` rows (a genuine improvement over the old manual flag), but it still does not prove the asset *fetches*. Flagged, not claimed as done.
- **200-seeds-per-mode soak** — the spec's "run each of the four modes 200 times". Each assembly is a live multi-query DB round trip against a shared 4-connection pool; 800 of them is a soak run, not a unit test. The invariants are asserted per-assembly instead (`assemble.test.ts` + the availability parity test). `db/scripts/assembler-verify.ts` is the right harness if a real soak is wanted.

---

## Session log

### Session 1 (2026-08-31)
- Read the pasted spec in full; saved it verbatim as `docs/test-engine-fix-prompt.md` and opened this tracker. Confirmed the user's added requirement — an in-app dialog box for insufficient questions, demo-ready — and treated Defect 6 as the pass's headline deliverable.
- **Audited all six defects against live code and live data before fixing anything**, per the spec's own ordering. Three of the six (2, 4, and most of 3 and 5) turned out to be already addressed by earlier directives in this repo; each was re-verified with fresh evidence (greps, live queries, a live guard rejection) rather than either assumed done or rebuilt from scratch.
- **Defect 1 landed and verified live.** Found 27 mid-stem artifacts the spec's own regex did not cover, and found that the spec's suggested bare-`n_n` pattern would have mangled real decimals — narrowed it, with a live query proving nothing is lost. Dry run before applying, migration applied, verify passed, re-run proved idempotence, write-guard proven to reject.
- **Found and recorded the cross-defect causation**: Defect 1 *was* the surviving cause of Defect 5. Template variants hashed differently while the tag sat in the stem, so the assembler's content dedup correctly admitted both. Stripping collapsed 643 published rows to 600. Recorded rather than presented as two independent fixes.
- **Found that the spec's own quality-report design returns a misleading zero on this bank** (catalog holds composite unit titles; stems interpolate chapter names). Added a second catalog-independent detector rather than reporting the zero — it finds 92 questions in 26 real template families.
- **Defect 5's template-family guard added**, scoped to one paper rather than to the bank, so migration 030's deliberate decision not to enforce `skeleton_fp` bank-wide stays intact. `assemble.test.ts` 7/7 after the change.
- **Defect 6 built end to end** — endpoint, banner, blocking dialog, debounce, configHash scoping, Start gate — with the availability count proven equal to what the assembler really delivers, not merely plausible.
- **Defect 3's Exit dialog** replaced a native `confirm()`; the B1 popstate test was rewritten to assert the new flow, including that nothing is paused until the student chooses. Flagged the "exactly two buttons" deviation rather than deleting a Submit control an earlier fix added on purpose.
- **Defect 2 closed as verified-not-reproduced**, with a standing test rather than a dead debug logger.
- **The full unit suite caught a real consequence of the family guard, and it was investigated rather than worked around**: `concurrent-shared-pool.test.ts` failed with a correct `PoolInsufficientError`. Inspected the actual rows, confirmed the guard was right (8 near-identical rolling-sphere variants + 8 generator-filler variants collapsing to 2 usable questions), then **measured whether it broke any real mode before accepting it** — full mock and subject-wise are unaffected on every subject. Fixed the fixture by deriving its count from the live pool instead of re-hardcoding a smaller number. Full detail under Defect 5 above, deliberately recorded as a finding rather than buried as a test tweak.

### Session 2 (2026-08-31)
- User asked for "a resume button for paused tests in the view results" — the exact item Session 1 left open under Defect 3. Built it as the spec describes rather than as a bare button: a **Resume** action on each paused row *plus* the partial-state screen `View` now routes to, with Resume primary and Submit now secondary.
- **Checked the resume mechanics before writing a second path to them** and found the portal's existing resume carries a `requestFullscreen()` call that only exists because of a past live regression (B6). Extracted `enterResumedSession` so both entry points share it, instead of copying a path where that call could quietly go missing.
- **Made the panel provably non-destructive**: opening it reads the envelope, which freezes a paused attempt's clock at `paused_at`, so looking at your progress costs no time. The test asserts `resumeAttempt` is never called on open, rather than just asserting the counts render.
- **Guarded against a stale list row**: `resumeSessionById` re-reads the attempt's state from the server before deciding whether to transition, because `resumeAttempt` throws on anything not `paused` and a results list can be seconds behind reality (resumed in another tab, or closed by the sweeper).
- **Verified**: `tsc --noEmit` clean; `npm run build` clean; Vitest **69/69** (up from 61). No backend or DB change, so the `node:test` suite was not re-run — nothing it covers was touched.
