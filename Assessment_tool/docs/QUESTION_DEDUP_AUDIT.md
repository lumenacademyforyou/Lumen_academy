# QUESTION_DEDUP_AUDIT — findings report

Source directive: `question-dedup-audit-and-fix.md` (Part 1).
Investigation run live against the working database (Supabase/Postgres 17.6,
`aws-0-ap-northeast-1.pooler.supabase.com`) on 2026-09-01. Read-only; nothing
was mutated during Part 1.

**Headline:** the directive's premise is correct, but three of its five
"confirmed bugs" describe a database state that no longer exists — two earlier
passes (migrations 030/031/036) already built exact-content fingerprinting and
collapsed 799 byte-identical clones. What survives is a **different and
narrower defect that every prior pass missed**, and it is live and
reproducible: 58 published questions are exact duplicates of each other that
all three existing fingerprints fail to catch, because the only thing
separating them is a decorative chapter name in the stem.

---

## 0. Bank census (live)

| Metric | Value |
|---|---|
| `content.question` total rows | 1400 |
| `lifecycle_status = 'published'` | **600** |
| `lifecycle_status = 'duplicate_archived'` | 799 |
| `lifecycle_status = 'retired'` | 1 |
| `canonical_question_id` populated | 799 |
| `usage_count > 0` | **0** |
| `question_uid LIKE 'LMN-%'` | 1380 |
| `question_uid LIKE 'LEGACY-%'` | 20 |
| `has_image = true` | 15 |
| `difficulty_band IS NULL` | 20 |
| `question_type IS NULL` | 0 |
| `group_id IS NOT NULL` | 0 |
| `revision_no > 1` | 0 |

All 600 published questions are `single_choice`, with **exactly 4 options and
exactly 1 correct option each** (0 exceptions).

---

## 1.1 Schema and taxonomy discovery

### `content.question`

26 columns, exactly as the directive's ground-truth list states — verified
column-for-column. Relevant constraints:

- `question_pkey` PRIMARY KEY (question_id)
- `uq_question_question_uid` UNIQUE (question_uid) — **`question_uid` is genuinely unique**, enforced
- `uq_question_external_ref` UNIQUE (external_ref) WHERE NOT NULL
- `uq_question_group_seq` UNIQUE (group_id, group_sequence) WHERE group_id NOT NULL
- `fk_question_primary_node_id` to `catalog.syllabus_node(node_id)`, **NOT NULL**
- `question_canonical_question_id_fkey` self-referencing to `content.question(question_id)`
- `ck_question_lifecycle` CHECK IN (draft, in_review, approved, published, retired, **duplicate_archived**)
- `ck_question_type` CHECK IN (single_choice, multi_choice, integer, numeric, matrix_match, assertion_reason, true_false)
- `ck_question_numeric_answer` — question_type IN (integer, numeric) is equivalent to numeric_answer IS NOT NULL

Existing indexes: `idx_question_content_fp`, `idx_question_stem_fp`,
`idx_question_skeleton_fp` (all plain btree), `ix_question_lifecycle_published`
(partial).

### Options / correct-answer flag — matches the directive's assumptions

`content.question_option (option_id, question_id, option_label, option_text,
is_correct boolean, display_order)`, unique on `(question_id, option_label)`.
The correct option is flagged by the **boolean `is_correct`**, exactly as the
directive assumes. No separate answer table. No ambiguity: 0 published
questions have zero correct options, 0 have more than one.

### Node taxonomy — DIFFERS from the directive's assumptions (stop-and-report item)

```
nodes = 38, roots = 38, max_depth = 0, node_types = {'unit'}
question primary_node_id -> depth 0 ('unit') = 600   (single depth, no mixing)
published questions per node: 37 nodes, min 1, max 58, avg 16.2
```

`catalog.syllabus_node` is **not a hierarchy at all** — it is a flat list of
38 root-level "unit" nodes, every one at depth 0, no parent/child edges in
use. The directive anticipated chapter-level vs concept-level vs *mixed*
depths and prescribed Layer 5 (`node_leaf_id`) for the mixed case.

**Consequence: Layer 5 is not applicable and is not built.** Depths are not
merely consistent — there is only one depth. There is nothing to normalise.
This is reported rather than silently adapted, per the directive's Constraints.

This does **not** disturb the `answer_key`-blocking design decision — it
strengthens it. With only 38 flat units averaging 16 published questions, a
`(primary_node_id, answer_key)` index would be both too coarse *and* unable
to see the same fact filed under two units, which is precisely the failure
mode observed in §1.4 below.

### Assets / images

`content.asset (asset_id, question_id, document_id, asset_type, storage_uri,
alt_text, render_hint, option_id, group_id, target_role, mime_type,
inline_payload, width_px, height_px, byte_size, checksum_sha256,
display_order, slot_key)`.

15 asset rows, all `target_role='stem'`, all `mime_type='image/png'`, all
stored as object-storage paths (`question/<uuid>/q_<uuid>_stem_01.png`) with
`inline_payload` NULL. A hash exists — `checksum_sha256` — but it is
**cryptographic, not perceptual**, confirming the directive's Layer 1 point.

### Provenance columns

- `job_id` NOT NULL to `content.ai_generation_job`. Every question is attributed to a generation job; 50 jobs exist.
- `external_ref` — nullable, uniquely indexed; the bulk-import idempotency key.
- `group_id`/`group_sequence` — the comprehension/linked-set mechanism. **Unused: 0 rows populated.** `question_group` table exists and is empty.
- `revision_no` — defaults 1. **Unused: 0 rows above 1.**

### Lifecycle values in use

`published` (600, the only selectable state — see §1.3), `duplicate_archived`
(799), `retired` (1).

### Triggers already on `content.question`

| Trigger | Timing | Function |
|---|---|---|
| `trg_question_reject_artifacts` | **BEFORE** INS/UPD OF stem_text | `fn_reject_question_artifacts` |
| `trg_question_fingerprint_sync` | AFTER INS/UPD OF stem_text | `trg_question_fingerprint_sync` |
| `trg_question_primary_node_sync` | AFTER INS/UPD OF primary_node_id | `trg_question_primary_node_sync` |
| `trg_question_option_fingerprint_sync` (on `question_option`) | AFTER INS/DEL/UPD OF option_text | `trg_question_fingerprint_sync` |
| `trg_asset_sync_has_image` (on `asset`) | AFTER INS/DEL/UPD | `trg_asset_sync_has_image` |

---

## 1.2 Fingerprint forensics

### The fingerprints are NOT application-computed — they are database triggers

This is the single most important correction to the directive's model.
`content.fn_question_fingerprints(question_id)` computes all three:

```sql
content_fp  = sha256( normalize(stem) || CHR(31) || string_agg(normalize(option_text) ORDER BY normalize(option_text)) )
stem_fp     = sha256( normalize(stem) )
skeleton_fp = sha256( regexp_replace(normalize(stem), '\d+(\.\d+)?', '#', 'g') )
```

and `trg_question_fingerprint_sync` fires AFTER INSERT/UPDATE on **both**
`content.question` and `content.question_option`.

**Therefore there are no bypassing write paths.** Authoring UI, bulk import,
legacy migration, direct API, and a manual `psql` session all get correct
fingerprints, because the database computes them. The directive's Part 1.2
request to "report every bypassing path" resolves to: **none exist.**

### Are the columns actually read? — YES

Contrary to the directive's suspicion that the hashes might be written but
never compared: `db/assess/test/generation/assemble.ts` actively filters on
**both** `content_fp` (`$11::bytea[]`) and `skeleton_fp` (`$12::bytea[]`) in
its live candidate query, plus a `family_rank` window partitioned on
`skeleton_fp`. `usage_count` and `canonical_question_id`, by contrast, are
written **only by migrations 031/036** and read by **no runtime code path**.

### `stem_fp = skeleton_fp` count

| Scope | Count |
|---|---|
| All rows where `stem_fp = skeleton_fp` | 612 / 1400 |

**Bug 2 confirmed, and the mechanism is now exact.** `skeleton_fp` differs
from `stem_fp` if and only if the normalised stem contains a digit. Sample
rows B and C in the directive are qualitative text with no digits, so the
`\d+` replace is a no-op and the two digests are byte-identical. Sample row A
contains `5'` in "5'-sticky", so the `5` was collapsed to `#` — the directive's
inference that it "fired on the prime, stripping a token carrying real
biological meaning" is **correct**.

However the directive's conclusion that this makes `skeleton_fp` useless
should be qualified: the repo already understands this. Migration 030
deliberately left `skeleton_fp` unenforced as a bank-wide key, and
`assemble.ts` uses it correctly as a *within-one-paper* template-family
guard. That is a sound use of a lossy key. The real problem with
`skeleton_fp` is different and worse — see §1.4.

### Exact-duplicate hash collisions among published rows

| Key | Colliding groups (published) |
|---|---|
| `content_fp` | **0** |
| `stem_fp` | **0** |
| `skeleton_fp` | 62 |

Zero exact content or stem duplicates survive in the published bank —
migration 031 collapsed 799 of them into `duplicate_archived` with
`canonical_question_id` set. The 62 `skeleton_fp` groups are the intended
"same formula, different numbers" families, correctly left unmerged.

---

## 1.3 Assembler audit (`db/assess/test/generation/assemble.ts`)

The assembler is **substantially more advanced than the directive assumes**.
Audited against every Part 1.3 question:

| Question | Finding |
|---|---|
| Selection query | `LINE_CANDIDATE_SQL`, one query per blueprint line, run **sequentially** so each line excludes earlier lines' picks |
| Dedup at selection time? | **Yes** — excludes `question_id`, `content_fp`, and `skeleton_fp` arrays accumulated across all prior lines |
| Cap per `primary_node_id` per paper? | **No** — not implemented |
| Excludes recently used? | **Yes, per-user** via `assess.user_question_seen` (1246 rows). Unseen sort first; seen fall back least-recently-seen. Soft preference, never a hard exclusion (deliberate — see the file's own comment) |
| Writes back after generation? | **`usage_count` is NEVER incremented — confirmed 0 across all 1400 rows.** No paper-level or cohort-level usage table exists. `user_question_seen` is per-user only |
| `group_id`/`group_sequence` atomicity? | **Not handled** — but moot today, 0 rows use grouping |
| Randomised / fixed seed? | Randomised per attempt, `crypto.randomBytes(7)`. **Not a fixed seed** — this repetition source does not apply |
| NULL `difficulty_band`? | Handled — `($7::text is null or q.difficulty_band = $7::text)`, so a NULL-band line matches everything and a banded line correctly excludes NULL-band rows |
| `lifecycle_status` filter | Correct — hard `= 'published'`. `duplicate_archived` and `retired` rows are unreachable |
| Superseded `revision_no` selectable? | Moot — 0 rows above revision 1 |
| Post-assembly gate | **Partial** — `AssemblerDuplicateAssertionError` re-checks `content_fp` before persist. No `answer_key`, `dedup_key`, or similarity check |

**Gaps that matter:** no usage write-back, no `usage_count`-based rotation, no
canonical-awareness at selection, no per-node cap, and a post-assembly gate
that only knows about `content_fp`.

---

## 1.4 Further failure modes found

### FINDING 1 (critical, new) — decorative chapter lead-in defeats all three fingerprints

168 of 600 published questions (28%) begin with an `In <Chapter Name>, `
lead-in that is **decorative and physically meaningless**. The generator
interpolated an NCERT chapter name into an otherwise generic template.

Because the chapter name is *text*, not a number, `skeleton_fp`'s number
collapsing does nothing to it — so three copies of one question get three
different `skeleton_fp` values, three different `stem_fp` values, and three
different `content_fp` values. **Every existing guard misses them.**

Proven live:

```
LMN-PHY-PHY04-000012  skel=d9bf1668...  "In Kinetic Theory of Gases, a body of mass m = 10.0 kg ... velocity v = 15.0 m/s..."
LMN-PHY-PHY05-000018  skel=a4c6891b...  "In Waves, a body of mass m = 10.0 kg ... velocity v = 15.0 m/s..."
LMN-PHY-PHY10-000008  skel=699fa5a9...  "In Thermal Properties of Matter, a body of mass m = 10.0 kg ... velocity v = 15.0 m/s..."
```

All three carry the **identical option set** {1125.0 J, 562.5 J, 2250.0 J,
150.0 J} and the **identical correct answer, 1125.0 Joules**. They differ only
in the chapter noun and in option display order. They sit in three different
units of the same subject, so a subject-wide or full-mock Physics section can
draw all three into one paper today.

**Blast radius, measured:** normalising the lead-in away and keying on
`(stem_norm, sorted options, answer_key, question_type)` collapses the 600
published rows to **542 distinct identities — 29 collision groups, 58 rows
that would become non-canonical (9.7%)**.

**All 29 groups were reviewed by hand. All 29 are genuine duplicates. Zero
false merges.** Precision on this deterministic tier is 100/100.

### FINDING 2 — the same fact filed under many different nodes

Directly quantifies the directive's blocking-key decision. One family
(`6b9021`) spans **6 different units**; another (`18664a`) spans **7**:
Electric Charges and Fields, Ray Optics, Thermodynamics, Magnetism and Matter,
Motion in a Plane, Nuclei, Gravitation. A node-scoped dedup key would have
compared none of them. **The `answer_key`-as-global-blocking-key decision is
validated empirically.**

### FINDING 3 — `answer_key` blocking produces true *and* false pairs, as predicted

61 answer-key collision groups covering 180 published rows. Hand-inspection
confirms both classes exist:

- **True duplicates:** the NaOH molarity trio (8.0 g/1000 mL, 4.0 g/500 mL, 16.0 g/2000 mL — all 0.200 M, the same question scaled); the isothermal work trio (all −22.98 kJ because the volume *ratio* is preserved).
- **Legitimately distinct:** oxidation number `+6` in H2SO4 vs in K2Cr2O7; `2 A` from Ohm's law vs from a series-resistor network; `2 m/s` from an inelastic collision vs from gun recoil.

**This is Bug 3 confirmed with live evidence, and it is why auto-merge on
answer similarity must never ship.** Answer key blocks; identity decides;
a human confirms anything short of exact identity.

### FINDING 4 — image duplicates, including a LEGACY/LMN cross-stream overlap

Two `content.asset` rows share `checksum_sha256 = 1bb672cfb0f8...`
(questions `d3c0c759...` and `02059dbc...`). The same image is attached to two
different questions. Not detectable by any text fingerprint.

**Confirmed and extended by real perceptual hashing.** All 15 stem images were
downloaded from object storage and dHash-ed
(`db/scripts/backfill-image-phash.ts`, run live). One perceptual collision:

```
c488888080606000   LMN-CHEM-CHEM08-000119, LEGACY-13
```

This is the directive's own **sample row C**, and it confirms the directive's
prediction for it exactly: `LEGACY-13` has `has_image = true`, its
discriminating content lives in the image, and every text fingerprint is
structurally blind to the overlap.

It is also the one genuine **LEGACY-\* / LMN-\* cross-stream overlap** in the
bank — the same question imported once and re-authored once, which the
directive's §1.4 asked for specifically. It is invisible to text comparison,
which is why the "no cross-stream overlap" row in the table below is scoped to
text only.

### FINDING 5 — the normaliser is more destructive than documented

`content.fn_normalize_stem` strips every character outside
`[a-z0-9\s+\-*/=<>]`. That silently removes `^`, `_`, degree signs,
parentheses and commas — so `10^-3` becomes `10-3`, `E°` becomes `e`, and
`x^2` collapses onto `x2`. Combined with option text in `content_fp` this has
not yet caused a false merge (0 `content_fp` collisions), but it is a latent
false-positive source for any future maths-heavy import, and it is the direct
cause of the `5'-sticky` information loss in the directive's sample row A.

### FINDING 6 — repetition-control fields are inert at runtime

`usage_count` is 0 on all 1400 rows and is incremented by nothing.
`canonical_question_id` *is* populated (799 rows, by migration 031) — so the
directive's "the field is unused" is **outdated** — but no runtime query
reads it. The assembler is protected only because archived duplicates are not
`published`; nothing makes that protection explicit.

### Failure modes checked and found ABSENT

| Mode | Result |
|---|---|
| Multiple `revision_no` with old ones still published | **None** — 0 rows above revision 1 |
| Shuffled option sets producing different hashes | **Already handled** — `content_fp` sorts options before hashing |
| Smart quotes / primes / unicode variance | **Already handled** — NFKC + punctuation strip folds `5'` and the prime character together |
| Case / punctuation variance | **Already handled** by `fn_normalize_stem` |
| LaTeX `$x$` vs `\(x\)` | Partially handled — `$` collapsed, `\(`/`\)` survive as stripped punctuation, so both fold |
| LEGACY-* / LMN-* cross-stream overlap (text) | **None in text** — the 20 LEGACY rows produce no cross-stream text or identity collision. But see Finding 4: there IS one cross-stream overlap, and it is an **image** one (`LEGACY-13` / `LMN-CHEM-CHEM08-000119`), invisible to every text fingerprint |
| `question_uid` non-unique | **Unique**, DB-enforced |
| Numeric-only variants (what `skeleton_fp` was for) | 62 families, correctly detected and correctly left unmerged |

---

## Verdict on the directive's five "confirmed bugs"

| # | Directive's claim | Live verdict |
|---|---|---|
| 1 | Dedup is exact-hash only, catches nothing real | **Confirmed in principle, overstated in fact.** Exact hashing already removed 799 clones. But it is blind to paraphrase, and Finding 1 shows it is blind to a trivial *non*-paraphrase too |
| 2 | `skeleton_fp` inert on qualitative text, lossy when it fires | **Confirmed**, mechanism identified exactly (digit-presence). Qualified: the repo uses it correctly as a scoped family guard, not as a bank key |
| 3 | Stem-only similarity is dangerous; identity = stem+options+answer | **Confirmed with live counter-examples** (Finding 3). Adopted as specified |
| 4 | Legacy metadata self-contradictory; recompute flags | **Confirmed but tiny** — 20 LEGACY rows, 20 NULL `difficulty_band`. `has_image` is already trigger-computed from `content.asset` (migration 028), so it is trustworthy; `has_math`/`has_table` are not |
| 5 | `canonical_question_id` and `usage_count` unwritten | **Half wrong, half confirmed.** `canonical_question_id`: populated on 799 rows. `usage_count`: **never incremented, confirmed 0/1400** |

---

## Deviations from the directive, with reasons

1. **Layer 5 (`node_leaf_id`) not built.** Taxonomy is flat — 38 roots, one
   depth. The directive scopes Layer 5 to "only if 1.1 shows mixed depths".
   It does not.

2. **`stem_vec` provisioned but left NULL.** No embedding provider is
   configured in this environment (`.env` holds only Supabase + Postgres
   credentials; `content.document_chunk.embedding vector(1024)` exists and is
   0/0 populated — the pipeline was never built). The column and
   `embed_model_version` are created so an embedding tier can drop in, but
   near-duplicate detection ships on the **lexical tier the directive itself
   specifies in Layer 3** (`pg_trgm` over `stem_norm`), which is tunable with
   real precision/recall today. Shipping fabricated vectors would be worse
   than shipping none.

3. **Identity trigger is AFTER, not BEFORE.** `answer_key` and the option
   hash depend on `content.question_option` rows, which are inserted *after*
   the parent question row — a BEFORE trigger on `content.question` cannot
   see them. The existing `trg_question_fingerprint_sync` solved this the
   same way. The permanence guarantee is preserved: the recompute and the
   unique-index check both occur inside the writer's own transaction, so a
   violation still aborts it. Application-supplied values are always
   overwritten, never trusted.
