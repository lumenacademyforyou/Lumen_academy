# Agent Prompt — Question Bank Deduplication, Restructure & Safe Ingestion

> Paste this whole file as the task prompt. Fill in the `<<FILL>>` values in **Section 0** before running.
> Rule of thumb for the agent: **nothing is deleted for real until a dry run has been reviewed and approved.**

---

## 0. Environment (fill this in)

| Item | Value |
|---|---|
| Live database | `<<FILL: postgres / mysql / mongo — host, db name>>` |
| Questions table/collection | `<<FILL: e.g. questions>>` |
| Primary key | `<<FILL: e.g. id (uuid)>>` |
| Stem/question text column | `<<FILL: e.g. stem / question_text>>` |
| Options / answer columns | `<<FILL: e.g. options jsonb, correct_option>>` |
| Metadata columns | `<<FILL: subject, topic, subtopic, difficulty, exam_tag, created_at, source_batch>>` |
| Content batch root | `<<FILL: e.g. ./content/batches/>>` |
| Batch file format | `<<FILL: json / jsonl / csv / docx>>` |
| New/incoming content folder | `<<FILL: e.g. ./content/incoming/>>` |
| Approx. row counts | live: `<<FILL>>`, batches: `<<FILL>>` |
| Language(s) | `<<FILL: e.g. English + Tamil>>` |

---

## 1. Problem statement

A Gemini-based generation pipeline drifted and emitted the same question many times. Typical damage: **~7 near-identical copies per unique stem**, spread across (a) the live database, (b) the on-disk content batches, and (c) newly generated content still waiting to be uploaded.

You must:

1. Find every duplicate cluster in the **live DB**.
2. Find every duplicate cluster in the **content batch files**.
3. Keep exactly **one canonical question per cluster**; remove the rest.
4. Reorganise the content folder into a clean, predictable structure.
5. Build a **repeatable ingestion gate** so new questions are dedup-checked against live + batches *before* insert.
6. Push verified new questions to live **transactionally (ACID)** — all or nothing, resumable, auditable.

---

## 2. Definition of a duplicate

Two questions are duplicates when they test the same thing with the same answer. Detect in three tiers:

**Tier 1 — Exact (auto-delete safe)**
Normalise the stem, then hash it. Normalisation: lowercase; strip HTML/markdown; collapse whitespace; strip punctuation, LaTeX spacing artefacts, leading numbering (`1.`, `Q1)`, `a)`); normalise unicode (NFKC), smart quotes, en/em dashes; strip trailing "Which of the following is correct?" boilerplate only if it appears in >X% of rows.
Match key = `sha256(normalised_stem + sorted(normalised_options) + normalised_correct_answer)`.

**Tier 2 — Near-duplicate (auto-delete with a rule, log everything)**
- Token-set / trigram similarity ≥ **0.92** on the normalised stem, **and**
- same correct answer after normalisation, **and**
- same subject + topic.

Use `pg_trgm` similarity, RapidFuzz `token_set_ratio`, or MinHash+LSH for large sets. Blocking key = `(subject, topic, first 40 chars of normalised stem)` so you don't do an O(n²) comparison across the whole bank.

**Tier 3 — Semantic (never auto-delete — queue for human review)**
Cosine similarity ≥ **0.95** on sentence embeddings but Tier 2 didn't fire (numbers swapped, options reordered, paraphrased). Write these to `review_queue.csv` with both rows side by side and a `KEEP_BOTH / MERGE` column.

> Guard: questions differing **only** in numeric values, units, or named entities are **not** duplicates — they're variants. Flag any pair where the digit sequences differ and route to Tier 3.

---

## 3. Canonical survivor rules

Within each cluster, keep exactly one row, in this priority order:

1. Has a valid, non-null correct answer and the full option set.
2. Richest metadata (topic, difficulty, explanation, tags all populated).
3. Longest/most complete stem (catches truncated copies).
4. Referenced by other tables (attempts, tests, papers) — never orphan live references.
5. Oldest `created_at` — the original, not the drift copies.
6. Tiebreaker: lowest primary key.

Before deleting a loser, **re-point its foreign keys** (attempts, test_questions, bookmarks, analytics) to the survivor. Merge non-conflicting metadata upward into the survivor (e.g. survivor missing `explanation`, loser has one → copy it).

---

## 4. Execution phases

### Phase 1 — Snapshot and audit (read-only)
- Take a full DB backup / dump and a `git commit` or zip of the content folder. Record the restore command in the report.
- Produce `audit_report.md` + `duplicates.csv` with: total rows, unique stems, cluster count, cluster size histogram, per-subject/topic breakdown, per-`source_batch` breakdown (identifies which generation runs drifted), and estimated deletions per tier.
- **Stop and show this report before any write.**

### Phase 2 — Live DB dedup
- Add `is_deleted BOOLEAN DEFAULT false`, `deleted_at`, `dedup_cluster_id`, `merged_into_id` if not present.
- Create `question_dedup_audit` (id, question_id, survivor_id, tier, similarity_score, reason, payload_json snapshot of the deleted row, actor, run_id, created_at).
- Run `--dry-run` first: writes the plan, changes nothing.
- On apply: process **one cluster per transaction**, or batches of ~500 clusters, each wrapped in `BEGIN … COMMIT`. Re-point FKs → merge metadata → soft-delete losers → write audit rows. Any error inside a batch → `ROLLBACK` that batch only, log it, continue.
- Default to **soft delete**. Hard delete only after an approval window (`--purge --older-than 30d`) as a separate, explicitly invoked command.

### Phase 3 — Content batch dedup
- Parse every batch file into a normalised in-memory record set with `(file_path, line_no/index)` provenance.
- Dedup **within** each batch, **across** batches, and **against live DB** (a batch question already live is a duplicate).
- Rewrite each batch file with only survivors. Move removed items to `content/_quarantine/<run_id>/<original_path>.removed.jsonl` — never delete outright.
- Emit `batch_dedup_report.md`: per-file before/after counts and where each removal went.

### Phase 4 — Folder restructure
Target structure (adapt to the real taxonomy):

```
content/
  live/                       # mirrors what's in the DB, read-only reference
  batches/
    <subject>/<topic>/<batch_id>.jsonl
  incoming/                   # new, unverified drops land here
  staged/                     # passed dedup + validation, awaiting push
  rejected/                   # failed validation, with reason file alongside
  _quarantine/<run_id>/       # everything removed by dedup, recoverable
  manifests/<batch_id>.json   # counts, checksums, source, generated_at, model, run_id
  reports/
```

Rules: one question per JSONL line; stable `question_id` (uuid v5 over the normalised match key so the same question always gets the same id); every batch has a manifest with a SHA-256 checksum; file names slugified and lowercase; no spaces.

### Phase 5 — Ingestion gate for new questions
A single command, e.g. `dedup-cli ingest --src content/incoming --dry-run`:

1. **Schema validation** — required fields present, exactly one correct answer, option count in range, no empty/placeholder text, no `<<`/`TODO`/model-preamble leakage.
2. **Self-dedup** within the incoming drop.
3. **Cross-check** against live DB and staged content (Tiers 1–3).
4. Route: unique → `staged/`; Tier 1/2 dupe → `rejected/` with reason; Tier 3 → `review_queue.csv`.
5. Print a summary: received / valid / duplicates / staged / rejected.

### Phase 6 — Push to live (ACID)
- Insert from `staged/` only.
- Wrap the whole push in a **single transaction** where volume allows; otherwise chunk it and make each chunk idempotent.
- Enforce idempotency at the database level: `UNIQUE` index on the normalised match hash column, and `INSERT … ON CONFLICT (match_hash) DO NOTHING` (Postgres) so a re-run can never double-insert. This is the real safety net — application-side checks race, constraints don't.
- Record every push in `ingestion_runs` (run_id, source manifest, checksum, counts, started_at, finished_at, status).
- On any failure: `ROLLBACK`, leave `staged/` untouched, exit non-zero with the failing record ids. The run must be safely re-runnable from scratch.
- After commit, verify: post-count == pre-count + inserted, no duplicate `match_hash`, spot-check 10 random inserted rows.

---

## 5. ACID requirements (non-negotiable)

- **Atomicity** — every mutation runs inside an explicit transaction; partial cluster merges are forbidden. FK re-pointing and the soft-delete of the loser commit together or not at all.
- **Consistency** — FK constraints stay enabled; unique index on `match_hash`; no row may reference a deleted question; validation runs before commit, not after.
- **Isolation** — use `READ COMMITTED` minimum, `SERIALIZABLE` or `SELECT … FOR UPDATE` on the cluster rows during merges. Take an advisory lock so two dedup runs can't overlap.
- **Durability** — confirm commit before reporting success; keep the pre-run dump until the operator signs off.

Also: every script takes `--dry-run` (default on), `--limit`, `--subject`, `--run-id`; is resumable after a kill; and logs structured JSON to `reports/<run_id>/`.

---

## 6. Deliverables

- `dedup/` toolkit — normalisation module, matcher (all 3 tiers), DB dedup, batch dedup, ingestion gate, push, and a `rollback` command that restores soft-deleted rows for a given `run_id`.
- Migration file for the new columns, tables, and unique index.
- Reports: `audit_report.md`, `duplicates.csv`, `batch_dedup_report.md`, `review_queue.csv`, `ingestion_summary.md`.
- `README.md` — how to run each phase, in order, with rollback instructions.
- Tests: normalisation cases, a synthetic 7-copies-of-one-stem cluster, variant-not-duplicate case (numbers differ), FK re-pointing, transaction rollback on injected failure, idempotent re-run of the push.

---

## 7. Order of work and stop points

1. Audit → **stop, show report, wait for approval.**
2. Live DB dedup dry run → **stop, show diff.** Then apply.
3. Batch dedup dry run → **stop.** Then apply.
4. Folder restructure → show the before/after tree.
5. Ingestion gate on `incoming/` → show the summary.
6. Push staged → live → show verification counts.

Do not skip a stop point. Do not hard-delete anything. If the duplicate rules are ambiguous for a cluster, put it in the review queue rather than guessing.
