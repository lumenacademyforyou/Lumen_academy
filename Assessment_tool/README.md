# Lumen Academy — NEET Assessment Tool (NEET-assessment-tool-CSK)

One-line summary
A focused, self-hosted exam-prep platform for NEET aspirants: real question banks, session-scoped mock tests assembled from the database on every attempt, server-scored results, and analytics — a TypeScript full-stack Vite + React frontend with an Express backend over PostgreSQL (Supabase), with a small legacy Prisma-backed slice retained for one profile field pair.

Table of contents
- What this is
- Stack
- Architecture & folder layout
- How it fits together (runtime flow)
- Quick start (developer)
- Environment variables (important)
- Build & deployment
- Testing
- Common maintenance tasks
- Contributing
- License & contact

## What this is
Lumen Academy helps NEET candidates train with realistic mock tests, review results, and track progress. The real domain schema (catalog/content/assess/core/learn) is a hand-written TypeScript layer over raw SQL migrations, not an ORM-managed one — see `db/` below. Auth is entirely client-side Supabase Auth; the backend never issues or verifies its own tokens.

### Stack
- Language(s): TypeScript (frontend + backend)
- Framework / runtime:
  - Frontend: React 19 + Vite 6 (client SPA)
  - Backend: Node + Express 4 (TypeScript)
  - Database: PostgreSQL via Supabase (the real, migrated domain schema lives under `db/migrations/`, applied with `db/scripts/run-migration.mjs` — not a Prisma migration)
- Notable libraries and services:
  - Supabase (`@supabase/supabase-js`) — auth (client-side) and Storage (question images)
  - Prisma — retained only for one legacy table's `targetExam`/`locale` fields (see `prisma/schema.prisma`'s own header for exactly why); not the schema-migration system for this app
  - Tailwind CSS v4 (UI styling)
  - Zod (runtime validation)
  - Recharts (dashboard/analytics charts)
  - Playwright + Vitest/node:test (E2E + unit testing)
  - PDF tooling (pdfkit, jspdf, html2canvas) for exports

## Architecture & folder layout
Top-level important entries (see `RESTRUCTURE_PLAN.md` for the historical restructure audit — a completed one-time migration record, not a living reference; and `docs/APP_COMPLETION_PLAN.md` for the current, up-to-date picture of what's built and why):
```
backend/src/                  # Express app: routes, controllers, services, middleware, lib, config
db/                           # The real domain layer: catalog/core/content/assess/learn
                               # (model/repository/service per entity, raw SQL)
                               # + migrations/, verify/, scripts/ (seed, import, manual/e2e, prove-*)
db/content/content-batches/    # Raw question-import batches (JSON + images), organized by subject
schemas/                      # Zod schema validating content-batch JSON shape
prisma/                       # Retained for exactly one legacy table (see prisma/schema.prisma header)
frontend/src/                 # React app: pages, components/{layout,ui}, contexts, services, data, types
frontend/public/              # Static assets served as-is
docs/                         # APP_COMPLETION_PLAN.md (current status), design docs, ops notes
tests/                        # Playwright E2E tests
.env.example                  # Environment template
package.json                  # Root scripts and dependency list
vite.config.ts, tsconfig.json # Root build/type config (frontend/backend each also have a tsconfig.json)
prisma.config.ts              # Prisma tooling config (client generation only — see prisma/schema.prisma)
README.md                     # (this file)
```

## How it fits together (runtime flow)
- Dev: frontend runs on Vite (`npm run dev`) and backend runs separately (`npm run dev:api`); the frontend talks to the Express API under `/api/*`.
- Production build bundles the frontend into `dist/`; the backend serves those static files and the bundled server is produced with esbuild as ESM (`dist/server.mjs` — the generated Prisma client relies on `import.meta.url`, which is only valid in ESM output).
- Database: the real schema (catalog/content/assess/core/learn) is created and evolved via `db/migrations/*.sql` + a matching `db/verify/*.sql` per migration, applied with `node db/scripts/run-migration.mjs <name>`. Prisma's own migration track (`prisma/migrations/`) is not used to change this schema — see `prisma/schema.prisma`'s header for the full boundary decision.
- Auth: 100% client-side Supabase Auth. The backend verifies a request's bearer token by calling Supabase's Auth API directly (`auth.getUser`) — it never signs or verifies its own JWTs, so there is no `JWT_SECRET` anywhere in this app.
- Images: question assets resolve to Supabase Storage public URLs (`db/content/asset-resolver.ts`), configured via `OBJECT_STORAGE_BUCKET`.

## Quick start (developer)
1. Install dependencies
```bash
npm install
```
2. Copy the env template and fill in real values
```bash
cp .env.example .env
# Edit .env — see "Environment variables" below for what each one is and where it's read.
```
3. Generate the Prisma client (needed for the one still-used legacy field pair — see prisma/schema.prisma)
```bash
npx prisma generate
```
4. Apply the real domain-schema migrations, in order, against the database `DATABASE_URL` points at
```bash
for f in db/migrations/*.sql; do
  name=$(basename "$f" .sql)
  node db/scripts/run-migration.mjs "$name"
done
```
5. Seed reference data — order matters, each script assumes the earlier ones already ran (see `docs/CORE_LAYER_OPERATIONS.md`)
```bash
npx tsx db/scripts/seed/00_core_roles.ts
npx tsx db/scripts/seed/01_catalog.ts
npx tsx db/scripts/seed/02_core_lifecycle_fixture.ts
npx tsx db/scripts/seed/03_assess_fixture.ts
```
6. Start servers (dev) — two terminals
```bash
npm run dev:api   # backend API on :4000
npm run dev       # frontend on :5173
```

Production build
```bash
npm run build   # Vite build + esbuild bundle of the backend
npm start        # runs the bundled server (serves the built frontend too)
```

## Environment variables
Full template: `.env.example` (kept in sync with `backend/src/config/env.ts`, `db/config/env.ts`, and the frontend's `VITE_`-prefixed vars — update the template if those change). The essentials:
- `DATABASE_URL` — Postgres connection string (read by both the backend and the `db/` layer)
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` — server-side token verification
- `SUPABASE_SERVICE_ROLE_KEY` — admin-only operations (invitations, forced status changes, seed/e2e scripts); not required for normal request serving
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` — the frontend's own Supabase client
- `OBJECT_STORAGE_BUCKET` — required at runtime for any image-bearing question to resolve (schema-optional at boot; see `db/config/env.ts`)
- `PORT`, `CORS_ORIGINS`, `NODE_ENV`, `LOG_LEVEL`, `SESSION_IDLE_TIMEOUT_MINUTES`, `SESSION_ABSOLUTE_HOURS` — all optional, sensible defaults

There is no `JWT_SECRET` and no AI-provider key anywhere in this app — auth is Supabase-only, and rule 6 of the completion directive (`docs/LA-APP-COMPLETION-001_claude_code_prompt.md`) bans AI calls entirely; the AI subsystem that used to exist here was retired in Phase H.

## Scripts (from package.json)
- `npm run dev` — start Vite dev server (frontend)
- `npm run dev:api` — watch and run the backend server (tsx)
- `npm run build` — build frontend + bundle backend with esbuild
- `npm start` — run the bundled production server
- `npm test` / `npm run test:e2e` — Playwright E2E tests
- `npm run test:unit` — backend + `db/` unit tests (node:test) and frontend unit tests (Vitest)

## Testing & QA
- Playwright is configured for E2E tests (`playwright.config.ts`). Run `npm test` to execute the suite.
- `npm run test:unit` runs backend/db `node:test` files and the frontend Vitest suite in one command (also what CI runs).
- `docs/HAPPY_PATH.md` documents the expected user journey for manual QA.

## Database & migrations
- The real schema (catalog, content, assess, core, learn, util) lives under `db/migrations/*.sql`, each with a matching `db/verify/verify_<name>.sql`. Apply one with `node db/scripts/run-migration.mjs <migration-name-without-.sql>` — this runs the migration then its verify script against `DATABASE_URL`.
- `prisma/` is retained only for one legacy table's `targetExam`/`locale` fields, still read/written by the real `/api/me` endpoints — see `prisma/schema.prisma`'s own header comment for the full reasoning and what's confirmed dead vs. load-bearing. Do not add new domain tables there, and do not run `prisma migrate deploy`/`db push` against the live database.
- Reference-data seeding: `db/scripts/seed/00_core_roles.ts` → `01_catalog.ts` → `02_core_lifecycle_fixture.ts` → `03_assess_fixture.ts`, in that order (see `docs/CORE_LAYER_OPERATIONS.md`). All are idempotent — safe to re-run, and each accepts `--dry-run`.

## Deployment notes
- Production artifact is a single Node server that serves the built frontend from `dist/` and exposes the API.
- The `build` script uses Vite for the frontend and esbuild to bundle the backend into `dist/server.mjs` (ESM format — required by the generated Prisma client's use of `import.meta.url`).
- `npm start` sets `NODE_ENV=production` via `cross-env` before running the bundle — this matters: without it, the server falls back to a non-production code path that never serves the built frontend.
- Use a managed Postgres (Supabase recommended, since Storage/Auth already point there) with connection pooling.
- For CI: run `npm run typecheck`, `npm run test:unit`, `npm run build`, then `npx playwright test` — this is exactly what `.github/workflows/ci.yml` does. Apply `db/migrations/` (not a Prisma migration) as a separate, explicit deploy step against the target database.

## Common maintenance tasks
- Add new content: question banks import via `db/scripts/import/import-content.ts` against JSON batches under `db/content/content-batches/`; publishing goes through the real review-state-machine scripts, not a direct SQL update.
- Add a schema change: write a new `db/migrations/NNN_name.sql` + matching `db/verify/verify_NNN_name.sql`; apply with `db/scripts/run-migration.mjs`. Never hand-edit an already-applied migration file.
- Update the Prisma client after a schema.prisma change: `npx prisma generate` (only affects the one legacy `User` model in active use).
- Regenerate the production bundle after a dependency or code change: `npm run build && npm start`.

## Contributing
- Branching: create feature branches off `NEET-assessment-tool-CSK` for NEET-specific work; open PRs against that branch.
- Coding standards: TypeScript strict mode is enforced. Use Zod for runtime validation in API boundaries.
- Tests: add Playwright tests for major user flows (landing → test creation → test taking → evaluation → results).
- PR checklist:
  - `npm run typecheck` passes
  - `npm run test:unit` and, where relevant, `npx playwright test` pass
  - A matching `db/verify/*.sql` is included for any new `db/migrations/*.sql`
  - Update `docs/HAPPY_PATH.md` or this README if a user-facing flow changes

## Troubleshooting
- "Cannot connect to DB": verify `DATABASE_URL` and that your IP/network is allowed by the Postgres provider.
- A `db/migrations/*.sql` file fails to apply: check `db/verify/verify_<name>.sql`'s own assertions for what it expected; migrations are forward-only and are never edited after being applied.
- Frontend CORS issues in dev: run `dev:api` and `dev` in separate terminals; allowed origins are configured via `CORS_ORIGINS`.
- Sign-in doesn't work at all: confirm `helmet()`'s CSP in `backend/src/server.ts` actually allows your Supabase project's origin for `connect-src`/`img-src` (a real production bug found and fixed in Phase F — see `docs/APP_COMPLETION_PLAN.md`).

## Try asking
- "Where are the question banks located for NEET topics?" — real content is uploaded unit-wise via `db/content/content-batches/` (organized by subject) → `db/scripts/import/import-content.ts` → `content.question` (published via the review-state-machine scripts).
- "How do I run the backend server with hot reload?" — `npm run dev:api`.
- "What's actually done vs. still in progress?" — `docs/APP_COMPLETION_PLAN.md` is the authoritative, continuously-updated running tracker (phase status, evidence, session log).

## License & contact
- LICENSE: (Add your project license file here)
- Maintainers: C.Santhosh Kumar, Prince.A, Deepan.B
- For urgent issues, open an issue on this repository and tag `@lumenacademyforyou`.
