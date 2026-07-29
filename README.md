# Lumen Academy — Study Plan

A production-shaped **frontend-only** implementation of the Study Plan feature for the Lumen Academy NEET Test Builder console.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL (typically `http://localhost:5173`).

```bash
npm run build     # type-checks and produces a production build in dist/
npm run preview   # serves the production build locally
```

## Trying it out

Go to the **Study Plan** tab. You have two ways to see it in action:

- **Create Study Plan** — walks through the real 5-step wizard (Target → Syllabus
  Progress → Priorities → Availability → Plan Preferences) and deterministically
  generates a fresh plan from your answers. Everything starts `pending`, exactly as
  a brand-new plan should.
- **Explore Planner** — instantly loads a fully populated demo plan (a realistic mix
  of completed/pending sessions today, plus a generated week ahead) so you can see
  Today, Week, Calendar and Progress fully populated without clicking through the
  wizard first.

From any **Practice** session card, **Build Practice Test** hands off to `/build-test`
preconfigured with that subject/chapter/topic/question count — demonstrating the
Study Plan → Test Builder integration described in the spec. A **Build Custom Test**
path is always available alongside it; the planner never locks you out of manual use.

Your plan persists to `localStorage`, so refreshing the browser keeps it. Use
**Edit Plan** to change availability, priorities, or preferences — completed
sessions are preserved and only the remaining plan is recalculated.

## Architecture

```
src/
  types/            StudyPlan, StudySession, SyllabusSubject, TestConfig, etc.
  data/
    neetSyllabus.ts   The single shared NEET syllabus (Physics/Chemistry/Biology).
                       Study Plan and Test Builder both read from this — no duplication.
    mockStudyPlan.ts   Curated "Explore Planner" demo seed.
  utils/
    planHelpers.ts     Deterministic (non-AI) plan generation + progress calculations.
    dates.ts           date-fns based helpers.
    subjectMeta.ts      Subject colors/icons/labels.
  services/
    studyPlanService.ts  The ONLY module that touches localStorage. Shaped like the
                          future backend API (getStudyPlan, createStudyPlan, ...) so
                          swapping to real HTTP calls later is a one-file change.
  context/
    StudyPlanContext.tsx  Global plan state + actions, consumed via useStudyPlan().
    ToastContext.tsx      Lightweight inline feedback for actions.
  components/
    layout/            Header, navigation, page shell, modal primitive.
    study-plan/         Session cards, Today/Week/Calendar/Progress views, wizard.
  pages/               One page per top-level route.
```

### Key decisions

- **Shared syllabus, not duplicated data.** `neetSyllabus.ts` is the one syllabus
  dataset. Marking topic progress in the wizard mutates that shared source (via a
  tiny pub/sub — see `hooks/useSyllabus.ts`) rather than a Study-Plan-only copy, so
  a future Test Builder reads the same state.
- **Deterministic generation, not AI.** `generateSessions()` in `planHelpers.ts` is a
  plain rule-based scheduler: it walks enabled availability days, allocates study
  blocks proportional to subject priority weighting, follows each study block with a
  matching practice block, and inserts revision sessions on a cadence derived from
  the chosen intensity. No LLM, no mastery scoring, no prediction — as specified.
- **Test Builder stays independent.** `TestConfig` doesn't know whether it came from
  a study-plan session or the manual form (`source: "study-plan" | "manual"`); the
  builder UI treats both identically.
- **Everything generated for today is `pending`.** A freshly generated plan doesn't
  show fabricated completions — only the curated "Explore Planner" demo plan does,
  since it exists specifically to demonstrate the full range of UI states.

## What's intentionally out of scope (per spec)

No AI planner/chatbot, no mastery scoring, no weakness detection, no spaced-repetition
algorithm, no real backend/auth/database, no gamification. These are called out in the
spec as explicitly deferred to a later version.
