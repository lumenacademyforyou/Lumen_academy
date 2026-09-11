# Lumen Academy — No Repeated Questions in a Session: Fix Spec

Based on the read-only investigation findings. Implement in phase order. Do not skip Phase 1's census — later phases depend on knowing the real pool size.

**Root cause, restated:** the assembler is not broken. It correctly avoids re-picking the same `question_id` within a paper, correctly fails loudly on pool exhaustion, and correctly biases away from recently-seen questions. The problem is that `question_id` is the wrong unit of identity when ~54% of the published bank consists of byte-for-byte content clones under distinct IDs. Every existing guard — the `globallyPicked` array, `uq_test_question_test_id_question_id`, the `attempt_question` PK, the `user_question_seen` sort — is keyed on an identifier that does not correspond to what the student actually sees.

---

## Phase 0 — Design decision: no global flag column

A proposed approach was a `checker` column on the question row: default `0`, set to `1` on entering a session, reset to `0` on completion.

**Do not implement this.** Reasons:

1. **Concurrency.** The column lives on a shared row. Two students sitting the same unit simultaneously would hide questions from each other. The pool would appear to shrink under load, in Physics units of ~30 questions this would break test generation outright.
2. **Leakage.** Abandoned attempts, browser closes, server restarts and crashed sessions all leave the flag stuck at `1`. Every stuck flag permanently removes a question from the bank until a reaper job clears it. This introduces a whole class of state-cleanup bugs.
3. **It already exists, correctly scoped.** `assess.attempt_question` (migration 020, PK `(attempt_id, question_id)`) is exactly this flag, per-attempt rather than global. Row present = served in this attempt. Row absent = not served. It is concurrency-safe by construction and requires no reset because it is scoped to an attempt that ends.

**What we keep from the idea:** the in-session served-set concept is right. We change what it is keyed on — content fingerprint instead of `question_id` — and enforce it at both the application and DB layer.

---

## Phase 1 — Fingerprints and the honest census

### 1.1 Normalizer

Single shared implementation, mirrored in TS and SQL so they cannot drift.

`packages/shared/src/normalizeStem.ts` and `content.fn_normalize_stem(text)` (`IMMUTABLE`):

1. Unicode NFKC normalize.
2. Strip HTML/markdown tags.
3. Strip LaTeX spacing tokens (`\,` `\!` `\;` `\quad` `\qquad` `~`) and collapse `$$`/`$` delimiters.
4. Strip leading enumeration: `/^\s*[\(\[]?\d+[\)\].:]\s*/`.
5. Lowercase.
6. Strip punctuation except decimal points inside numbers and mathematical operators.
7. Normalize unit spacing (`5kg` → `5 kg`).
8. Collapse whitespace, trim.

Add a unit test asserting the TS and SQL implementations produce identical output over a fixture set of at least 200 real stems drawn from all four subjects. If they diverge, everything downstream is unreliable.

### 1.2 Columns

```sql
create extension if not exists pg_trgm;

alter table content.question
  add column content_fp   bytea,
  add column stem_fp      bytea,
  add column skeleton_fp  bytea;

create index idx_question_content_fp  on content.question (content_fp);
create index idx_question_stem_fp     on content.question (stem_fp);
create index idx_question_skeleton_fp on content.question (skeleton_fp);
```

| Column | Definition | Catches |
|---|---|---|
| `content_fp` | `sha256(norm(stem_text) ‖ '␟' ‖ array_to_string(sorted(norm(option_text)[]), '␟'))` | Exact clones incl. option-order variants — **this is the enforced key** |
| `stem_fp` | `sha256(norm(stem_text))` | Same stem, re-authored options |
| `skeleton_fp` | `sha256(regexp_replace(norm(stem_text), '[0-9]+(\.[0-9]+)?', '#', 'g'))` | Numeric variants (`5 kg` vs `8 kg`) — **report only for now, see 1.4** |

Option text must be pulled from `content.question_option` and sorted by normalized text before hashing — the findings confirm clone rows carry the same four options in different insertion order, so unsorted hashing would miss them.

Maintain via trigger on insert/update of `question.stem_text` and any `question_option` row for that question. A stale fingerprint is worse than no fingerprint.

### 1.3 Backfill and census

Backfill all three columns in batches, then produce this report and **commit it to the repo** as `docs/POOL_CENSUS.md`:

```sql
select s.subject_code,
       count(*)                            as published_rows,
       count(distinct q.content_fp)        as distinct_content,
       count(distinct q.stem_fp)           as distinct_stems,
       count(distinct q.skeleton_fp)       as distinct_skeletons
from content.question q
join catalog.subject s on s.id = q.subject_id
where q.lifecycle_status = 'published'
group by s.subject_code;
```

And the same broken down per unit — this is the number that decides whether a unit mock test is buildable:

```sql
select s.subject_code, n.node_code, n.title,
       count(*) as rows,
       count(distinct q.content_fp) as real_questions
from content.question q
join catalog.node n on n.id = q.primary_node_id
join catalog.subject s on s.id = q.subject_id
where q.lifecycle_status = 'published'
group by s.subject_code, n.node_code, n.title
order by s.subject_code, n.node_code;
```

Expected from the investigation: Physics ~337 real, Chemistry ~136, Botany ~87, Zoology ~83. Confirm before proceeding.

### 1.4 Do not enforce `skeleton_fp` yet

`skeleton_fp` is aggressive — it will collapse legitimate numeric-variant drills (unit conversion practice, same formula with different values) that arguably *should* both exist. Compute it and report on it, but enforce only `content_fp` in Phases 3 and 4. Revisit after the Phase 7 report shows how many additional collapses it would cause.

---

## Phase 2 — Collapse the clone rows

Fingerprint-aware querying alone leaves ~750 dead rows in the bank inflating every count and every admin view. Collapse them properly.

### 2.1 Pick a canonical row per group

For each `content_fp` group with more than one row, the canonical row is chosen by, in order: highest `revision_no`, then non-null `solution_text`, then `has_image`/`has_table`/`has_math` richness, then lowest `question_id` as a stable tiebreak.

### 2.2 Archive the rest

Add `'duplicate_archived'` to the `lifecycle_status` enum. Do **not** delete rows — `assess.attempt_question` and `assess.user_question_seen` hold FKs to them and historical attempts must stay reconstructible.

```sql
alter table content.question
  add column canonical_question_id uuid references content.question(question_id);
```

Non-canonical rows get `lifecycle_status = 'duplicate_archived'` and `canonical_question_id` pointing at the survivor. Canonical rows keep `canonical_question_id = null`.

### 2.3 Merge signals onto the canonical row

- `usage_count` on the canonical row becomes the **sum** across the group.
- `assess.user_question_seen`: rewrite `question_id` to the canonical id, merging on conflict by keeping the **earliest** `last_seen_at`. Without this, a student who saw clone B still sorts as "unseen" for canonical A and will be served the same question again.
- `v_question_eligibility` must exclude `duplicate_archived`. Verify no other view or query selects on `lifecycle_status = 'published'` in a way that now silently changes behaviour — grep for it.

### 2.4 Fix the ingestion pipeline

The clone rows came from somewhere — likely retried or un-deduped batch import jobs. Find the importer, and add a pre-write check: reject any incoming item whose `content_fp` already exists in the bank, with reject reason `DUPLICATE_CONTENT_FP`. Report the reject count per batch. Without this, the bank re-fills with clones after the cleanup.

---

## Phase 3 — Assembler: exclude on fingerprint

File: `db/assess/test/generation/assemble.ts`

### 3.1 Change the exclusion key

`globallyPicked: string[]` (line ~239) currently holds `question_id`s and is passed to `LINE_CANDIDATE_SQL` as `$4::uuid[]`.

Replace with two parallel accumulators carried across all blueprint lines:
- `pickedQuestionIds: Set<uuid>` — retained, cheap, keeps the existing DB constraints meaningful.
- `pickedContentFps: Set<hex>` — the new real guard.

The candidate SQL exclusion (line ~169) becomes:

```sql
and not (q.question_id = any ($4::uuid[]))
and not (q.content_fp  = any ($5::bytea[]))
```

Apply the same exclusion to `LINE_AVAILABLE_SQL` so the count reported by `PoolInsufficientError` stays honest.

### 3.2 Pre-persist assertion

Before the assembled paper is written, assert that no two selected questions share a `content_fp`. On violation, abort the transaction with `ASSEMBLER_DUPLICATE_ASSERTION_FAILED` and log the offending pairs with their ids and stems. A paper that fails this must never be persisted — fail loudly rather than ship a duplicate.

### 3.3 Anti-repeat sort stays soft, with one change

The `user_question_seen` LEFT JOIN sort (lines ~180-187) is correct and stays soft. But after Phase 2.3 it joins on canonical ids, so it now works as intended for the first time.

---

## Phase 4 — Session guard at the DB layer

### 4.1 Constraint on the paper

```sql
alter table assess.test_question
  add column content_fp bytea not null;

alter table assess.test_question
  add constraint uq_test_question_test_content
  unique (test_id, content_fp);
```

`content_fp` is denormalized onto `test_question` at insert time (copied from the question row) because a UNIQUE constraint cannot span a join. This is the hard stop that makes a duplicate paper impossible regardless of application-layer bugs.

### 4.2 Constraint on the attempt

```sql
alter table assess.attempt_question
  add column content_fp bytea not null;

alter table assess.attempt_question
  add constraint uq_attempt_question_content
  unique (attempt_id, content_fp);
```

This is the direct, correctly-scoped replacement for the proposed `0/1` checker flag: row present = served in this session, and now content-aware. It needs no reset because it is scoped to the attempt.

### 4.3 Application-layer de-dup

`attempt-flow.ts:212-225` already de-dups with a `Set` at persistence time. Change that Set to key on `content_fp`. Keep it — belt and braces with the constraint above.

---

## Phase 5 — Recycling policy: be honest with the student

The findings identify a second, separate issue: Physics units hold ~30-32 genuinely unique questions. A student sitting the same unit repeatedly exhausts the unseen pool, and the D-2 policy correctly falls back to least-recently-seen. That is not a bug, but from the student's seat it reads as "the app keeps repeating."

**Within a single attempt:** repeats are now impossible (Phases 3 and 4). Non-negotiable.

**Across attempts:** the fallback stays, but stops being silent.

1. When a generated paper contains any question the user has seen before, set `attempt.has_recycled_items = true` and record the count.
2. Surface it in the UI before the test starts: *"This unit has 30 questions. You've seen 22 of them — 8 will be new."* Students accept a known limitation; they do not accept a system that appears broken.
3. When **zero** unseen questions remain for a unit scope, offer a "Retake for practice" framing rather than presenting it as a fresh test.
4. Log recycle events per unit. This becomes the content team's authoring backlog, ordered by real demand.

---

## Phase 6 — Loose ends from the investigation

1. **`candidate-pool.sql` is stale.** It documents a hard 50-attempt exclusion window that the live code does not implement. Delete it, or rewrite it to describe `assemble.ts` as actually written. It is actively misleading anyone reading the codebase.
2. **The `Case #12` report was not a data bug.** The artifact regex matched **0** rows. Whatever the reporter saw is almost certainly the frontend question-index label rendering into or adjacent to the stem area. Inspect the question-render component and the test-taking layout separately — check for a question counter that is being placed inside the stem container, or a `key`/index value leaking into rendered text. This is a UI bug and does not belong to this workstream, but it needs its own ticket.
3. **`question_uid`** is a plain unique text ID, not content-derived. Leave it alone; do not overload it with fingerprint duties.

---

## Phase 7 — Verification: one unit mock test per subject

Scope narrow before widening. Build a CLI:

```
npm run assembler:verify -- --unit=1 --subjects=all [--commit]
```

Dry-run by default: generates in memory, prints the report, writes nothing.

### For each subject, report

- **Pool for this unit:** raw published rows, distinct `content_fp`, distinct `skeleton_fp`, split by `difficulty_band`.
- **Buildable?** Whether the unit blueprint's `pick_count` can be met from distinct content. If not, the exact deficit per difficulty band.
- **The paper:** every item as `question_id | difficulty | content_fp (first 8 hex) | stem (first 80 chars)`.
- **Self-overlap check:** must be 0 on `question_id`, `content_fp`, and `stem_fp`.
- **Recycle count:** how many items the user (use a fresh test user) would have seen before — should be 0 on a fresh user.
- **Assertion result:** pass/fail on the Phase 3.2 pre-persist check.

### Expected outcome, stated up front

Physics will likely pass. Chemistry, Botany and Zoology may report `INSUFFICIENT_POOL` for a full-length unit mock once clones are collapsed — Botany drops to ~87 real questions across all units, Zoology ~83. **That is the correct result and must not be worked around.** Do not pad, do not relax to sibling nodes, do not lower the bar to make the run green. Report the deficit as an authoring requirement.

If a subject cannot fill a full unit mock, generate the largest honest paper it supports, mark it `is_partial = true`, score out of actual item count, and tell the student the unit is still being built out.

---

## Acceptance criteria

1. `content_fp`, `stem_fp`, `skeleton_fp` populated for 100% of non-archived questions, maintained by trigger, with TS/SQL normalizer parity proven by test.
2. `docs/POOL_CENSUS.md` committed, per subject and per unit.
3. Zero `content_fp` groups with more than one row at `lifecycle_status = 'published'`.
4. `user_question_seen` fully remapped to canonical ids with no orphaned references.
5. Importer rejects duplicate `content_fp` on ingest, with a per-batch reject report.
6. `uq_test_question_test_content` and `uq_attempt_question_content` live and verified in `information_schema`.
7. Pre-persist assertion in place; a deliberately-seeded duplicate paper aborts the transaction in an integration test.
8. `assembler:verify --unit=1 --subjects=all` runs for all four subjects and reports 0 self-overlap on every key.
9. Recycled items are flagged on the attempt and surfaced in the UI before test start.
10. `candidate-pool.sql` deleted or rewritten to match live behaviour.

## Report back before widening scope

When Phase 7 is green, report: real per-unit question counts for all four subjects, which units can support a full mock, and the authoring backlog ordered by deficit. Do not extend to Unit 2+ or to full mock tests until that report is reviewed.
