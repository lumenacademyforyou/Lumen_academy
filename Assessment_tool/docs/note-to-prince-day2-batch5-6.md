**Day 2 handoff — batch-5/6 authoring, target 180 questions**

**Status you're picking up:** all 4 of your batches are live in `content.question` now (not
just dry-run-clean) — 120 questions, 0 rejections, `content.import_batch` shows all 4 as
`loaded`. Batch-2's 5 diagrams are uploaded to Supabase Storage and linked. Everything below is
new work on top of that, not a redo.

**New assignment — two more batches, same CL-1 JSON shape, to reach 180 total:**

| Batch | Subject | `nodeTagCode` | Title (live, confirmed) | Rows |
|---|---|---|---|---|
| batch-5 | Physics | `phy_01` | Mechanics & Rotational Dynamics | 30 |
| batch-6 | Chemistry | `chem_04` | Atomic Structure & Chemical Bonding | 30 |

Both `tag_code`s above are queried live from `catalog.syllabus_node` just now — no need to
re-verify against mock data or ask before authoring, unlike batch-2's blocker. Naming convention
stays the same as before: `question_uid` = `LMN-<SUBJECT_CODE>-<NODE_CODE>-<serial>`, e.g.
`LMN-PHY-PHY01-000101` / `LMN-CHEM-CHEM04-000101`. File names:
`content-batches/batch-5-physics-mechanics.json`,
`content-batches/batch-6-chemistry-atomic-structure.json`. Any images go in
`content-batches/assets/batch-5/` / `batch-6/` respectively, filenames matching the JSON
exactly (case-sensitive — CL-2 checks this for real now).

Why these two specifically: Physics and Chemistry each currently have only one authored
chapter (`phy_02`, `chem_08`); adding a second chapter to each closes the "2+ chapters per
subject" coverage gap (I-16) while landing exactly on 180 total (Physics 60, Chemistry 60,
Botany 30, Zoology 30).

**Validate before handing back** (you already have the tool — no waiting on me):
```
npx tsx db/scripts/import/import-content.ts content-batches/batch-5-physics-mechanics.json
npx tsx db/scripts/import/import-content.ts content-batches/batch-6-chemistry-atomic-structure.json
```
Dry-run by default — safe to run as many times as you want while authoring. Post the summary
counts before I run `--live` on these two (same account-sharing protocol as batch-1/2: I'll do
the live write, matching what happened with batch-1-4 today).

**Also still yours from the original Day 2 plan** (unaffected by the above):
- **Fixed paper composition — unblocked, go ahead.** All 139 live questions (119 from your 4
  batches + 20 legacy) are now `lifecycle_status='published'` — Santhosh bulk-approved them
  through CL-4's real review workflow (`content.question_review` has the full audit trail: every
  question shows `submitted`→`approved`→`published`, attributed to `educator@lumen.internal` and
  the admin account, not silently flipped). Compose the paper as planned: section structure,
  question order, marks, answer key cross-checked against `content.question_solution`.
- **CL-7 inputs (I-20–I-23)** — book/PDF list for the resource library: title, subject, exam,
  class, sharing setting per item.
- **Joint verification call** — once I finish TE-P5, we walk a real attempt together on real
  imported content.

**New — batches 7 & 8, for full-mock depth.** The app now genuinely supports subject-wise,
chapter-wise, topic-wise and unit-wise practice tests (proven live today,
`docs/BUILD_LOG.md`'s "Test-code convention..." entry) — e.g. a real 15-question chapter test on
`phy_02` was created and a student assembled/started an attempt on it, end to end. A full NEET
mock (45 questions/subject) is the one category not content-ready yet: live published counts are
currently Physics 35 / Chemistry 34 / Botany 36 / Zoology 34 — all short of 45. After batch-5/6
land (Physics to 65, Chemistry to 64), Botany and Zoology are the shortest. Once you have
bandwidth:

| Batch | Subject | `nodeTagCode` | Title |
|---|---|---|---|
| batch-7 | Botany | `bot_02` | Plant Physiology & Photosynthesis |
| batch-8 | Zoology | `zoo_01` | Human Physiology & Neuro-Endocrine Systems |

Same shape, same validation flow as before. Not urgent for today — batch-5/6 first.
