# QUESTION_DEDUP_THRESHOLDS — threshold tuning report

Deliverable 8 of `question-dedup-audit-and-fix.md`. The directive is explicit:
*"Tune thresholds empirically against a hand-labelled sample. Do not ship a
guessed number; report precision and recall."*

**Shipped threshold: `0.45` trigram similarity over `stem_norm`, blocked on
`answer_key`.** Precision 1.000, recall 1.000 on a labelled sample of 209
pairs.

---

## What is being thresholded

Only the **Layer 3 review queue** — which pairs get shown to a human. It is
not a merge threshold. Nothing in this system merges on similarity at any
score; see "Why no auto-merge" below.

The exact-identity tier (`dedup_key`) has no threshold at all — it is byte
equality, enforced by a unique index.

---

## Method

**Candidate generation.** All pairs of published questions that

- share a normalised `answer_key` (the global blocking key), and
- share a `question_type`, and
- do **not** already share a `dedup_key` (those are the unique index's
  business, not a reviewer's).

That yields **209 pairs** on the live bank of 600 published questions.

**Similarity metric.** `pg_trgm`'s `similarity()` over `stem_norm`. Chosen
over embeddings because no embedding provider is configured in this
environment — see `docs/QUESTION_DEDUP_AUDIT.md`, deviation 2. This is the
directive's own Layer 3 "cheaper lexical tier"; it is what can be honestly
tuned today.

**Labelling.** Each pair labelled duplicate / distinct. The label is
reproducible rather than a private judgement call: two questions are labelled
duplicates iff their stems are identical after (a) the production
`stem_norm`, (b) removal of an interpolated topic phrase wherever it appears,
and (c) collapsing all numbers. Every pair in the boundary region 0.20–0.60
was then read by hand and agreed with the automated label.

---

## Results

| Threshold | TP | FP | FN | TN | Precision | Recall |
|---|---|---|---|---|---|---|
| 0.30 | 197 | 3 | 0 | 9 | 0.985 | 1.000 |
| **0.35** | **197** | **0** | **0** | **12** | **1.000** | **1.000** |
| **0.40** | **197** | **0** | **0** | **12** | **1.000** | **1.000** |
| **0.45 (shipped)** | **197** | **0** | **0** | **12** | **1.000** | **1.000** |
| **0.50** | **197** | **0** | **0** | **12** | **1.000** | **1.000** |
| 0.55 | 194 | 0 | 3 | 12 | 1.000 | 0.985 |
| 0.60 | 180 | 0 | 17 | 12 | 1.000 | 0.914 |
| 0.70 | 88 | 0 | 109 | 12 | 1.000 | 0.447 |

Sample: 209 pairs — 197 duplicates, 12 distinct.

### Why 0.45

There is a **completely empty band between 0.328 and 0.523**. No pair in the
whole corpus scores in it. The nearest false positive sits at 0.328 and the
nearest false negative at 0.523, so any threshold in `[0.35, 0.50]` is
perfect. 0.45 is chosen as the midpoint of that plateau — maximally far from
both failure modes, so ordinary corpus drift has to move a pair a long way
before the threshold starts making mistakes.

Shipping 0.55 or above would start losing true duplicates immediately (recall
0.985 and falling); shipping 0.30 admits the first false positive.

---

## The labelled boundary, in full

Everything at or above 0.523 — all true duplicates. Template families whose
members differ only by an interpolated chapter name:

| Score | Pair | Why duplicate |
|---|---|---|
| 0.934 | CHEM03-000027 / CHEM03-000001 | Same isothermal-work question; volume *ratio* preserved so the answer is identical |
| 0.922 | PHY04-000013 / PHY08-000022 | `In <Chapter>, a parameter of magnitude X coupled with factor Y` |
| 0.896 | PHY07-000020 / PHY09-000010 | `In <Chapter>, a body of mass m = 12.0 kg...` |
| 0.878 | PHY07-000023 / PHY07-000022 | `Which fundamental physical principle governs the conservation laws in <Chapter>?` |
| 0.523 | PHY02-000029 / PHY10-000012 | Same conservation-laws template, furthest-apart chapter names |

Everything at or below 0.328 — all genuinely distinct, and all correctly
**not** queued:

| Score | Pair | Why distinct |
|---|---|---|
| 0.328 | PHY07-001060 / PHY07-001040 | Gun recoil vs inelastic collision. Both answer `2 m/s` |
| 0.325 | ZOO07-000233 / ZOO07-000237 | Text definition of residual volume vs reading it off a spirometer trace |
| 0.312 | CHEM08-000113 / CHEM08-000110 | Pie chart of mass % vs a mol-ratio table. Both answer `CH2O` |
| 0.296 | PHY02-000105 / PHY02-000101 | Series-resistor network vs bare Ohm's law. Both answer `2 A` |
| 0.227 | CHEM04-001045 / CHEM04-001040 | NH3 vs CH4 hybridisation. Both answer `sp3` |
| 0.200 | ZOO03-000105 / ZOO03-000104 | Bioluminescence vs comb plates. Both answer `Ctenophora` |
| 0.198 | ZOO03-000103 / ZOO03-000101 | Canal system vs spicules. Both answer `Porifera` |

---

## Why no auto-merge, at any score

The table immediately above is the whole argument, and it is the directive's
Bug 3 with live data behind it. Seven pairs in this bank share a normalised
answer key and are unambiguously different questions. A system that merged on
answer-key agreement would destroy all seven. A system that merged on high
similarity alone would be safe *on this corpus today* — the gap is clean — but
the gap is a property of this bank at this moment, not a guarantee, and the
cost of a wrong merge is a silently deleted question.

So: the exact-identity tier merges (byte equality, no judgement involved), and
the similarity tier only ever files a `pending` row in
`content.question_duplicate_candidate` for a person. Rejections are permanent,
enforced by the unique `(question_id_a, question_id_b)` index rather than by
job logic.

---

## Caveats, stated rather than buried

1. **The sample is one bank at one moment.** 209 pairs, dominated by
   generator-produced Physics template families. It is not a general-purpose
   NEET question corpus, and the clean 0.328/0.523 gap should not be assumed
   to survive a large human-authored import. Re-run this tuning after any
   substantial ingest.

2. **Trigram similarity is lexical, not semantic.** It will not catch the
   directive's motivating example — *"Which enzyme recognises GAATTC?"* vs
   *"EcoRI cleaves which palindromic sequence?"* — because those share almost
   no character trigrams. Catching genuine paraphrase needs the embedding
   tier, which is provisioned (`stem_vec vector(1024)`,
   `embed_model_version`) and unpopulated. **This is the single largest
   remaining gap in the fix**, and no threshold choice closes it.

3. **Recall is measured against pairs the blocking key produced.** A duplicate
   pair whose two members have different `answer_key` values never becomes a
   candidate and is invisible to this table. That is the accepted cost of
   blocking, and it is the right trade: the audit showed answer-key blocking
   is what makes cross-node duplicates visible at all.

---

## Reproducing

```
npx tsx db/scripts/detect-duplicate-candidates.ts --dry-run
npx tsx db/scripts/detect-duplicate-candidates.ts --threshold 0.45 --dry-run
```

Requires `stem_norm` and `answer_key` to be populated
(`backfill-question-identity.ts --execute`); the job warns loudly if they are
not.
