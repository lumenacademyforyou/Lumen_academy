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

---

# LA-UX-REFRESH-002 — Round 2

Spec: `docs/ux-refresh-round2-prompt.md`.

## Status

| # | Feature | Status | Evidence |
|---|---|---|---|
| G1 | Fix screenshot/PDF capture | **done** | Root cause proven in a real browser both ways: with `html2canvas@1.4.1` the same oklch/color-mix markup throws `Attempting to parse an unsupported color function "oklch"`; with `html2canvas-pro` it rasterises. Pinned by `tests/capture-oklch.spec.ts` |
| G2 | Focus Mode rebuilt as a notification-style timer | **done** | Corner panel, no scroll lock, presets + manual entry, collapses to a pill; 11 passing vitest cases |
| G3 | Focus Mode control moved to the header | **done** | Beside the dark-mode toggle in `Header.tsx`; owned by the always-mounted header so it survives tab changes |
| G4 | Pomodoro timer removed from the dashboard | **done** | `<PomodoroTimer />` off `DashboardView`; `DailyFlashcard` takes the full width |
| G5 | PDF export working everywhere | **done (same fix as G1)** | All three surfaces route through `pdfExport.ts`, now on `html2canvas-pro` |
| G6 | Separate adjacent Exit / Pause in the test console | **done** | Two-column footer, one confirmation dialog each; existing Defect-3 tests updated and passing |
| G7 | Prominent Resume on the results page | **done** | Banner above the table when a resumable attempt exists; 2 new tests, computed over unfiltered attempts |

Verification: `npm run typecheck` clean; `npm run test:frontend` 82/82;
`npm run test:unit` exit 0; `npm run build` succeeds; the Playwright capture
regression test passes.

## Round 2 deviations from the spec

1. **G1 — `html2canvas` was removed from `package.json`, not left alongside
   the fork.** Nothing imports it any more, and keeping both would ship two
   copies of the same ~200KB library and leave the broken one one careless
   import away from coming back.
2. **G1 — `shareElementAsImage` now reports *why* a capture failed.** The
   original swallowed every error into a generic "failed", which is why the
   user's report was "it shows couldn't create the score card image" with
   nothing actionable behind it.
3. **G6 — "Pause and keep for later" stays inside the Exit dialog** as well
   as being its own button. Exit is the moment a student discovers it was not
   what they wanted, and that is the wrong moment to have removed the way out.
4. **G6 — both buttons still confirm.** The user asked for two buttons, not
   for unconfirmed ones; `docs/test-engine-fix-prompt.md` Defect 3 exists
   because an unconfirmed exit mid-attempt was a real defect.
5. **G7 — the existing per-row Resume was kept, and a banner added.** The ask
   read as "there is no Resume on the results page"; there was one, but only
   on the paused row, which is easy to page past in a filtered table. The
   banner is computed over the *unfiltered* attempt list so a type or date
   filter cannot hide the way back into an unfinished test.

## Round 2 open items

- **The three PDF buttons and the share button have not been clicked in the
  running app.** The library-level cause is fixed and proven in a browser, and
  the build is clean, but each surface mounts different content (charts,
  images) and only a signed-in pass confirms them end to end.

## Session log (round 2)

### Session 2 — 2026-09-08

- Diagnosed the capture failure properly rather than patching the symptom:
  Tailwind v4 emits `oklch()` (109 occurrences in the built CSS) and
  `html2canvas@1.4.1` cannot parse it, which broke the scorecard share and all
  three PDF buttons with one error. Swapped both `shareScorecard.ts` and
  `pdfExport.ts` to `html2canvas-pro@2.4.2`, removed the old dependency, and
  added `tests/capture-oklch.spec.ts` so a regression is caught.
- Rebuilt Focus Mode as a compact corner panel that does not lock page
  scrolling, moved its control into the header next to the theme toggle, and
  removed the dashboard Pomodoro timer.
- Split the test console's single "Exit & Pause Test" button into adjacent
  Pause and Exit buttons, each with its own confirmation.
- Added a Resume banner to My Results.
