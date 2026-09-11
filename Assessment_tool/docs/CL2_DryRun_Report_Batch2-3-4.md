# CL-2 dry-run report — Batch-2, Batch-3, Batch-4

**Run:** 26-08-2026. Same method as `docs/CL2_DryRun_Report_Batch1.md` (CL-2 importer itself still doesn't exist on this branch, so this reproduces its three checks directly: schema validation against `schemas/question-authoring.schema.ts`, a live read-only query against `catalog.syllabus_node`, and a file-existence check against the shared asset folder). Nothing written to `content.*` tables.

## Result

| Batch | File | Subject | Node | Rows | Pass | schema_error | unmapped_node | missing_asset |
|---|---|---|---|---|---|---|---|---|
| 2 | `content-batches/batch-2-chemistry-pending-node.json` | Chemistry | `chem_08` | 30 | 30 | 0 | 0 | 0 |
| 3 | `content-batches/batch-3-botany-plant-kingdom.json` | Botany | `bot_07` | 30 | 30 | 0 | 0 | 0 |
| 4 | `content-batches/batch-4-zoology-animal-kingdom.json` | Zoology | `zoo_03` | 30 | 30 | 0 | 0 | 0 |

**Zero rejections across all three batches, all three categories.**

## Notes

- **Batch-2** was previously blocked on an unmapped node (flagged in the original `CL1_Contract_Review_Prince.md` as `"UNMAPPED_some_basic_concepts_of_chemistry"`). Santhosh confirmed and committed the real node (`chem_08` — "Some Basic Concepts & States of Matter") directly to the batch file; this run confirms it resolves live. `questionUid`'s node segment was also corrected from the leftover `PENDING` placeholder to `CHEM08` to match.
- Batch-2's 5 image-bearing rows (`CHE_SOMBAS_DIAG_0001.png`–`0005.png`) all resolve — the diagrams were generated and placed at `content-batches/assets/batch-2/` and are now confirmed present by this check.
- **Batch-3** (`bot_07` — Biological Classification & Plant Kingdom) and **Batch-4** (`zoo_03` — Animal Diversity & Structural Organisation) both node-mapped cleanly on the first try; their real node codes were confirmed via live query before conversion, so no unmapped-node risk was carried into these batches.
- None of batch-3 or batch-4 reference images, so the asset check is trivially satisfied for both.

## Running total across all four batches

120 questions authored, converted, and dry-run clean: 30 Physics (`phy_02`), 30 Chemistry (`chem_08`), 30 Botany (`bot_07`), 30 Zoology (`zoo_03`). All four ready for live import once CL-2 exists.
