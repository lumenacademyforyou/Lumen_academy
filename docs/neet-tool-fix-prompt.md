# NEET Assessment Tool — Fix Prompt

You are working on our existing NEET assessment/test-taking web app (TypeScript, React frontend, Node/Express backend, PostgreSQL).

**Rules of engagement**
- Do not rewrite unrelated modules. Follow existing project structure, state management and styling conventions.
- Any DB change goes through a migration file. No hardcoded data, no seeded JSON standing in for a table.
- Work in the order below. Task 1 is deletion-only and unblocks layout work; Task 2 stabilises the generated paper before Task 3 debugs rendering against it.

**Order of work:** Task 1 → Task 2 → Task 3 → Task 4

---

## Task 1 — Remove Learning Path from the frontend

**Current:** The Learning Path module is visible in the frontend. We're pulling it for now.

**Do:**
- Remove the Learning Path route/page, its nav or sidebar entry, and any dashboard card, widget or CTA that links to it.
- Remove the **container element**, not just its contents. Delete the grid cell / flex child / column wrapper that held it. Do **not** use `display: none`, `visibility: hidden`, `opacity: 0`, or an empty `<div>` placeholder.
- After removal, the surrounding grid must reflow so remaining cards fill the space naturally. Check the dashboard at desktop, tablet and mobile breakpoints — there must be no gap, no orphan row, no stray gap/margin from the deleted child.
- Remove now-unused frontend imports, hooks, context providers, and API client functions that existed only for Learning Path.

**Do not touch:** backend routes, services, controllers, DB tables or migrations for Learning Path. They stay intact so the feature can be restored later. If a backend endpoint is now uncalled, leave it — just don't call it.

**Done when:** no Learning Path text, link or empty space appears anywhere in the UI, no console errors from dangling imports, and `git diff` on the backend is empty.

---

## Task 2 — No repeated questions; one question at a time

**Current:** The same question appears more than once inside a single test.

### 2a. Find the cause before patching

Log the generated question ID list for one attempt and check for duplicate IDs. Then check both suspects:

1. **Row fan-out in the eligibility query.** If the query joins questions through the concept/unit mapping (e.g. `map_node_concept`, `content.v_question_eligibility`), a question mapped to two concepts or two units returns two rows and reads as two questions.
2. **Per-bucket sampling without a global used-set.** If the generator picks N per unit / per difficulty / per topic independently, a question eligible for two buckets can be drawn twice.

Both can be true at once. Fix both.

### 2b. Fix, in four layers

- **Query layer:** deduplicate to one row per `question_id` — `SELECT DISTINCT ON (question_id) ...` or `GROUP BY question_id` with aggregation over the mapping columns. The eligibility view must never return the same question twice.
- **Generator layer:** maintain a `Set<questionId>` of already-selected IDs across the whole paper. Every bucket's picks are filtered against it before being accepted.
- **Top-up:** if deduplication leaves the paper short of its target count, top up from the remaining eligible pool (relaxing the bucket constraint in a documented order, e.g. same unit → same subject → any eligible) until the count is met. If the pool genuinely cannot fill the paper, return a clear error naming the shortfall — do not silently ship a short or padded paper.
- **DB backstop:** add a unique index on the attempt-questions join table, `UNIQUE (attempt_id, question_id)`. This turns any future regression into a loud insert failure rather than a silent duplicate.

### 2c. One question per screen

- The test console renders exactly one question at a time, with next/previous navigation and the question palette.
- No stacked or repeated question blocks in the DOM. If a list is being rendered where a single item should be, fix the render, and make sure React keys are `question.id` (not array index) so navigation doesn't reuse stale nodes.

**Done when:** generating 20 papers of each type produces zero duplicate question IDs within any single paper; the unique index exists; the console shows one question at a time.

---

## Task 3 — Question images

**Current:** The test console reserves a large empty block where an image should be (making questions unnecessarily tall), and no image ever loads. The images exist in the DB but are not reaching the frontend. Separately, the image-to-question mapping itself is not trustworthy — asset IDs and question IDs are suspected to be out of sync.

> **This was attempted before and not completed.** Two things from the earlier pass need correcting:
> 1. The earlier spec said to *reserve a fixed-height image container* so text doesn't jump. **That instruction is reversed.** The fixed-height reservation is what's producing the long empty gap on text-only questions. Render the container only when an image exists (see 3d).
> 2. The earlier spec said to "verify the mapping" without specifying how. That step was skipped, so a rendering fix alone will now show *wrong* images rather than no images. **Section 3b is mandatory and must be completed before 3c/3d are considered done.**

Treat this as three separate bugs: a **data** bug (images not reaching the client), an **identity** bug (asset ↔ question ID mismatch), and a **layout** bug (empty reserved space).

### 3a. Diagnose the data path first

Pick a question you know has an image in the DB. Trace it end to end and report which layer drops it:

1. **DB:** confirm the image row/column actually holds a value (path, URL, object key or blob reference) for that `question_id`. Note whether images live on the question row, in a separate `question_images`/assets table, or per-option.
2. **Query:** does the paper/attempt endpoint's `SELECT` include the image columns, or does it only select text fields?
3. **Serializer/DTO:** does the question DTO carry the image field, or is it stripped in mapping?
4. **Transport:** what does the API response for that question actually look like? Log the raw JSON.

Fix at whichever layer breaks. Most likely the image columns were never added to the paper query or the DTO.

### 3b. Asset ID audit, verification and rename

The goal is that every image file is unambiguously tied to the question it belongs to, by ID, with no orphans and no crossed wires. Do this in the order below — **renaming before verifying will permanently cement any existing mismatch.**

**Step 1 — Build the audit report (read-only, no writes yet).**

Write a script that produces a single CSV/table with one row per image asset and one row per question that expects an image:

| column | meaning |
|---|---|
| `asset_id` | PK of the asset row, if it exists |
| `current_path` / `current_filename` | as stored on disk / in the bucket |
| `referenced_by_question_id` | the question(s) whose row or join points at this asset |
| `slot` | `stem` or `option_A/B/C/D` |
| `file_exists` | does the stored path actually resolve to a real file |
| `status` | see categories below |

Classify every row into one of:

- **OK** — asset exists, exactly one question references it, path resolves.
- **DANGLING** — a question references an asset ID or path that doesn't exist. These questions currently render nothing.
- **ORPHAN** — an asset file exists but no question references it. These are the likely partners for the DANGLING rows.
- **SHARED** — one asset referenced by more than one question ID. May be legitimate (a common diagram reused across questions) — flag, don't auto-fix.
- **SUSPECT** — filename encodes a question ID (or serial number) that disagrees with `referenced_by_question_id`. This is the crossed-wire case.

Output counts per category before doing anything else. Do not proceed until these numbers are reviewed.

**Step 2 — Resolve mismatches with human confirmation.**

Do **not** infer the correct question from the filename alone — the filename is exactly what we don't trust. Build a small internal review screen (or generate a static HTML contact sheet) that shows, side by side:

- the question stem text and its options,
- the currently-linked image,
- the candidate ORPHAN images (nearest matches by filename, by legacy serial, by upload timestamp, by source paper).

A human confirms or reassigns each SUSPECT and DANGLING row. Record the decision. Anything left unresolved stays unresolved and is reported — do not guess and do not silently link the "closest" asset.

**Step 3 — Rename to a canonical scheme.**

Only after Step 2 sign-off, rename the confirmed assets to:

```
q_<question_id>_stem_<nn>.<ext>
q_<question_id>_opt_<A|B|C|D>_<nn>.<ext>
```

- `<question_id>` is the canonical question PK as used by the test-generation and attempt tables — the same ID the test console requests. If the app has both an internal PK and an external/legacy question code, use the **PK**, and store the legacy code as a separate column, not in the filename.
- `<nn>` is a zero-padded sequence for questions with multiple images (`01`, `02`).
- Lowercase, no spaces, no original upload names.

**The filename is for human debugging convenience only. The foreign key in the DB remains the single source of truth for mapping.** Nothing in application code may parse the filename to resolve a question. If a reviewer later spots `q_4471_stem_01.png` rendering under question 4472, that's a data bug to fix in the FK, not something the app should paper over.

**Step 4 — Make it reversible and auditable.**

- Perform the rename in a migration (or a scripted job with a migration for the DB side), inside a transaction where possible. Update the DB path/key column and the file in the same operation — never rename files without updating references.
- Create an `asset_rename_log` table: `asset_id`, `old_path`, `new_path`, `question_id`, `slot`, `resolution` (`ok` / `reassigned` / `confirmed_shared`), `reviewed_by`, `renamed_at`.
- Keep the old files (or a full backup of the bucket prefix) until the verification in 3e passes.

**Step 5 — Prevent recurrence.**

- Add a FK constraint from the asset/junction row to `questions(id)` with `ON DELETE` behaviour decided explicitly.
- Add a unique constraint on `(question_id, slot, sequence)` so one slot can't accumulate conflicting images.
- Make the upload/ingest path assign the canonical name at write time, so new material can never enter with an arbitrary filename.

### 3c. Serve the images

- Expose images by URL, not by embedding base64 in the paper payload — the paper response must stay small.
- Add a serving endpoint (or signed URL) for question assets, authenticated the same way the rest of the attempt API is. Students must not be able to enumerate images for questions outside their attempt.
- Support **option-level images** as well as stem-level, if the schema has them. An image attached to option (B) must render inside option (B), not above the question.

### 3d. Fix the layout

- Render the image container **only when the question payload actually contains an image.** A text-only question must produce no image element and no reserved height at all.
- Size the image to its natural aspect ratio inside a responsive wrapper with a sensible `max-height` (e.g. 45vh on desktop, less on mobile) and `object-fit: contain`. Never a fixed-height empty box.
- While the image is loading, show a skeleton sized to the image's known aspect ratio if available; otherwise let the container grow on load. Do not reserve a fixed block up front.
- On load failure, show a small inline "Image unavailable" note and log it — do not leave a broken-image icon or a blank gap.
- Diagrams must be legible: add pinch/tap-to-zoom or a click-to-enlarge lightbox on mobile.

### 3e. Verify question IDs against the test console

Renaming and relinking is not "done" until it is proven in the place students actually see it. Build a verification pass that runs against a **generated attempt**, not against the raw tables.

**Automated check.** For a generated paper, dump one row per served question:

`position | question_id | slot | expected_asset_id | resolved_url | http_status | rendered_dimensions`

Assert all of the following:
- every `question_id` served by the attempt API exists in `questions` and matches the ID the generator selected — no ID drift between generation, storage and serving;
- every question flagged `has_image` returns a `200` on its asset URL;
- no question flagged `has_image = false` returns any image URL;
- the `question_id` embedded in the resolved filename matches the `question_id` of the row serving it (this is a *tripwire* on the naming convention, not the mapping mechanism);
- no `asset_id` appears against two different `question_id`s unless it is on the confirmed SHARED list from 3b.

**Manual spot-check.** Generate at least 3 papers covering Physics, Chemistry and Biology, open each in the real test console, and confirm by eye for every image question that the diagram actually belongs to the stem being asked. Include at least a few questions from the SUSPECT and DANGLING sets from 3b — those are the ones most likely to still be wrong. Record the result.

**Also verify outside the console.** The same asset must resolve correctly in the review/solution view, the scorecard breakdown, and any downloaded PDF report. A mapping fix that only holds in the test console isn't a fix.

**Done when:** the 3b audit reports zero DANGLING, zero SUSPECT and zero unreviewed rows; the 3e automated check passes on freshly generated papers; the manual spot-check confirms correct diagrams; a text-only question has zero vertical space allocated to images; and question height is proportional to content.

**Deliverable:** hand back the audit report (before/after counts per category) and the 3e check output. "It looks fine now" is not acceptance for this task — that's what happened last time.

---

## Task 4 — Course syllabus materials from Google Drive

**Current:** The syllabus page shows a mix of file links; materials aren't mapped to units, don't open in-app, and there's no controlled download.

### 4a. Store the mapping

Create a `unit_materials` table (migration):

| column | notes |
|---|---|
| `id` | PK |
| `unit_id` | FK to the units/nodes table |
| `title` | display name shown to the student |
| `drive_file_id` | the Drive file ID, **not** the full share URL |
| `mime_type` | `application/pdf` etc. |
| `sort_order` | display order within the unit |
| `is_active` | soft-hide without deleting |

Seed it from the link list below. Extract the file ID from whatever URL form was supplied — `/file/d/<ID>/view`, `?id=<ID>`, `/open?id=<ID>` all resolve to the same `<ID>`. Store the ID only and build URLs in code.

**Link → unit mapping (fill in before implementing):**

| Unit | Material title | Drive link |
|---|---|---|
| _(unit name)_ | _(title)_ | _(paste link)_ |

Every link must be mapped to exactly one unit. Anything that can't be mapped does not get added.

### 4b. Open in an in-app PDF viewer

Clicking a material opens it inside the app — no new tab to Drive, no redirect out of the product.

Two acceptable approaches; pick one and be consistent:

- **Drive preview embed (lower effort):** render `https://drive.google.com/file/d/<FILE_ID>/preview` in an iframe inside our own modal/page shell. Requires each file's sharing to be "Anyone with the link — Viewer". Verify this for every file before shipping; a file left as restricted will render a sign-in wall.
- **pdf.js via backend proxy (more control):** backend fetches the file from Drive with a service account and streams it to the client; frontend renders with pdf.js. This hides Drive entirely, works with restricted files, and lets us control the toolbar — but needs Drive API credentials and adds bandwidth cost.

The viewer needs: page navigation, zoom, and a close/back control that returns to the unit view.

### 4c. Clean up the syllabus page

- Remove every other file link on the syllabus/material section — stray links, duplicate links, and any link not present in `unit_materials`.
- Suppress Drive's own download/print/popout chrome where the embed allows it. Do not rely on this for security; it is cosmetic.
- Add **our own Download button** on each material row and inside the viewer, hitting a backend endpoint we control (which either redirects to `https://drive.google.com/uc?export=download&id=<FILE_ID>` or streams the proxied file). Downloads must be authenticated and, ideally, logged per user.
- Materials render grouped under their unit, in `sort_order`. A unit with no materials shows an empty-state line, not a blank region.

**Done when:** every material appears under its correct unit, opens in the in-app viewer, downloads via our button, and no other file links remain on the page.

---

## Final acceptance checklist

- [ ] No Learning Path anywhere in the UI; no leftover gap at any breakpoint; backend untouched
- [ ] 20 generated papers per type, zero duplicate question IDs within a paper
- [ ] `UNIQUE (attempt_id, question_id)` index in place
- [ ] Test console shows exactly one question at a time
- [ ] Asset audit run; zero DANGLING, zero SUSPECT, zero unreviewed rows remaining
- [ ] All assets renamed to `q_<question_id>_<slot>_<nn>` with `asset_rename_log` populated
- [ ] FK + unique constraint on `(question_id, slot, sequence)` in place; ingest assigns canonical names
- [ ] Automated ID/asset check passes on freshly generated papers
- [ ] Manual spot-check across 3 subjects confirms correct diagram per stem
- [ ] Image questions render the correct image, stem-level and option-level, in console *and* review/report views
- [ ] Text-only questions reserve zero vertical space for images
- [ ] Every syllabus material mapped to its correct unit
- [ ] Materials open in the in-app PDF viewer, not a Drive tab
- [ ] Download works from our own button; no other file links on the page
