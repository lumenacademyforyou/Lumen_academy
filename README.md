# Lumen Academy — NEET Assessment Tool (NEET-assessment-tool-CSK)

One-line summary
A focused, self-hosted exam-prep platform for NEET aspirants providing curated mock tests, AI-assisted study plans, proctored test runs, and analytics — implemented as a TypeScript full‑stack Vite + React frontend with an Express + Prisma + PostgreSQL backend.

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
Lumen Academy helps NEET candidates train with realistic mock tests, review results, and get targeted study plans. The codebase is structured as a single repository with a clear frontend/backend split: a modern React + TypeScript UI (Vite) and an Express API backed by PostgreSQL (Prisma). The branch NEET-assessment-tool-CSK contains the NEET-focused feature work and migration state.

### Stack
- Language(s): TypeScript (frontend + backend), small amounts of CSS/HTML for static assets
- Framework / runtime:
  - Frontend: React 19 + Vite 6 (client SPA)
  - Backend: Node 20 + Express 4 (TypeScript)
  - Database: PostgreSQL 16 (Neon recommended) via Prisma ORM
- Notable libraries and services:
  - Prisma (schema, migrations, seeding)
  - Tailwind CSS v4 (UI styling)
  - Zod (runtime validation)
  - Supabase client/admin (auth / storage interop)
  - Playwright (E2E testing)
  - Recharts (charts/analytics)
  - PDF tooling (pdfkit, jspdf, html2canvas) for exports
  - Optional AI layer: provider-agnostic explanation interface (OpenRouter / mock providers)

## Architecture & folder layout
Top-level important entries:
```
.backend/ or backend/         # Express app, routes, controllers, services
prisma/                       # Prisma schema, migrations, seeds
public/                       # Static assets (favicon, meta files)
db/ or database/              # Legacy question banks, initial data (being migrated)
frontend/ or src/frontend/     # React app (components, contexts, views)
types/                        # Shared TypeScript types
tests/                        # Playwright or unit tests
.env.example                  # Environment template
package.json                  # Root scripts and dependency list
vite.config.ts                # Frontend build config
prisma.config.ts              # Prisma / DB helper config
HAPPY_PATH.md                 # User journey & architecture reference
README.md                     # (this file)
```

How it fits together (runtime flow)
- Dev: frontend runs on Vite (npm run dev) and backend runs separately (npm run dev:api); the frontend talks to the Express API under `/api/*`.
- Production build bundles the frontend into a `dist` folder; the backend serves static files from `dist` and the bundled server is produced with esbuild (see package.json build script).
- Database: Prisma manages schema and migrations; runtime DB operations use `@prisma/client`. Seed scripts populate subjects, units, and question banks.
- Auth & storage: Supabase is used in places for storage and optionally auth; server-side admin tasks use a Supabase service role key.

## How to run (quick path)
1. Install dependencies
```bash
npm install
```
2. Copy env template
```bash
cp .env.example .env
# Edit .env to set DATABASE_URL, JWT_SECRET, SUPABASE keys, etc.
```
3. Prisma (generate & migrate)
```bash
npx prisma generate
npx prisma migrate dev
```
4. Seed reference data
```bash
npm run seed
```
5. Start servers (dev)
- Backend only (API): npm run dev:api
- Frontend only (UI): npm run dev
- Or open two terminals and run both concurrently

Production build
```bash
npm run build
npm start
# build bundles frontend and the server; start runs the bundled server
```

## Important environment variables
(See .env.example for full template — keep secrets out of source control.)
- DATABASE_URL — PostgreSQL connection string (Neon recommended)
- JWT_SECRET — signing secret for access tokens (>= 32 chars)
- PORT — server listen port (default in config)
- NODE_ENV — development/production
- SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY — if using Supabase features
- OPTIONAL AI provider keys (if AI layer is enabled)

## Scripts (from package.json)
- npm run dev — start Vite dev server (frontend)
- npm run dev:api — watch and run backend server (tsx)
- npm run build — build frontend + bundle backend with esbuild
- npm run start — run bundled server
- npm run seed — run Prisma seed script to populate initial data
- npm test / npm run test:e2e — Playwright tests

## Testing & QA
- Playwright is configured for E2E tests (playwright.config.ts). Run `npm test` to execute test suite.
- Unit tests for backend can be executed with Node test runner (see package.json `test:unit`).
- Use the `HAPPY_PATH.md` document to replicate the expected user journey and manual QA scenarios.

## Database & migrations
- Schema lives under `prisma/` (edit schema.prisma).
- Use `npx prisma migrate dev` during development and `npx prisma migrate deploy` for CI/CD production deployments.
- Seed script: `prisma/seed.ts` (invoked by `npm run seed`) populates subjects, units, and question banks used by the NEET flows.

## Deployment notes
- Production artifact is a single Node server that serves static frontend assets from `dist`.
- The `build` script uses Vite to build the frontend and esbuild to bundle the backend into `dist/server.cjs`.
- Recommended deployment targets:
  - Platform for Node apps (Heroku, Fly.io, DigitalOcean App Platform) or containerized deployment to Cloud Run / Kubernetes.
  - Use managed Postgres (Neon / Supabase / RDS) with connection pooling.
- For CI:
  - Run lint/typecheck (`npm run typecheck`), Prisma migrations, and Playwright tests as pre-deploy steps.
  - Ensure secrets (DATABASE_URL, JWT_SECRET, SUPABASE keys) are injected via the platform's environment management.

## Common maintenance tasks
- Add new questions/units: update `database/` or add migrations + seed changes; run `npm run seed` locally for dev.
- Update Prisma client after schema change: `npx prisma generate`.
- Regenerate production bundle on server after dependency or code change: `npm run build && npm start`.

## Contributing
- Branching: create feature branches off `NEET-assessment-tool-CSK` for NEET-specific work; open PRs against that branch.
- Coding standards: TypeScript strict mode is enforced. Use Zod for runtime validation in API boundaries.
- Tests: add Playwright tests for major user flows (landing → test creation → test taking → evaluation).
- PR checklist:
  - Type check passes
  - Tests (unit + E2E) added/updated for feature
  - Migration files included if DB changes are required
  - Update HAPPY_PATH.md or README sections if flows change

## Troubleshooting
- "Cannot connect to DB": verify DATABASE_URL and allowlist IPs on managed DB provider.
- Migrations failing: ensure `prisma migrate dev` runs from the repo root and that the DB is empty or migration sequence is correct.
- Frontend CORS issues in dev: use `dev:api` + `dev` in separate terminals; CORS origins are configured via backend `config`.

## Try asking
- "Where are the question banks located for NEET topics?" — check `database/questions.ts` and `prisma/seed.ts`.
- "How do I run the backend server with hot reload?" — use `npm run dev:api`.
- "Which env vars are required to run the Supabase admin tasks?" — check `.env.example` and `backend/supabaseAdmin.ts`.

## License & contact
- LICENSE: (Add your project license file here)
- Maintainers: C.Santhosh Kumar, Prince.A, Deepan.B
- For urgent issues, open an issue on this repository and tag `@lumenacademyforyou`.
