# Lumen Academy — Frontend Architecture & Engineering Lifecycle

> **Scope of this file.** Everything that runs in the student's browser: the
> React application, its build pipeline, its state, its contract with the API,
> how it is tested, versioned, containerised, deployed, and what it costs to
> host. The Express API is covered in `docs/BACKEND.md`; PostgreSQL/Prisma in
> `docs/DATABASE.md`. Where the frontend depends on those, this file states the
> contract and points there.
>
> **Audience.** You are new to this. Every section explains *why* before *how*,
> and every command is one you can literally paste.
>
> **Grounding.** This is not a generic template. Every claim below was read out
> of this repository at commit `5a62a54` on branch `NEET-assessment-tool-CSK`.
> Where the code disagrees with `CLAUDE.md` or `README.md`, this file says so
> rather than quietly repeating the doc.

---

## Table of contents

- [0. Where the frontend actually stands today](#0-where-the-frontend-actually-stands-today)
- [1. System Overview & SDLC Integration](#1-system-overview--sdlc-integration)
- [2. Architecture, Data Pipeline & Module Breakdown](#2-architecture-data-pipeline--module-breakdown)
- [3. Local Setup, Installation & Code Boilerplate](#3-local-setup-installation--code-boilerplate)
- [4. Version Control, Deployment & CI/CD](#4-version-control-deployment--cicd)
- [5. Tooling Ecosystem, Cost Estimation & Tier Analysis](#5-tooling-ecosystem-cost-estimation--tier-analysis)
- [6. Prioritised remediation backlog](#6-prioritised-remediation-backlog)

---

## 0. Where the frontend actually stands today

Read this before anything else. A plan that ignores the current state is
fiction.

### 0.1 The real stack (from `package.json`)

| Concern | Package | Version | Note |
|---|---|---|---|
| UI runtime | `react`, `react-dom` | 19.0.1 | React 19 — Actions, `use()`, ref-as-prop |
| Build tool | `vite` | 6.2.3 | ESM dev server + Rollup production build |
| React plugin | `@vitejs/plugin-react` | 5.0.4 | Babel-based Fast Refresh |
| Styling | `tailwindcss` + `@tailwindcss/vite` | 4.1.14 | Tailwind **v4** — CSS-first config, no `tailwind.config.js` |
| Language | `typescript` | ~5.8.2 | **`strict` is NOT enabled** — see 0.3 |
| Icons | `lucide-react` | 0.546.0 | Tree-shakeable SVG icons |
| Animation | `motion` | 12.23.24 | Imported as `motion/react` (the renamed Framer Motion) |
| Charts | `recharts` | 3.10.1 | Area/Bar/Radar charts on the dashboard |
| Confetti | `canvas-confetti` | 1.9.4 | Score celebration |
| PDF export | `jspdf` + `html2canvas` | 4.2.1 / 1.4.1 | Client-side screenshot-to-PDF |
| Auth + BaaS client | `@supabase/supabase-js` | 2.112.2 | OTP auth + direct table reads |
| **Legacy** | `firebase` | 12.17.0 | **Dead code.** Must be removed — see 0.4 |
| E2E tests | `@playwright/test` | 1.62.1 | One spec: `tests/happy-path.spec.ts` |

The package is still named `"react-example"` in `package.json`. Rename it to
`lumen-academy` — the name shows up in lockfiles, Docker image labels and
error reports.

### 0.2 Entry chain

```
index.html                      <- Vite's HTML entry, loads Google Fonts, <div id="root">
  └── /frontend/main.tsx        <- createRoot, StrictMode, LanguageProvider
        └── frontend/App.tsx    <- 1,339 lines: auth gate + router + analytics tab
```

`main.tsx` is 13 lines and does exactly three things: mount, enable
`StrictMode`, wrap in `LanguageProvider`. That is correct and should stay
that way.

### 0.3 Honest findings — things that are wrong right now

These are not nitpicks. Each one will cost you real time later.

| # | Finding | Evidence | Impact |
|---|---|---|---|
| F1 | **`tsconfig.json` has no `"strict": true`** despite `CLAUDE.md` claiming "TypeScript with strict mode" | `tsconfig.json` compilerOptions | `null`/`undefined` bugs pass typecheck. Your CI `npm run typecheck` gives false confidence. |
| F2 | **No router.** Navigation is two `useState` strings: `currentTab` (`dashboard`/`tests`/`course`/`analytics`) and `currentScreen` (`portal`/`system_check`/`lobby`/`test_taking`/`evaluating`) | `App.tsx:145`, `App.tsx:276` | No deep links, browser Back exits the app, a refresh mid-test drops the student to the landing page, no per-route code splitting. |
| F3 | **`App.tsx` is 1,339 lines** and owns auth state, attempt state, chapter goals, PDF export, confetti, and the entire analytics tab | `frontend/App.tsx` | Every change risks every feature. Impossible to unit test. |
| F4 | **Hardcoded demo password ships to the browser** | `frontend/lib/demoSession.ts` — `DEMO_PASSWORD = "Demo-Student-Session-2026"` | Anyone who opens DevTools owns that Supabase account. Client bundles are public; there is no such thing as a client-side secret. |
| F5 | **Two competing data paths.** Tests go through the Express API (`lib/testApi.ts`), but profiles/tasks/notes bypass it and hit Supabase tables directly (`frontend/supabase.ts`, 293 lines) with a `localStorage` fallback | `frontend/supabase.ts:64-292`, `lib/studySessionService.ts` | Business rules live in two places. RLS policies become the only thing between a student and another student's notes. |
| F6 | **`frontend/firebase.ts` still exists** and `firebase` is a runtime dependency | `frontend/firebase.ts` (37 lines) | Dead weight in the bundle, contradicts the migration rule in `CLAUDE.md` ("do not add new Firebase code"). |
| F7 | **Port mismatch across three files** | `.env.example` `PORT=4000`; `backend/config.ts` default `4000`; `playwright.config.ts` `baseURL: "http://localhost:3000"` | `npm test` starts the built server and then probes the wrong port. |
| F8 | **Env var name drift** | `CLAUDE.md` says `VITE_SUPABASE_ANON_KEY`; `.env.example` and `frontend/supabase.ts` use `VITE_SUPABASE_PUBLISHABLE_KEY` | New contributor sets the wrong variable, app silently falls back to `"dummy-publishable-key"` and every auth call fails with a confusing error. |
| F9 | **Silent dummy fallback** | `frontend/supabase.ts:4-5` defaults to `https://dummy-supabase-project.supabase.co` | Misconfiguration surfaces as a runtime network error deep in a flow instead of a loud startup failure. |
| F10 | **No code splitting, no `React.lazy`, no error boundary** | `App.tsx` imports every view eagerly | `LandingView.tsx` alone is 1,682 lines; a first-time visitor downloads the entire test engine and chart library to read a headline. One thrown render error blanks the whole page. |
| F11 | **Translation keys are full English sentences** | `contexts/LanguageContext.tsx` (504 lines) | Fixing a typo in English breaks the Tamil lookup. Keys must be stable identifiers. |
| F12 | **CI runs on `pull_request` only, and never runs tests** | `.github/workflows/ci.yml` | Pushing straight to a branch runs nothing. Playwright is never executed in CI. |

Nothing here means the project is bad — it means it grew out of an AI Studio
applet and hasn't been re-based yet. Section 6 turns these into an ordered
backlog.

### 0.4 What "done" looks like for the frontend

A student on a 4G phone in Tamil Nadu can: land, sign in with a phone OTP,
see their dashboard, start a 30-question Botany test, lose connectivity for
20 seconds mid-test without losing answers, submit, and read a bilingual
explanation for every question they got wrong — with the correct answers
never having been present in the browser before submission.

That last clause is the product's integrity guarantee and it is a *frontend*
constraint as much as a backend one.

---

## 1. System Overview & SDLC Integration

### 1.1 What the frontend is responsible for — and what it must never do

Think of three parties. Getting the boundary right is 80% of the architecture.

**The frontend owns (and is trusted with):**

1. **Presentation and interaction** — rendering questions, the question
   palette, timers, charts, the Pomodoro widget, animations.
2. **Ephemeral UI state** — which option is highlighted, which modal is open,
   which tab is active, scroll position.
3. **Optimistic local buffering** — holding answers in memory and flushing
   them to `PATCH /api/tests/:id/answers` on an interval, so a flaky network
   doesn't lose work.
4. **Session custody** — holding the Supabase session (supabase-js manages
   refresh in the background) and attaching the access token to every request.
5. **Locale** — English/Tamil switching, which is purely presentational.
6. **Accessibility and responsiveness** — keyboard navigation of the palette,
   readable contrast, touch targets.

**The frontend must never own:**

| Never | Why | Where it lives instead |
|---|---|---|
| The correct answer, before submission | A student can read any variable in the bundle. If the answer is in the browser, the test is meaningless. | Server, in `Option.isCorrect`, only returned by `GET /api/tests/:id/result` |
| Scoring (+4 / −1) | Same reason. Marks are money. | `backend/services/attempt.service.ts` |
| Authoritative test timing | Client clocks are trivially editable. | Server records `startedAt`; server rejects late submissions |
| "Am I an admin?" | A boolean in React state is not a permission. | Server checks role on every admin route |
| Any API key that is not public by design | Anything in `import.meta.env.VITE_*` is compiled into public JS. | Backend `.env`, never `VITE_`-prefixed |

The current code respects the first two of these — `lib/testApi.ts` even
documents it, setting `correctAnswerIndex: -1` as a deliberate sentinel so
the legacy `Question` type can be reused without ever carrying a real answer.
Keep that discipline.

> **`toLegacyQuestions` is technical debt with a good excuse.** It adapts the
> API's real question shape (`ApiQuestion` with string UUIDs) into the old
> client-side `Question` type (numeric `id`, `correctAnswerIndex`) so
> `TestTakingView.tsx` didn't have to be rewritten during the migration. It
> keeps a `Map<number, QuestionIdMapEntry>` to translate back. This is the
> right call *during* a migration and the wrong thing to keep forever — the
> exit plan is in Section 6 (R7).

### 1.2 Background/async work that belongs to the client

There are no service workers or web workers today. Three candidates, in order
of value:

1. **Answer autosave loop** — a `setInterval` (or `requestIdleCallback`) that
   flushes dirty answers every 10s and on `visibilitychange`. Cheap, high
   value, no new dependency. *Should exist already; currently answers are held
   in component state.*
2. **Service worker for offline test resilience** — caches the question
   payload and queues answer PATCHes via Background Sync. High value in India
   where connectivity drops mid-test are common; moderate complexity.
3. **Web worker for PDF generation** — `html2canvas` blocks the main thread
   for seconds on a long analytics report. Moving rasterisation off-thread
   removes the freeze. Low priority until users complain.

### 1.3 SDLC mapping — phase by phase

The SDLC is not paperwork. Each phase produces an **artifact** (a thing that
exists in the repo) and enforces a **gate** (a check that must pass before you
move on). Below is the concrete version for this frontend.

#### Phase 1 — Requirements

| Item | Detail |
|---|---|
| **Artifacts** | A user story per view in GitHub Issues, using the template in `.github/ISSUE_TEMPLATE/` (to be created); acceptance criteria written as Given/When/Then; bilingual copy signed off *before* build, because Tamil strings are 2–3× longer than English and break layouts |
| **Owner** | You + whoever represents the students |
| **Gate** | Every story answers: which server endpoint does this need? Does it need a new one? If yes, the backend story is filed first and linked. |
| **Anti-pattern to avoid** | Designing a screen, then discovering the API can't supply the data. `HAPPY_PATH.md` is your best existing requirements artifact — extend it rather than starting fresh. |

#### Phase 2 — Architecture / Design

| Item | Detail |
|---|---|
| **Artifacts** | This file; an ADR (Architecture Decision Record) per irreversible choice in `docs/adr/NNNN-title.md`; the component tree sketch in §2.3; the API contract types in `frontend/lib/testApi.ts` |
| **Gate** | Any new npm dependency requires an ADR paragraph: what it costs in bundle bytes, what it replaces, and what the eject path is. Run `npx vite-bundle-visualizer` before merging a dependency over ~20 kB gzipped. |
| **ADRs you owe yourself right now** | (a) "Why Supabase Auth and not our own JWT" — already decided in `CLAUDE.md`, write it down properly; (b) "Why direct Supabase table access for notes/tasks" — F5; this one may well be reversed |

#### Phase 3 — Development

| Item | Detail |
|---|---|
| **Artifacts** | Feature branch; component + colocated test; Storybook story (optional, later) |
| **Gate (pre-commit, local)** | `npm run typecheck` clean, ESLint clean, Prettier applied. Enforced by Husky + lint-staged (§4.1.4) — not by willpower |
| **Definition of Done for a component** | Renders a loading state, an error state, and an empty state; every string goes through `t()`; no `any`; no `process.env`; no direct `fetch` (use `apiFetch`) |

#### Phase 4 — Testing

Four layers, cheapest first. You currently have only layer 4, and it isn't run
in CI.

| Layer | Tool | What it covers here | Target |
|---|---|---|---|
| Static | `tsc --noEmit` + ESLint | Type errors, unused vars, hook dependency bugs | Every commit |
| Unit | Vitest | `buildHonestAttemptFromResult`, `toLegacyQuestions`, `calculateStudyStreak`, `calculateSessionStats` — all pure functions, all currently untested | ≥80% on `lib/` and pure helpers |
| Component | Vitest + React Testing Library | `TestTakingView` palette state machine; `LanguageContext` switching; error/empty states | Critical views |
| E2E | Playwright | The happy path in `HAPPY_PATH.md`: land → sign in → dashboard → start test → answer → submit → scorecard | 1 blocking smoke test in CI |

`buildHonestAttemptFromResult` in `App.tsx:44-135` is the single most
test-worthy function in the frontend — it does arithmetic on scores that
students will trust. It is currently untested and unexported. Extract it to
`frontend/lib/attemptMapper.ts` and test it first.

#### Phase 5 — Deployment

| Item | Detail |
|---|---|
| **Artifacts** | `Dockerfile`, `docker-compose.yml`, `.github/workflows/deploy.yml`, an immutable build tagged with the git SHA |
| **Gate** | Staging deploy is automatic on merge to `main`; production requires a GitHub Environment approval. A build that hasn't passed CI can't be promoted. |
| **Rollback** | Redeploy the previous SHA. Because the frontend is static files, rollback is seconds — this is a genuine advantage of the static/SPA model. |

#### Phase 6 — Maintenance

| Item | Detail |
|---|---|
| **Artifacts** | Sentry issue triage; weekly Dependabot PRs; a `CHANGELOG.md`; Core Web Vitals dashboard |
| **Gate** | Error rate and LCP checked before each release; any regression in p75 LCP over 2.5s blocks the next feature |
| **Seasonality** | NEET/JEE traffic is violently seasonal — near-zero in monsoon, a wall of load in the fortnight before the exam. Your maintenance calendar and your hosting tier (§5) must both anticipate that spike, not average it. |

---

## 2. Architecture, Data Pipeline & Module Breakdown

### 2.1 The end-to-end data flow

Below is a real request as it exists in this codebase — a student starting a
test. Follow the file names; they are all real.

```
[1] TestListView.tsx
      student picks subject + question count + duration
      calls onStartTest(config)  ──────────────────────────────┐
                                                               │
[2] App.tsx  (currentScreen: "portal" -> "system_check" -> "lobby")
      setCustomTestConfig(config)
      on lobby confirm: startAttempt({ subjectId, count, durationSeconds })
                                                               │
[3] frontend/lib/testApi.ts :: startAttempt()
      thin, typed wrapper. Knows the URL and the shape. No UI, no state.
                                                               │
[4] frontend/lib/api.ts :: apiFetch()
      - reads the Supabase session from supabase.auth.getSession()  (cached, no network)
      - sets Authorization: Bearer <access_token>
      - sets Content-Type: application/json
      - on 401 -> supabase.auth.signOut() + redirect to "/"
      - on !ok -> throws ApiError(status, code, message)
      - on 204 -> returns undefined
                                                               │
                        ===== NETWORK BOUNDARY =====
                                                               │
[5] Express: backend/server.ts -> helmet -> cors -> express.json -> /api router
[6] backend/routes/tests.routes.ts   HTTP only: parse, validate (Zod), delegate
[7] backend/middleware/requireAuth.ts  supabase.auth.getUser(token); lazily
                                       provisions the local User row
[8] backend/services/attempt.service.ts  business logic; picks questions;
                                         records startedAt; NEVER returns isCorrect
[9] Prisma -> Neon PostgreSQL
                                                               │
                        ===== RESPONSE =====
                                                               │
[10] StartAttemptResponse { id, durationSeconds, startedAt, requestedCount,
                            shortfall, questions[] }
[11] toLegacyQuestions() adapts shape; builds Map<legacyId, {questionId, optionIdByIndex}>
[12] App.tsx stores activeApiAttemptId + apiQuestionIdMap; currentScreen = "test_taking"
[13] TestTakingView.tsx renders; answers buffered in state
[14] patchAnswers(attemptId, [{questionId, selectedOptionId, timeSpentMs}])
[15] submitAttempt(attemptId) -> server scores it
[16] getResult(attemptId) -> NOW options carry isCorrect, plus explanations
[17] buildHonestAttemptFromResult() -> TestAttempt -> EvaluatingView.tsx
```

**The two things to internalise from this diagram:**

- **`shortfall` exists for a reason.** If a student asks for 50 Chemistry
  questions and the bank has 38, the server returns 38 and tells you the
  shortfall rather than silently under-delivering or erroring. The UI must
  surface that ("Only 38 questions available for this unit"). Design your
  components to handle partial success, not just success/failure.
- **The correct answer crosses the network exactly once**, at step 16, after
  the attempt is submitted. Every layer above is built to preserve that.

### 2.2 Layering rules for the frontend

The backend has a stated three-layer rule in `CLAUDE.md`. The frontend needs
the mirror image, and currently doesn't have one. Adopt this:

| Layer | Directory | May import | May NOT |
|---|---|---|---|
| **Transport** | `frontend/lib/api.ts` | `supabase.ts` | Any React, any component |
| **API clients** | `frontend/lib/*Api.ts` | `lib/api.ts`, types | React, components, `fetch` directly |
| **Domain/pure logic** | `frontend/lib/` (mappers, calculators) | types only | React, `window`, `localStorage`, network |
| **State/hooks** | `frontend/hooks/`, `frontend/contexts/` | api clients, domain | JSX beyond providers |
| **Views** | `frontend/components/views/` | hooks, common components | `fetch`, `supabase`, business arithmetic |
| **Presentational** | `frontend/components/common/`, `dashboard/` | props only | Data fetching of any kind |

One sentence to remember: **components ask hooks for data; hooks ask API
clients; API clients ask `apiFetch`; nothing skips a level.** The single
current violation of note is `frontend/supabase.ts`, which lets any component
talk to the database directly (F5).

### 2.3 Directory structure — current vs. target

**Current (real):**

```text
index.html
vite.config.ts
tsconfig.json
frontend/
├── main.tsx                      13 lines — mount + providers
├── App.tsx                       1,339 lines — DO NOT LEAVE THIS AS IS
├── index.css                     Tailwind v4 @import + CSS custom properties + @theme
├── vite-env.d.ts                 image module declarations
├── firebase.ts                   LEGACY — delete
├── supabase.ts                   client + profile/task/note CRUD + localStorage fallback
├── assets/lumen-logo.png
├── contexts/
│   └── LanguageContext.tsx       504 lines — en/ta dictionary + t()
├── lib/
│   ├── api.ts                    apiFetch, ApiError, token injection, 401 handling
│   ├── testApi.ts                start/patch/submit/result + toLegacyQuestions
│   ├── supabaseAuth.ts           email OTP, phone OTP, signOut, session
│   ├── demoSession.ts            hardcoded demo login — SECURITY (F4)
│   ├── pdfExport.ts              html2canvas -> jsPDF, multipage A4
│   └── studySessionService.ts    localStorage-backed sessions, streaks, stats
└── components/
    ├── common/                   AnimatedCounter, DailyReminderModal, Header (734),
    │                             LumenLogo, SplashView
    ├── dashboard/                DailyFlashcard, PomodoroTimer (697)
    └── views/                    Admin, CourseArea, Courses (638), Dashboard (1349),
                                  Evaluating, Landing (1682), Lobby, StudyPlan (636),
                                  SystemCheck, TestList (469), TestTaking (542)
```

**Target (incremental — you do not do this in one weekend):**

```text
frontend/
├── main.tsx                      mount, providers, router
├── routes/                       NEW — one file per route, lazy-loaded
│   ├── index.tsx                 route table (React Router v7 / TanStack Router)
│   ├── landing.route.tsx
│   ├── dashboard.route.tsx
│   ├── tests.route.tsx
│   ├── attempt.$attemptId.route.tsx     <- deep-linkable, survives refresh
│   ├── result.$attemptId.route.tsx
│   └── admin.route.tsx           guarded
├── app/
│   ├── providers.tsx             Language + Auth + QueryClient + ErrorBoundary
│   └── ErrorBoundary.tsx         NEW — F10
├── features/                     NEW — vertical slices, the key refactor
│   ├── auth/                     components/ hooks/ api/ (moves supabaseAuth.ts here)
│   ├── attempt/                  TestTakingView, palette, timer, useAttempt hook,
│   │                             attemptMapper.ts (extracted from App.tsx)
│   ├── analytics/                DashboardView charts, pdfExport
│   ├── syllabus/                 Courses, CourseArea, StudyPlan
│   └── study-tools/              Pomodoro, flashcards, study sessions
├── components/ui/                dumb, reusable: Button, Card, Modal, Skeleton
├── hooks/                        useAutosave, useCountdown, useMediaQuery
├── lib/
│   ├── api.ts                    unchanged — it is already correct
│   ├── env.ts                    NEW — validated import.meta.env (fixes F9)
│   └── format.ts
├── i18n/                         NEW — replaces the 504-line dictionary
│   ├── en.json                   stable keys: "attempt.submit.confirm"
│   └── ta.json
├── styles/index.css
└── types/                        frontend-only view models
```

**Why `features/` and not `components/views/`?** Because when you fix a bug in
the test timer you currently touch `App.tsx`, `TestTakingView.tsx`, and
`LobbyView.tsx` in three different directories. A vertical slice keeps
everything that changes together in one folder — that is the single highest
-leverage structural change available to this codebase.

### 2.4 State: what goes where

A frequent beginner mistake is putting everything in one place. Use four
distinct homes:

| Kind of state | Example here | Home | Why |
|---|---|---|---|
| **Server cache** | questions, attempt result, analytics | TanStack Query (to add) | It's a *cache* of someone else's data — needs staleness, retry, dedup, background refetch. Hand-rolling this in `useState` is where the bugs are. |
| **URL state** | which attempt, which tab, which subject | Router params | Free deep-linking, free Back button, free refresh-survival. Fixes F2. |
| **Global client state** | language, theme, auth session | React Context | Small, rarely changes, read everywhere. `LanguageContext` is already correct in shape. |
| **Local UI state** | open modal, hovered option, palette focus | `useState` in the component | Never lift it higher than it needs to go. |

Today, all four kinds live in `App.tsx` as `useState`. That is F3 in one
sentence.

**The in-test buffer deserves special mention.** Answers should be held in a
`useRef`-backed map (not `useState`, to avoid re-rendering 180 questions on
every keystroke), flushed by `useAutosave`, and mirrored to `sessionStorage`
so a tab crash doesn't lose 90 minutes of work. `sessionStorage` here is a
crash-recovery buffer, not a source of truth — the server is still
authoritative.

### 2.5 The API contract, restated

These are the endpoints the frontend consumes. Types are already declared in
`frontend/lib/testApi.ts`; keep them as the single source of truth and never
inline a response shape in a component.

| Method | Path | Body | Returns | Auth |
|---|---|---|---|---|
| `POST` | `/api/tests` | `{ subjectId?, unitId?, topicId?, count, durationSeconds }` | `StartAttemptResponse` (questions **without** `isCorrect`) | Bearer |
| `PATCH` | `/api/tests/:id/answers` | `AnswerInput[]` | `{ status }` | Bearer |
| `POST` | `/api/tests/:id/submit` | — | `ResultSummary` | Bearer |
| `GET` | `/api/tests/:id/result` | — | `AttemptResult` (options **with** `isCorrect` + explanations) | Bearer |
| `GET` | `/api/health` | — | liveness | none |

Error envelope, as parsed by `api.ts`:

```jsonc
{ "error": { "code": "ATTEMPT_ALREADY_SUBMITTED", "message": "…" } }
```

Always branch on `error.code`, never on `error.message` — messages are
user-facing copy and will be translated; codes are the contract.

### 2.6 Styling architecture (Tailwind v4)

This project uses **Tailwind v4**, which is configured in CSS, not in a JS
file. There is no `tailwind.config.js` and you should not add one.

- `frontend/index.css` starts with `@import "tailwindcss";`
- Brand tokens are plain CSS custom properties on `:root` — `--teal #115D75`,
  `--navy #00243B`, `--gold #FCB824`, `--sky #A8DFEB`
- Dark mode overrides those same variables under `[data-theme="dark"], .dark`
- `@theme { --color-teal: var(--teal); … }` is what exposes them to Tailwind
  as utilities like `bg-teal`

**Rule:** never hardcode a hex value in a component. Add a token in
`index.css` and use the utility. This is what makes the dark theme work for
free, and it is what will make a future white-label (a second coaching
institute on the same platform) a one-file change.

---

## 3. Local Setup, Installation & Code Boilerplate

### 3.1 Required tooling

| Tool | Version | Why this one | Install |
|---|---|---|---|
| Node.js | **20 LTS** | Matches `.github/workflows/ci.yml` and the Prisma 7 requirement. Do not use 18 (Vite 6 drops it) or 23 (odd = unstable). | `nvm install 20 && nvm use 20` |
| npm | 10.x (bundled) | `package-lock.json` is committed. **Note:** a `bun.lock` is also committed — pick one and delete the other, two lockfiles will drift. | ships with Node |
| Git | ≥ 2.40 | | `git --version` |
| VS Code | latest | | + extensions below |
| Docker Desktop | latest | Only needed for §4.2 | optional at first |

VS Code extensions that pay for themselves immediately: **ESLint**,
**Prettier**, **Tailwind CSS IntelliSense** (works with v4 CSS config),
**Error Lens**, **Playwright Test for VS Code**.

### 3.2 Zero-to-running, exactly

```bash
# 1. Clone and enter
git clone <your-repo-url> lumen-academy
cd lumen-academy

# 2. Pin Node
nvm use 20            # or: nvm install 20

# 3. Install (uses the committed package-lock.json)
npm ci

# 4. Environment
cp .env.example .env
```

Now open `.env` and fill in **four** values for frontend work:

```dotenv
VITE_API_URL="http://localhost:4000/api"
VITE_SUPABASE_URL="https://<your-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_…"
CORS_ORIGINS="http://localhost:5173"
```

> Get the first two from **Supabase dashboard → Project Settings → API**.
> `CORS_ORIGINS` must contain Vite's dev origin (`5173`) or every request from
> the browser will fail with an opaque CORS error rather than a useful message.
>
> **Naming gotcha (F8):** `CLAUDE.md` mentions `VITE_SUPABASE_ANON_KEY`. The
> code reads `VITE_SUPABASE_PUBLISHABLE_KEY`. Use the latter. "Publishable key"
> is Supabase's newer name for the anon key — same thing, safe to expose,
> protected by Row Level Security rather than secrecy.

```bash
# 5. Database side (needed because the API serves the questions)
npx prisma generate
npx prisma migrate dev
npm run seed

# 6. Two terminals
npm run dev:api      # Express on :4000
npm run dev          # Vite on :5173  <- open this one
```

**Verify it works:**

```bash
curl -s http://localhost:4000/api/health     # expect a 200 JSON body
open http://localhost:5173                    # splash -> landing page
npm run typecheck                             # must exit 0
```

### 3.3 Fix the foundations first (do these before writing features)

#### 3.3.1 Turn on strict mode (fixes F1)

`tsconfig.json` — add these to `compilerOptions`:

```jsonc
{
  "compilerOptions": {
    // …existing options…
    "strict": true,
    "noUncheckedIndexedAccess": true,   // arr[0] is T | undefined — catches real bugs
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true
  },
  "include": ["frontend", "types", "database", "backend", "tests"]
}
```

Then:

```bash
npm run typecheck 2>&1 | tee strict-errors.txt
wc -l strict-errors.txt
```

You will get a wall of errors. **Do not fix them all in one PR.** Strategy:
turn `strict` on, then add a temporary `// @ts-expect-error` with a linked
issue number at each site, and burn them down file by file. `@ts-expect-error`
is better than `@ts-ignore` because it *fails* the build once the underlying
error is fixed — it can never go stale.

#### 3.3.2 Validate the environment loudly (fixes F9)

Create **`frontend/lib/env.ts`**:

```ts
import { z } from "zod";

// Every VITE_-prefixed variable is compiled into the public bundle. Nothing
// secret may ever appear here. Validating at module load turns a
// misconfiguration into an immediate, readable crash instead of a confusing
// 401 three screens later.
const schema = z.object({
  VITE_API_URL: z.string().url(),
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

const parsed = schema.safeParse(import.meta.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((i) => `  ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(
    `Invalid frontend environment configuration:\n${details}\n` +
      `Copy .env.example to .env and fill in the Supabase values.`
  );
}

export const env = Object.freeze(parsed.data);
```

This deliberately mirrors `backend/config.ts`, which uses the same Zod pattern
— one idea, applied on both sides.

Then rewrite the top of **`frontend/supabase.ts`**:

```ts
import { createClient } from "@supabase/supabase-js";
import { env } from "./lib/env.js";

export const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false, // no magic-link redirects; we use OTP codes
    },
  }
);
```

The `"https://dummy-supabase-project.supabase.co"` fallback goes away. A
missing variable should stop you at second zero, not at minute ten.

#### 3.3.3 Delete the legacy Firebase surface (fixes F6)

```bash
git rm frontend/firebase.ts
git rm -r legacy/          # firebase-applet-config.json, firestore.rules, blueprint
npm uninstall firebase
npm run typecheck          # confirms nothing imported it
```

`CLAUDE.md` already forbids new Firebase code; this makes it structurally
impossible. Expect roughly 100–200 kB gzipped off the bundle.

#### 3.3.4 Kill the client-side demo password (fixes F4)

`frontend/lib/demoSession.ts` currently ships a real password to every visitor.
Replace the whole flow with a **server-issued** demo session:

```ts
// frontend/lib/demoSession.ts
import { apiFetch } from "./api.js";
import { supabase } from "../supabase.js";

// The backend owns the demo account entirely. It creates (or reuses) a
// short-lived, rate-limited demo user and returns a session for it. No
// credential of any kind exists in the client bundle.
interface DemoSessionResponse {
  accessToken: string;
  refreshToken: string;
}

export async function ensureDemoSession(): Promise<void> {
  const { accessToken, refreshToken } = await apiFetch<DemoSessionResponse>(
    "/auth/demo-session",
    { method: "POST", skipAuth: true }
  );
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw error;
}
```

The matching `POST /api/auth/demo-session` route (using the Supabase
**service-role** key, which lives only in the backend `.env`) is specified in
`docs/BACKEND.md`. Until that route exists, the honest interim fix is to
disable the demo button — a broken demo is cheaper than a public credential.

#### 3.3.5 Add an error boundary (fixes half of F10)

**`frontend/app/ErrorBoundary.tsx`**:

```tsx
import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}
interface State {
  error: Error | null;
}

// React has no hook equivalent for componentDidCatch — an error boundary must
// still be a class component. This one is deliberately dumb: it renders a
// recovery affordance and reports. It must never itself throw.
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Replaced by Sentry.captureException in §5. console.error until then.
    console.error("Unhandled render error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
            <h1 className="text-xl font-bold text-navy">Something went wrong</h1>
            <p className="max-w-md text-muted">
              Your answers are saved on our servers. Reloading is safe.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-teal px-5 py-2.5 font-semibold text-white"
            >
              Reload
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
```

Wrap it around `<App />` in `main.tsx`, and — importantly — wrap a *second*,
narrower boundary around `TestTakingView` so a chart crash in the sidebar can
never destroy an in-progress attempt.

### 3.4 Working boilerplate — the three pieces you asked for

#### (1) Secure API connection handling

`frontend/lib/api.ts` **already implements this correctly** and is the best
file in the frontend. Reproduced with the security reasoning made explicit:

```ts
import { supabase } from "../supabase.js";
import { env } from "./env.js";

const BASE_URL = env.VITE_API_URL;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function currentAccessToken(): Promise<string | null> {
  // supabase-js refreshes in the background and answers from its own cache,
  // so this is not a network round-trip on the common path.
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export interface ApiFetchOptions extends RequestInit {
  skipAuth?: boolean;
  timeoutMs?: number;
}

async function parseErrorBody(res: Response) {
  try {
    const body = await res.json();
    return {
      code: body?.error?.code ?? "UNKNOWN_ERROR",
      message: body?.error?.message ?? `Request failed with status ${res.status}`,
    };
  } catch {
    return { code: "UNKNOWN_ERROR", message: `Request failed with status ${res.status}` };
  }
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { skipAuth, headers, timeoutMs = 15_000, signal, ...rest } = options;
  const token = skipAuth ? null : await currentAccessToken();

  // A student on patchy 4G must not stare at a spinner forever.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  signal?.addEventListener("abort", () => controller.abort());

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });

    // 401 means Supabase considers the session genuinely gone — supabase-js
    // already retried the refresh internally before we got here, so there is
    // nothing left to retry. Sign out to clear the dead session.
    if (res.status === 401 && !skipAuth) {
      await supabase.auth.signOut();
      if (typeof window !== "undefined") window.location.assign("/");
      throw new ApiError(401, "SESSION_EXPIRED", "Your session has expired. Please sign in again.");
    }

    if (!res.ok) {
      const { code, message } = await parseErrorBody(res);
      throw new ApiError(res.status, code, message);
    }

    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(0, "NETWORK_TIMEOUT", "The network is slow. Please try again.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
```

Why the token is **never** kept in `localStorage` by our own code: an XSS bug
anywhere on the page can read `localStorage`. We delegate storage and refresh
to `supabase-js` and read the token per-request, so there is exactly one place
that touches it.

#### (2) A typed "model" — the API contract as the schema

The frontend's equivalent of a database model is the validated response shape.
Today `testApi.ts` declares TypeScript interfaces, which are erased at
runtime — if the server changes a field, you get `undefined` deep inside a
render instead of a clear error. Upgrade them to Zod schemas and derive the
types (this matches the project convention: *"types are inferred from Zod
schemas where possible rather than declared twice"*).

**`frontend/features/attempt/attempt.schema.ts`**:

```ts
import { z } from "zod";

export const apiQuestionOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  textEn: z.string(),
  textTa: z.string().nullable(),
});

export const apiQuestionSchema = z.object({
  id: z.string(),
  stemEn: z.string(),
  stemTa: z.string().nullable(),
  marks: z.number(),
  negativeMarks: z.number(),
  subject: z.string(),
  unit: z.string(),
  options: z.array(apiQuestionOptionSchema).min(2),
  // NOTE: there is intentionally no `isCorrect` here. If the server ever
  // starts sending one before submission, this schema is where we notice.
});

export const startAttemptResponseSchema = z.object({
  id: z.string(),
  durationSeconds: z.number().int().positive(),
  startedAt: z.string(),
  requestedCount: z.number().int(),
  shortfall: z.number().int().min(0),
  questions: z.array(apiQuestionSchema),
});

export const resultQuestionSchema = apiQuestionSchema
  .omit({ options: true, marks: true, negativeMarks: true })
  .extend({
    explanationEn: z.string().nullable(),
    explanationTa: z.string().nullable(),
    selectedOptionId: z.string().nullable(),
    timeSpentMs: z.number().nullable(),
    options: z.array(apiQuestionOptionSchema.extend({ isCorrect: z.boolean() })),
  });

export const attemptResultSchema = z.object({
  id: z.string(),
  status: z.string(),
  score: z.number().nullable(),
  maxScore: z.number().nullable(),
  correctCount: z.number().nullable(),
  wrongCount: z.number().nullable(),
  skippedCount: z.number().nullable(),
  submittedAt: z.string().nullable(),
  questions: z.array(resultQuestionSchema),
});

export type ApiQuestion = z.infer<typeof apiQuestionSchema>;
export type StartAttemptResponse = z.infer<typeof startAttemptResponseSchema>;
export type AttemptResult = z.infer<typeof attemptResultSchema>;
```

And parse at the boundary:

```ts
// frontend/features/attempt/attempt.api.ts
import { apiFetch } from "../../lib/api.js";
import { startAttemptResponseSchema, attemptResultSchema } from "./attempt.schema.js";
import type { StartAttemptResponse, AttemptResult } from "./attempt.schema.js";

export interface StartAttemptInput {
  subjectId?: string;
  unitId?: string;
  topicId?: string;
  count: number;
  durationSeconds: number;
}

export async function startAttempt(input: StartAttemptInput): Promise<StartAttemptResponse> {
  const raw = await apiFetch<unknown>("/tests", {
    method: "POST",
    body: JSON.stringify(input),
  });
  // Trust the network with nothing. A contract drift fails here, loudly,
  // with the exact field path — not three components deeper.
  return startAttemptResponseSchema.parse(raw);
}

export async function getResult(attemptId: string): Promise<AttemptResult> {
  return attemptResultSchema.parse(await apiFetch<unknown>(`/tests/${attemptId}/result`));
}
```

`zod` is already a dependency (`^4.4.3`) — no bundle cost decision to make.

#### (3) A complete feature slice: fetch + validate + render

This is the pattern every view should follow. Install the cache first:

```bash
npm i @tanstack/react-query
```

**`frontend/features/attempt/useAttempt.ts`** — the hook layer:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { startAttempt, getResult, type StartAttemptInput } from "./attempt.api.js";
import { ApiError } from "../../lib/api.js";

export function useStartAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StartAttemptInput) => startAttempt(input),
    onSuccess: (data) => {
      // Seed the cache so the test screen renders instantly without refetching.
      qc.setQueryData(["attempt", data.id], data);
    },
  });
}

export function useAttemptResult(attemptId: string | null) {
  return useQuery({
    queryKey: ["attempt-result", attemptId],
    queryFn: () => getResult(attemptId!),
    enabled: Boolean(attemptId),
    staleTime: Infinity,      // a submitted result never changes
    retry: (failureCount, error) =>
      // Never retry a client error; the answer will be the same 4xx.
      error instanceof ApiError && error.status < 500 ? false : failureCount < 3,
  });
}
```

**`frontend/features/attempt/StartTestPanel.tsx`** — the view layer, with all
four states handled:

```tsx
import { useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { useStartAttempt } from "./useAttempt.js";
import { ApiError } from "../../lib/api.js";

const SUBJECTS = ["physics", "chemistry", "botany", "zoology"] as const;
type Subject = (typeof SUBJECTS)[number];

interface Props {
  onStarted: (attemptId: string) => void;
}

export function StartTestPanel({ onStarted }: Props) {
  const { t } = useLanguage();
  const [subjectId, setSubjectId] = useState<Subject>("botany");
  const [count, setCount] = useState(30);
  const startMutation = useStartAttempt();

  async function handleStart() {
    try {
      const attempt = await startMutation.mutateAsync({
        subjectId,
        count,
        // NEET pacing: ~60 seconds per question.
        durationSeconds: count * 60,
      });
      if (attempt.shortfall > 0) {
        // Partial success is a real outcome, not an error. Tell the truth.
        alert(
          t("Only {n} questions were available for this unit.").replace(
            "{n}",
            String(attempt.questions.length)
          )
        );
      }
      onStarted(attempt.id);
    } catch (err) {
      if (err instanceof ApiError) {
        console.error(`[${err.code}] ${err.message}`);
      }
      throw err; // let the ErrorBoundary / mutation state handle display
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow">
      <h2 className="mb-4 text-lg font-bold text-text">{t("Custom Calibration")}</h2>

      <div className="mb-4 flex flex-wrap gap-2">
        {SUBJECTS.map((s) => (
          <button
            key={s}
            onClick={() => setSubjectId(s)}
            aria-pressed={subjectId === s}
            className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition ${
              subjectId === s
                ? "bg-teal text-white"
                : "bg-surface text-muted hover:bg-sky/30"
            }`}
          >
            {t(s)}
          </button>
        ))}
      </div>

      <label className="mb-4 block text-sm text-muted">
        {t("Questions")}
        <input
          type="range"
          min={10}
          max={100}
          step={10}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="mt-2 w-full accent-teal"
        />
        <span className="font-bold text-text">{count}</span>
      </label>

      <button
        onClick={handleStart}
        disabled={startMutation.isPending}
        className="w-full rounded-xl bg-gold py-3 font-bold text-navy disabled:opacity-60"
      >
        {startMutation.isPending ? t("Preparing…") : t("Start Mock Test")}
      </button>

      {startMutation.isError && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {startMutation.error instanceof ApiError
            ? startMutation.error.message
            : t("Something went wrong. Please try again.")}
        </p>
      )}
    </section>
  );
}
```

Note what this component does **not** do: no `fetch`, no `supabase`, no
scoring, no direct hex colours, no untranslated string. That is the whole
discipline in one file.

#### (4) The autosave hook (protects a 3-hour attempt)

**`frontend/hooks/useAutosave.ts`**:

```ts
import { useEffect, useRef } from "react";

/**
 * Flushes a dirty buffer on an interval, on tab hide, and on unmount.
 * `visibilitychange` matters more than the interval: on mobile, a student
 * switching apps is the most common way an unsaved answer dies.
 */
export function useAutosave(
  flush: () => Promise<void>,
  { intervalMs = 10_000 }: { intervalMs?: number } = {}
): void {
  const flushRef = useRef(flush);
  flushRef.current = flush;

  useEffect(() => {
    const safeFlush = () => {
      void flushRef.current().catch((err) => {
        // Never let a failed autosave break the test UI. It will retry.
        console.warn("Autosave failed; will retry", err);
      });
    };

    const id = setInterval(safeFlush, intervalMs);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") safeFlush();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      safeFlush();
    };
  }, [intervalMs]);
}
```

### 3.5 Testing setup from zero

Vitest shares Vite's config and transform pipeline, so it is the correct unit
runner here — no separate Babel/Jest config to maintain.

```bash
npm i -D vitest @vitest/coverage-v8 jsdom \
        @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

**`vitest.config.ts`** (new file at repo root):

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["frontend/**/*.test.{ts,tsx}"],
    coverage: {
      reporter: ["text", "lcov"],
      include: ["frontend/lib/**", "frontend/features/**"],
      thresholds: { lines: 70, functions: 70 },
    },
  },
});
```

**`vitest.setup.ts`**:

```ts
import "@testing-library/jest-dom/vitest";
```

Add to `package.json` scripts (keeping the existing backend test script,
which uses the Node test runner — the two coexist fine):

```jsonc
{
  "scripts": {
    "test:unit:web": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

**The first test to write** — extract `buildHonestAttemptFromResult` from
`App.tsx:44` into `frontend/features/attempt/attemptMapper.ts`, then:

```ts
// frontend/features/attempt/attemptMapper.test.ts
import { describe, it, expect } from "vitest";
import { buildHonestAttemptFromResult } from "./attemptMapper.js";
import type { AttemptResult } from "./attempt.schema.js";

const base: AttemptResult = {
  id: "att_1", status: "SUBMITTED", score: 8, maxScore: 12,
  correctCount: 3, wrongCount: 1, skippedCount: 0,
  submittedAt: new Date().toISOString(),
  questions: [],
};

describe("buildHonestAttemptFromResult", () => {
  it("computes accuracy from correct vs wrong only, excluding skipped", () => {
    const out = buildHonestAttemptFromResult(base, "Mock 5", []);
    expect(out.accuracy).toBe(75); // 3 / (3 + 1)
  });

  it("does not divide by zero when every question was skipped", () => {
    const allSkipped = { ...base, correctCount: 0, wrongCount: 0, skippedCount: 10 };
    expect(buildHonestAttemptFromResult(allSkipped, "Mock 6", []).accuracy).toBe(0);
  });

  it("carries forward the previous percentile rather than inventing one", () => {
    const prev = [{ percentile: 91 }] as never;
    expect(buildHonestAttemptFromResult(base, "Mock 7", prev).percentile).toBe(91);
  });
});
```

That third test encodes a real product value already present in the code's
comments: *never invent a number you don't have*. Tests are where values become
enforceable.

### 3.6 Fix the Playwright port mismatch (F7)

`playwright.config.ts` targets `http://localhost:3000` while the server
defaults to `4000`. Make the config read the same source of truth:

```ts
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 4000);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "html",
  use: { baseURL: BASE_URL, trace: "on-first-retry", video: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Most NEET students are on Android. Test what they use.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

Probing `/api/health` instead of `/` is deliberate: it proves the API is
actually up, not just that something is bound to the port.

---

## 4. Version Control, Deployment & CI/CD

### 4.0 🚨 Do this before anything else in this section

While auditing the repository I found real secrets committed to git history.

```bash
# Reproduce the finding yourself:
git log --all --oneline --name-only | grep -E "\.env$"
git show 6d9fdb02 --stat
```

Commit `6d9fdb02` ("admin updated"), reachable from `origin/feature/deepan`,
contains **`backend/.env`** with live values for:

| Variable | Severity | Action |
|---|---|---|
| `DATABASE_URL` | **Critical** | Rotate the Neon password now. Anyone with repo access has your production database. |
| `DIRECT_URL` | **Critical** | Same credential, rotate together. |
| `JWT_SECRET` | High | Legacy (auth moved to Supabase), but rotate/retire regardless. |
| `PORT` | None | — |

`frontend/.env` in the same commit only held `VITE_API_URL`, which is public
by design — no action needed there.

**The current `.gitignore` is correct** (`.env*` with `!.env.example`), so this
is historical, not ongoing. But git history is forever until you rewrite it.

Remediation, in this order:

```bash
# 1. ROTATE FIRST. History rewriting does not un-leak a credential that has
#    already been cloned. Rotate in the Neon console, then update every
#    environment (local .env, staging, production).

# 2. Purge the blobs from history (git-filter-repo is the maintained tool;
#    BFG and filter-branch are both worse choices in 2026).
pipx install git-filter-repo        # or: pip install git-filter-repo
git filter-repo --path backend/.env --path frontend/.env --invert-paths

# 3. Coordinate — this rewrites SHAs. Every collaborator re-clones. Announce
#    it before you force-push.
git push --force --all
git push --force --tags

# 4. Prevent recurrence (see 4.1.4 for the pre-commit hook)
pipx install detect-secrets
detect-secrets scan > .secrets.baseline
```

Treat this as the highest-priority item in the entire document. Everything
else is engineering hygiene; this is an active exposure.

### 4.1 Version control strategy

#### 4.1.1 Current state

```
* NEET-assessment-tool-CSK        <- you are here
  feature/test
  remotes/origin/HEAD -> origin/feature/study-planner-neet
  remotes/origin/NEET-assessment-tool-CSK
  remotes/origin/feature/deepan
  remotes/origin/feature/study-planner-neet
  remotes/origin/feature/test
```

Three problems: there is **no `main`**; the remote HEAD points at a *feature*
branch; and branches are named after people (`feature/deepan`) rather than
work. Person-branches never merge — they become permanent forks, and that is
exactly how `backend/.env` ended up in one branch's history and not another's.

#### 4.1.2 The model: GitHub Flow (not Git Flow)

For a small team shipping a web app continuously, **GitHub Flow** is the right
choice. Git Flow's `develop` + `release/*` + `hotfix/*` ceremony exists for
versioned software with multiple supported releases in the field. You have one
production deployment. The extra branches would be pure overhead.

```
main ────●────●────────●────────●────●──►   always deployable, protected
          \        /     \      /
           ●──●──●        ●────●              short-lived branches (< 3 days)
        feat/attempt-autosave   fix/tamil-overflow
```

Rules:

1. `main` is protected, always green, always deployable.
2. Branch names: `feat/`, `fix/`, `chore/`, `docs/`, `refactor/`, `test/` +
   kebab-case description. Never a person's name.
3. Branches live under 3 days. A week-old branch is a merge conflict waiting.
4. Every change reaches `main` through a PR with at least one review.
5. **Squash merge** — one commit per PR keeps `main` readable and makes
   `git revert` a single, safe operation.

Set it up:

```bash
git branch -m NEET-assessment-tool-CSK main    # or create main from it
git push -u origin main
gh repo edit --default-branch main

gh api -X PUT repos/:owner/:repo/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["quality", "e2e"] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 1 },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

#### 4.1.3 Commit conventions

Use **Conventional Commits**. It is not bureaucracy — it lets a tool generate
your changelog and decide your version number, and it makes `git log` a
searchable history of *why* rather than *what*.

```
<type>(<scope>): <subject>

feat(attempt): flush buffered answers on tab hide
fix(i18n): stop Tamil labels overflowing the question palette
refactor(app): extract buildHonestAttemptFromResult into attemptMapper
chore(deps): drop firebase, remove legacy applet config
perf(bundle): lazy-load LandingView and recharts
docs(frontend): add architecture and lifecycle guide
```

Scopes that match this codebase: `attempt`, `analytics`, `auth`, `i18n`,
`syllabus`, `study-tools`, `ui`, `bundle`, `ci`, `deps`.

Breaking changes get a `!` (`feat(api)!: …`) and a `BREAKING CHANGE:` footer.

#### 4.1.4 Enforce it locally (so CI is never the first to notice)

```bash
npm i -D husky lint-staged @commitlint/cli @commitlint/config-conventional \
        eslint @eslint/js typescript-eslint eslint-plugin-react-hooks \
        eslint-plugin-react-refresh prettier prettier-plugin-tailwindcss
npx husky init
```

`.husky/pre-commit`:

```sh
npx lint-staged
```

`.husky/commit-msg`:

```sh
npx --no -- commitlint --edit "$1"
```

`package.json` additions:

```jsonc
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{css,json,md}": ["prettier --write"]
  }
}
```

`commitlint.config.js`:

```js
export default { extends: ["@commitlint/config-conventional"] };
```

`eslint.config.js` (flat config — ESLint 9+):

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  { ignores: ["dist", "backend/generated", "playwright-report", "test-results"] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["frontend/**/*.{ts,tsx}"],
    languageOptions: { parserOptions: { project: "./tsconfig.json" } },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "warn",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",

      // Architectural rules from §2.2, enforced by the linter rather than by
      // code review. This is how a layering rule survives contact with a
      // deadline.
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["**/firebase*", "firebase/*"],
            message: "Firebase is legacy. See CLAUDE.md — do not add new Firebase code."
          },
          {
            group: ["**/supabase.js", "**/supabase"],
            importNames: ["supabase"],
            message: "Components must not touch Supabase directly. Use a hook -> api client -> apiFetch."
          }
        ]
      }],
      "no-restricted-globals": ["error",
        { name: "fetch", message: "Use apiFetch from frontend/lib/api.ts so auth and errors are handled once." }
      ]
    }
  }
);
```

Add `"lint": "eslint ."` and change the existing `"lint": "tsc --noEmit"` to
`"typecheck"` only — right now `npm run lint` runs the typechecker, which
means you have never actually linted this codebase.

#### 4.1.5 Secrets across environments

| Environment | Where secrets live | Who can read them |
|---|---|---|
| **Local dev** | `.env`, gitignored, created from `.env.example` | You |
| **CI** | GitHub Actions repository secrets / environment secrets | Workflow runs on protected branches |
| **Staging** | Host dashboard env vars (Cloudflare/Render/Fly), separate Supabase project + separate Neon branch | Deploy role |
| **Production** | Host dashboard env vars, GitHub Environment with required reviewers | Owner only |

Non-negotiables:

1. `.env.example` contains **every** key with a placeholder value and a
   comment. It is the contract. When you add a variable, you update
   `.env.example` in the same commit or the next person's clone is broken.
2. Anything `VITE_`-prefixed is **public**. Vite statically replaces
   `import.meta.env.VITE_*` at build time and the value ends up in a JS file
   any student can read. There are exactly three legitimate `VITE_` values
   here: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Use a **separate Supabase project for staging**. Sharing an auth project
   between staging and production means a test signup creates a real user.
4. Frontend builds are environment-specific: `VITE_API_URL` is baked in at
   build time, so staging and production need *separate builds*, not a
   re-tagged image. This is the one genuine downside of client-side env vars;
   the alternative is a runtime `/config.json` fetch, which costs a round trip.

### 4.2 Containerisation

#### 4.2.1 The key decision: does the frontend need its own container?

`backend/server.ts` already serves `dist/` statically in production:

```ts
if (config.nodeEnv === "production") {
  app.use(express.static(distPath));
  app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
}
```

That gives you two viable deployment shapes:

| | **A — Single container** (Express serves the SPA) | **B — Split** (static CDN + API container) |
|---|---|---|
| Matches current code | ✅ already implemented | ❌ needs a small change |
| Cost at low scale | One service; free tiers cover it | Static hosting is free & unlimited on Cloudflare; API still needs a host |
| Latency for Indian students | Single region — 150–300 ms from Chennai to a US/EU region | Cloudflare edge in Mumbai/Chennai → ~10–30 ms for HTML/JS/CSS |
| Cold starts | The whole app sleeps on free tiers → student waits 30–50 s | Static assets never sleep; only the API cold-starts |
| CORS | None needed (same origin) | Needed; already configured via `CORS_ORIGINS` |
| Rollback | Redeploy image | Instant (static) + separate API rollback |
| Complexity | Lower | Slightly higher |

**Recommendation: start with A, move to B before your first exam-season
spike.** The cold-start row is the deciding one — a student who taps your link
and stares at a blank screen for 40 seconds does not come back. Option B keeps
the shell instant even when the API is asleep.

#### 4.2.2 `Dockerfile` (multi-stage, production, shape A)

```dockerfile
# syntax=docker/dockerfile:1.7

# ---- Stage 1: dependencies -------------------------------------------------
# Separated so that a source-only change does not re-run npm ci.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- Stage 2: build --------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# VITE_ values are compiled into the client bundle, so they must be present at
# BUILD time, not run time. They are public by design (see §4.1.5) — passing
# them as build args is safe. Never pass DATABASE_URL this way.
ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_API_URL=$VITE_API_URL \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY

RUN npx prisma generate
RUN npm run build          # vite build -> dist/  +  esbuild -> dist/server.cjs

# ---- Stage 3: production dependencies only ---------------------------------
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- Stage 4: runtime ------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Run as a non-root user. If the process is ever compromised, this is the
# difference between an inconvenience and a container escape.
RUN addgroup -g 1001 -S nodejs && adduser -S lumen -u 1001 -G nodejs

COPY --from=prod-deps --chown=lumen:nodejs /app/node_modules ./node_modules
COPY --from=build     --chown=lumen:nodejs /app/dist ./dist
COPY --from=build     --chown=lumen:nodejs /app/backend/generated ./backend/generated
COPY --chown=lumen:nodejs package.json ./

USER lumen
EXPOSE 4000

# Orchestrators restart an unhealthy container; without this they only know
# whether the process is alive, not whether it is serving.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.cjs"]
```

Add a `.dockerignore` — without it you copy `node_modules`, `.git` and
`playwright-report` into the build context and your builds crawl:

```gitignore
node_modules
dist
.git
.github
.env*
!.env.example
playwright-report
test-results
backend/generated
*.log
docs
legacy
```

#### 4.2.3 `docker-compose.yml` (local development)

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: lumen
      POSTGRES_PASSWORD: lumen_dev_only
      POSTGRES_DB: lumen_academy
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U lumen -d lumen_academy"]
      interval: 5s
      retries: 10

  api:
    build:
      context: .
      target: build          # dev uses the build stage so tsx/devDeps exist
    command: npx tsx watch backend/server.ts
    environment:
      NODE_ENV: development
      PORT: 4000
      DATABASE_URL: postgresql://lumen:lumen_dev_only@db:5432/lumen_academy
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_PUBLISHABLE_KEY: ${SUPABASE_PUBLISHABLE_KEY}
      CORS_ORIGINS: http://localhost:5173
    ports: ["4000:4000"]
    depends_on:
      db: { condition: service_healthy }
    volumes:
      - .:/app
      - /app/node_modules     # keep the container's node_modules, not the host's

  web:
    build:
      context: .
      target: build
    command: npx vite --host 0.0.0.0
    environment:
      VITE_API_URL: http://localhost:4000/api
      VITE_SUPABASE_URL: ${VITE_SUPABASE_URL}
      VITE_SUPABASE_PUBLISHABLE_KEY: ${VITE_SUPABASE_PUBLISHABLE_KEY}
    ports: ["5173:5173"]
    depends_on: [api]
    volumes:
      - .:/app
      - /app/node_modules

volumes:
  pgdata:
```

```bash
docker compose up --build          # whole stack
docker compose exec api npx prisma migrate dev
docker compose exec api npm run seed
docker compose down -v             # -v also drops the database volume
```

> **Local Postgres vs. Neon for development.** Compose gives you a throwaway
> database with no network dependency and no shared-state accidents. Neon's
> *branching* gives you a copy of production data in seconds. Use Compose for
> day-to-day work and a Neon branch when you need to reproduce a real data bug.
> Details in `docs/DATABASE.md`.

### 4.3 Deployment, step by step

#### Path A — single container on Render (simplest, matches current code)

1. Push `main` to GitHub.
2. Render → **New → Web Service** → connect the repo.
3. Runtime **Docker**; Dockerfile path `./Dockerfile`.
4. Add **Environment Variables**: `NODE_ENV=production`, `DATABASE_URL`
   (Neon pooled connection string), `SUPABASE_URL`,
   `SUPABASE_PUBLISHABLE_KEY`, `CORS_ORIGINS=https://lumenacademy.in`.
5. Add **Build Arguments** for the three `VITE_*` values (they are needed at
   build time — step 4 alone is not enough; this is the single most common
   deployment mistake with Vite).
6. Health check path: `/api/health`.
7. Deploy. Verify: `curl -I https://<service>.onrender.com/api/health`.
8. Custom domain → add `lumenacademy.in`, point DNS at Render, TLS is
   automatic.

**Free-tier caveat:** Render's free web services sleep after ~15 minutes idle
and cold-start in roughly 30–60 seconds. Acceptable for a demo; not acceptable
in exam season. That constraint is exactly why Path B exists.

#### Path B — split (recommended before real traffic)

**Frontend → Cloudflare Pages**

```bash
npm i -D wrangler
npx wrangler pages project create lumen-academy
npm run build            # produces dist/
npx wrangler pages deploy dist --project-name=lumen-academy
```

Then in the Pages dashboard set the build command to `npm run build`, output
directory `dist`, and the three `VITE_*` variables per environment
(Production / Preview). Add `public/_redirects` so client-side routes don't
404 — mandatory for any SPA:

```
/api/*  https://api.lumenacademy.in/api/:splat  200
/*      /index.html                             200
```

The first line proxies the API through the same origin, which removes CORS
entirely and means cookies and `Authorization` headers behave identically in
dev and prod.

**Backend → Fly.io** (`fly.toml` and the reasoning live in `docs/BACKEND.md`).
Deploy to `bom` (Mumbai) — for Indian students that is the difference between
~40 ms and ~250 ms per request, and a 90-question test makes a lot of requests.

**Deployment checklist (run before every production release):**

```bash
npm ci
npm run typecheck            # must be clean, with strict: true
npm run lint
npm run test:unit:web
npm run test:unit            # backend, existing script
npm run build
npx vite-bundle-visualizer   # eyeball the bundle; did a dependency sneak in?
npx playwright test          # smoke the happy path against the built artifact
```

### 4.4 CI/CD with GitHub Actions

#### 4.4.1 What is wrong with the current workflow

`.github/workflows/ci.yml` runs on `pull_request` only, and does checkout →
setup-node → `npm ci` → `prisma generate` → `typecheck` → `build`. It never
runs a test. It never lints. It never runs on `main`. And with `strict` off,
`typecheck` passing means very little.

#### 4.4.2 Replacement: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

# A new push to the same PR cancels the previous run — saves free-tier minutes.
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: "20"

jobs:
  quality:
    name: quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - name: Typecheck
        run: npm run typecheck
      - name: Lint
        run: npm run lint
      - name: Format check
        run: npx prettier --check .
      - name: Unit tests (frontend)
        run: npm run test:unit:web -- --coverage
      - name: Unit tests (backend)
        run: npm run test:unit
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage
          path: coverage/

  bundle-budget:
    name: bundle budget
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: npm }
      - run: npm ci
      - run: npx prisma generate
      - run: npm run build
        env:
          VITE_API_URL: https://api.example.com/api
          VITE_SUPABASE_URL: https://example.supabase.co
          VITE_SUPABASE_PUBLISHABLE_KEY: sb_publishable_ci_placeholder_value
      - name: Enforce initial JS budget
        run: |
          # A performance budget only works if it is a build failure, not a
          # dashboard nobody opens. 350 kB of gzipped JS is already generous
          # for a student on a mid-range Android phone.
          BYTES=$(find dist/assets -name 'index-*.js' -exec gzip -c {} \; | wc -c)
          echo "Initial JS (gzip): $BYTES bytes"
          if [ "$BYTES" -gt 358400 ]; then
            echo "::error::Initial JS bundle exceeds the 350 kB gzip budget."
            exit 1
          fi

  e2e:
    name: e2e
    runs-on: ubuntu-latest
    needs: quality
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: lumen
          POSTGRES_PASSWORD: lumen
          POSTGRES_DB: lumen_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready --health-interval 5s
          --health-timeout 5s --health-retries 10
    env:
      DATABASE_URL: postgresql://lumen:lumen@localhost:5432/lumen_test
      SUPABASE_URL: ${{ secrets.STAGING_SUPABASE_URL }}
      SUPABASE_PUBLISHABLE_KEY: ${{ secrets.STAGING_SUPABASE_PUBLISHABLE_KEY }}
      VITE_API_URL: http://localhost:4000/api
      VITE_SUPABASE_URL: ${{ secrets.STAGING_SUPABASE_URL }}
      VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.STAGING_SUPABASE_PUBLISHABLE_KEY }}
      NODE_ENV: production
      PORT: "4000"
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: npm }
      - run: npm ci
      - run: npx prisma migrate deploy
      - run: npm run seed
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

  security:
    name: security
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: npm }
      - run: npm ci
      - name: Dependency audit
        run: npm audit --audit-level=high
      - name: Secret scan
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

The `security` job is what would have caught `backend/.env` before it was ever
committed. Add it today.

#### 4.4.3 `.github/workflows/deploy.yml`

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false        # never cancel a deploy mid-flight

jobs:
  staging:
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.lumenacademy.in
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: npm }
      - run: npm ci
      - run: npx prisma generate
      - run: npm run build
        env:
          VITE_API_URL: https://api-staging.lumenacademy.in/api
          VITE_SUPABASE_URL: ${{ secrets.STAGING_SUPABASE_URL }}
          VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.STAGING_SUPABASE_PUBLISHABLE_KEY }}
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=lumen-academy --branch=staging

  production:
    needs: staging
    runs-on: ubuntu-latest
    # This environment has "required reviewers" configured in repo settings,
    # so the job pauses for a human before touching production.
    environment:
      name: production
      url: https://lumenacademy.in
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: npm }
      - run: npm ci
      - run: npx prisma generate
      - run: npm run build
        env:
          VITE_API_URL: https://api.lumenacademy.in/api
          VITE_SUPABASE_URL: ${{ secrets.PROD_SUPABASE_URL }}
          VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.PROD_SUPABASE_PUBLISHABLE_KEY }}
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=lumen-academy --branch=main
      - name: Smoke test
        run: |
          sleep 15
          curl -fsS https://lumenacademy.in | grep -q "Lumen Academy" \
            || { echo "::error::Production smoke test failed"; exit 1; }
```

Because the frontend build bakes in `VITE_API_URL`, staging and production are
genuinely **different builds** — you cannot promote the staging artifact. The
compensating control is that both are built from the same commit SHA, and both
run the same test suite before either deploys.

**Rollback:**

```bash
# Cloudflare Pages keeps every deployment; promoting an old one is instant.
npx wrangler pages deployment list --project-name=lumen-academy
# then "Rollback to this deployment" in the dashboard, or:
git revert <sha> && git push        # forward-fix through the same pipeline
```

`git revert` is preferred over rollback-by-dashboard: it keeps the deployed
artifact and `main` in agreement, which is what stops the next deploy from
silently reintroducing the bug.

---

## 5. Tooling Ecosystem, Cost Estimation & Tier Analysis

> **Read the pricing page before you commit.** Figures below were checked in
> **August 2026** and are directionally reliable, but every one of these
> vendors has changed its free tier in the last 24 months — Netlify replaced
> bandwidth/build-minute limits with a credit system in September 2025 and
> adjusted credit costs again in April 2026. Where a number is marked *(verify)*
> I could not confirm it against a primary source at the time of writing.
> Treat the *structure* of the analysis as durable and the *numbers* as
> perishable.

### 5.1 The categories you must cover

A beginner's instinct is to think only about hosting. There are seven
categories, and skipping any one of them costs you later:

| # | Category | Why it is not optional |
|---|---|---|
| 1 | **Static hosting / CDN** | Where `dist/` lives and how fast it reaches Chennai |
| 2 | **API hosting** | Covered fully in `docs/BACKEND.md`; summarised here because it determines the frontend's CORS and latency |
| 3 | **Database** | Covered in `docs/DATABASE.md` |
| 4 | **Auth / identity** | Supabase Auth — its SMS costs are the sleeper expense (§5.6) |
| 5 | **CI/CD** | Free minutes are finite; a careless matrix build burns them |
| 6 | **Monitoring** (errors, analytics, uptime, Web Vitals) | Without it you learn about outages from students |
| 7 | **Domain / DNS / security** | Domain is the only unavoidable hard cost |

### 5.2 Static hosting — detailed tier comparison

This is the decision that matters most for the frontend.

#### Cloudflare Pages

| | |
|---|---|
| **Free tier** | **Unlimited bandwidth**, unlimited sites, **500 builds/month**, 10 GB asset storage |
| **Edge presence in India** | Yes — multiple PoPs including Mumbai and Chennai. This is the single biggest performance advantage for your users. |
| **Sleeping** | None. Static assets are always warm. |
| **Advantages** | Unlimited bandwidth removes your scariest cost variable entirely — an exam-eve traffic spike cannot generate a bill. Free preview deployments per branch. Free DDoS protection and WAF at the same edge. Cloudflare Registrar sells domains at wholesale with no markup. |
| **Disadvantages** | 500 builds/month is the real ceiling — a busy team pushing 20×/day will hit it. Build environment is less flexible than Vercel's. Cloudflare Workers (if you later need SSR) use a runtime that is *not* Node.js, so some npm packages won't run. |
| **Lock-in risk** | **Very low** for static hosting — you are uploading a `dist/` folder; moving means changing a deploy command. Risk rises sharply only if you adopt Workers/D1/KV. |

#### Vercel (Hobby)

| | |
|---|---|
| **Free tier** | 100 GB bandwidth/month, ~6,000 build-execution minutes/month, ~100K function invocations, 1 concurrent build, 100 deployments/day, 45-minute per-build cap |
| **Behaviour at the limit** | The project **pauses** rather than billing you. Predictable, but it means an unexpected spike takes you offline. |
| **The clause that matters** | Hobby is licensed for **personal, non-commercial** use. Lumen Academy, the moment it charges a student or is operated by an institute, is commercial — you are expected to be on Pro (~$20/user/month). Do not build a business on Hobby and hope. |
| **Advantages** | Best-in-class DX, instant preview URLs with comments, excellent analytics. |
| **Disadvantages** | 100 GB is genuinely tight for a media-ish education app during a spike. Pro pricing is per-*user*, so a three-person team is ~$60/month before usage. |
| **Lock-in risk** | Low for a Vite SPA; high if you migrate to Next.js and adopt Vercel-specific features (ISR, Image Optimization, Edge Middleware). |

#### Netlify (Free — credit model)

| | |
|---|---|
| **Free tier** | **300 credits/month** pooled across everything. Bandwidth ≈ 20 credits/GB (≈15 GB), production deploys ≈ 15 credits each (≈20 deploys), Functions ≈ 10 credits/GB-hour with a 10-second timeout; Edge Functions get 1,000,000 invocations/month separately |
| **Legacy accounts** | Accounts created before 4 September 2025 may still have the old model: 100 GB bandwidth + 300 build minutes |
| **Behaviour at the limit** | Serving **stops**; no auto-recharge. You must upgrade to Personal (~$9/mo) or Pro (~$20/mo). |
| **Advantages** | Mature platform, good form handling and split testing, generous edge function allowance. |
| **Disadvantages** | ~20 production deploys/month on the free plan is very restrictive for a team practising continuous deployment — you would exhaust it in a single active week. The credit model also makes cost forecasting harder than a flat cap. |
| **Lock-in risk** | Low-to-moderate; Netlify-specific features (Forms, Identity, Edge Functions) do not port. |

#### GitHub Pages

| | |
|---|---|
| **Free tier** | 1 GB site size, 100 GB/month soft bandwidth, 10 builds/hour *(verify)* |
| **Advantages** | Zero extra account; deploys from the same Actions workflow. |
| **Disadvantages** | **No custom redirect rules**, which means no clean SPA fallback — deep links 404 unless you use the ugly `404.html` copy trick. No preview deployments. No edge presence tuned for India. Not intended for production applications. |
| **Verdict** | Fine for documentation. Not for this app. |

#### Render (Static Site)

| | |
|---|---|
| **Free tier** | 100 GB/month bandwidth, unlimited static sites *(verify)* |
| **Advantages** | If your API is already on Render, one dashboard for both. Static sites do **not** sleep (only free *web services* do). |
| **Disadvantages** | Weaker global CDN than Cloudflare; no Indian edge advantage. |

**Decision for Lumen Academy: Cloudflare Pages.** Two reasons dominate:
unlimited bandwidth eliminates spike risk during exam season, and Indian edge
presence directly improves the experience for the actual user base. Vercel is
the better developer experience; Cloudflare is the better fit for *these
students* and *this budget*.

### 5.3 Supporting tools — free tiers worth using

| Category | Pick | Free tier | Why this one |
|---|---|---|---|
| **Error tracking** | **Sentry** | ~5,000 errors + 10,000 performance units/month, 1 user *(verify)* | Source-map upload turns a minified stack trace into a real file and line. Non-negotiable for a client app you cannot debug on the student's phone. |
| **Product analytics** | **PostHog Cloud** | ~1M events/month, includes session replay quota *(verify)* | Session replay of a student getting stuck in the test flow is worth more than any dashboard. EU/US hosting choice matters for Indian data-protection posture. |
| **Uptime** | **BetterStack / UptimeRobot** | 10 monitors, 3–5 min interval *(verify)* | Point one at `/api/health` and one at the landing page. Free tiers page you by email. |
| **Web Vitals** | **Cloudflare Web Analytics** | Free, unlimited, cookieless | No script-tag performance cost, no consent banner needed. |
| **CI/CD** | **GitHub Actions** | 2,000 minutes/month on free plans for private repos; **unlimited for public repos** *(verify)* | You already use it. The `concurrency` block in §4.4.2 is what keeps you inside the cap. |
| **Container registry** | **GitHub Container Registry (ghcr.io)** | Free for public images; storage counted against the account otherwise | Same auth as the repo. |
| **DNS** | **Cloudflare DNS** | Free, unlimited records, fast propagation, free DDoS + universal TLS | Even if you host elsewhere. |
| **Domain registrar** | **Cloudflare Registrar** or **Porkbun** | Not free — see §5.5 | Cloudflare sells at wholesale cost with no renewal markup, which matters more than year-one discounts. |
| **Dependency security** | **Dependabot + `npm audit` + Gitleaks** | Free | Gitleaks is the specific control for the §4.0 incident. |
| **Design/assets** | **Figma** (free: 3 files), **Squoosh** (image compression) | Free | Compress `lumen-logo.png` and any illustration before it enters `dist/`. |

### 5.4 Cost progression matrix

Assumptions for the frontend-attributable costs. Student traffic in this
domain is bursty: a typical 90-question mock test session downloads the app
shell once (cached thereafter) and then exchanges small JSON payloads. Assume
a ~1.2 MB first-visit transfer after the optimisations in §6, and ~200 KB per
returning session.

| Stage | Users | Frontend hosting | API + DB (see other docs) | Monitoring | Domain | **Frontend-attributable /mo** | **Whole stack /mo** |
|---|---|---|---|---|---|---|---|
| **0 — Building** | just you | Cloudflare Pages Free | Neon Free + Fly free allowance | Sentry Free | — | **$0** | **$0** |
| **1 — Pilot** | ≤100 students, 1 institute | Cloudflare Pages Free (bandwidth unlimited; ~30 builds/mo) | Neon Free, Fly shared-cpu-1x | Sentry Free, PostHog Free | ₹900/yr `.in` (~$1/mo) | **$0** | **~$1** |
| **2 — Early traction** | ~1,000 students | Cloudflare Pages Free — still $0 | Neon Launch ~$19, Fly ~$5–10 | Sentry Free, PostHog Free | ~$1 | **$0** | **~$25–30** |
| **3 — Exam season** | ~10,000 students, spiky | Cloudflare Pages Free ($0) **or** Pages Pro $20 if >500 builds/mo | Neon Scale ~$69, Fly 2×512 MB ~$25 | Sentry Team ~$26, PostHog ~$0–50 | ~$1 | **$0–20** | **~$120–170** |
| **4 — Multi-institute** | 50,000+ | Pages Pro $20 + Cloudflare WAF | Neon Scale/Business $69–700, Fly autoscale ~$80+ | Sentry Business, PostHog paid | ~$1 | **~$20–25** | **$300–900+** |

**The headline finding: the frontend is free essentially forever on
Cloudflare Pages.** Your costs are the database, the API host, and — the one
people forget — SMS. See §5.6.

#### Exact upgrade trigger points

| Trigger | Threshold | What you must do | Warning sign to watch |
|---|---|---|---|
| Cloudflare Pages builds | **>500 builds/month** | Pages Pro ($20/mo) **or** batch your deploys | Team pushing >16×/day |
| GitHub Actions minutes | **>2,000 min/mo** (private repo) | Make the repo public, or Team plan, or trim the E2E matrix | Playwright matrix across 3 browsers |
| Sentry events | **>5k errors/mo** | Team plan (~$26/mo) **or** fix the noisy error first | One bad release can burn a month's quota in a day |
| Vercel (if you chose it) | Any commercial use, or >100 GB bandwidth | Pro, ~$20/user/mo | Institute pays you anything |
| Netlify (if you chose it) | **>300 credits** ≈ 20 deploys or 15 GB | Personal $9 / Pro $20 | Second week of active development |
| Neon storage/compute | See `docs/DATABASE.md` | Launch tier | Question bank growth + attempt history |
| **Supabase SMS OTP** | Any real volume | Bring your own SMS provider | First 100 phone signups |

### 5.5 The unavoidable costs

Nothing below has a genuine free tier. Budget for them from day one.

| Item | Realistic cost | Notes |
|---|---|---|
| Domain `.in` | ₹700–1,200/year (~$9–15) | `.in` is the right TLD for this audience and trust. Register at Cloudflare Registrar (wholesale, no renewal markup) or Porkbun. Beware year-one ₹99 offers that renew at ₹1,500. |
| Domain `.com` | ~$10–12/year | Buy it too, redirect it. Cheap insurance against a competitor. |
| **SMS OTP** | ~₹0.12–0.25 per SMS in India | The real one. See §5.6. |
| Email OTP | ~$0 at low volume | Supabase's built-in SMTP is rate-limited and unsuitable for production — plug in Resend (3,000 emails/mo free *(verify)*) or Amazon SES (~$0.10 per 1,000). |

### 5.6 The SMS trap — read this before you launch phone login

`frontend/lib/supabaseAuth.ts` implements phone OTP, and `CLAUDE.md` correctly
notes that delivery requires an SMS provider configured in the Supabase
dashboard. What neither document says is the cost shape:

- Supabase does not send SMS for you on any plan — you connect Twilio,
  MessageBird, Vonage or an Indian provider (MSG91, Fast2SMS) and **pay them
  directly**.
- Indian transactional SMS runs roughly **₹0.12–0.25 per message**, and DLT
  registration with TRAI is mandatory for any sender operating in India. That
  registration takes days-to-weeks and requires a registered entity — start it
  early, not the week you launch.
- Every OTP resend is another message. A student who mistypes and retries
  twice costs you 3×.
- **Modelled cost:** 10,000 students × 2 logins/month × 1.3 messages (retries)
  ≈ 26,000 SMS ≈ **₹3,900–6,500/month (~$47–78)**. That is larger than your
  entire hosting bill at Stage 3.

**Frontend mitigations that directly cut this bill:**

1. **Default to email OTP**, offer phone as the secondary option. Email is
   effectively free.
2. **Client-side E.164 validation before sending.** Supabase rejects malformed
   numbers, but a validated number also prevents a wasted send to a typo'd
   valid-but-wrong number. Add `libphonenumber-js` (~15 kB gz) or a strict
   regex for `+91` + 10 digits.
3. **Enforce a resend cooldown in the UI** — a 60-second disabled timer on the
   "Resend code" button. This is a one-hour change that pays for itself in the
   first week.
4. **Lean on session persistence.** `supabase-js` already refreshes tokens in
   the background; a student who is not forced to re-authenticate does not
   trigger an SMS at all. Do not add an aggressive client-side logout.

### 5.7 Final verdict — the recommended stack

**Build and launch entirely on free tiers:**

| Layer | Choice | Cost | Why |
|---|---|---|---|
| Static hosting | **Cloudflare Pages** | $0 | Unlimited bandwidth, Indian edge, never sleeps |
| API | **Fly.io**, Mumbai (`bom`) region | $0 → ~$5 | Closest to users; see `docs/BACKEND.md` |
| Database | **Neon** PostgreSQL | $0 → $19 | Branching makes staging trivial; see `docs/DATABASE.md` |
| Auth | **Supabase Auth** | $0 (+ SMS) | Already decided; email OTP is free |
| CI/CD | **GitHub Actions** | $0 | Free & unlimited if the repo is public |
| Errors | **Sentry** | $0 | Source-mapped stack traces |
| Analytics | **PostHog** + Cloudflare Web Analytics | $0 | Session replay is the killer feature |
| DNS + WAF | **Cloudflare** | $0 | Same vendor as Pages, one dashboard |
| Domain | **Cloudflare Registrar** `.in` | ~₹900/yr | Wholesale pricing, no renewal markup |
| **Total** | | **~$1/month** | plus SMS once phone login is live |

**The upgrade path, in the order you will actually need it:**

1. **Neon Free → Launch (~$19/mo)** — first, driven by attempt-history growth.
2. **Fly shared-cpu-1x → 2 instances (~$25/mo)** — second, driven by the exam
   spike; add a second machine before the season, not during it.
3. **Sentry Free → Team (~$26/mo)** — third, when 5k events/mo stops covering
   you.
4. **Cloudflare Pages Free → Pro ($20/mo)** — last, and only if build count
   (not traffic) exceeds 500/month.

Notice the shape: **the frontend is the last thing you pay for.** That is the
result of choosing a static SPA on an unlimited-bandwidth CDN, and it is the
strongest argument for deployment shape B in §4.2.1.

**What would change this recommendation:**

- If you adopt **Next.js** for SEO on public course pages, Vercel becomes the
  natural host and the calculus flips — but you would be on Pro (~$20/user)
  from the first paying student.
- If an institute demands **data residency in India**, Neon and Fly both offer
  Indian regions; Supabase's region list should be checked against the
  contract before you sign it.
- If you go **fully Supabase** (Postgres + Auth + Storage + Edge Functions),
  you shed the Fly and Neon bills but take on real lock-in and contradict the
  architecture in `CLAUDE.md`, which deliberately keeps application data in
  Neon/Prisma. Not recommended.

---

## 6. Prioritised remediation backlog

Work top to bottom. Each item names the finding it closes.

| # | Task | Closes | Effort | Why this order |
|---|---|---|---|---|
| **R1** | Rotate the Neon credentials; purge `backend/.env` from git history; add Gitleaks to CI | §4.0 | 2 h | Active credential exposure. Nothing else matters until this is done. |
| **R2** | Remove the hardcoded demo password; add `POST /api/auth/demo-session` or disable the demo button | F4 | 3 h | Second active exposure |
| **R3** | Create `main`, protect it, repoint remote HEAD, retire person-named branches | §4.1.1 | 1 h | Everything downstream assumes a trunk |
| **R4** | Add `frontend/lib/env.ts`; delete the dummy Supabase fallback | F9 | 1 h | Cheap; converts silent failure into a loud one |
| **R5** | Delete `frontend/firebase.ts`, `legacy/`, and the `firebase` dependency | F6 | 1 h | Immediate bundle win, enforces the migration rule |
| **R6** | Enable `strict: true`; burn down errors file-by-file with `@ts-expect-error` + issue links | F1 | 1–2 days | Makes every later refactor safe |
| **R7** | Extract `buildHonestAttemptFromResult` → `attemptMapper.ts`; add Vitest; write its first three tests | F3 (partial) | 4 h | Highest-value untested arithmetic in the app |
| **R8** | Replace the CI workflow (§4.4.2); fix the Playwright port | F12, F7 | 3 h | Now the gates actually gate |
| **R9** | Add ESLint flat config with the `no-restricted-imports` layering rules | §2.2 | 2 h | Makes the architecture self-enforcing |
| **R10** | Introduce a router; move `currentTab`/`currentScreen` into URL state; add `React.lazy` per route | F2, F10 | 3 days | Fixes refresh-during-test, Back button, and initial bundle in one change |
| **R11** | Add the `ErrorBoundary` (global + one around `TestTakingView`) | F10 | 2 h | A chart crash must never end an attempt |
| **R12** | Add `useAutosave` + `sessionStorage` mirror to the attempt flow | §1.2 | 1 day | Directly protects student work on flaky mobile networks |
| **R13** | Migrate `LanguageContext` to `i18n/en.json` + `ta.json` with stable keys | F11 | 2 days | Sentence-keys will break Tamil the first time you fix an English typo |
| **R14** | Decide F5: either route notes/tasks/sessions through the Express API, or write the ADR that justifies direct Supabase access + the RLS policies that make it safe | F5 | 1 day + decision | Two data paths is the biggest latent architecture risk |
| **R15** | Retire `toLegacyQuestions`; rewrite `TestTakingView` against `ApiQuestion` directly | §1.1 | 2 days | The migration shim has served its purpose |
| **R16** | Delete `bun.lock` or `package-lock.json` — commit to one package manager | §3.1 | 5 min | Two lockfiles will drift and produce "works on my machine" |
| **R17** | Rename the package from `react-example` to `lumen-academy` | §0.1 | 5 min | Shows up in images, logs, error reports |

R1–R5 are a single afternoon and remove both security exposures. Do them
before you read `docs/BACKEND.md`.

---

## Sources

Free-tier figures checked August 2026:

- [Vercel free tier limits in 2026: what you actually get on Hobby](https://www.promptstoproduct.com/vercel-free-tier-limits)
- [Vercel Free Tier Limits 2026: Every Hobby Plan Limit Explained](https://deploywise.dev/blog/vercel-free-tier-limits-2026)
- [Cloudflare Pages Pricing & Bandwidth Limits 2026](https://www.devtoolreviews.com/reviews/cloudflare-pages-pricing-bandwidth-limits-2026)
- [Cloudflare Pages Free Tier – Pricing & Limits](https://www.freetiers.com/directory/cloudflare-pages)
- [Netlify Pricing and Limits in 2026: Free Plan, Credits, and What You Actually Get](https://netli.fyi/blog/netlify-pricing-and-limits)
- [Netlify Free Tier Limits 2026: 300 Credits, ~15 GB, 10s Function Timeout](https://temps.sh/compare/vs-netlify)

Repository facts were read directly from this codebase at commit `5a62a54`
(branch `NEET-assessment-tool-CSK`).

---

*Next: `docs/BACKEND.md` (Express, services, Zod validation, AI provider layer,
Fly.io deployment) and `docs/DATABASE.md` (Prisma schema, Neon branching,
migrations, seeding, indexing for the question bank).*
