# Coverage verification — I-16 / I-17 / I-18

**Date:** 27-08-2026
**Author:** Prince
**Scope:** Roadmap slot 15:00–16:00, `docs/LA-PLAN-002_Two_Day_Roadmap.md`. Verified directly against the live database (`db/scripts/query.ts`), not against any script's own console output.

## Summary

| Bar | Verdict |
|---|---|
| I-16 — 30+ questions in 2+ chapters per exam | **PASS** |
| I-17 — one complete fixed paper | **GAP** |
| I-18 — concept-tree/syllabus mapping confirmed | **PASS** (mapping) — gap noted (tree structure) |

## I-16 — 30+ questions in 2+ chapters per exam: PASS

Only one exam exists in `catalog.exam` (`NEET`), so all four chapters are evaluated under it.

| Chapter | Published | Meets 30+? |
|---|---|---|
| phy_02 (Physics) | 31 | Yes |
| chem_08 (Chemistry) | 29 | No — 1 short |
| bot_07 (Botany) | 30 | Yes |
| zoo_03 (Zoology) | 30 | Yes |

Bar requires 2+ chapters at 30+; three clear it, so I-16 passes. Named gap: `chem_08` sits at 29, one short of independently qualifying — caused by 1 row (`LMN-CHEM-CHEM08-000112`) retired during a CL-4 lifecycle-service proof run on 2026-08-27 (`content.question_review` shows a full `submitted → approved → published → retired` trail, note "superseded proof run"). Not a content defect.

## I-17 — one complete fixed paper: GAP

Checked every row in `assess.test` (6 total) joined through `assess.test_section` → `assess.test_question` → `content.question`.

| Test | Status | Questions wired | Chapters used |
|---|---|---|---|
| `LMN-NEET-CHAP-PHY02-000001` | published | 0 | none — section exists, empty |
| `NEET_E2E_FIXTURE` | published | 20 | old legacy chapters (phy_01/05/08, chem_01/02/06, bot_01/05, zoo_05/06), `exam_id` null |
| `TE_P3_PROOF_FIXED` | draft | 20 | same old legacy chapters |
| `TE_P3_PROOF_BLUEPRINT_1/2/3` | draft | 0 each | none |

**Quantified gap: 0 of 6 tests qualify.** The only published test tied to the newly authored content (`LMN-NEET-CHAP-PHY02-000001`) has zero questions actually attached. The only test with real question volume (`NEET_E2E_FIXTURE`, 20 questions) is a QA/E2E fixture built on old legacy chapters, not batch-1–4 content, and 20 questions is far short of a complete NEET-pattern paper. Nothing currently in the database satisfies "one complete fixed paper" built from the authored content.

This is expected to be closed by the next roadmap slot, 16:00–19:00 "Fixed paper composition (I-17)."

## I-18 — concept-tree/syllabus mapping confirmed: PASS (mapping), gap noted (tree structure)

- Question→node mapping: clean. 0 orphan questions (`primary_node_id` null) across all 140 rows in `content.question`; all 4 batch imports passed live node-mapping validation with 0 unmapped_node errors (see `docs/CL2_Error_Triage_Batch1-4.md`).
- Caveat: `catalog.syllabus_node` is currently flat — all 38 rows are `node_type='unit'`, `depth=0`, and 0 of 38 have a `parent_node_id` or `node_path` set. If "concept-tree" is meant literally as a multi-level hierarchy (unit → topic → subtopic), that structure does not exist in the database at all; it is a single-level chapter list. This is a backend/schema-population matter outside the content track's direct control, flagged here since I-18 references "concept-tree" explicitly.

## Bottom line

- I-16: pass
- I-17: fail — named gap: 0 published tests with real wired content from the new batches; carried into the 16:00–19:00 slot
- I-18: pass on the part the content track controls (question-node mapping); flagged, non-blocking structural gap on the syllabus tree itself
