# Project context: Lumen Academy

## What this is
A NEET and JEE examination preparation platform for Indian students. React 19
frontend, Express backend, PostgreSQL database. Bilingual: English and Tamil.

## Migration in progress
This project originally shipped as a Google AI Studio applet (Firebase Auth +
Firestore + Supabase + `@google/genai`/Gemini, deployed via AI Studio's managed
Cloud Run pipeline — see `metadata.json`, `firebase-applet-config.json`,
`firebase-blueprint.json`). It is being migrated off that stack onto the one
below, self-hosted. Files still referencing Firebase/Gemini are legacy and
should be replaced, not extended, as each area is migrated. Do not add new
Firebase or Gemini-specific code.

**Auth is the one deliberate exception**: authentication runs on **Supabase
Auth** (email OTP + phone/SMS OTP), by explicit decision — not the custom
bcrypt/JWT system originally planned. All application data (questions,
attempts, scoring, AI cache, PDFs) still lives in Neon via Prisma, unaffected.
See "Auth architecture" below.

## Stack — do not substitute
- Node.js 20 LTS, TypeScript with strict mode
- Express 4.21
- PostgreSQL 16 hosted on Neon, accessed through Prisma ORM, for all
  application data
- Supabase Auth for authentication (email OTP + phone OTP) — Supabase's own
  `auth.users` table is the source of truth for identity; our `User` table
  holds only app-specific profile fields, keyed by the Supabase user id
- Zod for all input validation
- React 19 + Vite + Tailwind v4 on the client (already built, do not rewrite)

## Architecture rules — these are not negotiable
1. Three layers: routes handle HTTP, services hold business logic, Prisma handles
   data. Nothing in `services/` or `ai/` may import Express types or reference
   `req` or `res`.
2. The server is authoritative. Test timing, correct answers and scores are
   determined server-side. The client never receives a correct answer before the
   attempt is submitted.
3. Every request body, query parameter and path parameter is validated with Zod
   before it reaches a service.
4. All configuration is read through one validated module (`src/backend/config.ts`).
   Never call `process.env` anywhere else.
5. No file outside `src/backend/ai/` may reference an AI vendor SDK, vendor type
   or model name. The provider is chosen at runtime from configuration.
6. Errors are thrown as `AppError(statusCode, code, message)` and formatted by a
   single error handler. Never send an error response directly from a route.
7. Database changes are made by editing `prisma/schema.prisma` and running a
   migration. Never write raw CREATE TABLE statements.

## Auth architecture
- The frontend talks to Supabase Auth directly (via `@supabase/supabase-js`)
  for sign-up, sign-in and OTP verification. Our Express backend never issues
  or stores passwords, access tokens or refresh tokens itself.
- Every authenticated request carries the Supabase access token in the
  `Authorization` header. The backend verifies it by calling Supabase's own
  `auth.getUser(token)` (via a server-side Supabase client configured with
  `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`) rather than checking a local
  signing secret — this works the same whether the project signs tokens with
  a legacy shared HS256 secret or newer asymmetric keys, and means we never
  need to manage a JWT secret ourselves.
- On first authenticated request from a given Supabase user id, the backend
  lazily provisions a matching row in our own `User` table (id = Supabase
  user id) to hold app-specific fields (`role`, `locale`, `targetExam`,
  `displayName`). This is the only place `User` rows are created.
- Mobile OTP delivery requires an SMS provider configured in the Supabase
  project dashboard (Authentication → Providers → Phone). Without one, phone
  sign-in requests will fail at Supabase, not in our code.

## Security rules
- Sign-in failures must not reveal whether an email address or phone number is
  registered — this is enforced by Supabase Auth's OTP flow itself.
- Every student query is filtered by the authenticated user's id, enforced in the
  service layer.
- Secrets come from environment variables only. Never hardcode a key, never
  prefix a server secret with VITE_. `SUPABASE_JWT_SECRET` is backend-only;
  `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are the only Supabase values
  safe to expose to the client.

## Domain notes
- NEET biology is modeled as two subjects, `botany` and `zoology`, not one
  combined `biology` subject — this matches the existing syllabus data and
  question tagging. Subjects: `physics`, `chemistry`, `botany`, `zoology`.
- Existing unit ids (`phy_01`, `chem_01`, `bot_01`, `zoo_01`, ...) in
  `src/database/syllabusData.ts` must be preserved exactly when seeding, since
  question tagging depends on them.

## Code conventions
- ES modules. Import paths end in `.js` even for TypeScript files.
- Named exports, not default exports.
- `async/await`, never `.then()` chains.
- Types are inferred from Zod schemas where possible rather than declared twice.
- Comments explain why, not what.

## How to respond to me
- Give me complete files, not fragments with "... rest unchanged".
- State the file path above every code block.
- After the code, give me the exact command to verify it works.
- If a request conflicts with the rules above, say so instead of complying.
- If something is ambiguous, ask one question rather than guessing.
