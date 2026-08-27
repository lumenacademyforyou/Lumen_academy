# Lumen Academy — Repository Restructure Plan

Status: **Phase 1 audit complete, decisions confirmed by user, executing Phase 2.**
This repo is materially more complex than a generic Vite+Express app: `db/` is a
hand-written TypeScript domain layer (not just SQL), there is a second, parallel
Prisma ORM setup, and several root-level data folders (`database_sample/`,
`content-batches/`, `schemas/`) don't fit neatly into `frontend/backend/db`.

---

## 1. Current tree (depth 4, excl. node_modules/dist/.git)

```
├─ .agents/skills/prisma-*/            # AI-agent skill docs (tooling, not app source)
├─ .claude/, .windsurf/                # same skill docs, mirrored for other tools
├─ .github/workflows/ci.yml            # npm ci → prisma generate → typecheck → build
├─ backend/                            # Express API (flat, no src/)
│  ├─ ai/{index,types}.ts, ai/providers/*, ai/prompts/*
│  ├─ config.ts, db.ts, supabaseAdmin.ts, supabaseClient.ts
│  ├─ controllers/*.ts  (5 files)
│  ├─ generated/prisma/  (gitignored, Prisma Client output)
│  ├─ lib/{dbCrudRouter,permissions}.ts
│  ├─ middleware/*.ts   (6 files)
│  ├─ routes/*.ts       (9 files)
│  ├─ services/*.ts     (9 files + tests)
│  └─ server.ts
├─ content-batches/                    # raw question-import JSON + batch image assets
├─ database_sample/                    # mock/demo data: questions, syllabus, attempts
├─ db/                                 # NOT just migrations — a full domain layer:
│  ├─ catalog/, core/, content/, assess/, learn/   (model/repository/service per entity)
│  ├─ shared/{errors,pool,repository-helpers}.ts
│  ├─ config/env.ts
│  ├─ scripts/{seed,import,e2e,prove-*.ts,...}
│  ├─ migrations/*.sql (000–021, forward-only, applied)
│  ├─ verify/*.sql + verify/docs/FRONTEND.md
│  ├─ reports/*.json   (generated run output, currently git-tracked)
│  └─ CORE_LAYER_ENDPOINTS.md, CORE_LAYER_OPERATIONS.md, MIGRATION_STATE.md
├─ docs/                               # 15 existing design/status docs
├─ frontend/                           # flat, no src/
│  ├─ App.tsx, main.tsx, supabase.ts, index.css, vite-env.d.ts
│  ├─ assets/lumen-logo.png
│  ├─ components/{common,dashboard,views}/*.tsx
│  ├─ contexts/LanguageContext.tsx
│  └─ lib/*.ts  (9 files — API clients + local-storage services)
├─ lumen-db-claude-code-kit/           # UNTRACKED (gitignored) — reference kit, not source
├─ prisma/                             # a SECOND, parallel ORM/migrations setup
│  ├─ schema.prisma, seed.ts, migrations/2026*/migration.sql
├─ public/lumen-logo.png               # Vite's default publicDir (repo root)
├─ schemas/question-authoring.schema.ts + samples/*.json
├─ tests/happy-path.spec.ts
├─ types/index.ts                      # legacy shared interfaces (Question, TestAttempt…)
├─ index.html, vite.config.ts, tsconfig.json, prisma.config.ts, playwright.config.ts
└─ package.json, .env(.example), .gitignore
```

## 2. Entry points & config files (current paths)

| File | Path | Notes |
|---|---|---|
| HTML entry | `index.html` (root) | loads `/frontend/main.tsx` directly |
| Vite config | `vite.config.ts` (root) | `alias '@' → repo root`; no custom `root`/`publicDir` |
| TS config | `tsconfig.json` (root) | **only one** in the repo; `paths: {"@/*":["./*"]}`; no `include`/`exclude` (implicit whole-repo) |
| Tailwind | *(none)* | Tailwind v4 via `@tailwindcss/vite` plugin + `@theme` block in `frontend/index.css` — no `tailwind.config.*` exists |
| PostCSS | *(none)* | not needed by Tailwind v4 |
| oxlint | *(none)* | lint script is `tsc --noEmit`, not oxlint |
| package.json scripts | root | `dev` (vite), `dev:api` (tsx watch backend/server.ts), `build` (vite build && esbuild backend/server.ts → dist/server.cjs), `start`, `test`/`test:e2e` (playwright), `test:unit` (`node --test "backend/**/*.test.ts"`), `lint`/`typecheck` (tsc), `seed` (tsx prisma/seed.ts) |
| .env / .env.example | root | shared by frontend (`VITE_*`) and backend/db |
| esbuild entry | inline in `build` script | `backend/server.ts` → `dist/server.cjs` |
| Playwright | `playwright.config.ts` (root) | `testDir: "./tests"`, `webServer: npm run start` on port 3000 |
| Prisma config | `prisma.config.ts` (root) | schema `prisma/schema.prisma`, migrations `prisma/migrations`, seed `prisma/seed.ts` |
| Prisma generator output | `prisma/schema.prisma:3` | `output = "../backend/generated/prisma"` |
| CI | `.github/workflows/ci.yml` | `npm ci` → `npx prisma generate` → `npm run typecheck` → `npm run build` |

## 3. Import graph summary

Full per-file tables were produced during the audit; condensed findings:

- **Frontend** (~33 files, all under flat `frontend/`): every file reachable from
  `main.tsx`/`App.tsx`; zero broken imports. 12 call sites cross the `frontend/`
  boundary into root `types/` (11 files, depth 1–3) and root `database_sample/`
  (7 files, depth 1–3) via relative paths — the single biggest fragility, since
  adding any nesting under `frontend/` changes what these resolve to *silently*
  rather than erroring. The `@/` alias (→ repo root) is configured but **never used**.
- **Backend** (~30 non-generated, non-test files, flat under `backend/`): no
  alias usage, all relative, all `.js`-suffixed (ESM convention, resolved to
  `.ts` by tsx/esbuild) except `routes/api.ts`'s 5 controller imports (no
  extension — inconsistent, harmless). **19 files / ~35 import lines** reach into
  root `db/**` via a uniform `../../db/...` (2-level climb, since `backend/*/file.ts`
  is exactly 2 levels deep). One true orphan: `backend/middleware/tenancyScope.ts`
  (deliberately unwired, staged for a future phase per its own header comment).
- **`db/` domain layer**: only `backend/**` imports it (confirmed, exhaustive).
  Internal imports climb 2–5 levels depending on entity nesting (all correct,
  none broken). **Reverse coupling exists**: `db/content/asset-resolver.ts`,
  `db/scripts/import/import-content.ts`, `db/scripts/e2e/attempt.ts`,
  `db/scripts/seed/02_content.ts`, `db/scripts/prove-cl5-rbac.ts` import back
  from `backend/` (`supabaseAdmin.ts`, `lib/permissions.ts`), and `prisma/seed.ts`
  imports `backend/generated/prisma/client.js`. Two scripts additionally compute
  paths by **counting `../` segments + literal folder-name strings**, not
  imports — `db/scripts/import/import-content.ts` and
  `db/scripts/prove-cl3-asset-resolver.ts` hardcode `"content-batches/assets/..."`
  relative to a `REPO_ROOT` computed from their own file depth. These break on a
  depth change even though no `import` statement references `content-batches/`.
- **Prisma vs `db/` vs legacy**: both are live, not one superseding the other.
  `backend/db.ts`'s Prisma client (`public.*` tables) powers a legacy/parallel
  quiz track (`/api/questions`, `/api/tests/*`, the retired `/submit-attempt`);
  `db/**` (raw `pg` via `db/shared/pool.ts`) powers the real
  catalog/core/content/assess/learn domain. `backend/services/meProfile.service.ts`
  and `provisionUser.service.ts` straddle both intentionally (one Prisma
  `$transaction` writes both `prisma.user` and `core.app_user` atomically).
  `db/config/env.ts` and `backend/config.ts` are two independent Zod env readers
  by design (`db/config/env.ts`'s own comment: lets the db layer run without the
  Express app) — plus Prisma's own implicit env read is a de facto third path.
- **`database_sample/**`**: `initialAttempts.ts` and `questions.ts` both import
  `Question`/`TestAttempt` from root `../types` — so `types/index.ts` is
  consumed by *both* `frontend/**` and `database_sample/**`, not frontend alone.
  Runtime consumers: `App.tsx`, `TestTakingView.tsx`, `TestListView.tsx`,
  `CoursesView.tsx`, `LandingView.tsx`. One-time consumers:
  `db/scripts/seed/01_catalog.ts` (`SYLLABUS_UNITS`), `db/scripts/seed/02_content.ts`
  (`ALL_QUESTIONS`), `prisma/seed.ts` (both) — these treat it as a one-shot
  migration source, not a runtime dependency.
- **`content-batches/**` / `schemas/**`**: only `db/scripts/import/import-content.ts`
  and `db/scripts/prove-cl3-asset-resolver.ts` touch `content-batches/` (by
  hardcoded path string / CLI arg, not import). `schemas/question-authoring.schema.ts`
  is imported only by `import-content.ts`; `schemas/validate-samples.ts` resolves
  its own `samples/` directory relative to `import.meta.url`, so it's
  self-contained and safe to move as a unit.
- No broken imports were found anywhere in the repo.

## 4. Orphan / dead-code candidates

| File | Status |
|---|---|
| `backend/middleware/tenancyScope.ts` | Not imported anywhere. Deliberately staged (own comment: built ahead of the route that will use it). **Not a delete candidate** — keep, just note it's currently dead. |

No orphans found under `frontend/` or `db/` (everything traced to an entry point).

## 5. Mock / seed / demo data inventory (list only, per instructions)

| Location | Content | Consumers |
|---|---|---|
| `database_sample/questions.ts` | Hardcoded `BIOLOGY_QUESTIONS`/`CHEMISTRY_QUESTIONS`/`PHYSICS_QUESTIONS`/`ALL_QUESTIONS` | frontend views + one-time seed scripts |
| `database_sample/syllabusData.ts` | `SYLLABUS_UNITS` (exam/unit structure) | frontend views + `db/scripts/seed/01_catalog.ts` |
| `database_sample/initialAttempts.ts` | `INITIAL_ATTEMPTS` (mock dashboard history) | `App.tsx` only |
| `content-batches/*.json` + `assets/**` | Real question-import batches (physics/chem/botany/zoology), pending validation | `db/scripts/import/import-content.ts` (CLI arg) |
| `schemas/question-authoring.schema.ts` | Zod schema validating batch JSON shape | `import-content.ts`, `schemas/validate-samples.ts` |
| `db/scripts/seed/*.ts` | One-time migration scripts (roles, catalog, content, fixtures) | run manually via `tsx` |
| `db/reports/*.json` | Generated run output (timestamped, embeds contributor-machine absolute paths) — **git-tracked despite looking like a build artifact**, inconsistent with how `backend/generated/prisma` is gitignored. Flagged, not touched. |

## 6. User decision — question/demo-data cleanup (confirmed, executing alongside the layout move)

This is a deliberate exception to "pure layout refactor": the user has asked to
retire the hardcoded mock question bank now that real content will be uploaded
unit-by-unit through `db/content` (via `content-batches/` → `import-content.ts`).
Confirmed approach:
- `database_sample/questions.ts` → relocated (see mapping below), **arrays
  emptied** (`BIOLOGY_QUESTIONS = []`, etc.) but the module, export names, and
  types stay identical, so every current import site keeps compiling and
  rendering (empty state) with zero component-logic changes.
- `database_sample/syllabusData.ts` (exam/unit structure) and
  `database_sample/initialAttempts.ts` (mock dashboard history) are **kept
  as-is**, just relocated with the rest of the frontend move.
- The `database_sample/` folder itself goes away; its 3 files + barrel move into
  `frontend/src/data/` (see §8) since every remaining runtime consumer is a
  frontend component and the emptied `questions.ts` no longer needs to be
  reachable from `db/scripts/seed/02_content.ts` (that seed script becomes
  moot once real content replaces the mock bank, but is left in place, unedited
  — not this task's concern to retire it).

## 7. Anything the literal target tree can't satisfy without a logic change (or a named deviation)

| Item | Issue | Resolution taken |
|---|---|---|
| `db/` domain layer (catalog/core/content/assess/learn, ~110 files) | Target tree's `db/` is meant to hold only `README.md, migrations/, verify/, seed/`. Moving the actual business logic into `backend/src/{services,repositories}/` would require rewriting the internal relative imports of ~110 files (climbs of 2–5 levels each) plus all 19 backend importers — far beyond a "pure file layout" risk budget for zero behavior change. | **Kept `db/` at repo root as its own top-level tier**, exactly matching the user's own framing ("hold the respective files in frontend, backend, db folders"). Internal structure untouched; only `backend/`'s climb depth into it changes (see §8). |
| Parallel `prisma/` ORM setup | Not mentioned in the target tree at all; folding it into `backend/` or `db/` risks the `prisma generate` CI step and `dist/server.cjs` build. | **Left at repo root, untouched**, as an "other" top-level folder per the user's own instruction. Only its generator `output` path is updated (see §9) because `backend/generated/prisma` itself moves. |
| `content-batches/`, `schemas/`, `database_sample/` (post-cleanup: `frontend/src/data/`) | Not present in the target tree; don't cleanly belong to exactly one of frontend/backend/db. | `content-batches/` and `schemas/` **stay at repo root** as "other" folders (their only consumers are `db/scripts/*`, which don't move). `database_sample/`'s surviving files move into `frontend/src/data/` since frontend is now their only consumer. |
| `shared/types/` | Target tree expects this to hold cross-boundary types. Audit found `types/index.ts` is consumed by `frontend/**` and (pre-cleanup) `database_sample/**` only — **never by `backend/`**. Per the target's own rule ("a type used by one side stays with that side"), nothing currently qualifies for `shared/`. | **`shared/` is omitted.** `types/index.ts` moves into `frontend/src/types/` instead of `shared/types/`. |
| `frontend/vite.config.ts`, `frontend/index.html`, `frontend/tsconfig.json` | Root `package.json` scripts (`dev`, `build`) invoke bare `vite`/`esbuild` from the repo root; `backend/server.ts`'s static-file serving hardcodes `path.join(process.cwd(), "dist")`; `playwright.config.ts` expects `webServer: npm run start`. Moving these three files into `frontend/` and keeping behavior byte-identical requires Vite's `root`/`build.outDir` to be reconfigured so `dist/` still lands where `server.ts` expects it — a config change, not a logic change, but a more invasive one than a single path string. | Config changes detailed in §9 — `vite.config.ts` gets `root: '.'`(unchanged) is **not** moved into `frontend/`; instead it **stays at repo root** pointing at `frontend/index.html`/`frontend/src` via `root`/alias options, since relocating it risks the build output path silently changing. Flagged as a deviation from the literal target tree, chosen to protect `server.ts`'s untouched static-serving logic. |
| `backend/tsconfig.json` / `frontend/tsconfig.json` as two files | Only one root `tsconfig.json` exists today, with no `include`; splitting it into two requires designing new `include` arrays (more than a path-string edit). | Two tsconfigs are created (frontend/backend), each `include`-scoped to its own tree, both extending shared `compilerOptions`. This is the one place the restructure adds new config content rather than only editing paths — called out explicitly since it's a gray area against rule 3. |
| `backend/lib/` (dbCrudRouter.ts, permissions.ts) and backend infra singletons (db.ts, supabaseAdmin.ts, supabaseClient.ts) | Target tree's backend buckets (`routes/controllers/services/repositories/middleware/config/types`) have no natural home for generic routing-factory or client-singleton code. | Added `backend/src/lib/` (a named deviation) to hold all five files, rather than forcing them into `services/` or `config/` where they don't semantically fit. |

## 8. File-by-file mapping (old → new)

### db/ (Option B — stays at repo root, internal shape unchanged)
| Old | New |
|---|---|
| `db/catalog/**`, `db/core/**`, `db/content/**`, `db/assess/**`, `db/learn/**`, `db/shared/**`, `db/config/**`, `db/scripts/**` | *(unchanged — no move)* |
| `db/migrations/*.sql` | *(unchanged — never edited, per rule 6)* |
| `db/verify/*.sql` | *(unchanged)* |
| `db/verify/docs/FRONTEND.md` | `docs/FRONTEND.md` (misplaced frontend API doc, pure relocation) |
| `db/verify/docs/blueprint/` | *(empty directory — nothing to move)* |
| `db/CORE_LAYER_ENDPOINTS.md` | `docs/CORE_LAYER_ENDPOINTS.md` |
| `db/CORE_LAYER_OPERATIONS.md` | `docs/CORE_LAYER_OPERATIONS.md` |
| `db/MIGRATION_STATE.md` | `docs/MIGRATION_STATE.md` |
| `db/reports/*.json` | *(unchanged; flagged in §5, not touched)* |
| *(new)* | `db/README.md` — brief pointer explaining `db/` is the domain layer + migrations, added per target tree |

### backend/ → backend/src/**
| Old | New |
|---|---|
| `backend/server.ts` | `backend/src/server.ts` |
| `backend/config.ts` | `backend/src/config/env.ts` |
| `backend/db.ts` | `backend/src/lib/db.ts` |
| `backend/supabaseAdmin.ts` | `backend/src/lib/supabaseAdmin.ts` |
| `backend/supabaseClient.ts` | `backend/src/lib/supabaseClient.ts` |
| `backend/lib/dbCrudRouter.ts` | `backend/src/lib/dbCrudRouter.ts` |
| `backend/lib/permissions.ts` | `backend/src/lib/permissions.ts` |
| `backend/ai/**` | `backend/src/services/ai/**` |
| `backend/controllers/*.ts` | `backend/src/controllers/*.ts` |
| `backend/routes/*.ts` | `backend/src/routes/*.ts` |
| `backend/services/*.ts` (+ `.test.ts`) | `backend/src/services/*.ts` |
| `backend/middleware/*.ts` | `backend/src/middleware/*.ts` |
| `backend/generated/prisma/**` | `backend/src/generated/prisma/**` (regenerated by `prisma generate`, not `git mv`'d — see §9) |
| *(new)* | `backend/tsconfig.json` — `include: ["src"]`, extends root compilerOptions |

### frontend/ → frontend/src/**
| Old | New |
|---|---|
| `frontend/App.tsx` | `frontend/src/App.tsx` |
| `frontend/main.tsx` | `frontend/src/main.tsx` |
| `frontend/supabase.ts` | `frontend/src/services/supabase.ts` |
| `frontend/index.css` | `frontend/src/styles/index.css` |
| `frontend/vite-env.d.ts` | `frontend/src/vite-env.d.ts` |
| `frontend/assets/lumen-logo.png` | `frontend/src/assets/lumen-logo.png` |
| `frontend/components/common/Header.tsx` | `frontend/src/components/layout/Header.tsx` |
| `frontend/components/common/DailyReminderModal.tsx` | `frontend/src/components/layout/DailyReminderModal.tsx` |
| `frontend/components/common/SplashView.tsx` | `frontend/src/components/layout/SplashView.tsx` |
| `frontend/components/common/LumenLogo.tsx` | `frontend/src/components/ui/LumenLogo.tsx` |
| `frontend/components/common/AnimatedCounter.tsx` | `frontend/src/components/ui/AnimatedCounter.tsx` |
| `frontend/components/common/NotificationBell.tsx` | `frontend/src/components/ui/NotificationBell.tsx` |
| `frontend/components/dashboard/*.tsx` (3 files) | `frontend/src/components/ui/dashboard/*.tsx` |
| `frontend/components/views/*.tsx` (13 files incl. `ProfileCard.tsx`) | `frontend/src/pages/*.tsx` |
| `frontend/contexts/LanguageContext.tsx` | `frontend/src/contexts/LanguageContext.tsx` |
| `frontend/lib/*.ts` (9 files) | `frontend/src/services/*.ts` |
| `types/index.ts` (root) | `frontend/src/types/index.ts` |
| `database_sample/index.ts` | `frontend/src/data/index.ts` |
| `database_sample/syllabusData.ts` | `frontend/src/data/syllabusData.ts` *(unchanged content)* |
| `database_sample/initialAttempts.ts` | `frontend/src/data/initialAttempts.ts` *(unchanged content)* |
| `database_sample/questions.ts` | `frontend/src/data/questions.ts` *(arrays emptied per §6, exports/types unchanged)* |
| `public/lumen-logo.png` | `frontend/public/lumen-logo.png` |
| *(new)* | `frontend/tsconfig.json` — `include: ["src"]`, extends root compilerOptions |

### Root — unchanged (kept as "other" top-level folders per user's framing)
`content-batches/`, `schemas/`, `prisma/`, `docs/` (plus incoming files above), `tests/`,
`playwright.config.ts`, `package.json`, `.env`/`.env.example`, `.gitignore`,
`README.md`, `HAPPY_PATH.md` → `docs/HAPPY_PATH.md` (relocated, spec-like doc),
`index.html`, `vite.config.ts`, `tsconfig.json` (root — see §7/§9 on why these
don't move into `frontend/`), `.agents/`, `.claude/`, `.windsurf/` (tooling,
untouched), `lumen-db-claude-code-kit/` (untracked/gitignored, untouched).

## 9. Config values to change

| File | Old | New |
|---|---|---|
| root `tsconfig.json` | single file, `paths: {"@/*": ["./*"]}`, no `include` | becomes the shared base (`compilerOptions` only, still no emit); `paths` gains `"@/*": ["./frontend/src/*"]` and `"@shared/*"` is **not** added (no shared/ — see §7) |
| *(new)* `frontend/tsconfig.json` | — | `{"extends": "../tsconfig.json", "include": ["src"], "compilerOptions": {"paths": {"@/*": ["./src/*"]}}}` |
| *(new)* `backend/tsconfig.json` | — | `{"extends": "../tsconfig.json", "include": ["src"]}` |
| `vite.config.ts` | `resolve.alias['@'] = repo root` | `resolve.alias['@'] = frontend/src`; add `publicDir: 'frontend/public'`; `root` stays repo root (see §7) so `dist/` output path is untouched |
| `index.html` | `<script src="/frontend/main.tsx">` | `<script src="/frontend/src/main.tsx">` |
| `prisma/schema.prisma` | `output = "../backend/generated/prisma"` | `output = "../backend/src/generated/prisma"` |
| root `package.json` `test:unit` | `node --import tsx --test "backend/**/*.test.ts"` | `"backend/src/**/*.test.ts"` |
| `.gitignore` | `/backend/generated/prisma` | `/backend/src/generated/prisma` |

No changes to `playwright.config.ts` (testDir/webServer paths are unaffected), no
changes to `.env.example` (no path references), no Tailwind/PostCSS/oxlint
config exists to change.

## 10. Execution order (Phase 2, committing after each step)

1. `db/` doc tidy (low risk, no import changes): move the 4 stray `.md` files
   into `docs/`, add `db/README.md`.
2. `backend/` → `backend/src/**`, rewrite backend-internal imports and the
   19-file `../../db/...` → `../../../db/...` climb, update
   `prisma/schema.prisma` generator output + `.gitignore`.
3. `frontend/` → `frontend/src/**`, including `types/` and the cleaned-up
   `database_sample/` → `frontend/src/data/` move; rewrite all internal +
   cross-boundary imports.
4. Config pass: `vite.config.ts`, two new `tsconfig.json`s, root `tsconfig.json`,
   `index.html`, root `package.json` scripts.
5. `HAPPY_PATH.md` → `docs/`.
6. Verification: `tsc --noEmit` on both new tsconfigs, `npm run build`, manual
   route-table diff, manual smoke test of the dev server.

---

## 11. Phase 3 — verification (actual output)

`npx tsc --noEmit -p frontend/tsconfig.json` → **0 errors.**

`npx tsc --noEmit -p backend/tsconfig.json` → **6 errors, all pre-existing**
(confirmed by regenerating the Prisma client fresh at its new path and
re-running — identical errors before and after):
```
backend/src/services/aiExplanation.service.ts(89,64): 'hitCount' does not exist on AiCache update input
backend/src/services/attempt.service.ts(43,5) / (44,5): Type 'Decimal' is not assignable to type 'number'
backend/src/services/attempt.service.ts(239,5): ScoringInput.marks: Decimal vs number
backend/src/services/attempt.service.ts(356,28) / (364,26) / (409,24): score: Decimal vs number
```
These are drift between `prisma/schema.prisma`'s `Decimal` fields and
hand-written interfaces expecting `number` — unrelated to file paths.
`prisma/schema.prisma`'s own header comment already flags it as
"reconstructed... not guaranteed byte-identical to the original." Left
untouched, as instructed for pre-existing failures.

`npx tsc --noEmit` (root config, whole repo — what `npm run typecheck`/`lint`
actually runs) → same 6 errors, nothing else. Confirms the restructure
introduced zero errors anywhere in `db/`, `prisma/`, `schemas/`, or the
seed scripts.

`npm run build` (`vite build && esbuild backend/src/server.ts ...`) →
**succeeds.** Vite transformed 3005 modules and produced a separate chunk
for every lazy-loaded page (`AdminView`, `AnalyticsView`, `CourseAreaView`,
`DashboardView`, `EvaluatingView`, `LandingView`, `LobbyView`, `ProfileView`,
`SystemCheckView`, `TestListView`, `TestTakingView`) plus `syllabusData` —
confirming every dynamic `import()` in `App.tsx` resolved. esbuild bundled
`dist/server.cjs` with no new warnings (the one pre-existing warning, about
`import.meta` in the generated Prisma client under `--format=cjs`, is
intrinsic to bundling any Prisma client this way and unrelated to its
new path).

Runtime checks:
- `npx tsx backend/src/server.ts` boots cleanly and logs the healthy-start
  message — proves every route/controller/service/middleware/`db/` import
  across the whole backend resolves at module-load time, not just under `tsc`.
- `GET /` → `{"status":"ok", ...}`. `GET /api/health` → `{"status":"ok","db":"up",...}`
  (live Supabase connection succeeded). `GET /api/questions` → 139 real
  questions returned. `GET /api/syllabus` → `200`. Route table intact.
- `npx vite` dev server: `GET /` serves `index.html`; `GET /frontend/src/main.tsx`
  → `200` (entry script resolves through the new `publicDir`/root config);
  `GET /lumen-logo.png` → `200` (public-asset fallback path still resolves
  from the relocated `frontend/public/`).
- A repo-wide sweep for stale old-path import patterns (old component
  bucket names, bare `../db.js`/`../supabaseAdmin.js`, `backend/{controllers,
  routes,...}/` outside `src/`, `frontend/lib`, `database_sample`) found none
  remaining in active code — only inert comments and historical status docs
  (see §12).

## 12. Phase 4 — report

### Final `old → new` mapping as executed
Matches §8 exactly as planned, with one addition not anticipated in Phase 1:
`database_sample/questions.ts` did not survive as a clean rename (git shows
delete+add, not rename) because its content was rewritten (arrays emptied)
in the same step it moved — see §6.

### Every import rewritten, grouped by file
- **db/ doc tidy (commit 1):** no imports touched, doc-only + `README.md`
  cross-reference fixes (`docs/OPEN_ITEMS.md`, `docs/ENGINE_STATE.md`,
  `docs/DB_STATE.md`, `docs/BUILD_LOG.md`, `docs/CORE_LAYER_OPERATIONS.md`,
  `docs/MIGRATION_STATE.md`, `README.md`).
- **backend/ move (commit 2):** `backend/src/{server.ts, lib/db.ts,
  lib/supabaseAdmin.ts, lib/supabaseClient.ts}` (config.js → config/env.js);
  `backend/src/services/ai/{index.ts, providers/openrouter.ts}` (config.js
  path depth); `backend/src/services/aiExplanation.service.ts` (db.js → lib/db.js,
  ai/* → ./ai/*); 9 files' `../db.js`/`../supabaseAdmin.js`/`../supabaseClient.js`
  → `../lib/...`; 18 files / 46 occurrences of `../../db/...` → `../../../db/...`;
  5 reverse-coupling files outside backend (`db/content/asset-resolver.ts`,
  `db/scripts/e2e/attempt.ts`, `db/scripts/import/import-content.ts`,
  `db/scripts/seed/02_content.ts`, `db/scripts/prove-cl5-rbac.ts`) plus
  `prisma/seed.ts`'s generated-client import.
- **frontend/ move (commit 3):** `App.tsx` (14 import lines), `main.tsx` (1),
  5 `services/*.ts` files (supabase.js path fixes), `components/layout/
  {Header,SplashView}.tsx`, `components/ui/NotificationBell.tsx`,
  3 `components/ui/dashboard/*.tsx` files (+1 depth level each), all 14
  `pages/*.tsx` files (uniform −1 depth level, applied via 14 distinct
  find/replace patterns), plus 3 cross-tier seed-script/`prisma/seed.ts`
  fixes for the `database_sample/` → `frontend/src/data/` move.

### Every config value changed, with old and new value
| File | Old | New |
|---|---|---|
| `index.html` | `src="/frontend/main.tsx"` | `src="/frontend/src/main.tsx"` |
| `vite.config.ts` | `alias['@'] = __dirname` (repo root); no `publicDir` | `alias['@'] = __dirname/frontend/src`; `publicDir = __dirname/frontend/public` |
| `tsconfig.json` (root) | `paths: {"@/*": ["./*"]}` | `paths: {"@/*": ["./frontend/src/*"]}` |
| `backend/tsconfig.json` | *(new)* | `{"extends": "../tsconfig.json", "include": ["src"]}` |
| `frontend/tsconfig.json` | *(new)* | `{"extends": "../tsconfig.json", "include": ["src"]}` |
| `prisma/schema.prisma` | `output = "../backend/generated/prisma"` | `output = "../backend/src/generated/prisma"` |
| `.gitignore` | `/backend/generated/prisma` | `/backend/src/generated/prisma` |
| `package.json` `dev:api` | `tsx watch backend/server.ts` | `tsx watch backend/src/server.ts` |
| `package.json` `build` | `esbuild backend/server.ts ...` | `esbuild backend/src/server.ts ...` |
| `package.json` `test:unit` | `--test "backend/**/*.test.ts"` | `--test "backend/src/**/*.test.ts"` |

No changes to `playwright.config.ts`, `.env.example`, or any oxlint/Tailwind/
PostCSS config (none of the latter three exist in this repo).

### DELETE_CANDIDATES
| File | Evidence |
|---|---|
| `backend/src/middleware/tenancyScope.ts` | Grepped repo-wide for `tenancyScope`, `requireOwnInstitution`, `getCallerInstitutionId` — zero references outside its own file. Its own header comment confirms this is deliberate ("not wired into any route yet... built ahead of the phase that needs it"), not an accidental orphan. **Not deleted**, per rule 2 — flagged only. |
| `db/reports/*.json` (23 files) | Timestamped, contributor-machine-path-embedding generated run output, currently git-tracked unlike `backend/generated/prisma`. Not unreferenced by code, just inconsistent with the repo's own generated-artifact convention. **Not deleted** — out of scope (not a layout question), flagged for a separate decision. |

No other unreferenced files were found — the three research agents' exhaustive
import-graph audit (§3) found zero orphans in `frontend/` or `db/`, and only
the one in `backend/`.

### Pre-existing failures not touched
The 6 `Decimal`/`hitCount` type errors in `backend/src/services/{attempt,
aiExplanation}.service.ts` — see §11.

### Anything skipped and why
- **`shared/types/`** — omitted. Nothing in the current codebase is imported
  by both `frontend/` and `backend/`; forcing an empty folder into existence
  would contradict the target tree's own placement rule.
- **Root `scripts/`** — omitted. Every operational script that exists lives
  under `db/scripts/` already and is domain-specific; there was nothing
  left over to populate a generic top-level `scripts/`.
- **`content-batches/`, `schemas/`, `prisma/`** — left at repo root as
  standalone "other" folders (per the user's own framing: hold frontend/
  backend/db's respective files in those three, everything else stays
  outside). Their only consumers (`db/scripts/*`) didn't move, so no import
  changes were needed for them beyond the 2 files noted above.
- **`db/`'s internal domain-layer structure (catalog/core/content/assess/learn)**
  — left exactly as-is (Option B from §7): moving that business logic into
  `backend/src/{services,repositories}/` to literally match the target
  tree's minimal `db/` definition would have required rewriting on the
  order of 150+ internal relative imports across the domain layer for no
  behavioral benefit, which is a different risk class than the ~200 import
  lines this restructure did rewrite (all either a single mechanical
  depth-offset or a single renamed-file substitution, each individually
  verified). Flagged as a deviation from the literal prompt in §7, consistent
  with the user's explicit go-ahead to keep `db/`'s own files inside `db/`.
- **Historical status docs** (`docs/ENGINE_STATE.md`, `docs/DB_STATE.md`,
  `docs/BUILD_LOG.md`, `docs/FRONTEND.md`, and code comments referencing old
  paths) — left untouched. These are dated engineering logs describing
  point-in-time state ("Mounted at `backend/routes/api.ts:69`"), not living
  indexes; rewriting them wholesale would misrepresent them as still being
  maintained references. Only the docs that were clearly meant as
  forward-pointing (`README.md`'s architecture tree and troubleshooting
  section, `docs/CORE_LAYER_ENDPOINTS.md`/`OPERATIONS.md`/`MIGRATION_STATE.md`'s
  own cross-references) were updated.
