# CL-1 contract review — Prince (Day 1, 11:00–12:00 slot)

**Reviewer:** Prince A. **Against:** `schemas/question-authoring.schema.ts` v1.0 (frozen 26-08-2026 11:00) and `docs/CL1_CONTENT_CONTRACT.md`.
**Source material:** 30 real, physics-checked Current Electricity questions (batch-1), bilingual English/Tamil, authored earlier today.

## Verification performed

Ran `npx tsx schemas/validate-samples.ts` — all 3 worked samples pass, all 3 deliberately-broken cases are correctly rejected. The schema's rejection path works as documented.

Ran batch-1 (all 30 questions) through the real `QuestionAuthoringSchema`/`QuestionBatchSchema` after converting to the contract's shape (see below) — **all 30 pass, zero rejections**, and a cross-check confirms exactly one `isCorrect: true` option per row.

## Fields the source data has that the schema has no place for

| Source field | Notes |
|---|---|
| `cognitiveSkill` (RECALL/APPLICATION/ANALYSIS) | No equivalent field. Worth carrying if the engine ever wants Bloom's-level tagging, but out of scope for CL-1 v1.0. |
| `marks` / `negativeMarks` | Per-question marks aren't part of the authoring contract — presumably these live at the test-pattern/section level (TE track), not per-question. Confirm this assumption with Santhosh; if a question ever needs a non-default mark, this is a gap. |
| `conceptCount` | No equivalent. Not clearly load-bearing for anything downstream yet. |
| `chapterName` / `unitName` / `topicName` (free text) | Correctly superseded by `nodeTagCode`, which resolves to a real `catalog.syllabus_node` row. No gap — just confirming the free-text fields are intentionally dropped, not lost. |
| `source` / `sourceReference` (e.g. "AI_GENERATED", authoring tool + date) | No field for provenance/authorship metadata on the question itself. If tracking AI-generated vs human-authored content matters later (it will, per Phase 8 of the roadmap), this needs a home — possibly on `content.question` directly rather than in the authoring JSON. |

None of the above block authoring — the schema simply doesn't need them for the importer to do its job. Flagging in case Santhosh wants any of them for CL-4 (review workflow) or CL-6 (volume tracking) later.

## Schema fields the source couldn't supply as-is (mapping decisions made)

| Schema field | Source had | Resolution |
|---|---|---|
| `questionUid` | `questionId` (`PHY-CUR-001001`, a different, non-existent numbering scheme) | Reassigned per the real convention: `LMN-PHY-PHY02-000101`–`000130`. |
| `subjectCode` | `subjectName: "Physics"` (full word) | Mapped to `"PHY"`. |
| `nodeTagCode` | `unitName`/`chapterName: "Current Electricity"` (free text, no real node) | Mapped to `phy_02` — confirmed against `database_sample/syllabusData.ts`, which titles this exact node "Electrostatics & **Current Electricity**" with subtopics (Kirchhoff's Laws, Wheatstone Bridge & Potentiometer) matching this batch. **This needs Santhosh's confirmation that `phy_02` is the live `catalog.syllabus_node.tag_code`** — I traced it from the frontend mock data / legacy seed mapping, not from a direct DB read. |
| `questionType` | `"MCQ"` | Mapped to `"single_choice"` (every row has exactly one correct option). |
| `difficultyBand` | `difficulty: L1`–`L4` (4 levels) | Mapped down to the schema's 3-value vocabulary: `L1→easy`, `L2→medium`, `L3→hard`, `L4→hard`. **This is a judgment call, not a contract rule** — L4 (currently 2 of 30 rows: ammeter/voltmeter conversion) arguably deserves to stand apart from L3, but the schema only has three bands. Flagging for Santhosh in case `difficultyBand` should grow a 4th value, or in case this mapping is wrong. |
| `stemText` / `options[].text` / `solution.explanationText` | `stemEn` / `options[].textEn` / `explanationEn` | Straight rename — English content moves to the top-level fields as the contract specifies. |
| `translations[]` | `stemTa` / `options[].textTa` | Moved into one `translations[{ languageCode: "ta", ... }]` entry per question, per the contract's bilingual convention. |

## Bottom line

The schema is workable for this content with the mappings above. The two items that need Santhosh's explicit sign-off before Day 2's live import (Gate G3):

1. **Confirm `phy_02` is correct** for Current Electricity — I inferred it from mock/legacy data, not a live DB query.
2. **Confirm the L1–L4 → easy/medium/hard mapping** (specifically L4) is acceptable, or amend `difficultyBand`'s vocabulary in CL-1 v1.1.

No amendment to the schema file itself is being requested — the gaps above are additive (fields the schema could optionally grow later), not blockers.

## Batch-2 (Chemistry, "Some Basic Concepts of Chemistry") — a real blocker found

Same field-renaming mappings applied cleanly (subjectCode `CHEM`, `single_choice`, same difficulty mapping). Schema-shape validation passes for all 30 rows (`batch-2-chemistry-pending-node.json`). But unlike batch-1, **this chapter has no matching real syllabus node**:

- Checked all 6 seeded Chemistry nodes (`chem_01`–`chem_06` in `database_sample/syllabusData.ts`): Organic Reactions, Inorganic/p-Block, Equilibrium & Thermodynamics, Atomic Structure & Bonding, Hydrocarbons, Electrochemistry/Solutions/Surface Chem.
- "Some Basic Concepts of Chemistry" (mole concept, stoichiometry, molarity/molality — NCERT Class 11 Ch. 1) isn't any of them.
- `nodeTagCode` is written as the obvious placeholder `"UNMAPPED_some_basic_concepts_of_chemistry"` rather than a guessed real code, so the importer's node-resolution step correctly buckets these as **unmapped**, not silently wrong.

**This needs Santhosh's decision before Day 1's G5/G3 gates**: either a new `catalog.syllabus_node` row needs to be added for this chapter, or the currently-seeded node set is incomplete and a real one already exists that isn't in the mock data I checked.

**Also flagging — image assets not yet in the upload folder.** 5 of the 30 batch-2 questions reference diagram images (`CHE_SOMBAS_DIAG_0001.png`–`0005.png`, `targetRole: "stem"` in each case). The diagrams themselves were shared as inline images in this conversation, not as files — I have no file-system access to extract and save them, so **the actual PNG files still need to be produced and placed in the shared upload folder** before CL-3's asset resolver or CL-2's import can find them. The JSON's `images[]` references are correct and ready; the files behind them are the open item.
