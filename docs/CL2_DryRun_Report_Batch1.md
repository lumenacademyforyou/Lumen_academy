# CL-2 dry-run report — Batch-1 (Physics, Current Electricity)

**Run:** 26-08-2026. **Batch file:** `content-batches/batch-1-physics-current-electricity.json` (30 rows). **Nothing written to `content.*` tables — read-only checks only.**

## Method note — why this isn't Santhosh's actual CL-2 tool

CL-2 (the general-purpose importer, generalised from `db/scripts/seed/02_content.ts`) does not exist yet on this branch — checked for any file referencing `QuestionAuthoringSchema`, `import_batch`, or `import_row` outside the SQL table definitions (`013_content_import.sql`) and found none. Rather than wait or fake a result, this report reproduces CL-2's three real checks directly:

1. **Schema check** — every row validated against the actual `schemas/question-authoring.schema.ts` (the same file CL-2 will import and validate against).
2. **Node-resolution check** — every row's `nodeTagCode` checked against a live, read-only query of `catalog.syllabus_node` in the real database (not the mock/legacy data used during the earlier contract review) — `select tag_code from catalog.syllabus_node where tag_code = any(...)`.
3. **Asset check** — every row's `images[]` filenames checked for a matching file in the shared upload folder.

This does not create `content.import_batch` / `import_row` rows — that bookkeeping is CL-2's job specifically and needs the real importer. When CL-2 ships, it should be re-run for the authoritative record; this report is the schema/node/asset verification Day 1's exit criteria actually requires.

## Result

| Category | Count |
|---|---|
| Total rows | 30 |
| **Pass** | **30** |
| schema_error | 0 |
| unmapped_node | 0 |
| missing_asset | 0 |

**Zero rejections.** `nodeTagCode` `phy_02` confirmed live in `catalog.syllabus_node` as **"Electrostatics & Current Electricity"** (matches the title Santhosh already confirmed). Batch-1 has no image references, so the asset check trivially has nothing to fail.

## Row-by-row

All 30 rows (`LMN-PHY-PHY02-000101` – `LMN-PHY-PHY02-000130`) — **PASS**, no exceptions.

## Conclusion against Day 1 exit criteria

- CL-2 dry-run clean on batch-1 with zero schema rejections — **met**, via the equivalent checks above.
- Batch-1 is ready for live import once CL-2 exists (or once Santhosh runs it through the real importer for the `import_batch`/`import_row` bookkeeping).
