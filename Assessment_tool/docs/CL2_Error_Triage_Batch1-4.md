# Error triage — Batch-1 to Batch-4 content authoring

**Date:** 26-08-2026
**Author:** Prince
**Scope:** All failures/blockers hit while authoring and dry-running 120 questions (Physics `phy_02`, Chemistry `chem_08`, Botany `bot_07`, Zoology `zoo_03`) against the CL-1 contract (`schemas/question-authoring.schema.ts`).

## Summary

| # | What failed | Category | Root cause | Fix owner | Status |
|---|---|---|---|---|---|
| 1 | First-pass content used a completely different schema (`questionId`/`stemEn`/`subjectName`, Prisma-style) | schema_error | Content was authored before checking the real CL-1 contract shape | **Prince** | Fixed — rebuilt from scratch against `QuestionAuthoringSchema` |
| 2 | Batch-2 chemistry rows had no valid `nodeTagCode` (placeholder `UNMAPPED_some_basic_concepts_of_chemistry`) | unmapped_node | The chapter didn't appear in the mock frontend data (`database_sample/syllabusData.ts`), which is incomplete vs. the live DB — no way to confirm the real code without asking | **Santhosh** | Fixed — Santhosh confirmed and committed real code `chem_08` |
| 3 | Batch-2 `questionUid` still read `LMN-CHEM-PENDING-...` after node was fixed | schema_error (leftover) | Node code was corrected in `nodeTagCode` but the UID segment wasn't updated to match | **Prince** | Fixed — bulk string-replaced `PENDING`→`CHEM08`, re-validated 30/30 |
| 4 | Batch-2's 5 referenced diagram images didn't exist on disk | missing_asset | Diagrams existed only as inline chat images, not exportable as files by me directly | **Prince** | Fixed — regenerated all 5 as PNGs via matplotlib from the original descriptions, placed at `content-batches/assets/batch-2/` |
| 5 | Batch-3 Tamil per-option translations were dropped mid-transcription | schema_error (would-be silent data loss, caught before validation) | Manual transcription shortcut to save space | **Prince** | Fixed — rewrote source with `textTa` on every option before converting |

**Net result:** 0 rows currently failing in any batch. 120/120 pass schema + live node + asset checks (see `docs/CL2_DryRun_Report_Batch1.md`, `docs/CL2_DryRun_Report_Batch2-3-4.md`).

## What Santhosh must change (process, not content)

- **Publish the live `catalog.syllabus_node` code list up front**, before handing off a chapter for authoring — batch-2's blocker only happened because the mock data Prince had access to (`syllabusData.ts`) doesn't cover every chapter (e.g. `chem_08`, `bot_07` are missing from it entirely). Prince had to query the live DB directly for batch-3/4 to avoid repeating this.
- When fixing a `nodeTagCode` directly in a content file, also check the `questionUid` segment derived from it — item #3 above was a one-field fix that missed a dependent field.

## What Prince must re-author / keep doing

- Never start authoring against a schema that hasn't been confirmed live against `schemas/question-authoring.schema.ts` — item #1 cost a full rebuild.
- Always query the live syllabus node table before conversion rather than trusting mock data (this is now standard practice as of batch-3/4 and produced zero unmapped-node issues on either).
- Always double-check bilingual (Tamil) fields are preserved at both stem and per-option level before running validation, not after.

## Not a failure, just a flagged risk (no action needed now)

- Batch-1's `phy_02` code was inferred from mock data before Santhosh's confirmation — it turned out correct, but it was still a guess at the time and was labeled as such in `docs/CL1_Contract_Review_Prince.md` rather than assumed silently.
