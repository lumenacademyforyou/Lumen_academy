# ASSET_DEDUP_AUDIT — images, duplicates, and syllabus mapping

Companion to `docs/QUESTION_DEDUP_AUDIT.md`. Same directive
(`question-dedup-audit-and-fix.md`), same logic, applied to `content.asset`
instead of `content.question`. Investigated and fixed live on 2026-09-01.

---

## What was wrong

### 1. Every image was stored twice (15 wasted objects)

Migration 024 renamed each question image from its authored, human-readable
name to an id-based one:

```
question/<uuid>/CHE_SOMBAS_DIAG_0001.png        <- authored name, ORPHAN
question/<uuid>/q_<uuid>_stem_01.png            <- referenced by content.asset
```

It **copied rather than moved**, so both files survived and only the id-named
one was ever referenced. Storage held 31 objects for 15 images.

`content.asset_rename_log` (15 rows) records every `old_path → new_path`, so
each leftover was provable rather than inferred — that log is what made the
cleanup safe to automate.

### 2. One object under a question that does not exist

```
question/c1195717-c179-42aa-b983-9aad9c07bdb3/CHE_SOMBAS_DIAG_0002.png
```

No `content.question` row, no `content.asset` row. Pure garbage.

### 3. A real content bug, not just wasted bytes

One image — sha `1bb672cfb0f8…`, phash `c488888080606000` — was the stem image
of **two** questions:

| Question | Node | Stem | Verdict |
|---|---|---|---|
| `LMN-CHEM-CHEM08-000119` | Some Basic Concepts & States of Matter | *"The diagram shows the molecules available before the reaction 2H2 + O2 → 2H2O…"* | **Correct** — genuinely needs the diagram, and its node matches the filename's own `SOMBAS` code |
| `LEGACY-13` | Electrochemistry, Solutions & Surface Chem | *"Which of the following solutions will have the highest boiling point elevation at the same concentration?"* | **Wrong** — a pure text question that references no diagram, yet carried a stoichiometry diagram |

`LEGACY-13` is the only one of the 15 whose filename topic code disagrees with
its question's node. Because `has_image` was true it also wrongly qualified for
**Image Only Practice**, so a student could be served a stoichiometry diagram
above a boiling-point question.

### 4. Images were isolated from the syllabus tree

`content.asset` had no link to `catalog.syllabus_node` at all. Images were
reachable only by walking `asset → question → primary_node_id`, so they could
not be listed, counted or audited per unit/topic.

---

## What was done

### Migration 042 — `db/migrations/042_asset_identity.sql`

| Change | Purpose |
|---|---|
| `content.asset.image_phash` | Perceptual hash. `checksum_sha256` already existed but is cryptographic — blind to the same diagram re-exported at another DPI |
| `content.asset.node_id` | Trigger-maintained from the owning question. Ends the syllabus isolation |
| `content.asset_archive` | Every removed asset row recorded in full before deletion, so a wrong call is recoverable |
| `trg_asset_identity_sync` | Keeps `asset.node_id` and `question.image_phash` correct on every insert/update/delete |
| `uq_asset_stem_checksum` | **One image file may be the stem of at most one question.** The asset-layer analogue of `uq_question_dedup` |
| LEGACY-13 removal | Archived, then deleted. `has_image` and `image_phash` self-corrected via trigger |

`question.image_phash` was previously written only by a backfill script and
kept in sync by nothing — and it feeds `dedup_key`. It is now trigger-derived
from the stem asset, closing the same staleness hole migration 037 closed for
the text identity columns.

### `db/scripts/prune-orphan-assets.ts`

SQL cannot delete from object storage, so this does. Dry-run by default;
`--execute` required. Every candidate must be *explained* by evidence — a
rename-log entry, a missing question, or an archived asset — and anything
unexplained is reported but **not** deleted without `--include-unexplained`,
because an unexplained orphan is likelier to be a gap in the script than
genuine garbage.

Result: 17 objects deleted (14 rename leftovers + 1 dead question + 2 belonging
to the archived LEGACY-13 asset). **31 → 14 objects, and all 14 are
referenced.** Post-delete the script re-lists the bucket and confirms every
`content.asset` row still resolves to a real object.

### `db/scripts/report-asset-node-mismatch.ts`

Re-runnable detector, three signals:

1. **SUBJECT_MISMATCH** — filename subject prefix vs the question's subject.
2. **SHARED_IMAGE** — one file as the stem of several questions (what caught
   LEGACY-13; now also a DB constraint, so it should always read zero).
3. **UNREFERENCED_DIAGRAM** — `has_image` true but the stem never mentions a
   diagram/figure/graph/circuit.

A fourth signal was **built, measured, and removed**: matching the filename's
topic code against the node title. The codes abbreviate NCERT *chapter* names
(`PHOIN` = PHOtosynthesis IN higher plants, `NLM` = Newton's Laws of Motion,
`BREAND` = BREathing AND exchange of gases) while `catalog.syllabus_node` holds
38 composite *unit* titles. The catalog does not carry chapter names at all, so
the check produced **6 false positives and 0 true positives**. A report that
cries wolf six times out of six teaches people to ignore it, so it was deleted
rather than tuned.

The surviving detector was verified to discriminate rather than merely return
zero: signal 3 flags LEGACY-13's stem and does **not** flag
`LMN-CHEM-CHEM08-000119` ("The diagram shows…").

---

## Final state

| Metric | Before | After |
|---|---|---|
| Storage objects | 31 | **14** |
| Objects referenced by `content.asset` | 15 | **14** |
| Unreferenced (orphan) objects | 16 | **0** |
| `content.asset` rows | 15 | **14** |
| Assets with a syllabus `node_id` | 0 | **14 (all)** |
| Images that are the stem of >1 question | 1 | **0** |
| Questions with `has_image` | 15 | **14** |
| Report findings | 1 real | **0** |

Reversal: the removed row is in `content.asset_archive` with its full
storage_uri, checksum and phash. The bytes themselves are gone from storage —
that step is genuinely irreversible, which is why it runs last, separately, and
only on evidence-classified candidates.

---

## Note on `uq_asset_stem_checksum`

If a diagram ever legitimately needs to be the stem of two different questions,
this index forbids it and the second attach fails loudly. That is the intended
policy for this bank — a shared stem image has so far only ever meant a
mis-attachment — and a loud, easily-reversed failure is the right trade against
silently serving the wrong diagram. Stated here so the constraint is a decision
on record rather than a surprise.
