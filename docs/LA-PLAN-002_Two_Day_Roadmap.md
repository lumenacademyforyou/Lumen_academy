# Lumen Academy — Two-Day Execution Roadmap

**Document ID:** LA-PLAN-002
**Version:** 1.0
**Workstream:** Project — NEET Assessment Tool (backend: test engine + learn layer)
**Prepared by:** C. Santhosh Kumar (Team Lead)
**Applies to:** C. Santhosh Kumar, Prince A
**Window:** Day 1 — 26-08-2026 · Day 2 — 27-08-2026
**Feeds milestone:** Implementation complete 30-08-2026, pilot demo 31-08-2026

---

## 1. Purpose and Scope

This roadmap converts the outstanding backlog — content/data track (CL-1 to CL-7), test engine remainder (TE-P5 to TE-P8) and learn layer (LL-P0 to LL-P4) — into a two-day plan for two people sharing one Claude account.

The split is fixed on capability, not convenience:

| Owner | Track | Nature of work |
|---|---|---|
| Prince A | Content feeding, validation, data handling | Authoring source content into the agreed JSON contract, running the importer, triaging rejected rows, mapping questions to syllabus nodes, preparing and uploading image assets, composing the fixed paper, compiling the resource-library input list |
| C. Santhosh Kumar | Engine, tooling, services, HTTP surface | Contract definition, importer implementation, storage resolver, lifecycle service, scorecard/review services, expiry proof, route wiring, end-to-end verification |

Prince consumes tooling; Santhosh builds tooling. Every gate in Section 5 exists because one side cannot proceed until the other side ships.

Standing constraint carried into this plan: object storage for both `content.asset` and the future `learn.resource` is **Supabase Storage**, superseding the earlier Google Drive decision. Free-plan storage and bandwidth limits (I-25) therefore become live risks the moment bulk image upload starts, and are checked on Day 2 before batch-3 assets are pushed.

---

## 2. Claude Account Sharing Protocol

Both members operate from the same Claude account. Concurrent heavy sessions will exhaust the shared usage window and stall both tracks mid-task. The following protocol is mandatory for both days.

### 2.1 Rules

1. **One operator at a time.** No two sessions run in parallel, at any point, for any reason.
2. **Declare in and out.** Post `IN — <name> — <task id>` in the team group at the start of a slot and `OUT — <name>` at the end. Silence is treated as still-in.
3. **Slot discipline.** If a slot is unused, post `SLOT FREE` and the other member may claim it. Do not assume a slot is free.
4. **No overrun.** Stop at the slot boundary even mid-task. Write a two-line handover note in ClickUp describing where the task stopped, then hand the account over.
5. **Offline blocks are genuinely offline.** During the counterpart's slot, work on tasks that require no model access — authoring in spreadsheets, cropping images, reading source PDFs, manual verification against the database, writing status notes.
6. **Token hygiene.** Do not re-attach the whole repository per prompt. Attach only the files under change. Clear context between unrelated tasks. Keep one saved project-context prompt and reference it rather than restating architecture each session.
7. **Blocked-and-waiting is not a reason to hold the account.** If a task blocks on the counterpart, release the slot immediately.
8. **Shared quiet window 13:00–14:00 on both days.** Neither member uses the account. This is the reset buffer that protects the afternoon slots.

### 2.2 Slot allocation

**Day 1 — 26-08-2026**

| Time (IST) | Account holder | Counterpart status |
|---|---|---|
| 08:00 – 11:00 | Santhosh | Prince offline — source collection and normalisation |
| 11:00 – 13:00 | Prince | Santhosh offline — review, planning, status notes |
| 13:00 – 14:00 | Quiet window | Both offline |
| 14:00 – 17:00 | Santhosh | Prince offline — batch-2 authoring, image preparation |
| 17:00 – 19:30 | Prince | Santhosh offline — code review, manual DB checks |
| 19:30 – 21:00 | Santhosh | Prince offline — error triage write-up |

**Day 2 — 27-08-2026** (order reversed so Prince gets the morning, since his Day 2 work depends on Day 1 tooling being ready overnight)

| Time (IST) | Account holder | Counterpart status |
|---|---|---|
| 08:00 – 10:30 | Prince | Santhosh offline — reading batch-1 import report |
| 10:30 – 13:00 | Santhosh | Prince offline — batch-3 authoring |
| 13:00 – 14:00 | Quiet window | Both offline |
| 14:00 – 16:00 | Prince | Santhosh offline — test plan for end-to-end run |
| 16:00 – 19:00 | Santhosh | Prince offline — fixed-paper composition sheet |
| 19:00 – 20:00 | Santhosh (joint call) | Prince present, not operating |
| 20:00 – 21:00 | Prince | Santhosh offline — daily report to Rajaaram sir |

Total account time: Santhosh 12h 30m, Prince 9h 30m across two days. The imbalance is deliberate — Santhosh's tasks are code-generation heavy; Prince's are authoring-heavy and mostly offline.

---

## 3. Day 1 — 26-08-2026

### 3.1 Santhosh

| Slot | Task | Deliverable | Done when |
|---|---|---|---|
| 08:00 – 09:00 | **LL-P0 — Syllabus read model** | `listExams()`, `getSyllabusTree()` over `catalog.syllabus_node`, with per-node availability counts | Both functions return a correct tree for NEET from live Supabase data; counts match a manual `SELECT COUNT(*)` on `content.question_node_map` |
| 09:00 – 11:00 | **CL-1 — Authoring/import contract** | Single JSON schema file plus a one-page written spec: `stem_text`, `stem_format`, `options[]`, `solution`, node tags, image references, `question_uid` naming convention, difficulty level, language variant | Schema validates a hand-written sample of three questions (one with an image, one with LaTeX, one Tamil translation); spec frozen and handed to Prince at 11:00 |
| 14:00 – 16:30 | **CL-2 — General-purpose content importer** | Generalised from `db/scripts/seed/02_content.ts`: validates against CL-1, upserts `content.question`, `question_option`, `question_solution`, `question_translation`, `question_node_map`, tracks batches in `content.import_batch` / `import_row`, emits an invalid/unmapped row report | Importer runs against Prince's batch-1 file in dry-run mode and produces a row-level pass/fail report without writing |
| 16:30 – 17:00 | Buffer | Fix defects surfaced by Prince's 11:00–13:00 contract review | Contract amendments, if any, versioned as CL-1 v1.1 and re-announced |
| 19:30 – 20:30 | **CL-3 — Asset storage resolver** | One resolver function converting a stored reference to a Supabase Storage URL; upload path writing `content.asset.storage_uri`; no caller anywhere constructs a URL directly | A test image uploads, the row lands in `content.asset`, and the resolver returns a URL that opens |
| 20:30 – 21:00 | Triage | Apply fixes for failures in Prince's 17:00–19:30 dry-run report | Importer clears the batch-1 file with zero schema-level rejections |

### 3.2 Prince

| Slot | Task | Deliverable | Done when |
|---|---|---|---|
| 08:00 – 11:00 (offline) | **Source collection and normalisation** | Batch-1 raw sheet: 30 Physics questions from one chapter — stem, four options, correct key, solution text, chapter and topic name, image filename where applicable | 30 complete rows, no blanks in any mandatory column |
| 11:00 – 12:00 | **CL-1 contract review** | Written review of Santhosh's schema against real source material — every field the source data has that the schema lacks, and every schema field the source cannot supply | Review posted before 12:00 so amendments land the same day |
| 12:00 – 13:00 | **Batch-1 JSON conversion** | Batch-1 converted from sheet to the CL-1 JSON shape, `question_uid` assigned per the naming convention | File committed to the agreed repository path |
| 14:00 – 17:00 (offline) | **Batch-2 authoring and asset preparation** | 30 Chemistry questions in the same shape; all batch-1 and batch-2 images cropped, renamed to match the reference in the JSON, placed in the upload folder | 60 questions total authored; every image reference in the JSON has a matching file |
| 17:00 – 18:30 | **CL-2 dry-run on batch-1** | Import dry-run executed; every rejected row categorised as schema error, unmapped syllabus node, or missing asset | Report filed with row numbers and categories |
| 18:30 – 19:30 | **Syllabus node mapping** | Every batch-1 and batch-2 question mapped to a real `catalog.syllabus_node` id, not a free-text chapter name | Zero unmapped rows remaining in the report |
| 19:30 – 20:15 (offline) | **Error triage write-up** | One-page note: what failed, why, what Santhosh must change versus what Prince must re-author | Note posted to ClickUp before 20:15 |

### 3.3 Day 1 exit criteria

Day 2 does not start until all of the following are true:

- LL-P0 returns a live syllabus tree.
- CL-1 is frozen at v1.1 or later and Prince has authored against it successfully.
- CL-2 imports batch-1 in dry-run with zero schema rejections.
- CL-3 uploads and resolves at least one real asset.
- 60 questions authored and node-mapped.

If CL-2 slips, Day 2 morning re-plans around it; Prince's 08:00 slot converts to further authoring instead of import.

---

## 4. Day 2 — 27-08-2026

### 4.1 Prince

| Slot | Task | Deliverable | Done when |
|---|---|---|---|
| 08:00 – 09:30 | **Batch-1 live import (CL-6 begins)** | Batch-1 written for real — questions, options, solutions, translations, node maps — with `import_batch` recorded | 30 questions queryable from `content.question` and reachable through the LL-P0 tree |
| 09:30 – 10:30 | **Asset upload run (via CL-3)** | All batch-1 and batch-2 images uploaded to Supabase Storage; `content.asset.storage_uri` populated | Every image-bearing question resolves to a working URL |
| 10:30 – 13:00 (offline) | **Batch-3 authoring** | 30 Biology questions in CL-1 shape, node-mapped, assets prepared | Second exam's chapter coverage reaches the I-16 bar |
| 14:00 – 15:00 | **Batch-2 and batch-3 live import** | Both batches imported; failures triaged on the spot | 90 questions live across three chapters |
| 15:00 – 16:00 | **Coverage verification** | Report against the three acceptance bars: I-16 (30+ questions in 2+ chapters per exam), I-17 (one complete fixed paper), I-18 (concept-tree/syllabus mapping confirmed) | Report shows pass or a named, quantified gap |
| 16:00 – 19:00 (offline) | **Fixed paper composition (I-17)** | One complete paper composed from imported questions — section structure, question order, marks, answer key cross-checked against `question_solution` | Paper sheet ready to be seeded as a fixed test |
| 19:00 – 20:00 | Joint verification call (Santhosh operating) | Present for the end-to-end run; confirms content correctness as the attempt is walked through | Content defects logged during the run |
| 20:00 – 21:00 | **CL-7 inputs (I-20 to I-23)** | Book/PDF list for the resource library with title, subject, exam, class, sharing setting per item | List handed to Santhosh; unblocks CL-7 for the next cycle |

### 4.2 Santhosh

| Slot | Task | Deliverable | Done when |
|---|---|---|---|
| 10:30 – 12:30 | **TE-P5 — Scorecard and review** | `getScorecard()` reading persisted values only, never recomputing; `getReview()` returning the post-submission walkthrough with correct answer, solution and topic attribution; `listAttempts()` | All three run against the existing 20-question fixture and return correct values; a deliberate mismatch between stored and recomputed score proves the read path never recomputes |
| 12:30 – 13:00 | **TE-P4 outstanding gap** | Dedicated proof of `enforceExpiry` plus the sweeper against a genuinely expired attempt | An attempt aged past its window is closed by the sweeper and rejects further responses with the correct error code |
| 14:00 – 16:00 (offline) | End-to-end test plan | Written script for the 19:00 run: two accounts, ownership isolation, forbidden-key scan of the attempt envelope | Plan circulated before 16:00 |
| 16:00 – 17:30 | **CL-4 — Content lifecycle service** | State machine `draft → in_review → approved → published → retired`, writing real `content.question_review` rows, gated by existing RBAC (educator submits, content_reviewer/content_admin approves) | Each transition proven once with the correct role, and each rejected once with the wrong role |
| 17:30 – 19:00 | **CL-5 — Content HTTP surface (first pass)** | Audit of `backend/routes/content.routes.ts` against generic CRUD; author, list, search and filter-by-node endpoints with real ownership and role scoping; generic CRUD writes stripped where real controllers now exist | Filter-by-node endpoint returns only questions mapped to the requested node, scoped by role |
| 19:00 – 20:00 | **Joint end-to-end run (TE-P7 partial)** | Two accounts sit the fixed paper on real imported content; submit; scorecard and review verified; envelope scanned for forbidden keys | Attempt A cannot read attempt B; no answer key leaks in the pre-submission envelope |

### 4.3 Day 2 exit criteria

- 90 questions live across three chapters with assets resolving.
- One complete fixed paper composed and verified against the answer key.
- Scorecard and review return correct persisted values.
- Expiry and sweeper proven.
- A real student attempt runs end to end on real content, with ownership isolation confirmed.

---

## 5. Dependency Gates

No task below may start before its gate clears. This is the only sequencing rule that matters if the schedule slips.

| Gate | Clears when | Unblocks |
|---|---|---|
| G1 | CL-1 contract frozen (Day 1, 11:00) | Prince's JSON conversion, CL-2 implementation |
| G2 | Prince's contract review returned (Day 1, 12:00) | CL-1 v1.1 amendment; anything authored before this may need rework |
| G3 | CL-2 dry-run clean on batch-1 (Day 1, 21:00) | All live imports on Day 2 |
| G4 | CL-3 resolver working (Day 1, 20:30) | Asset upload run; any image-bearing question |
| G5 | Syllabus node mapping complete (Day 1, 19:30) | `question_node_map` writes; LL-P0 availability counts becoming meaningful |
| G6 | Batch imports live (Day 2, 15:00) | Fixed paper composition, end-to-end run on real content |
| G7 | TE-P5 complete (Day 2, 12:30) | End-to-end run; anything that reads a completed attempt |
| G8 | Fixed paper composed (Day 2, 19:00) | Joint verification run |
| G9 | CL-7 input list delivered (Day 2, 21:00) | LL-P1 / CL-7 in the next cycle |

Two gates are single points of failure. **G1** stalls both people if it slips past 11:00 on Day 1 — it is scheduled first for that reason. **G3** stalls the entire Day 2 content track; if the dry-run is not clean by Day 1 close, Day 2 morning is spent fixing the importer and Prince's morning slot converts to authoring.

---

## 6. Carried Forward — Not in This Two-Day Window

These remain open and are explicitly out of scope for 26–27 August. They are listed so nothing is assumed done.

| Item | Status entering 28-08-2026 |
|---|---|
| TE-P6 — full HTTP surface | Partial. DTO validation, thin controllers, `requireAttemptOwner` middleware, and routes for `getAttemptEnvelope` / `pauseAttempt` / `resumeAttempt` still unwired |
| TE-P7 — end-to-end proof | Partial. Run performed; the scripted two-account harness is not yet automated |
| TE-P8 — hardening | Not started. Concurrency, connection loss, clock manipulation, malformed input, 180-question volume timing, runbook |
| CL-5 — content HTTP surface | First pass only. Remaining generic CRUD writes still to be stripped |
| CL-6 — content at volume | Ongoing. 90 questions is the proof bar, not the product bar |
| CL-7 / LL-P1 — resource library | Inputs collected; implementation not started |
| LL-P2 — study plan | Not started. `createPlan` / `distribute` / `getTasks` / `reschedule`; depends only on LL-P0, which is now done |
| LL-P3 — progress and mastery | Not started. Extends `submitAttempt` with a mastery update in the same transaction; depends on LL-P2 |
| LL-P4 — learn HTTP surface and e2e proof | Not started |
| I-25 — Supabase free-plan volume limits | Live risk. Must be measured after the Day 2 asset upload run, before any further bulk load |

---

## 7. What Comes After the Test Layer and the Study Layer

Both layers are backend service layers. Completing them produces a system that can run a test and plan a study schedule, but not one a student or an institution can use. The following phases are the remaining path to the pilot and beyond, in dependency order.

### Phase 3 — Analytics and dashboard layer

The first thing that consumes both completed layers. Built on `assess.scorecard`, `section_score`, `attempt_response` and the mastery values written by LL-P3.

- Per-student performance analytics: score trend across attempts, accuracy by subject, section-wise timing, attempt-over-attempt delta.
- Concept-level weakness mapping against `catalog.syllabus_node`, producing a heatmap down to topic level rather than free-text unit tags.
- Cohort comparison: percentile and rank within an institution or batch for a given fixed paper.
- Question-level item analysis for the content team — difficulty index and discrimination index per question, which feeds back into CL-4 as a retirement signal for bad questions.
- Reporting exports: answer key, question paper, and performance report downloads, which were already agreed as a deliverable.

### Phase 4 — Frontend integration and the student product surface

The existing dashboard codebase runs on mock data with no fetch calls into the backend. This phase connects it.

- Wire `apiService.ts` to the real routes; delete the mock data paths.
- Test workspace against the live attempt runtime — envelope, pause, resume, expiry, submit.
- Review screen against TE-P5's `getReview()`.
- Study planner screens against LL-P2 and LL-P3.
- Bilingual delivery (Tamil/English) driven by `question_translation` rather than translation keys held in the frontend.

### Phase 5 — Educator, admin and institution layer

- Educator authoring console over CL-4 and CL-5 — submit, review, approve, publish, retire.
- Institution and batch management: enrolment, batch assignment, teacher-to-batch mapping.
- Institution-level reporting, which is the commercial deliverable that distinguishes this from a consumer app.
- Super-admin tier (Platform) operations — the Tier 0 already carried in the ER model.

### Phase 6 — Production hardening and operations

- Authentication hardening, rate limiting, audit trail on content mutations.
- Backup strategy beyond the seven-day free-plan retention window.
- Storage and bandwidth planning once I-25 is measured against real content volume.
- Observability: request logging, error tracking, slow-query monitoring.
- Load testing at the 180-question paper size with concurrent attempts, which is TE-P8 extended to production conditions.

### Phase 7 — Multi-exam expansion

The schema is already exam-agnostic through the recursive syllabus node. This phase exercises that.

- JEE Main and JEE Advanced content loaded through the same CL-2 pipeline.
- Exam-specific paper patterns, marking schemes and sectional rules.
- Then GATE, CAT and board exams, each as content plus a pattern definition rather than new code.

### Phase 8 — AI layer re-entry

Deliberately excluded from the current build. It returns only after the content pipeline is proven, because it depends on a clean, validated question bank.

- Offline generation stage: RAG generator against the vector store, strict JSON output matching the CL-1 contract, validator and critic pass.
- Generated questions enter the same CL-4 review workflow as human-authored ones — no separate path, no unreviewed content reaching students.
- The student-facing runtime stays AI-free: assemble, attempt, score arithmetically.

### Phase 9 — Commercial layer

- The four-tier package system (language access, weekly tests, full access) discussed with the team.
- Subscription and entitlement enforcement against the existing `SUBSCRIPTION_PLAN` model.
- Integration of the standalone Question Paper Generator workstream as a content source feeding CL-2.

The sequencing principle across all nine phases is unchanged from the current build order: nothing that reads data is built before the data exists, and nothing student-facing is built before the layer beneath it has been proven against real content.
