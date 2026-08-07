# Lumen Academy

Lumen Academy is a comprehensive web application for students preparing for
competitive exams like NEET, JEE Mains, JEE Advanced, and Olympiads. The
platform provides a focused environment for taking mock tests, reviewing
performance, and accessing study materials. Bilingual: English and Tamil.

## Migration status

This project is being migrated off a Google AI Studio applet stack (Firebase
Auth + Firestore + Supabase + Gemini, deployed via AI Studio's managed Cloud
Run pipeline) onto a self-hosted Express + PostgreSQL backend. See
[CLAUDE.md](CLAUDE.md) for the target architecture and the current migration
state.

## Technology stack

- **Frontend:** React 19 + TypeScript, Vite 6, Tailwind CSS v4, `lucide-react`, `motion`
- **Backend:** Node.js 20, Express 4, TypeScript (strict mode)
- **Database:** PostgreSQL 16 (Neon), accessed through Prisma ORM
- **Validation:** Zod
- **Auth:** JWT access tokens + rotated opaque refresh tokens (bcrypt-hashed passwords)
- **AI:** Provider-agnostic explanation layer (OpenRouter in production, a mock provider for local dev)

## Prerequisites

- Node.js 20 LTS
- npm
- A PostgreSQL 16 database (this project targets [Neon](https://neon.tech))

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and fill in real values:

   ```bash
   cp .env.example .env
   ```

   At minimum you need `DATABASE_URL` (your Neon connection string) and a
   `JWT_SECRET` of at least 32 characters.

3. Generate the Prisma client and apply migrations:

   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

4. Seed reference data (subjects, units, questions):

   ```bash
   npm run seed
   ```

## Running

- Backend API: `npm run dev:api`
- Frontend dev server: `npm run dev`
- Typecheck: `npm run typecheck`
- Build: `npm run build`
- Tests: `npm test`

## Folder structure

```text
prisma/                   Prisma schema, migrations, seed script
src/
  backend/
    config.ts              Validated environment config (only place process.env is read)
    server.ts               Express app bootstrap
    middleware/              errorHandler, requireAuth, validate
    routes/                  HTTP routes (thin, delegate to services)
    services/                Business logic (no Express types)
    ai/                      Provider-agnostic AI explanation layer
  database/                 Legacy static syllabus/question data, being migrated into Postgres
  frontend/                 React application (components, contexts, services)
  types/                    Shared TypeScript types
```
