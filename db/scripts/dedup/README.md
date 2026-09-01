# `db/scripts/dedup/` — question bank deduplication, restructure and safe ingestion

Implements `question-dedup-promptnew.md`. Companion implementation of
`session-shuffle-prompt.md` lives in
[db/assess/test/attempt/session-shuffle.ts](../db/assess/test/attempt/session-shuffle.ts).

**Nothing is deleted for real until a dry run has been reviewed and approved.**
Every command is a dry run unless you pass `--apply`. There is no flag that
hard-deletes without a separate, explicit invocation and an age window.

---

## 0. Environment — Section 0 of the directive, filled in

| Item | Value |
|---|---|
| Live database | PostgreSQL 15 (Supabase), `DATABASE_URL` in `.env`; pooled via [db/shared/pool.ts](../db/shared/pool.ts) |
| Questions table | `content.question` |
| Primary key | `question_id uuid` (`question_uid text` is the human/authoring id) |
| Stem column | `stem_text` |
| Options / answer | `content.question_option (option_id, option_label, option_text, is_correct, display_order)`; numeric types use `content.question.numeric_answer` |
| Metadata | `primary_node_id` → `catalog.syllabus_node`, `difficulty_band`, `question_type`, `lifecycle_status`, `job_id` → `content.ai_generation_job`, `external_ref` |
| Content batch root | `db/content/content-batches/` (pre-restructure), `db/content/bank/` (post) |
| Batch file format | `.json` — a top-level array of authoring objects. Target format is `.jsonl`, one question per line |
| Incoming folder | `db/content/bank/incoming/` |
| Row counts | live 1400 (533 published, 866 `duplicate_archived`, 1 retired); batch files 1380 across 43 files |
| Languages | English + Tamil (`content.question_translation`, `language_code = 'ta'`) |

**There is no `created_at` on `content.question`.** Verified against
`information_schema`: 32 columns, none temporal. Survivor rule 5 ("oldest
`created_at`") therefore falls back to the monotonic serial inside
`question_uid`; [survivor.ts](survivor.ts) explains what that substitute is
worth and why it sits at priority 5 rather than higher.

---

## 1. What the audit found

Run: `npx tsx db/scripts/dedup/cli.ts audit`

### The live database is clean, under a stricter key than has ever been applied to it

| | |
|---|---:|
| published rows | 533 |
| distinct normalised stems | **533** |
| Tier 1 clusters | 0 |
| Tier 2 clusters | 0 |
| rows this pass would delete | **0** |

Three earlier passes already ran (migrations 030/031 collapsed 799
byte-identical clones; 037–041 plus `backfill-question-identity.ts` retired 67
more; 041's unique index prevents re-introduction). This audit applies the
**stem alone** — options, answer, difficulty and topic all ignored — and still
finds nothing to collapse. It shares no code with those passes except the
normaliser, and `db/scripts/dedup/integration.test.ts` checks that normaliser against the
database itself.

### The numeric-variant guard is doing all the work, and it is not optional

| | |
|---:|---|
| **1451** | published pairs at trigram similarity ≥ 0.92 |
| **1451** | of those whose digit signatures differ |
| **0** | that Tier 2 may auto-delete |

Every single live Tier-2 candidate is a numeric variant of a template — same
wording, different quantities, different correct answer. Without the guard the
prompt's own Tier 2 rule would have deleted roughly a thousand legitimate
questions. This is the reason `digitSignature` is checked **before** the
similarity threshold and not after.

### The batch files are where the damage actually is

| | |
|---|---:|
| files | 43 |
| questions | 1380 |
| distinct normalised stems | **557** |
| Tier 1 clusters | 112 |
| largest cluster | **45 copies of one stem** |
| already published live | 1280 |
| removable | **1303 → 77 remain** |

`zoo_09_ZOO09.json` holds 30 questions, of which **30** are duplicates of
stems that survive elsewhere. The five hand-named `batch-N-*.json` files are
clean; the generated `<subject>_NN_CODE.json` files are the drifted ones. The
live bank is clean only because earlier passes cleaned it *after* import —
re-importing these files today would reintroduce every one of them, which is
exactly what the Phase 5 gate exists to stop.

---

## 2. Running it, in order

Each phase writes to `db/reports/dedup/<run_id>/`. Pass the same `--run-id`
through a sequence to keep its reports together.

```bash
# Phase 1 — audit. Read-only: opens no transaction, issues only SELECT.
npx tsx db/scripts/dedup/cli.ts audit
#   -> audit_report.md, duplicates.csv, review_queue.csv        [STOP POINT 1]

# Phase 2 — live DB dedup.
npx tsx db/scripts/dedup/cli.ts db-dedup --run-id $RID                     # dry run  [STOP POINT 2]
npx tsx db/scripts/dedup/cli.ts db-dedup --run-id $RID --apply

# Phase 3 — content batch dedup.
npx tsx db/scripts/dedup/cli.ts batch-dedup --run-id $RID                  # dry run  [STOP POINT 3]
npx tsx db/scripts/dedup/cli.ts batch-dedup --run-id $RID --apply

# Phase 4 — folder restructure.
npx tsx db/scripts/dedup/cli.ts restructure --run-id $RID                  # dry run  [STOP POINT 4]
npx tsx db/scripts/dedup/cli.ts restructure --run-id $RID --apply

# Phase 5 — ingestion gate.
npx tsx db/scripts/dedup/cli.ts ingest --src db/content/bank/incoming      # dry run  [STOP POINT 5]
npx tsx db/scripts/dedup/cli.ts ingest --src db/content/bank/incoming --apply

# Phase 6 — push staged -> live, one transaction.
npx tsx db/scripts/dedup/cli.ts push --run-id $RID                         # dry run  [STOP POINT 6]
npx tsx db/scripts/dedup/cli.ts push --run-id $RID --apply
```

### Before the first `--apply`

```bash
mkdir -p db/reports/dedup/_snapshots
pg_dump "$DATABASE_URL" --format=custom --file=db/reports/dedup/_snapshots/$RID.dump
git rev-parse HEAD > db/reports/dedup/_snapshots/$RID.content-commit
```

### Migrations

**Both are already applied (2026-09-01) and verified.** Kept here because the
ordering is a hard requirement, not a preference, and a fresh environment must
reproduce it:

```bash
npx tsx db/scripts/run-migration.mjs db/migrations/043_stem_norm_dash_fold.sql
npx tsx db/scripts/run-migration.mjs db/migrations/044_dedup_toolkit.sql
```

`044`'s `match_hash` is a **stored** generated column over
`content.fn_question_stem_norm`, and Postgres does not re-evaluate a stored
generated column when a function it calls is later redefined. Applying `044`
first bakes the pre-fold hash into the column that `uq_question_match_hash`
indexes. `db/scripts/dedup/integration.test.ts` caught exactly this, on one real row
(`LMN-PHY-PHY02-000125`, "…voltmeter of range 0–5 V", en dash).

---

## 3. Rollback

```bash
# Undo one dedup run: restores soft-deleted questions and moves every
# re-pointed foreign key back, using content.question_dedup_repoint.
npx tsx db/scripts/dedup/cli.ts rollback --run-id <id>            # dry run
npx tsx db/scripts/dedup/cli.ts rollback --run-id <id> --apply

# Undo the schema (run the data reversal above FIRST — dropping the audit
# table destroys the payload snapshots the reversal replays).
npx tsx db/scripts/run-migration.mjs db/migrations/rollback_044_dedup_toolkit.sql
```

A `--purge` cannot be rolled back to the same primary keys: the rows are gone
and everything that referenced them has been re-pointed. The audit row still
holds the full payload, so the content can be re-inserted, but with a new
`question_id`. That is the whole reason purge is a separate command behind an
age window.

---

## 4. Deliberate deviations from the directive, and why

Each of these is a place where following the prompt literally would have
produced a worse result. All are measured, not asserted.

**1. The blocking key is not "first 40 characters".**
Measured on the live bank: the prefix key finds 179 of the 1451 real Tier-2
candidate pairs — 12%. It fails on exactly the template families this pass
targets, whose difference is an early numeric literal. Replaced with a union
of three keys (digit-collapsed skeleton, sorted rare-token pairs, and the
40-char prefix), whose recall is asserted against exhaustive all-pairs in
`normalize.test.ts`. Under 5000 records the toolkit skips blocking entirely
and compares exhaustively — ~1900 records is under two million comparisons.

**2. Tier 3 uses a lexical metric, not sentence embeddings.**
No embedding provider is configured in this environment;
`content.question.stem_vec` exists and is NULL on all 1400 rows. A cosine tier
that cannot be computed is a tier that silently never fires, and an always-empty
review queue looks like a clean result. Tier 3 runs on the pg_trgm-compatible
metric at 0.45, tuned against 209 hand-labelled pairs in
`docs/QUESTION_DEDUP_THRESHOLDS.md` (P=1.000, R=1.000). `stem_vec` stays
provisioned; when a provider exists, add the cosine tier alongside this one.

**3. `is_deleted` and `merged_into_id` are GENERATED, not writable.**
This schema already expresses both: `lifecycle_status = 'duplicate_archived'`
and `canonical_question_id`, and the live assembler filters on
`lifecycle_status`. Independently-writable copies would be a second source of
truth for "is this question servable?", and the failure is silent — a row with
`is_deleted = true` but `lifecycle_status = 'published'` keeps being served
into live papers. Generating them makes disagreement impossible while giving
the directive's reports the exact column names they expect.

**4. Answer history is not re-pointed when doing so would falsify it.**
Section 2 says a differing correct answer is not a reason to keep a second
copy. For the *question* that is right. But `assess.attempt_response` stores
`option_id` (a foreign key to the **loser's** options) alongside an
already-scored `is_correct` and `marks_awarded`. Re-pointing `question_id`
alone yields a row saying "the student answered survivor X, and the option
they chose belongs to a different question". So `repoint.ts` gates it:

- every option a student actually selected must have a text-equivalent option
  on the survivor, and `option_id` / `selected_option_label` are rewritten to
  the survivor's;
- the survivor's correct-answer set must match the loser's;
- no unique constraint may collide (one attempt or paper that served *both*
  cluster members cannot be represented after a merge).

A cluster failing any gate is **escalated to review, not deleted**, and is
reported by cluster id with the reason. Section 3's own opening rule —
"never orphan live history" — is the justification: falsifying history is
worse than orphaning it. A loser with no answer history skips the first two
gates entirely, which on this bank is the overwhelming majority.

**5. The loser's primary-node map row does not move.**
`content.question_node_map` carries two triggers, found by running the tests
rather than by reading the schema: `trg_question_primary_node_sync` auto-creates
the map row for a question's `primary_node_id`, and `trg_question_node_map_guard`
raises on any attempt to delete it. Soft delete keeps the loser row alive, so
its primary map row must stay or the whole cluster transaction aborts. Only the
loser's **secondary** tags move — which is also semantically right: those are
the extra syllabus coverage the survivor should inherit.

**6. En/em dashes needed a new migration to normalise at all.**
`content.fn_normalize_stem` keeps ASCII `-` (a math operator) and strips
U+2013/U+2014, so `well-known` and `well—known` hash differently — the exact
inconsistency Section 2 asks normalisation to remove. Migration 043 folds
every dash variant onto ASCII `-`, mirrored by `DASH_VARIANTS` in
`normalize.ts`. Applied inside `fn_question_stem_norm`, never inside
`fn_normalize_stem`, because migration 030's `content_fp`/`stem_fp`/
`skeleton_fp` are computed from the latter and the assembler filters on them
at runtime. Measured impact: 1 published row of 533; 0 rows carry smart quotes,
which already normalised consistently.

**8. The directive's new tables are extensions of existing ones, not new tables.**
The prompt asks for a `question_dedup_audit` table and an `ingestion_runs`
table, and does not say to remove any existing constraint. Following that
literally produced three duplications, all of which were caught and undone:

| Asked for | Already here | What was done |
|---|---|---|
| `question_dedup_audit` | `content.question_identity_audit` (mig 037, 1467 rows) — already has `run_id`, `action` with `cluster_retire`/`cluster_restore` in its CHECK, `new_canonical` = the survivor, `note` = the reason | Added the four missing columns: `tier`, `similarity_score`, `payload_json`, `actor` |
| `ingestion_runs` | `content.import_batch` (43 rows) — already has `source_file`, `file_checksum`, `row_count`, `accepted_count`, `rejected_count`, `started_at`, `finished_at`, and `loaded`/`failed`/`rolled_back` in its status CHECK | Added `duplicate_count` and `detail` |
| (nothing — it just did not say to remove it) | `uq_question_dedup` (mig 041) | **Dropped.** `dedup_key` is derived from `stem_norm`, so every violation it could catch `uq_question_match_hash` catches first; the new predicate is broader; and `dedup_key` is NULL whenever `answer_key` is NULL, which exempts those rows from a unique index altogether, while `match_hash` never is |

A second audit table would have split one question's history across two places
that no query joins — the exact failure mode an audit trail exists to prevent —
and two overlapping unique constraints for one invariant is how the two drift
apart. `content.question_dedup_repoint` is the one genuinely new table: nothing
here recorded which foreign-key rows a merge moved, and rollback needs that.

`verify_044` asserts the parallel tables are **absent** as well as asserting
the added columns are present, and an integration test locks it in.

**7. Question order is not shuffled a second time.**
`session-shuffle-prompt.md` asks for per-session question order.
`assess.attempt_question.sequence_no` already comes from
`assembleForAttempt`'s own seeded shuffle and is per-attempt, so the set
already arrives in a per-session order. Re-shuffling at render time would also
desync `sequenceNo` from the value the client navigates by and responses are
keyed against. Option order — which genuinely was not shuffled at all — is
what this pass adds.

---

## 5. Layout

| File | What it is |
|---|---|
| [normalize.ts](normalize.ts) | Normalisation, `match_hash`, digit signature, pg_trgm-compatible similarity, blocking keys, uuid v5 ids |
| [cluster.ts](cluster.ts) | The three tiers, the numeric-variant guard, transitive clustering with a chained-cluster demotion |
| [survivor.ts](survivor.ts) | Section 3's six survivor rules, and the metadata merge |
| [repoint.ts](repoint.ts) | Foreign-key re-pointing and the history-safety gates |
| [sources/db.ts](sources/db.ts) | Live bank → `CanonicalRecord`, reference counts |
| [sources/batch.ts](sources/batch.ts) | Content files → `CanonicalRecord`, with `(file, index)` provenance |
| [audit.ts](audit.ts) | Phase 1 (read-only) |
| [db-dedup.ts](db-dedup.ts) | Phase 2, plus `--purge` |
| [batch-dedup.ts](batch-dedup.ts) | Phase 3 |
| [restructure.ts](restructure.ts) | Phase 4 |
| [ingest.ts](ingest.ts) | Phase 5 |
| [push.ts](push.ts) | Phase 6 |
| [rollback.ts](rollback.ts) | Reversal for a `run_id` |
| [cli.ts](cli.ts) | `dedup-cli` |
| [runlog.ts](runlog.ts) / [paths.ts](paths.ts) | Flags, structured JSONL logging, path constants |

---

## 6. Tests

These run as part of the repository suite — `db/scripts/dedup/*.test.ts` is in
`npm run test:unit`, and the shuffle tests are already covered by that script's
`db/assess/test/**` glob. To run just this pass's tests:

```bash
node --import tsx --test --test-concurrency=1 \
  "db/scripts/dedup/normalize.test.ts" \
  "db/scripts/dedup/integration.test.ts" \
  "db/assess/test/attempt/session-shuffle.test.ts"
```

`normalize.test.ts` (27) is pure. `integration.test.ts` (14) talks to the live
database **inside a transaction that is always rolled back** — it applies both
migrations, creates synthetic questions, exercises re-pointing and an injected
failure, and persists none of it. That is also what makes it a pre-flight
check: if 044 cannot be applied to the live schema, the suite says so before
anyone runs it for real.

Covering the directive's Section 6 list: normalisation cases; a synthetic
7-copies-of-one-stem cluster; the variant-not-duplicate case; FK re-pointing;
transaction rollback on injected failure; idempotent re-run of the push.
`session-shuffle.test.ts` (16) covers Section 8 of the shuffle directive,
including correct scoring under all 24 permutations of a four-option question
and a check that the bank is byte-identical after shuffling.

---

## 7. Where this lives, and what is tracked

This toolkit is **ops code, not app runtime**. It sits under `db/scripts/`
alongside the other non-runtime maintenance code (`demo/`, `import/`,
`manual/`, `seed/`), and nothing under `db/scripts/` is reached by the Vite
build or the esbuild server bundle — so it ships with the repository without
being part of the running application.

It is **tracked in git**, deliberately. It is the gate new questions have to
pass through before they can be inserted; `CLAUDE.md`, the tracker in
`docs/QUESTION_DEDUP_TRACKER.md`, and migrations 043/044 all
reference it by path. Untracking it would leave a fresh clone with dangling
references and no ingestion path.

What is **not** tracked is the generated output:

| Path | Contents |
|---|---|
| `db/reports/dedup/<run_id>/` | `*.jsonl` structured logs and every generated report |
| `db/reports/dedup/_snapshots/` | pre-run `pg_dump` files |

`.gitignore` already excluded `db/reports/` before this pass, with the comment
"Run artifacts from db/scripts (import runs, prove-*, e2e scripts) — logs of
what happened on a given run, not source". That describes these exactly, so no
new ignore rule was added. Reports embed full question stems and can be
regenerated at any time by re-running the phase.

Run every command from the repository root — all paths resolve from the
process working directory.
