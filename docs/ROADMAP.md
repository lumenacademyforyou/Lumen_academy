# Roadmap — content layer, test engine, learn layer

Living task lineup for the remaining work under LA-BE-ENGINE-001 (`docs/LA-BE-ENGINE-001.md`), plus a
new content/data-handling track this document introduces. Read alongside `docs/BUILD_LOG.md` (what's
already done, phase by phase) and `docs/OPEN_ITEMS.md` (where the live repository diverges from the
brief). Update this file as tasks complete or the order changes — it is not a frozen plan.

---

## Storage decision (recorded 25-08-2026)

**Supabase Storage is used completely, for now** — this supersedes brief decision D-4 (Google Drive
behind an abstraction for the pilot). Both `content.asset` (question-embedded images) and the future
`learn.resource` (books/PDFs/papers) target `storage_kind = SUPABASE_STORAGE`, not Drive. The `DRIVE_LINK`
enum value can stay defined for later; nothing writes it now.

Practical consequence: **I-25 (Supabase free-plan database and storage volume limits) becomes
load-bearing sooner** than the brief assumed, since there's no Drive fallback absorbing large files.
Check the current limits before content is loaded at volume.

---

## A. Content & data-handling track (CL series — new, not in the original brief)

The brief treated question content as an external input (I-16 to I-19), handed over already-authored.
It never planned the backend work to actually store, import, validate and serve that content
repeatably. This track is that work.

| # | Task | Objective | Depends on |
|---|---|---|---|
| CL-1 | Authoring/import contract | Define the real JSON shape content is authored in — `stem_text`+`stem_format`, options, solution, node tags, image refs — and a `question_uid` naming convention. Replaces the brief's `schemas/v3/` + `content.next_lumen_id()`, neither of which exist live (`docs/DB_STATE.md` §6). | — |
| CL-2 | General-purpose content importer | Generalize `db/scripts/seed/02_content.ts` (currently a one-off legacy-data migration) into a repeatable importer: validates against CL-1, upserts `content.question`/`question_option`/`question_solution`/`question_translation`/`question_node_map`, tracks batches via the already-built `content.import_batch`/`import_row`, reports invalid/unmapped rows the same way it does today. | CL-1 |
| CL-3 | Asset storage resolver (Supabase Storage) | One function turning a stored reference into a URL — no caller ever constructs a URL itself (same principle as the brief's D-4 resolver). Targets Supabase Storage buckets. Wires `content.asset.storage_uri`. Upload path for images referenced by authoring JSON. | — |
| CL-4 | Content lifecycle/review workflow | Service functions for `draft → in_review → approved → published → retired`, writing real `content.question_review` rows, gated by existing RBAC roles (`educator` submits, `content_reviewer`/`content_admin` approves). Nothing implements this state machine yet. | — |
| CL-5 | Content HTTP surface | Audit what `backend/routes/content.routes.ts` currently exposes vs. generic CRUD; add author/list/search/filter-by-node endpoints with real ownership/role scoping; strip generic CRUD writes once real controllers exist (same discipline TE-P6 applies to `assess`). | CL-2, CL-4 |
| CL-6 | Load real content at volume | Content-authoring work itself (Prince's track), using CL-2/CL-3's tooling. Target: the brief's own bar — 30+ questions in 2+ chapters per exam (I-16), one complete fixed paper (I-17), confirmed concept-tree/syllabus mapping (I-18). | CL-2, CL-3 |
| CL-7 | Resource library storage | The brief's LL-P1, resolved to Supabase-Storage-only per the decision above. Needs I-20 to I-23 (book list, sharing settings). | CL-3 |

---

## B. Test engine — Part A (brief Section 6)

Status as of 25-08-2026, see `docs/BUILD_LOG.md` for full phase reports.

- ✅ **TE-P0** — Audit and reconciliation
- ✅ **TE-P1** — Schema completion
- ✅ **TE-P2** — Scoring domain
- ✅ **TE-P3** — Test definition and assembly
- ✅ **TE-P4** — Attempt runtime (core: startAttempt, getAttemptEnvelope, upsertResponse,
  batchUpsertResponses, pause/resume, submitAttempt — all live-proven. Expiry enforcement and the
  sweeper are written but **not yet proven against a genuinely expired attempt** — open item.)
- 🔜 **TE-P5 — Scorecard and review**. `getScorecard` (read persisted, never recompute), `getReview`
  (post-submission walkthrough — correct answer, solution, topic attribution via
  `question_node_map`), `listAttempts`. No new inputs needed — runs against the existing 20-question
  fixture right now.
- **TE-P6 — HTTP surface**. Real DTO validation, thin controllers, `requireAttemptOwner` middleware,
  routes for the still-unwired `getAttemptEnvelope`/`pauseAttempt`/`resumeAttempt`, strip generic CRUD
  writes for entities with real controllers.
- **TE-P7 — End-to-end proof**. Two-account script: sign in, list, attempt, score, review; asserts
  ownership isolation and scans the envelope JSON for forbidden answer-key fields. Benefits from
  CL-2/CL-6's extra content volume but isn't blocked on it.
- **TE-P8 — Hardening**. Concurrency (parallel start/submit), connection loss, clock manipulation,
  malformed input, 180-question volume timing, `docs/RUNBOOK_TEST_ENGINE.md`.
- **Carried-over gap from TE-P4**: a dedicated proof of `enforceExpiry`
  (`db/assess/test/attempt/expiry.ts`) and `db/scripts/sweep-expired-attempts.ts` against a real
  expired attempt.

---

## C. Study/learn layer — Part B (brief Section 7)

Not started. Per brief §3.3, LL-P0 may begin immediately (already true — TE-P1 is done); the rest
follows Part A's completion in spirit, not by strict blocking where a real dependency doesn't exist.

- **LL-P0 — Syllabus read model**. `listExams`/`getSyllabusTree` over `catalog.syllabus_node` with
  availability counts from `content.question_node_map`. **Unblocked right now.**
- **LL-P1 — Resource library**. = CL-7 above.
- **LL-P2 — Study plan**. `createPlan`/`distribute`/`getTasks`/reschedule. Depends only on LL-P0.
- **LL-P3 — Progress and mastery**. Extends `submitAttempt` (already built, TE-P4) with a mastery
  update in the same transaction. Depends on TE-P4 (done) + LL-P2.
- **LL-P4 — Learn HTTP surface + e2e proof**. Same construction rules as TE-P6.

---

## Recommended order

Sequenced by actual dependency, not brief section numbering:

1. **LL-P0** — cheap, unblocked, everything else in the learn layer reads it
2. **CL-1 → CL-2 → CL-3** — content pipeline; unblocks real proof volume everywhere downstream
3. **TE-P5** — no new blockers
4. **CL-4, CL-5** — content workflow/HTTP, parallel with TE-P5/6
5. **TE-P6**
6. **CL-6** — content authoring at volume, ongoing parallel track
7. **LL-P1 / CL-7**
8. **LL-P2 → LL-P3**
9. **TE-P7 → TE-P8**
10. **LL-P4**

---

## Inputs still needed from the project lead

Unchanged since TE-P4 (`docs/BUILD_LOG.md`): I-12/I-13/I-14 (confirmed real NEET/JEE paper
structures — still using a 20-question scratch pattern), I-16 to I-19 at real volume, I-20 to I-23
(resource library book list and sharing settings, needed for CL-7/LL-P1), I-25 (current Supabase
volume limits — now more urgent per the storage decision above).
