# Fixed paper composition — I-17

**Date:** 2026-08-27
**Author:** Prince
**Branch:** `NEET-assessment-tool-CSK`
**Status:** Composition complete, dry-run verified against the live database. Not yet run live — awaiting go-ahead before writing to the database (this project's convention: no live DB write without explicit sign-off).

## Scope reconciliation — read this first

The task line was: *"One complete paper composed from imported questions — section structure, question order, marks, answer key cross-checked against question_solution — paper sheet ready to be seeded as a fixed test."*

`docs/note-to-prince-day2-batch5-6.md` says the same thing more specifically: compose a fixed paper from the 139 live `lifecycle_status='published'` questions (119 from batches 1-4 + 20 legacy), cross-checked against `content.question_solution`.

**This composition uses all 139 currently published questions, not the official 180-question NEET pattern (45/subject).** Confirmed directly against the live database: published counts per subject are Physics 35, Chemistry 34, Botany 36, Zoology 34 (139 total). A 45-per-subject paper needs 41 more questions than exist right now (batches 5-8 aren't authored yet). Padding to 180 would mean inventing questions with no home in the live database, or reusing questions twice in one paper — both worse than composing the complete paper the live content actually supports today.

## What's in this delivery

1. `db/scripts/paper-i17-composition.json` — the machine-readable spec (marking scheme code, exam pattern shape, test metadata, 4 sections each with its ordered list of `question_uid`s). Generated directly from a live-database query (not hand-typed), then hand-verified against the answer key below.
2. `db/scripts/compose-fixed-paper-i17.ts` — a dry-run-by-default script built on this repo's own proven building blocks: `createTest` (`db/assess/test/definition/create-test.ts`), `ingestFixedPaper` (`db/assess/test/definition/ingest-paper.ts`), and `generateTestCode` (`db/assess/test/definition/test-code.ts`) — the same combination `db/scripts/prove-te-p3-assembly.ts` already proved for FIXED-mode tests. Resolves every `question_uid` to a live `question_id`, validates (published, exactly-one-correct-option, has a `question_solution` row, correct subject), then writes `catalog.exam_pattern` + `catalog.pattern_section` (×4) + `assess.test` + `assess.test_section` (×4) + `assess.test_question` (×139). Run `npx tsx db/scripts/compose-fixed-paper-i17.ts` for a dry run, `--live` to write.
3. This document — the human-readable "paper sheet": section structure, full question order, marks, and the answer key, with the cross-check methodology and results.

## Section structure

Paper order follows NEET's conventional subject order (Physics, Chemistry, Botany, Zoology). Within each section, the section's own authored batch chapter runs first in its original authored order, followed by that subject's legacy questions (ordered by their original legacy id).

| Seq | Section | Subject | Questions | Marks (this section) |
|---|---|---|---|---|
| 1 | PHY | Physics | 35 | 140 |
| 2 | CHEM | Chemistry | 34 | 136 |
| 3 | BOT | Botany | 36 | 144 |
| 4 | ZOO | Zoology | 34 | 136 |
| — | **Total** | | **139** | **556** |

**Marking scheme:** reused as-is from the live `catalog.marking_scheme` row `NEET_STANDARD` — +4 correct, −1 incorrect, 0 unattempted. Not a new scheme.

**Duration:** 154 minutes — scaled from NEET's official 200 minutes for 180 questions: `round(139/180 × 200) = 154`.

**Test code:** assigned at seed time by `generateTestCode('NEET', 'MOCK', 'ALL')`, following `db/assess/test/definition/test-code.ts`'s convention (`LMN-<EXAM>-<TYPE>-<SCOPE>-<serial>`). No existing `assess.test` row uses `TEST_TYPE=MOCK` (confirmed live), so this resolves to `LMN-NEET-MOCK-ALL-000001` — the script re-checks the next free serial itself at seed time rather than hard-coding it.

**Pattern:** a new `catalog.exam_pattern` row is created (`version_no` = next free for the NEET 2027 cycle, `is_current=false` — only one `is_current=true` pattern is allowed per cycle by `catalog.uq_exam_pattern_current_per_cycle`, reserved for the cycle's official pattern; this is a supplementary paper shape, same convention `create-practice-test.ts` already uses).

**One excluded question:** `LMN-CHEM-CHEM08-000112` (retired during a CL-4 lifecycle-service proof run — the content itself is correct, it's simply not `published`). Batch-2's Chemistry chapter therefore contributes 29 questions here, not 30.

**A known pre-existing mapping quirk, not something introduced or fixed here:** 6 of the 20 legacy questions carry a `subject` label in `database_sample/questions.ts` that disagrees with the `catalog.syllabus_node` their `unit` string actually maps to — e.g. legacy id 3 is labelled `subject: "Botany"` but its unit `"Genetics & Evolution"` maps to `zoo_05`, a Zoology node. The sectioning below follows the **real, live node-derived subject** (confirmed by direct query against `content.question` joined through `catalog.syllabus_node`/`catalog.subject`), not the legacy label — that's what `ingestFixedPaper`'s own validation checks against anyway. Affected: legacy ids 3, 4, 7, 8, 9, 10.

## Answer-key cross-check — methodology and result

For all 139 questions, the correct option was read directly from the live `content.question_option` table (`is_correct=true`) and cross-checked against an independent re-derivation of the correct answer from each question's `content.question_solution.explanation_text`.

**Result: 139/139 consistent. Zero mismatches.** A live-database integrity sweep additionally confirmed, for all 139 rows: exactly one `is_correct` option each, and a non-empty `content.question_solution` row each — a data-integrity check, not a repeat of the semantic hand-check (a query can't judge whether an explanation's reasoning actually supports the marked answer; the hand check covers that separately).

`compose-fixed-paper-i17.ts` re-runs this same live check every time it's invoked (dry run or live), so the check is repeated automatically if any question's data changes before this is seeded.

## Physics — 35 questions (140 marks)

Batch-1 (Current Electricity, `phy_02`, `LMN-PHY-PHY02-000101`–`000130`) followed by 5 legacy questions.

| Seq | Question UID | Topic | Correct |
|---|---|---|---|
| 1 | LMN-PHY-PHY02-000101 | Ohm's law | C |
| 2 | LMN-PHY-PHY02-000102 | Resistance ratio (L, r) | A |
| 3 | LMN-PHY-PHY02-000103 | Temperature coefficient of resistance | D |
| 4 | LMN-PHY-PHY02-000104 | Drift velocity | B |
| 5 | LMN-PHY-PHY02-000105 | Series resistors, current | A |
| 6 | LMN-PHY-PHY02-000106 | Parallel resistors, equivalent R | C |
| 7 | LMN-PHY-PHY02-000107 | Cell with internal resistance | B |
| 8 | LMN-PHY-PHY02-000108 | Cells in series (EMF, r) | D |
| 9 | LMN-PHY-PHY02-000109 | Cells in parallel (r_eq) | A |
| 10 | LMN-PHY-PHY02-000110 | Kirchhoff's current law | B |
| 11 | LMN-PHY-PHY02-000111 | Kirchhoff's voltage law — origin | D |
| 12 | LMN-PHY-PHY02-000112 | Wheatstone bridge balance condition | C |
| 13 | LMN-PHY-PHY02-000113 | Wheatstone bridge, find S | A |
| 14 | LMN-PHY-PHY02-000114 | Metre bridge, find X | B |
| 15 | LMN-PHY-PHY02-000115 | Potentiometer principle | C |
| 16 | LMN-PHY-PHY02-000116 | Potentiometer, EMF ratio | D |
| 17 | LMN-PHY-PHY02-000117 | Power dissipated (I²R) | A |
| 18 | LMN-PHY-PHY02-000118 | Heater, heat produced | B |
| 19 | LMN-PHY-PHY02-000119 | Series-parallel combination | C |
| 20 | LMN-PHY-PHY02-000120 | Resistor colour code | A |
| 21 | LMN-PHY-PHY02-000121 | Superconductor definition | D |
| 22 | LMN-PHY-PHY02-000122 | Current density | B |
| 23 | LMN-PHY-PHY02-000123 | Electron mobility | C |
| 24 | LMN-PHY-PHY02-000124 | Galvanometer to ammeter (shunt) | A |
| 25 | LMN-PHY-PHY02-000125 | Galvanometer to voltmeter (series R) | D |
| 26 | LMN-PHY-PHY02-000126 | Voltmeter conversion principle | B |
| 27 | LMN-PHY-PHY02-000127 | Max current condition, series grouping | A |
| 28 | LMN-PHY-PHY02-000128 | Terminal voltage | C |
| 29 | LMN-PHY-PHY02-000129 | Conductivity definition | D |
| 30 | LMN-PHY-PHY02-000130 | Ohm's law exceptions (diode) | B |
| 31 | LEGACY-16 | Rotational dynamics — solid vs hollow sphere | B |
| 32 | LEGACY-17 | Capacitance with dielectric | C |
| 33 | LEGACY-18 | Photoelectric equation slope | B |
| 34 | LEGACY-19 | de Broglie wavelength | A |
| 35 | LEGACY-20 | SHM — potential energy = half total | B |

## Chemistry — 34 questions (136 marks)

Batch-2 (Some Basic Concepts of Chemistry, `chem_08`, `LMN-CHEM-CHEM08-000101`–`000130` minus retired `-000112`) followed by 5 legacy questions.

| Seq | Question UID | Topic | Correct |
|---|---|---|---|
| 1 | LMN-CHEM-CHEM08-000101 | Moles from mass | A |
| 2 | LMN-CHEM-CHEM08-000102 | Molecules from moles | A |
| 3 | LMN-CHEM-CHEM08-000103 | Mass from moles | B |
| 4 | LMN-CHEM-CHEM08-000104 | Volume at STP | B |
| 5 | LMN-CHEM-CHEM08-000105 | Average atomic mass (isotopes) | A |
| 6 | LMN-CHEM-CHEM08-000106 | Atoms from moles | B |
| 7 | LMN-CHEM-CHEM08-000107 | Mass of a single molecule | A |
| 8 | LMN-CHEM-CHEM08-000108 | Mole diagram, volume at STP | B |
| 9 | LMN-CHEM-CHEM08-000109 | Empirical formula from % composition | A |
| 10 | LMN-CHEM-CHEM08-000110 | Empirical formula from mole ratio | A |
| 11 | LMN-CHEM-CHEM08-000111 | Molecular formula from empirical | C |
| 12 | LMN-CHEM-CHEM08-000113 | Empirical formula (pie chart) | A |
| 13 | LMN-CHEM-CHEM08-000114 | Empirical vs molecular formula relation | B |
| 14 | LMN-CHEM-CHEM08-000115 | Molecular formula from empirical (hydrocarbon) | A |
| 15 | LMN-CHEM-CHEM08-000116 | Stoichiometry — NH3 formation | B |
| 16 | LMN-CHEM-CHEM08-000117 | Limiting reagent (H2/O2) | B |
| 17 | LMN-CHEM-CHEM08-000118 | Mass of product (combustion) | C |
| 18 | LMN-CHEM-CHEM08-000119 | Limiting reagent (diagram) | A |
| 19 | LMN-CHEM-CHEM08-000120 | Limiting reagent (bar graph) | B |
| 20 | LMN-CHEM-CHEM08-000121 | Percentage yield | C |
| 21 | LMN-CHEM-CHEM08-000122 | Mass of product (Mg + O2) | B |
| 22 | LMN-CHEM-CHEM08-000123 | Excess reagent remaining | C |
| 23 | LMN-CHEM-CHEM08-000124 | Molarity | B |
| 24 | LMN-CHEM-CHEM08-000125 | Molality | B |
| 25 | LMN-CHEM-CHEM08-000126 | Mole fraction | B |
| 26 | LMN-CHEM-CHEM08-000127 | Dilution law | C |
| 27 | LMN-CHEM-CHEM08-000128 | Titration (diagram) | B |
| 28 | LMN-CHEM-CHEM08-000129 | Normality | C |
| 29 | LMN-CHEM-CHEM08-000130 | Mixing solutions, resulting molarity | C |
| 30 | LEGACY-11 | Electron gain enthalpy, p-block | B |
| 31 | LEGACY-12 | Hybridisation of XeF4 | C |
| 32 | LEGACY-13 | Boiling point elevation (van't Hoff factor) | C |
| 33 | LEGACY-14 | Werner's coordination theory | A |
| 34 | LEGACY-15 | Wurtz reaction intermediate | C |

## Botany — 36 questions (144 marks)

Batch-3 (Plant Kingdom, `bot_07`, `LMN-BOT-BOT07-000101`–`000130`) followed by 6 legacy questions.

| Seq | Question UID | Topic | Correct |
|---|---|---|---|
| 1 | LMN-BOT-BOT07-000101 | Rhodophyceae pigment | C |
| 2 | LMN-BOT-BOT07-000102 | Chlorophyceae reserve food | B |
| 3 | LMN-BOT-BOT07-000103 | Phaeophyceae pigment | C |
| 4 | LMN-BOT-BOT07-000104 | Phaeophyceae cell wall | A |
| 5 | LMN-BOT-BOT07-000105 | Chlorophyceae example | C |
| 6 | LMN-BOT-BOT07-000106 | Rhodophyceae example | D |
| 7 | LMN-BOT-BOT07-000107 | Vegetative reproduction in algae | A |
| 8 | LMN-BOT-BOT07-000108 | Zoospores | B |
| 9 | LMN-BOT-BOT07-000109 | Anisogamy | C |
| 10 | LMN-BOT-BOT07-000110 | Algal habitat | B |
| 11 | LMN-BOT-BOT07-000111 | Bryophyte dominant generation | B |
| 12 | LMN-BOT-BOT07-000112 | Bryophytes as "amphibians" | B |
| 13 | LMN-BOT-BOT07-000113 | Liverwort example | B |
| 14 | LMN-BOT-BOT07-000114 | Moss protonema | B |
| 15 | LMN-BOT-BOT07-000115 | Fern dominant generation | C |
| 16 | LMN-BOT-BOT07-000116 | First true vascular tissue | C |
| 17 | LMN-BOT-BOT07-000117 | Heterospory in pteridophytes | C |
| 18 | LMN-BOT-BOT07-000118 | Sori | A |
| 19 | LMN-BOT-BOT07-000119 | Pteridophyte classes | D |
| 20 | LMN-BOT-BOT07-000120 | Moss example | B |
| 21 | LMN-BOT-BOT07-000121 | Gymnosperm = naked seed | A |
| 22 | LMN-BOT-BOT07-000122 | Gymnosperm example | B |
| 23 | LMN-BOT-BOT07-000123 | Gymnosperm leaf adaptation | B |
| 24 | LMN-BOT-BOT07-000124 | Haplontic life cycle | A |
| 25 | LMN-BOT-BOT07-000125 | Diplontic life cycle | A |
| 26 | LMN-BOT-BOT07-000126 | Haplo-diplontic life cycle | C |
| 27 | LMN-BOT-BOT07-000127 | Gymnosperm gametophyte dependency | B |
| 28 | LMN-BOT-BOT07-000128 | Gymnosperm pollination | C |
| 29 | LMN-BOT-BOT07-000129 | Cycas — dioecious | B |
| 30 | LMN-BOT-BOT07-000130 | Gymnosperm endosperm timing | B |
| 31 | LEGACY-1 | Start codon (AUG) | B |
| 32 | LEGACY-2 | DNA replication — leading strand | A |
| 33 | LEGACY-5 | Ecological pyramid (energy) | B |
| 34 | LEGACY-7 | Mutualism (sea anemone/hermit crab) | C |
| 35 | LEGACY-8 | Primary consumer (grasshopper) | B |
| 36 | LEGACY-10 | Semi-conservative DNA replication origin | A |

## Zoology — 34 questions (136 marks)

Batch-4 (Animal Kingdom, `zoo_03`, `LMN-ZOO-ZOO03-000101`–`000130`) followed by 4 legacy questions.

| Seq | Question UID | Topic | Correct |
|---|---|---|---|
| 1 | LMN-ZOO-ZOO03-000101 | Choanocytes — Porifera | B |
| 2 | LMN-ZOO-ZOO03-000102 | Cnidocytes — Coelenterata | B |
| 3 | LMN-ZOO-ZOO03-000103 | Canal system — Porifera | A |
| 4 | LMN-ZOO-ZOO03-000104 | Comb plates — Ctenophora | C |
| 5 | LMN-ZOO-ZOO03-000105 | Bioluminescence — Ctenophora | C |
| 6 | LMN-ZOO-ZOO03-000106 | Polymorphism (polyp/medusa) | B |
| 7 | LMN-ZOO-ZOO03-000107 | Sponge body organisation level | D |
| 8 | LMN-ZOO-ZOO03-000108 | Flame cells — Platyhelminthes | C |
| 9 | LMN-ZOO-ZOO03-000109 | Pseudocoelom — Aschelminthes | B |
| 10 | LMN-ZOO-ZOO03-000110 | Metameric segmentation — Annelida | C |
| 11 | LMN-ZOO-ZOO03-000111 | Tapeworm hooks/suckers | B |
| 12 | LMN-ZOO-ZOO03-000112 | Closed circulatory system origin | B |
| 13 | LMN-ZOO-ZOO03-000113 | Aschelminthes example (Ascaris) | C |
| 14 | LMN-ZOO-ZOO03-000114 | Annelida example (Pheretima) | C |
| 15 | LMN-ZOO-ZOO03-000115 | Arthropoda exoskeleton | B |
| 16 | LMN-ZOO-ZOO03-000116 | Radula — Mollusca | B |
| 17 | LMN-ZOO-ZOO03-000117 | Water vascular system — Echinodermata | C |
| 18 | LMN-ZOO-ZOO03-000118 | Open circulatory system — Arthropoda | B |
| 19 | LMN-ZOO-ZOO03-000119 | Mollusca example (Pila) | B |
| 20 | LMN-ZOO-ZOO03-000120 | Echinodermata larval vs adult symmetry | B |
| 21 | LMN-ZOO-ZOO03-000121 | Echinodermata endoskeleton | C |
| 22 | LMN-ZOO-ZOO03-000122 | Arthropoda example (Periplaneta) | C |
| 23 | LMN-ZOO-ZOO03-000123 | Chordata defining feature (notochord) | B |
| 24 | LMN-ZOO-ZOO03-000124 | Chondrichthyes vs Osteichthyes | B |
| 25 | LMN-ZOO-ZOO03-000125 | Chondrichthyes example (Scoliodon) | B |
| 26 | LMN-ZOO-ZOO03-000126 | Osteichthyes example (Labeo) | C |
| 27 | LMN-ZOO-ZOO03-000127 | Amphibia — 3-chambered heart | B |
| 28 | LMN-ZOO-ZOO03-000128 | Reptilia characteristics | B |
| 29 | LMN-ZOO-ZOO03-000129 | Aves characteristics | C |
| 30 | LMN-ZOO-ZOO03-000130 | Mammalia defining feature | D |
| 31 | LEGACY-3 | Dihybrid cross phenotypic ratio | B |
| 32 | LEGACY-4 | Disruptive selection | C |
| 33 | LEGACY-6 | ADA deficiency — first gene therapy | A |
| 34 | LEGACY-9 | Hardy-Weinberg — 2pq | C |

## Dry-run confirmation (live, 2026-08-27)

```
summary: {
  "totalQuestions": 139,
  "totalMarks": 556,
  "durationMinutes": 154,
  "sections": [
    { "subjectCode": "PHY",  "sectionName": "Physics",   "questionCount": 35, "marks": 140 },
    { "subjectCode": "CHEM", "sectionName": "Chemistry", "questionCount": 34, "marks": 136 },
    { "subjectCode": "BOT",  "sectionName": "Botany",    "questionCount": 36, "marks": 144 },
    { "subjectCode": "ZOO",  "sectionName": "Zoology",   "questionCount": 34, "marks": 136 }
  ],
  "errorCount": 0
}
```

Report saved at `db/reports/compose_paper-i17_2026-08-27T12-20-43-548Z.json`.

## Handoff — what's needed to seed this live

1. `npx tsx db/scripts/compose-fixed-paper-i17.ts` (dry run) — already run, confirms all 139 resolve, validate, and the test_code is free, against the real live database (see above).
2. `npx tsx db/scripts/compose-fixed-paper-i17.ts --live` — writes the pattern, sections, test, and all 139 test_question rows. **Not yet run — needs explicit go-ahead**, since it writes to the live database. The test is created `test_status='draft'` deliberately — publish it through the same review path used for the questions themselves, not by hand-editing the status column.
3. Once published, `docs/CL2_Coverage_Verification.md`'s I-17 line goes from GAP to PASS — worth a follow-up verification pass (same style as that document) confirming the live `assess.test_question` count matches this sheet exactly.
