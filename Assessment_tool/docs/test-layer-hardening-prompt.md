# LumenAcademy — Test Layer Hardening

**Working prompt for the coding agent. Scope: test layer only.**
Order of work is fixed: **Audit → Derive bugs → Derive test cases → Fix → Verify.** Do not fix anything before the audit and bug list are written down.

---

## 0. Scope and guardrails

**In scope**

- Test generation service (scope expansion, pool selection, section fill, anti-repeat)
- Test/attempt lifecycle: create → start → answer → pause → resume → submit → score
- Session lockdown and navigation control (frontend player + server-side guards)
- Test type definitions and their blueprints
- Question pool health: duplicates, eligibility, image availability
- Scoring and reconciliation against the marking scheme

**Out of scope for this pass** — do not touch, do not refactor, do not "improve while you're in there":

- Content importer and authoring flows
- Catalog / concept tree / syllabus mapping (read-only)
- Dashboard, analytics, mastery recompute (read-only, except where submit writes to it)
- RBAC beyond what the attempt endpoints need
- Any UI outside the test player

**Hard rules that override anything else in the codebase**

1. **No question appears twice inside one test.** Not across sections, not across groups, not via two eligibility paths.
2. **No custom or synthetic question generation. Ever.** The system may only draw from published, approved questions. It must never author, rephrase, mirror, or clone a question to fill a gap.
3. **If the pool is short, the test fails loudly.** No padding by reuse, no silent shrinking, no "close enough" substitution. Return a structured shortfall report naming the exact section, node, difficulty, and count that could not be satisfied.
4. **Once a test session starts, the only exits are Submit or explicit Exit.** No incidental navigation.
5. **No attempt is ever lost.** Every abnormal termination path resumes or auto-submits — never both, never neither.

Write these five as executable assertions, not as comments.

---

## 1. Phase 0 — Audit (read-only, no code changes)

Produce `AUDIT.md` answering each of these with file paths and line references. "I think so" is not an answer; cite the code or say **NOT FOUND**.

### 1.1 Repetition control

- Where is uniqueness enforced today — DB constraint, service logic, or nowhere?
- Confirm whether the constraint is `UNIQUE(test_section_id, question_id)` only. If so, **two sections of the same test can currently hold the same question.** Verify and state it plainly.
- Is there a `UNIQUE(test_id, question_id)` equivalent? If not, that is Bug #1.
- How is the anti-repeat window defined — per user, per exam, per node, per test type? What is the window length and where is it configured?
- How are grouped questions (comprehension sets, assertion-reason pairs, common-stem clusters) drawn? Whole-group or per-question? Can a group member leak into another section?
- What happens on regenerate/retry of a test that already has rows — are old rows cleared inside the same transaction?
- Is pool selection deterministic given a seed? If not, duplicate bugs will be unreproducible.

### 1.2 Pool sufficiency

- Is required count checked **before** the draw or discovered mid-fill?
- What is returned when the pool is short — exception, partial test, or padded test? Trace the actual code path.
- Is there any code path that relaxes filters on shortfall (drops difficulty constraint, widens node scope, ignores anti-repeat)? Silent relaxation is as bad as duplication. List every fallback.

### 1.3 Session flow

- Where does the attempt state machine live? Enumerate every state and every legal transition.
- Which server endpoints reject calls while an attempt is `IN_PROGRESS`? List them.
- Is the timer server-authoritative, or is client time trusted anywhere in scoring?
- Can one user hold two active attempts at once? Two devices? Two tabs?

### 1.4 Blueprint / weightage

- Does a blueprint table exist (`exam_subject_format` or similar)? What does it actually encode — subject counts only, or also unit weightage, difficulty mix, and question-type mix?
- Is NEET unit weightage stored as **data** or hardcoded in TypeScript? If hardcoded, that is a bug regardless of correctness.
- Is the marking scheme (+4 / −1, unattempted = 0) stored per exam or assumed globally?

### 1.5 Image questions

- How is an image attached — `question_asset` rows, block type in the v3 JSON, or inline URL?
- Is there a `has_image` flag? Is it **computed** from assets, or manually set (and therefore wrong)?
- Is image presence part of `v_question_eligibility`? Can a test currently draw a question whose asset URL is dead?

### 1.6 Test types

- Enumerate every test type the system supports today, and for each: scope rule, blueprint, duration, marking, anti-repeat policy, minimum pool.
- Is this table-driven config or a chain of `if (type === ...)`? If the latter, flag it — every new type will re-break the flow.

---

## 2. Phase 1 — Bug derivation

Produce `BUGS.md`. One row per bug: ID, area, severity (P0 blocks the demo / P1 wrong results / P2 degraded UX), reproduction steps, root cause, affected files, proposed fix, blast radius.

Hunt in these areas. These are leads, not a complete list — you are expected to find more.

### A. Repetition and pool integrity

- **A1** Same question in two sections of one test (missing test-level unique constraint).
- **A2** Same question eligible under two concept nodes → drawn once per node.
- **A3** Group draw double-counts: group counted as 1 toward section size but inserts 4 rows, blowing the section count or duplicating members.
- **A4** Concurrent generation: two requests for the same user draw overlapping pools; no row lock, no serializable transaction.
- **A5** Regenerate leaves orphan rows from the previous draw.
- **A6** Anti-repeat window compares against submitted attempts only, so an abandoned attempt burns nothing — or the reverse, burns questions the user never saw.
- **A7** **Duplicates at source** — the same question imported twice across batches with different IDs. Anti-repeat cannot catch this; two distinct IDs, identical stem. See §5.
- **A8** Shuffling applied after the uniqueness check rather than before.
- **A9** Random selection with replacement (`ORDER BY random()` without `DISTINCT`, or index-based picks that can collide).

### B. Session lockdown

- **B1** Browser back / forward / history manipulation escapes the player.
- **B2** Direct URL entry to any other route while an attempt is `IN_PROGRESS` succeeds.
- **B3** Refresh (F5) loses answers or, worse, starts a fresh attempt.
- **B4** Tab switch, window blur, minimise, or app switch is not detected or not logged.
- **B5** Second tab opens the same attempt and the two tabs race on save.
- **B6** Fullscreen exit (Esc) is not handled — user simply leaves fullscreen and browses.
- **B7** No `beforeunload` guard, or the guard is bypassable and there is no server-side equivalent.
- **B8** Server accepts non-test API calls (dashboard, profile, content browse) during an active attempt — client-side lockdown only is not lockdown.
- **B9** Mobile: notification pull-down, incoming call, or app background kills the session with no recovery.
- **B10** Deep links / push notifications navigate away mid-test.

### C. Pause, resume, and abnormal exit

- **C1** No distinction between **paused** (recoverable, timer frozen or still running per policy) and **abandoned** (past grace window).
- **C2** Timer state on resume: does remaining time recompute from server timestamps, or reset?
- **C3** Timer expiry while the client is offline — is there a server-side sweeper that auto-submits, or does the attempt hang forever in `IN_PROGRESS`?
- **C4** Resume does not restore: answered options, marked-for-review flags, current question index, per-question time spent.
- **C5** Double submit — user double-clicks, or client retries on timeout. Submit must be idempotent, keyed on attempt ID.
- **C6** Submit races with auto-submit; both write, scorecard is computed twice or mastery is double-incremented.
- **C7** Network drop mid-answer: is answer save optimistic, queued, or lost?
- **C8** Attempt stuck `IN_PROGRESS` blocks the user from ever starting a new test.
- **C9** Resume after the user's window has closed (e.g. scheduled test ended) — undefined behaviour.

### D. NEET blueprint and weightage

- **D1** Blueprint applied at subject level only; unit weightage ignored, so a "full mock" is a random 180 rather than an NTA-shaped 180.
- **D2** Weightage hardcoded in application code instead of a versioned table.
- **D3** No tolerance model — a blueprint that must be satisfied exactly will fail on almost every real pool; a blueprint with no bounds is decoration. Both are bugs.
- **D4** No deviation report: when the generator cannot hit the target mix, the user is not told how far off the paper is.
- **D5** Difficulty distribution and question-type distribution not modelled at all.
- **D6** Marking scheme assumed globally rather than read per exam/test type.
- **D7** Unit tests (single-unit scope) wrongly inherit the full-paper blueprint, or inherit nothing and lose sub-topic spread entirely.

### E. Image-based questions

- **E1** No reliable way to identify an image-bearing question.
- **E2** `has_image` set manually at import and drifting from actual assets.
- **E3** Broken or missing asset URLs are drawable — the student sees an empty box in a timed exam.
- **E4** Image questions render but do not zoom / do not fit mobile viewport / lose aspect ratio.
- **E5** Images load lazily during the test, so a slow network costs exam time.
- **E6** Diagram-dependent questions whose diagram lives in the *previous* question's block (group leakage) become unanswerable in isolation.

### F. Test types and scoping

- **F1** Scope expansion by `node_path` prefix picks up sibling nodes or misses leaves.
- **F2** A unit-scoped test silently pulls questions from outside the unit when the pool is short.
- **F3** Two test types share a config object by reference and mutate each other.
- **F4** Adding a type requires edits in more than one place.

---

## 3. Phase 2 — Test-case derivation

Produce `TEST-CASES.md`. Every case gets: ID, area, priority, preconditions (including exact seed data), steps, expected result, actual result, linked bug ID, automation status.

Derive cases in these buckets. Counts are floors, not targets.

| Bucket | Minimum cases | Must include |
|---|---|---|
| Repetition | 25 | Within-test, cross-section, cross-attempt, group draw, concurrent generation, regenerate, seeded determinism |
| Pool sufficiency | 15 | Pool exactly equal to requirement, one short, empty pool, short in one section only, short only at one difficulty |
| Session lockdown | 30 | Every escape route in §B, desktop and mobile, plus server-side rejection of each blocked endpoint |
| Pause / resume / recovery | 25 | Refresh, crash, offline, timer expiry offline, double submit, submit+autosubmit race, stale resume |
| Blueprint / weightage | 20 | Exact-fit paper, near-fit with deviation report, impossible blueprint, per-unit blueprint, marking scheme correctness |
| Image tests | 15 | Pool = 0 images, broken asset, group-leaked diagram, mobile render, slow network |
| Scoring | 15 | +4/−1/0 combinations, all unattempted, all wrong, partial, reconciliation against a hand-computed paper |
| Concurrency | 10 | Two tabs, two devices, simultaneous generate, simultaneous submit |

**Boundary cases to write explicitly** — these are where this kind of system actually breaks:

- Pool has exactly N questions and the test needs exactly N. Then N−1.
- Anti-repeat window would exclude every remaining question. (Correct behaviour: fail with a clear message, **not** repeat.)
- User submits with 0 seconds remaining.
- User submits while the auto-submit sweeper is mid-transaction.
- Last question of the last section is a group member.
- Every question in a unit is image-based. Then none is.
- Two students generate the same test type from the same node at the same millisecond.

---

## 4. Phase 3 — Fixes

Fix in priority order: **A (repetition) → B/C (session integrity) → D (blueprint) → E (image type) → F (config)**. Repetition first because a duplicate question in a live mock destroys trust faster than any other defect here.

Non-negotiables for the fix pass:

- Every fix ships with the failing test that proves it was broken.
- Schema changes go in numbered migrations, never in ad-hoc SQL.
- Selection, insertion, and constraint checks happen in **one transaction**.
- The generator takes an optional seed and is deterministic under it.
- Shortfall is a typed error carrying structured detail, surfaced to the user as: what was requested, what was available, which node/difficulty ran dry.
- Session lockdown is enforced on the **server** as well as the client. Client-side lockdown is UX; server-side is the actual rule.

### New: image-based test type

Add as a first-class test type, not a special case:

- Pool: every eligible published question in scope with at least one verified-reachable image asset.
- `has_image` becomes a **computed** column or view, derived from asset rows — never manually set.
- Add an asset-reachability check to eligibility. A question with a dead asset is not eligible, period.
- Group-aware: if the diagram belongs to a shared stem, draw the whole group or skip it.
- Same repetition and shortfall rules as every other type. No exceptions.
- If a scope has fewer image questions than requested, fail with the shortfall report and tell the user how many exist.

### Blueprint work

- Move NEET weightage into a versioned table (`blueprint`, `blueprint_section`, `blueprint_weight`) with an `effective_from` date. Never hardcode.
- Source the paper pattern (question counts, duration, marking) from the **official NTA information bulletin for the target year** and record the source in the table. Do not trust coaching-site reproductions, and do not trust the model's memory of the pattern — verify it against the bulletin before seeding.
- Unit weightage derived from historical papers is an estimate: store it with a confidence field and a tolerance band (e.g. target 8 questions, accept 6–10).
- The generator solves for the blueprint within tolerance and **always** returns a deviation report alongside the test, even on a perfect fit.
- Per-unit and per-chapter tests get their own blueprint rows (sub-topic spread, difficulty mix), not the full-paper one.

---

## 5. Reports to produce

### R1 — Pool health matrix (per unit, per subject)

One row per unit:

`unit | total questions | published+approved | unique after dedup | exact duplicates | near duplicates | image-based | image-based with reachable asset | max full mock contribution | shortfall vs blueprint target`

This single table answers most of the open questions: whether each unit has enough questions, whether it has image questions at all, and where the paper will fail to assemble.

### R2 — Duplicate report

Run these before any generator work. Table and column names below are best-guess from the current schema — correct them against the real schema first.

```sql
-- 5.1 Exact duplicates by normalised stem
WITH n AS (
  SELECT question_id,
         md5(regexp_replace(lower(coalesce(stem_text,'')), '[^a-z0-9]', '', 'g')) AS h
  FROM content.question
)
SELECT h, count(*) AS copies, array_agg(question_id ORDER BY question_id) AS ids
FROM n
GROUP BY h
HAVING count(*) > 1
ORDER BY copies DESC;
```

```sql
-- 5.2 Near-duplicates (requires pg_trgm). Tune the threshold; 0.92 is a starting point.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

SELECT a.question_id AS id_a,
       b.question_id AS id_b,
       round(similarity(a.stem_text, b.stem_text)::numeric, 3) AS sim
FROM content.question a
JOIN content.question b
  ON a.question_id < b.question_id
 AND a.stem_text % b.stem_text
WHERE similarity(a.stem_text, b.stem_text) > 0.92
ORDER BY sim DESC
LIMIT 500;
```

```sql
-- 5.3 Same stem, different options — the dangerous kind (looks like a repeat to the student,
-- but the two versions may have different correct answers)
WITH n AS (
  SELECT q.question_id,
         md5(regexp_replace(lower(q.stem_text), '[^a-z0-9]', '', 'g')) AS stem_h,
         md5(string_agg(lower(o.option_text), '|' ORDER BY o.option_text)) AS opt_h
  FROM content.question q
  JOIN content.question_option o USING (question_id)
  GROUP BY q.question_id, q.stem_text
)
SELECT stem_h, count(DISTINCT opt_h) AS option_variants, array_agg(question_id) AS ids
FROM n
GROUP BY stem_h
HAVING count(*) > 1 AND count(DISTINCT opt_h) > 1;
```

```sql
-- 5.4 Duplicates that already leaked into a generated test
SELECT ts.test_id, tsq.question_id, count(*) AS occurrences
FROM assess.test_section_question tsq
JOIN assess.test_section ts USING (test_section_id)
GROUP BY ts.test_id, tsq.question_id
HAVING count(*) > 1;
```

```sql
-- 5.5 Image coverage per unit
SELECT n.node_path,
       count(*) FILTER (WHERE q.status = 'PUBLISHED')                       AS published,
       count(*) FILTER (WHERE q.status = 'PUBLISHED' AND a.question_id IS NOT NULL) AS with_image
FROM content.question q
JOIN content.map_node_concept n USING (concept_id)
LEFT JOIN (SELECT DISTINCT question_id FROM content.question_asset WHERE asset_type = 'IMAGE') a
  USING (question_id)
GROUP BY n.node_path
ORDER BY n.node_path;
```

Deduplication policy once the report is in: **keep the earliest approved version, retire the rest** (status `DUPLICATE`, with a `duplicate_of` pointer). Never hard-delete — existing attempts reference those IDs.

### R3 — Blueprint fit simulation

Generate 100 full mocks with different seeds against the current pool. Report: duplicate rate (must be 0), average deviation from blueprint per subject and per unit, failure rate, and which nodes ran dry most often.

---

## 6. Definition of done

- [ ] 0 duplicates across 100 seeded generations (R3).
- [ ] Short pool produces a typed error with actionable detail. Verified for: whole test, one section, one difficulty band, one node.
- [ ] No code path anywhere can insert a question the generator did not draw, or draw one twice.
- [ ] Every §B escape route is blocked client-side **and** rejected server-side, with a test for each.
- [ ] Kill the browser mid-test → resume restores answers, flags, index, and correct remaining time.
- [ ] Timer expiry with no client connected → server auto-submits within the sweeper interval.
- [ ] Submit is idempotent; submit + auto-submit race produces exactly one scorecard.
- [ ] NEET weightage lives in a table with a cited source; generator returns a deviation report on every run.
- [ ] Image-based test type generates end-to-end, and no drawn question has an unreachable asset.
- [ ] R1, R2, R3 committed to the repo.
- [ ] One manual checkpoint: generate a full NEET mock, sit it from a clean browser as a new student, attempt every escape route, kill the tab at question 90, resume, submit, reconcile the scorecard by hand against the marking scheme.

---

## 7. Explicitly forbidden

- Generating, rewriting, or paraphrasing any question to fill a pool gap.
- Reusing a question to pad a section.
- Silently relaxing a filter (difficulty, node scope, anti-repeat) on shortfall.
- Shipping a fix without a test that fails before it.
- Refactoring anything outside the test layer this pass.
- Hardcoding syllabus, weightage, or marking scheme in application code.
- Treating client-side lockdown as sufficient.
