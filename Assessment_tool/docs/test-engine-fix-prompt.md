# Test Engine Fix Spec

> Source directive for this pass, kept verbatim as provided by the user on 2026-08-31.
> Running tracker: `docs/TEST_ENGINE_FIX_TRACKER.md`.
>
> **Added by the user on top of the spec below:** "give a notification in the app like a dialog box —
> *not sufficient questions for test building* — for the show." That is Defect 6, and it is the
> headline deliverable of this pass.

---

## Role

You are working on an existing exam/mock-test application (question bank + test player + results). Fix the five defects below. Locate the relevant modules yourself, propose a diff per file, and add tests. Do not refactor unrelated code.

---

## Defect 1 — Template artifacts leaking into question text

### Symptom

Questions render like:

```
Which fundamental physical principle governs the conservation laws in
Electrostatic Potential and Capacitance (case #5_0)?
```

`case #5_0` is a **generator/template identifier**, not part of the question. The same tag appears across many questions with different numbers (`#3_1`, `#5_0`, `#12_2`). The unit name is also being appended to the stem.

### Root cause to verify

Somewhere in the question generation or import pipeline, the stem is being built by string concatenation:

```
question_text = base_stem + " (case #" + template_index + "_" + variant_index + ")"
question_text = question_text + " — " + unit_name
```

Find every place this concatenation happens. There may be more than one (generator, importer, PDF exporter, API serializer).

### Required changes

1. **Never concatenate metadata into the stem.** Keep them as separate fields on the question record:

   ```json
   {
     "id": "q_84213",
     "question_text": "Which fundamental physical principle governs the conservation laws in electrostatics?",
     "template_case_id": "5_0",
     "unit_id": "phy_u02",
     "unit_name": "Electrostatic Potential and Capacitance",
     "subject": "Physics"
   }
   ```

2. **The word `case` and its identifier must never appear on any user-facing surface.** Not in the stem, not as a subtitle, not as a chip or badge, not in a tooltip, not in an aria-label, not in the PDF or print view, not in results or review screens. It is internal metadata only — visible in admin tooling and debug builds and nowhere else. Do not "move it somewhere less intrusive"; remove it from the user-facing layer entirely.

3. **Backfill existing rows.** Write a one-time migration that strips the artifacts from stored `question_text` and moves them into the metadata fields. Strip patterns (apply repeatedly until no match, then trim):

   ```regex
   # trailing tag, with or without the word "case":
   #   "... (case #5_0)"  "... [case 5_0]"  "... case#5_0"  "... (#5_0)"  "... 5_0"
   /\s*[\(\[]?\s*(?:case\s*)?#?\s*\d+[_\-.]\d+\s*[\)\]]?\s*(?=[?.:]?\s*$)/i

   # trailing unit-name suffix:  "... — Electrostatic Potential and Capacitance"
   /\s*[—–\-|:]\s*(<UNIT_NAME_LIST>)\s*$/i
   ```

   Build `<UNIT_NAME_LIST>` dynamically from the units table — do not hardcode unit names.
   The migration must be idempotent and must log a before/after sample of 20 rows for manual review before committing.

4. **Add a write-time guard.** Reject any insert/update where `question_text` matches the artifact regexes. Throw a validation error naming the offending question id.

5. **Fix the display layer too**, but only as defence in depth — sanitising on render while the DB stays dirty is not an acceptable fix on its own.

### Acceptance criteria

- The word `case` does not appear on any user-facing screen or export, in any form.
- No rendered question anywhere (test player, review screen, results, PDF export, print view) contains `case #`, a bare `n_n` tag, or a trailing unit name.
- Re-running the migration produces zero changes.
- Unit tests cover: trailing tag with parens, without parens, with brackets, tag before the `?`, unit name suffix, and a clean stem that must be left untouched.

### Related quality issue (flag, do not silently fix)

The example question is vague — "which fundamental principle governs the conservation laws in <unit name>" is a template that produces near-meaningless items. After the artifact fix, output a report of all questions whose stem is generated from a template with the unit name interpolated, so a subject expert can review them. Do not delete them automatically.

---

## Defect 2 — Debug output in the test console

### Symptom

Case ids, template indices, and assembler internals are printed to the browser/app console during a live test.

### Required changes

1. Remove every `console.log` / `print` / equivalent in the test-runtime path that emits question ids, case ids, answer keys, or assembler diagnostics.
2. Where logging is genuinely useful, route it through a single logger gated on an explicit debug flag that is **off in production builds**:

   ```ts
   // logger.ts
   const DEBUG = process.env.NODE_ENV !== 'production' && process.env.TEST_ENGINE_DEBUG === '1';
   export const log = (...args: unknown[]) => { if (DEBUG) console.debug('[test-engine]', ...args); };
   ```

3. **Answer keys must never reach the client console or client state before submission.** Audit the payload the test player receives; if it contains `correct_option`, strip it server-side for in-progress attempts.

### Acceptance criteria

- Production build with the console open through a full test attempt produces no `[test-engine]` output and no question metadata.
- Grep for `console.log` in the test runtime returns zero results.

---

## Defect 3 — Pause / Exit controls and the paused-attempt flow

### Required UI

The test header shows **exactly two** action buttons: `Pause` and `Exit`. Remove any other controls currently sitting there.

### State machine

```
NOT_STARTED ──start──> IN_PROGRESS ──pause──> PAUSED ──resume──> IN_PROGRESS
                            │                    │
                            └──submit──> SUBMITTED ──> RESULTS
                                                 ▲
                            PAUSED ──submit/abandon┘
```

An attempt is in exactly one state. Persist state server-side (or in durable local storage if offline-first), never only in component state.

### Pause

- Freeze the timer immediately and persist `remaining_seconds` (store remaining, not elapsed — avoids clock-skew bugs on resume).
- Snapshot and persist: `attempt_id`, ordered `question_ids`, `answers` map, `marked_for_review` set, `current_index`, `remaining_seconds`, `paused_at`.
- Navigate the user out of the player. The attempt now appears in the test list with a `Paused` badge.

### Exit

- Show a confirmation dialog with three choices: `Submit and exit`, `Save and exit` (→ `PAUSED`), `Cancel`.
- `Exit` must never discard answers silently.

### Resume

- Primary action on a paused attempt. Restores the **exact** snapshot: same question order, same answers pre-filled, same marked-for-review flags, same `current_index`, timer resuming from stored `remaining_seconds`.
- Resuming must **not** re-run the assembler. Load `question_ids` from the snapshot.

### View Results on a paused attempt

- `View Results` on an attempt in `PAUSED` state routes to that paused attempt, not to a completed-results screen. Show the partial state (attempted / unattempted / marked counts) with `Resume` as the primary CTA and `Submit now` as secondary.
- Full scoring UI is only reachable from `SUBMITTED`.

### Acceptance criteria

- Pause → close app → reopen → Resume restores every field listed above, with timer within ±2s of the paused value.
- Pause → Resume → Pause → Resume does not duplicate, reorder, or drop questions.
- Killing the app without pausing leaves a recoverable attempt (autosave the snapshot at least every 10s and on every answer change).

---

## Defect 4 — "Not enough questions" state leaking into other tests

### Symptom

When a unit has insufficient questions, the warning/unit badge is shown — and then it **keeps showing on a different test** the user opens afterwards, as if that unit were part of the new test.

### Root cause to verify

The diagnostics are held in a module-level singleton / global store keyed globally (e.g. `store.insufficientUnits = [...]`) instead of being scoped to a specific test configuration, and nothing clears it on navigation.

### Required changes

1. Scope every assembler diagnostic to the attempt it came from:

   ```ts
   type AssemblyDiagnostics = {
     configHash: string;      // hash of {mode, subjects, units, counts, filters, seed}
     attemptId: string | null;
     insufficientUnits: { unitId: string; requested: number; available: number }[];
     duplicatesDropped: number;
   };
   ```

2. The UI reads diagnostics **only** when `diagnostics.configHash === currentConfigHash`. Any mismatch renders nothing.
3. Clear diagnostics on: test-config screen mount, mode change, attempt start, attempt submit, and navigation away from the player.
4. Same treatment for any other shared assembler state (last seed, last question pool, last subject filter).

### Acceptance criteria

- Configure a test that triggers the insufficiency warning → back out → start an unrelated test → no warning, no stale unit chips.
- Automated test: assemble config A (insufficient), then config B (sufficient); assert `diagnostics.insufficientUnits` is empty for B.

---

## Defect 5 — Assembler is broken across all four test modes

### Symptom

Full mock test, subject-wise test, image test, and custom test all produce **repeating questions**.

### Root cause to verify

Likely one or more of: sampling with replacement; per-subject or per-unit pools sampled independently and then concatenated without a global seen-set; near-duplicate template variants (`5_0`, `5_1`, `5_2` of the same stem) counted as distinct; retries after a failed quota re-adding already-picked items.

### Single shared assembler

Replace the four separate code paths with one assembler that takes a config and returns a question list. Mode differences are expressed in the config, not in forked logic.

```ts
type Mode = 'full_mock' | 'subject_wise' | 'image' | 'custom';

interface AssemblyConfig {
  mode: Mode;
  seed: string;                 // deterministic; store on the attempt
  quotas: Quota[];              // per subject/unit/difficulty
  filters: {
    requireImage?: boolean;     // image mode
    subjects?: string[];
    units?: string[];
    difficulty?: ('easy'|'medium'|'hard')[];
    excludeAttemptedWithinDays?: number;
  };
  totalCount: number;
  allowShortfall: boolean;      // false => fail loudly instead of padding
}

interface Quota { subjectId?: string; unitId?: string; difficulty?: string; count: number; }
```

### Algorithm (implement exactly this shape)

```
function assemble(config, bank):
    rng   = seededRng(config.seed)
    seen  = new Set()            # canonical content hashes
    picked = []
    diagnostics = { insufficientUnits: [], duplicatesDropped: 0 }

    # 1. Build the eligible pool ONCE, globally filtered
    pool = bank.filter(q => matchesFilters(q, config.filters))

    # 2. Process quotas largest-constraint-first so scarce units get served first
    for quota in sortByScarcity(config.quotas, pool):
        candidates = shuffle(pool.filter(q => matchesQuota(q, quota)), rng)
        taken = 0
        for q in candidates:
            h = canonicalHash(q)
            if seen.has(h):                     # global dedup across ALL quotas
                diagnostics.duplicatesDropped++
                continue
            seen.add(h)
            picked.push(q)
            taken++
            if taken == quota.count: break

        if taken < quota.count:
            diagnostics.insufficientUnits.push({
                unitId: quota.unitId, requested: quota.count, available: taken
            })
            if not config.allowShortfall: throw InsufficientQuestions(diagnostics)
            # NEVER pad by reusing a picked question

    # 3. Final safety net
    assert picked.length == new Set(picked.map(q => q.id)).size
    return { questions: shuffle(picked, rng), diagnostics }
```

### Canonical hash — this is the key fix

Two questions are duplicates if their **normalised stem + normalised option set** match, even when their ids differ. This catches template variants like `case #5_0` / `#5_1` that were previously slipping through as distinct rows.

```ts
function canonicalHash(q: Question): string {
  const norm = (s: string) =>
    s.toLowerCase()
     .replace(/\s+/g, ' ')
     .replace(/[^\w\s]/g, '')   // punctuation-insensitive
     .trim();

  const stem    = norm(q.question_text);
  const options = q.options.map(o => norm(o.text)).sort().join('|');
  return sha256(`${stem}::${options}`);
}
```

Also add a **template-family guard**: never pick more than one question sharing the same `template_id`, regardless of variant index.

### Mode-specific requirements

- **Full mock** — quotas follow the official blueprint (subject counts, unit weightage). Assert the total matches the blueprint exactly before starting the attempt.
- **Subject-wise** — filter to one subject; distribute across that subject's units proportionally to unit weightage, not evenly.
- **Image test** — `requireImage: true` must check the image asset actually **resolves** (non-null URL and a successful HEAD/existence check at import time, cached as `has_valid_image`), not merely that an `image_url` column is non-empty. Broken images are the usual cause of short pools here.
- **Custom test** — respect every user filter. If filters yield fewer than the requested count, show the shortfall in the config screen **before** the test starts, with the exact available number, and let the user reduce the count or widen filters. Never silently start a short test.

### Persistence

Store `seed` and the resolved `question_ids` on the attempt at creation. Every later load (resume, review, results) reads that stored list — the assembler is never re-run for an existing attempt.

### Acceptance criteria

- Run each of the four modes 200 times with different seeds; assert zero duplicate ids and zero duplicate canonical hashes within any single assembled test.
- Same seed + same config produces an identical question list.
- A config that cannot be satisfied fails with a clear, unit-level message instead of padding with repeats.
- Image mode returns only questions whose image actually loads.

---

## Defect 6 — "Not enough questions" notification during test building

Right now a shortfall is either silent or surfaces as a stale badge (see Defect 4). Build a proper notification.

### When it fires

Run an availability check at three points:

1. **Live on the config screen**, debounced 300ms after any change to mode, subject, unit, difficulty, count, or filters.
2. **On Start**, as a final blocking check (the pool can change between screens).
3. **Never mid-attempt.** An in-progress test uses its stored `question_ids` and must never show this.

### Availability must be counted after dedup

Counting raw rows makes the notification lie — template variants (`5_0`, `5_1`, `5_2`) collapse to one usable question. The availability endpoint must apply the same `canonicalHash` and template-family rules as the assembler, then return the surviving count.

```ts
GET /api/availability?configHash=...

{
  "configHash": "a91f…",
  "requested": 90,
  "available": 74,
  "shortfall": 16,
  "byUnit": [
    { "unitId": "phy_u02", "unitName": "Electrostatic Potential and Capacitance",
      "requested": 15, "available": 6, "reason": "POOL_TOO_SMALL" },
    { "unitId": "phy_u07", "unitName": "Ray Optics",
      "requested": 10, "available": 0, "reason": "NO_VALID_IMAGE" }
  ]
}
```

Reason codes: `POOL_TOO_SMALL`, `FILTERED_OUT_BY_DIFFICULTY`, `EXCLUDED_RECENTLY_ATTEMPTED`, `NO_VALID_IMAGE`, `UNIT_NOT_PUBLISHED`.

### Presentation

**Inline banner** on the config screen while a shortfall exists. Warning styling, persistent — not a toast, since an auto-dismissing toast is exactly the thing a user misses. Collapsed by default to one line, expandable to the per-unit breakdown.

Copy (use these strings verbatim, substituting the numbers):

> **Not enough questions for this test**
> You asked for 90 questions. Only 74 are available with these settings.
> *Show details*

Expanded rows, one per short unit:

> Electrostatic Potential and Capacitance — 6 of 15 available
> Ray Optics — 0 of 10 available (no questions with a usable image)

Reason text per code:

| Code | Text shown |
|---|---|
| `POOL_TOO_SMALL` | *(none — the "6 of 15" line says it)* |
| `FILTERED_OUT_BY_DIFFICULTY` | no questions at the selected difficulty |
| `EXCLUDED_RECENTLY_ATTEMPTED` | remaining questions were attempted recently |
| `NO_VALID_IMAGE` | no questions with a usable image |
| `UNIT_NOT_PUBLISHED` | unit not available yet |

**Blocking dialog** if the user presses Start while short. Title: *Not enough questions*. Body repeats the summary line. Three actions:

- `Build with 74` — primary. Rewrites the config to the available count and starts. Only offered when `available > 0`.
- `Change settings` — dismisses back to the config screen.
- `Cancel` — closes.

If `available == 0`, drop the first action and show: *No questions match these settings. Try removing a filter or selecting more units.*

### Hard rules

- **Never start a test silently short.** Either the user explicitly accepts the reduced count, or the test does not start.
- **Never pad with repeats** to hit the requested number. This is the behaviour that produced Defect 5.
- The banner is scoped to `configHash` and cleared exactly as specified in Defect 4 — it must not survive navigation to a different test.
- Full mock mode is stricter: a blueprint cannot be silently reduced. Show the blocking dialog with `Change settings` and `Cancel` only, and log an admin-visible alert that the bank can no longer satisfy the blueprint.

### Accessibility

Inline banner: `role="status"` with `aria-live="polite"`, so it announces on change without interrupting typing. Blocking dialog: `role="alertdialog"`, focus trapped, focus returns to the Start button on close.

### Acceptance criteria

- Requesting more questions than exist shows the banner within ~300ms of the last keystroke, with correct post-dedup counts.
- Pressing Start while short always produces the dialog; there is no path that starts a short test without an explicit tap.
- `Build with 74` produces a test of exactly 74 distinct questions.
- Fixing the config (widening filters) clears the banner without a page reload.
- Navigating to a different test shows no banner.

---

## Deliverables

1. A per-file diff for each fix.
2. The backfill migration script plus its dry-run output sample.
3. Unit tests for: artifact stripping, canonical hashing/dedup, assembler determinism, diagnostics scoping, availability counts matching what the assembler actually produces, and pause/resume snapshot round-trip.
4. A short note listing any place where you found a second copy of the same buggy logic (there is likely duplication between the test player and the PDF/print path).

## Order of work

Fix in this order, since each one makes the next easier to verify: **1 → 5 → 4 → 6 → 2 → 3**.
Artifact stripping must land before the assembler work, because the canonical hash depends on clean stems. The notification (6) comes after the assembler and diagnostics scoping, because it reuses both — the availability count is meaningless until dedup is correct.
