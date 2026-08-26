# Engine state — TE-P0 (2026-08-25)

What exists, what's empty, what's broken, what's missing, and the Prisma disposition. Read
alongside `docs/DB_STATE.md` (schema/data ground truth) and `docs/OPEN_ITEMS.md` (brief
contradictions). No application code was written or changed to produce this file — everything
below is read from the repository and the live database as they stand.

## 1. What exists

- **Two independently-built, independently-wired attempt implementations, both live in the
  running Express app right now** — not one live and one dead, and not a "known drift risk" still
  to be assessed. Both are mounted, both are reachable from the frontend, and a runtime env flag
  picks between them per client build (see §2).
- A raw-SQL repository layer (`db/catalog`, `db/core`, `db/content`, `db/assess`, `db/learn`)
  covering the five custom schemas, wired into `backend/routes/{catalog,core,content,assess,learn}.routes.ts`.
- A Prisma-generated client (`backend/generated/prisma/`) and one `PrismaClient` instance
  (`backend/db.ts`), used by `backend/services/attempt.service.ts` (the `/api/tests/*` flow) and by
  the health check.
- A complete core/identity layer (LA-BE-CORE-002, documented in `db/CORE_LAYER_ENDPOINTS.md` /
  `db/CORE_LAYER_OPERATIONS.md`) — RBAC, invitations, admin user lifecycle, RLS lockdown. Not this
  phase's concern beyond confirming it's real and not mock (it is: `core.role`/`permission`/
  `role_permission` are seeded and read by `backend/lib/permissions.ts` via `pool`, no hardcoded
  role table anywhere).
- One DB-level trigger that already enforces part of defect (a) below at the schema layer
  (`assess.trg_attempt_response_option_guard`, §3).
- 18 raw-SQL migrations (000–017) and 18 matching verify scripts, all applied and DDL-verified live
  this session (`docs/DB_STATE.md` §2).

## 2. Attempt path trace, end to end (work item 8)

Three HTTP entry points exist for "attempt", not two:

| Route | Controller | Service/repo | Storage | Status |
|---|---|---|---|---|
| `POST /api/submit-attempt` | `backend/controllers/attemptController.ts` | none | none | **Retired stub.** `submitAttempt` immediately calls `next(new AppError(410, "ENDPOINT_RETIRED", ...))` (`backend/controllers/attemptController.ts:14-23`). Mounted at `backend/routes/api.ts:123`. Does not read mock data — reads nothing at all. |
| `POST /api/tests`, `PATCH /api/tests/:id/answers`, `POST /api/tests/:id/submit`, `GET /api/tests/:id/result` | inline handlers, `backend/routes/tests.routes.ts` | `backend/services/attempt.service.ts` | **Prisma → `public.test_attempts`, `public.attempt_answers`, `public.questions`, `public.question_options`** | **Live.** Mounted at `backend/routes/api.ts:69` (`router.use("/tests", testsRouter)`). Frontend calls it via `frontend/lib/testApi.ts`, used by `frontend/App.tsx` whenever `VITE_USE_REAL_API` is falsy. |
| `POST /api/assess/attempts/start`, `PATCH .../responses(/:testQuestionId)`, `POST .../submit`, `GET .../paper`, `.../scorecard`, `.../events` | `backend/controllers/attemptFlowController.ts` | `db/assess/test/attempt/attempt-flow.ts` (raw SQL via `pool`) | **`assess.attempt`, `assess.attempt_response`, `assess.attempt_event`, `assess.scorecard`, `assess.section_score`, `content.question`, `content.question_option`, `catalog.marking_scheme`/`pattern_section`** | **Live.** Mounted at `backend/routes/assess.routes.ts:48`, itself mounted at `backend/routes/api.ts:81`. Frontend calls it via `frontend/lib/assessApi.ts`, used by `frontend/App.tsx` whenever `VITE_USE_REAL_API === "true"`. |

`db/assess/test/attempt/attempt.service.ts` (55 lines) exists on disk alongside `attempt-flow.ts`
(426 lines) but **is dead code** — nothing imports it. `attemptFlowController.ts` imports
exclusively from `attempt-flow.ts` (`backend/controllers/attemptFlowController.ts:3-14`). The
brief's framing of "two service layers" for the raw-SQL side is one live file and one unused file,
not two competing live ones.

**Which path is "live" today is a runtime config choice, not a code fact:**
`frontend/App.tsx:71` reads `VITE_USE_REAL_API` and branches at `frontend/App.tsx:775-799`. The
repo's own `.env` (this environment) currently has `VITE_USE_REAL_API="true"` and
`VITE_DEMO_TEST_ID="309b67f6-498c-4424-9aba-3058a5618fc6"` — so **today's configured default is the
raw-SQL `/api/assess/*` path**, not Prisma. But `VITE_DEMO_TEST_ID` points at an `assess.test.test_id`
that cannot exist: `assess.test` is 0 rows live (`docs/DB_STATE.md` §5). Flipping the flag off falls
back to the Prisma path, which is equally unable to serve real content: `public.questions` is also
0 rows. **Neither configured path can currently serve a real question to a real student — both are
blocked on missing data, not on missing code.** Nothing in either path reads mock/stub data to paper
over this (`database_sample/*.ts` is referenced only in `attemptController.ts`'s explanatory comment
about why it was retired, and is not imported by any live controller) — this is a straightforward
data-completeness gap (I-16, I-17), not an R-5 violation.

## 3. The three named defects (work item 9)

Checked against **both** live paths, since both are reachable.

### (a) `option_id` not validated against the question that owns it

**Raw-SQL path (`assess.*`, the currently-configured default): defect is fixed, but only at the
database layer, and the failure it produces is not handled correctly.**

`db/assess/test/attempt/attempt-flow.ts`'s `upsertResponse` (lines 73–117) and
`batchUpsertResponses` (lines 275–325) both insert into `assess.attempt_response` with **no
application-level check** that `option_id` belongs to the question behind `test_question_id`. But a
`BEFORE INSERT OR UPDATE` trigger on `assess.attempt_response` already enforces exactly this,
confirmed live:

```sql
-- assess.trg_attempt_response_option_guard(), confirmed live via pg_get_functiondef
if new.option_id is not null then
  select question_id into v_option_qid from content.question_option where option_id = new.option_id;
  if v_option_qid is distinct from v_test_question_qid then
    raise exception 'attempt_response: option_id % belongs to question %, not the question behind test_question_id % (question %)',
      new.option_id, v_option_qid, new.test_question_id, v_test_question_qid;
  end if;
end if;
```

So a mismatched `option_id` **cannot** actually be written — the row-level integrity half of this
defect does not exist in the live schema. What's still broken: the trigger's `raise exception` has
no SQLSTATE mapping in `backend/middleware/errorHandler.ts`'s `PG_CLIENT_ERROR_CODES` /
`DB_ERROR_STATUS` tables (`backend/middleware/errorHandler.ts:23-35`), so it falls through to the
generic `500 INTERNAL_ERROR` branch (`errorHandler.ts:56-57`) — a plain R-6 violation ("never an
unhandled exception and never a generic 500"), and not the catalogued `RESPONSE_OPTION_MISMATCH`
the brief's TE-P4 spec names. **Net effect: a malicious/buggy client cannot corrupt scoring data
via a mismatched option, but does get an opaque 500 instead of a clean 4xx.**

**Prisma path (`public.*`): not present at all — already correctly validated in application code.**
`backend/services/attempt.service.ts`'s `recordAnswers` (lines 270–313) explicitly checks
`option.questionId !== answer.questionId` and throws a catalogued `400 VALIDATION_ERROR`
(`attempt.service.ts:289-297`) before ever writing. This path has no defect (a).

### (b) `submitAttempt` not fully transactional

**Present on both paths.**

Raw-SQL: `db/assess/test/attempt/attempt-flow.ts`'s `submitAttempt` (lines 233–251) issues three
separate, unwrapped `pool.query` calls in sequence — `update ... attempt_state = 'submitted'`
(line 239), then `scoreAttempt(attemptId)` (line 243, which itself runs a multi-row scoring `SELECT`
at lines 142–160, per-row `UPDATE ... marks_awarded` write-backs in a loop at lines 199–205, and an
`INSERT INTO assess.scorecard` at lines 210–215), then `update ... attempt_state = 'scored'`
(lines 245–248). No `BEGIN`/`COMMIT`, no client checkout from the pool, no `SELECT ... FOR UPDATE`
anywhere in the file. A crash or connection drop between any two of these steps leaves the attempt
in an inconsistent state (e.g. `submitted` with no scorecard, or scored with only some responses'
`marks_awarded` written back). This path is also **not idempotent** per D-7: a second call to an
already-`scored` attempt hits `if (attempt.attempt_state !== "in_progress") throw
InvalidStateTransitionError` (line 236) — a `409`, not "return the existing scorecard with `200`".

Prisma: `backend/services/attempt.service.ts`'s `submitAttempt` (lines 348–365) calls
`finalizeAttempt` (lines 226–262), which does a `findUniqueOrThrow`, a `findMany`, and an `update` —
three separate Prisma calls, no `prisma.$transaction(...)` wrapping any of them. Also
non-transactional, though the specific failure window is narrower (no per-row write-back loop).
This path **is** idempotent (lines 354-357: submitted/expired short-circuits to returning the
stored result) — D-7 is honoured here even though R-6's transaction requirement isn't.

### (c) `attempt_no` allocation race

**Present on the raw-SQL path** (the only one of the two that has an `attempt_no` concept at all —
the Prisma model has no per-test attempt-numbering scheme, so defect (c) as stated doesn't apply to
it).

`db/assess/test/attempt/attempt-flow.ts`'s `startAttempt` (lines 36–55): computes `attemptNo` from
a `select count(*) ... where test_id = $1 and user_id = $2` (lines 42-46), then a separate
`insert into assess.attempt (..., attempt_no, ...) values (...)` (lines 48-53). No transaction, no
`SELECT ... FOR UPDATE`, no `ON CONFLICT` retry. Two concurrent `startAttempt` calls for the same
student+test can both read the same count and both attempt to insert the same `attempt_no`. The
live `uq_attempt_test_id_user_id_attempt_no` unique constraint (`docs/DB_STATE.md` §4.2) will catch
the collision at the database — so two attempts with the same number can never both persist — but
the losing request's raw unique-violation (Postgres `23505`) is **not** in
`errorHandler.ts`'s mapped `PG_CLIENT_ERROR_CODES` set, so it also surfaces as a generic `500`
rather than a clean retry or a `409`. Confirmed present, exactly as the brief describes, with the
same "opaque 500 instead of a handled outcome" pattern as (a).

## 4. What's broken (summary)

1. No custom migration ledger table — `docs/DB_STATE.md` §1 (TE-P1's job, not fixed here).
2. Both live attempt paths are currently unable to serve real content — `content.question` and
   `public.questions` are both 0 rows (§2). Not a code defect; a data gap (I-16/I-17).
3. `VITE_DEMO_TEST_ID` in `.env` references a test row that doesn't exist in the empty `assess.test`
   table — stale config, harmless until someone tries the real-API demo path.
4. Defects (a)/(b)/(c) as detailed in §3 — (b) present on both attempt paths, (c) present on the
   raw-SQL path, (a) already closed at the DB layer on the raw-SQL path (with an unhandled-500
   side effect) and already closed in application code on the Prisma path.
5. `errorHandler.ts` has no SQLSTATE mapping for Postgres `raise exception` (`P0001`) or
   unique-violation (`23505`) — both of the raw-SQL path's constraint-enforced defences (the option
   guard trigger, the attempt_no unique index) degrade to generic `500`s instead of the catalogued
   4xx codes R-6 requires.
6. `assess.attempt`'s live `ck_attempt_state` check constraint only allows
   `in_progress|submitted|scored|abandoned` — no `paused` state exists yet, so TE-P4's
   `IN_PROGRESS ⇄ PAUSED` transitions (and TE-P1's `assess.attempt_pause` table) are additions, not
   already-present-but-unwired functionality.

## 5. What's empty

See `docs/DB_STATE.md` §5 in full. Headline: `assess.*` (all 10 tables), `content.*` (all 16
tables), and all of `public`'s content/attempt tables are 0 rows. `catalog.*` has a small hand-made
scratch NEET pattern, not production reference data. Only the identity/RBAC layer (`core.role`,
`core.permission`, `core.role_permission`) and one real user row are populated.

## 6. What's missing (relative to brief §1.4/§1.6, confirmed absent per `docs/DB_STATE.md` §6)

`content.v_question_eligibility`, `content.next_lumen_id()`, every `util.*` helper,
`upsert_concept`, `upsert_syllabus_node`, `map_node_concept` — none exist, under any name, anywhere
in the live database. There is also no `content.concept` table and no `question_exam_usage` table —
the entire concept-tree indirection layer the brief's §1.4 calls "settled" is architecturally absent
from this schema; `content.question_node_map` maps a question directly to one `catalog.syllabus_node`
instead. This is a bigger gap than "not yet built" — it's a different design already in place on
disk, not a hole in an otherwise-matching design. Recorded in full in `docs/OPEN_ITEMS.md`.

## 7. Prisma disposition — recommendation

**Recommendation: confine Prisma to the `public` schema only, keep it as the system of record for
exactly the tables it already owns, and do not extend it to `catalog/core/content/assess/learn`.
Do not retire it. Do not run `prisma db pull` against the whole database.**

Reasoning:

- Retiring Prisma outright is not viable without a migration project of its own: the Prisma path
  (`/api/tests/*`) is live, frontend-reachable by default-off/on toggle, and is the *only* one of
  the two attempt paths where defect (a) is already fixed in application code and D-7 idempotency
  already holds (§3). Deleting it now would delete correctness work, not just "legacy" code, and
  would leave the raw-SQL path — which still has the unresolved 500-instead-of-4xx handling gap —
  as the sole path with no fallback.
- Running `prisma db pull` against the whole database is actively dangerous here and not just
  theoretically: `db/MIGRATION_STATE.md` already records one incident this project caused
  (`schema.prisma` overwritten and had to be reconstructed from migration diffs) from exactly this
  command, and `catalog/core/content/assess/learn` were deliberately built outside `public` so that
  PostgREST — and, by the same logic, Prisma's introspection — never has to model them (brief
  §1.4). Pulling the whole database into one `schema.prisma` would produce a 90-table single schema
  file mixing two unrelated designs and re-introduce the exact confusion TE-P0 exists to resolve.
- Confining `prisma db pull`/`prisma generate` to `public` only (Prisma supports schema-scoped
  introspection via `schemas = ["public"]` in the datasource block, or simply never widening the
  `schema.prisma` models beyond what's there today) keeps the one thing Prisma is legitimately good
  at — typed access to `public`'s 28 tables, which are real, applied, and actively read/written —
  without letting it become a second, competing definition of the five custom schemas that already
  have their own hand-written, R-3-compliant raw-SQL migration track.
- This directly extends `MIGRATION_STATE.md`'s still-open architectural question ("converge,
  coexist, or supersede?") rather than answering it. TE-P0 cannot answer "converge vs. supersede"
  responsibly — that is a product/data decision (which of `content.question` vs `public.questions`
  is the real question bank going forward is exactly I-16/I-17/I-18's territory, not something
  visible from schema inspection alone). What TE-P0 *can* settle, and does: Prisma's blast radius is
  capped at `public`, application code on both sides keeps working exactly as configured today, and
  the convergence decision is deferred to the project lead with the concrete evidence above (§2's
  routing table, §7 of `DB_STATE.md`'s "26 of 28 public tables have a matching model" finding) rather
  than left as an abstract "known drift risk."
- Practical near-term consequence for TE-P1 onward: **the test engine (Sections 6/7 of the brief) is
  built exclusively against `assess`/`catalog`/`content`/`core`/`learn`**, per brief §1.4's schema
  table and R-3 ("no redesign") — this recommendation does not suggest building the test engine
  against Prisma/`public` instead. It only says: don't touch `schema.prisma`'s scope, don't delete
  the working Prisma attempt path while the raw-SQL one is still mid-build, and don't let a future
  session "helpfully" `prisma db pull` the whole database again.
