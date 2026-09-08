# LA-UX-REFRESH-001 — Tracker

Spec: `docs/ux-refresh-prompt.md`. Read the **Session log** (bottom) first on
"continue".

## Status

| # | Feature | Status | Evidence |
|---|---|---|---|
| F1 | Language toggle: test console only | **done** | Toggle removed from `Header.tsx`; `readStoredLanguage()` pins `en`; `grep` for Tamil UI outside `TestTakingView` returns only comments |
| F2 | Expanded student profile | **done** | Migration 048 applied + `verify_048` passed; live rollback round-trip wrote and read back all 6 new columns; all 3 CHECKs rejected bad values (`23514`) |
| F3 | Subscription-driven profile bar + auto onboarding | **done (code); no data to exercise** | `/api/me` returns a real `subscription`; Header card renders it; onboarding UPDATE runs (0 rows — see Open) |
| F4 | Register: e-mail already exists | **done** | Live: registered address → `{"exists":true}`, unknown → `{"exists":false}`, malformed → 400 `INVALID_EMAIL` |
| F5 | Click anywhere closes profile menu | **done** | Overlay replaced by a document `mousedown`/`touchstart` listener + `Escape`; ref-scoped |
| F6 | Scorecard mark breakdown + share-as-image | **done** | New SQL verified live on 6 real scored attempts: `correctMarks − penaltyMarks === obtainedMarks` for every one |
| F7 | Stat cards above Recent Achievements | **done** | 4-card grid moved directly under the hero |
| F8 | Temporal Analytics → Analytics tab | **done** | Panel removed from `DashboardView`, rendered in `AnalyticsView` with the same `useDashboardAnalytics` data |
| F9 | Focus Mode in hero panel | **done** | New `FocusMode.tsx` + 7 passing vitest cases (countdown, session logging, sub-minute suppression, Esc exit) |
| F10 | Remove dashboard study-goal card | **done** | Card and its `lumen_daily_study_goal` localStorage state deleted |
| F11 | "Log Out" → "Sign Out" | **done** | Header button + tooltip + `AdminView`; unused `"Log Out"` i18n key dropped from `en.json`/`ta.json` |

Verification at the end of the pass: `npm run typecheck` clean;
`npm run test:unit` 193/193 pass; `npm run test:frontend` 69/69 (+7 new) pass;
`npm run build` succeeds.

## Deviations from the spec

1. **F1 — `LanguageContext` and every `t()` call site are kept.** The spec
   said to remove the *switch*, not the i18n layer. Chrome now always renders
   English because `readStoredLanguage()` returns `'en'` unconditionally.
   Deleting ~450 `t()` calls across every screen would be a large mechanical
   rewrite with real regression risk and no user-visible benefit.
   `setLanguage`/`toggleLanguage` remain on the context (nothing calls them)
   so the contract and its consumers are untouched.
2. **F1 — a previously stored `'ta'` is deliberately ignored, not honoured.**
   With no toggle left in the UI, an account that had switched to Tamil would
   otherwise be stranded in it permanently.
3. **F2 — `daily_study_minutes` is reused rather than replaced.** The UI stops
   offering a free-text minutes box and offers fixed tags (30/45/60/90/120/180),
   but the stored column and unit are unchanged, so values recorded before
   this pass stay comparable with the ones recorded after it.
4. **F3 — the onboarding sync only ever promotes to `completed`, never
   demotes.** A lapsed plan must not un-onboard someone who has been using
   the app for months, and an admin who set `completed` by hand is not
   overridden by a missing field.
5. **F6 — the mark split is by the sign of `marks_awarded`, not by outcome
   flag.** That is what keeps it correct under partial credit and under rules
   with no negative marking, instead of hardcoding NEET's +4/−1.
6. **F6 — the breakdown is matched to the displayed attempt by test title,
   falling back to the most recent scored attempt.** `TestAttempt.id` is a
   *scorecard* id and the analytics history is keyed by *attempt* id, so
   there is no direct join available client-side. The panel prints the
   matched attempt's own title and date, so it can never silently claim to
   describe a different attempt than the one it came from.

## Open / blocked

- **F3 has no data to exercise it.** `core.subscription` and
  `core.subscription_plan` are both **empty** (0 rows, checked live
  2026-09-08). The code path is correct and runs, but every account will show
  "No active plan" and the onboarding auto-advance will match 0 rows until
  real plans and subscriptions exist. Nothing to fix in code — this needs
  plan/subscription rows (a seed, an admin surface, or a payment flow), which
  is outside this pass's scope.
- **F6/F9 have not been clicked through in a live browser.** The share button
  (html2canvas → Web Share / download) and focus mode are covered by unit
  tests and a clean production build, but a signed-in visual pass on the
  dashboard is still worth doing.

## Session log

### Session 1 — 2026-09-08

- Read the codebase surface for every feature: `Header.tsx`,
  `DashboardView.tsx`, `AnalyticsView.tsx`, `ProfileCard.tsx` /
  `ProfileView.tsx`, `meApi.ts`, `backend/src/services/meProfile.service.ts`,
  `backend/src/routes/api.ts`, `LandingView.tsx`'s register flow,
  `db/migrations/002_core.sql`, `db/assess/analytics/dashboard.ts`, scoring
  aggregate/types.
- Wrote `docs/ux-refresh-prompt.md` (the refined prompt) and this tracker.
- Implemented all eleven features. New files:
  `db/migrations/048_student_profile_details.sql`,
  `db/verify/verify_048_student_profile_details.sql`,
  `backend/src/services/emailAvailability.service.ts`,
  `frontend/src/services/emailAvailabilityApi.ts`,
  `frontend/src/services/shareScorecard.ts`,
  `frontend/src/components/ui/dashboard/FocusMode.tsx` (+ its test).
- Migration 048 applied to the live database and verified; no existing row
  was modified (all six columns are nullable, nothing backfilled).
- Live checks: `/api/health` up, `/api/auth/email-exists` correct on three
  inputs, the new analytics SQL reconciles on every real scored attempt, and
  the profile round-trip + constraint rejections were proven inside a
  rolled-back transaction (no data changed).
