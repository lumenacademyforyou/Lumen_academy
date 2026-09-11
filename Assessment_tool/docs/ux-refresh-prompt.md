# LA-UX-REFRESH-001 — Profile, Dashboard & Language-Scope Refresh

Refined from the user's 2026-09-07 request. One directive, eleven features,
implemented **feature by feature, each functional end-to-end across the whole
system** (DB → backend → API client → UI), not stubbed.

Operating rules are inherited from the earlier passes recorded in `CLAUDE.md`:
work through the phases in the order below without pausing for confirmation,
except before a genuinely destructive/irreversible action against shared
state. Stop at a clean phase boundary if the token budget runs low.

---

## F1 — Language toggle: test console only

**Ask:** "remove tamil english translation button from the whole app except
test console so that we can use it only for test questions purpose."

- Remove the global EN/தமி UI-language toggle from `Header.tsx`.
- Keep `LanguageContext` mounted and every `t()` call site intact — the app
  simply has no user-facing switch any more, so chrome renders in English.
  (Ripping out ~450 `t()` calls would be a mechanical rewrite of every screen
  with real regression risk and zero user-visible benefit.)
- The **question-display** control inside `TestTakingView`
  (`questionLanguage`: `en` | `ta` | `bilingual`) is a different control and
  **stays exactly as it is** — that is the one the user wants to keep.
- Persisted `lumen_ui_lang` values are forced back to `en` on load so an
  account that had previously switched to Tamil is not stranded there with no
  way back.

**Done when:** no language switch exists anywhere outside the test console;
the test console's own language selector still switches question text.

---

## F2 — Expanded student profile

**Ask:** mobile number; institution kind (school / college / university /
coaching centre); institution name; institution location; year of study
(standard / year / course, incl. secondary vs higher-secondary for school);
date of birth; and a **study-time target chosen from time tags** (30 min,
60 min, …) replacing the existing free-text "Daily Study Time" minutes input.

New `core.student_profile` columns (migration 048):

| column | type | notes |
|---|---|---|
| `institution_kind` | text | `school` / `college` / `university` / `coaching_centre` / `other`, CHECK-constrained |
| `institution_name` | text | free text |
| `institution_location` | text | free text (city / area) |
| `study_stage` | text | `secondary` / `higher_secondary` / `undergraduate` / `postgraduate` / `dropper` / `other`, CHECK-constrained |
| `study_year` | text | standard/year/course label, e.g. "11th", "2nd year", "B.Sc. Zoology" |
| `date_of_birth` | date | |

`daily_study_minutes` is **reused, not replaced** — the change is that the UI
now offers fixed tags (30 / 45 / 60 / 90 / 120 / 180) instead of a number box,
so the stored value stays comparable with what is already recorded.

Wired through: migration → `meProfile.service.ts` (read + zod write schema)
→ `meApi.ts` → `ProfileCard.tsx` (the profile page) and the Header's own
profile modal (mobile number already lives there).

**Done when:** every field round-trips: fill in → save → reload → still
there, read straight out of Postgres.

---

## F3 — Subscription-driven profile bar + automatic onboarding

**Ask:** "automatic on board updation if the user has subscribed for any plan,
in the profile bar."

- `GET /api/me` gains a real `subscription` object, read from
  `core.subscription` joined to `core.subscription_plan` (most recent active
  row; falls back to the latest row of any status): tier code, tier name,
  status, started/expiry dates.
- The Header profile dropdown's plan card stops being the hardcoded
  "Achiever Pro Plan / Valid till May 2026" and renders that real row —
  including an honest "No active plan" state.
- Onboarding auto-advance: when a user has an **active** subscription and the
  required profile fields are filled, `onboarding_state` is promoted to
  `completed` server-side (never demoted) so it stops being a field the
  student has to set by hand. The manual "Onboarding Status" dropdown is
  removed from `ProfileCard` — it was never a user-facing decision.

**Done when:** the dropdown shows the real plan for a subscribed account, "No
active plan" for one without, and onboarding flips to completed on its own.

---

## F4 — Register form: e-mail already exists

**Ask:** "in the new register form it must show if already registered email id
… a message that the user email already exists."

- New public endpoint `GET /api/auth/email-exists?email=` → `{ exists }`,
  checking `core.app_user` + the Supabase auth user table. Rate-limited and
  answering only a boolean.
- `LandingView`'s register form calls it on blur of the e-mail field and again
  before submit, showing an inline "An account with this email already exists
  — sign in instead" message with a one-click switch to the login form.
- The existing post-hoc `describeAuthError` mapping for
  `user_already_exists` / `email_exists` stays as the backstop.

**Done when:** typing a registered address into the register form surfaces the
message before any e-mail is ever sent.

---

## F5 — Clicking anywhere closes the profile menu

**Ask:** "if i click anywhere in the web app the profile options must close."

Replace the `fixed inset-0` overlay (which only closes on clicks that land on
the overlay itself, and swallows the click) with a document-level `mousedown`
listener plus a ref, so a click **anywhere** — including on other header
buttons — closes the dropdown and still reaches its intended target. `Escape`
closes it too.

**Done when:** one click anywhere outside dismisses the menu and the clicked
control still acts.

---

## F6 — Scorecard: mark breakdown + share as an image

**Ask:** "in the dashboard in the scorecard add info like how many correct
questions and incorrect questions and skip with marks … what cost you …
and then total"; "add a sharing feature in the dashboard score card as a pic
of the score card."

- Server-side (`db/assess/analytics/dashboard.ts`), each attempt-history row
  gains its real per-outcome counts and **marks**: marks earned from correct
  answers and marks lost to negative marking, summed from
  `assess.attempt_response.marks_awarded` — not a client-side `count * 4`
  guess, so it stays correct under every scoring rule the engine supports.
- The hero scorecard renders: correct (count, +marks), incorrect (count,
  −marks lost), skipped (count, 0), and the net total.
- A "Share scorecard" button rasterises the scorecard with `html2canvas`
  (already a dependency) and uses the Web Share API where available, falling
  back to a PNG download.

**Done when:** the numbers reconcile with the attempt's obtained marks, and
the button produces a shareable PNG of the card.

---

## F7 — Stat cards move above Recent Achievements

**Ask:** "push above the 4 cards correct answers, incorrect answers, skipped,
time taken to above the recent achievements and study goal."

Move the 4-card grid so it sits directly under the hero, above the
Achievements row.

---

## F8 — Temporal Analytics moves to the Analytics tab

**Ask:** "move temporal analytics to the analytics tab completely, no temporal
analytics in the dashboard."

Cut the Temporal Analytics panel out of `DashboardView` and render it in
`AnalyticsView`, reading the same `useDashboardAnalytics` data it already has.

---

## F9 — Focus Mode in the hero panel

**Ask:** "add a focus mode in the hero panel exactly like in the leet code
website."

LeetCode's focus mode strips the page down to just the work surface. Here:
a "Focus Mode" control in the hero opens a full-screen, dark, distraction-free
overlay carrying a study timer, the current target, and nothing else — no nav,
no cards, `Esc` to exit, browser fullscreen requested where permitted.
Sessions completed in focus mode are recorded through the existing Pomodoro
session API so they count toward the study streak.

---

## F10 — Remove the dashboard study-goal card

**Ask:** "remove the daily study time and questions solved goal in the
dashboard page."

Delete the "Daily Study Goal" card (and its `lumen_daily_study_goal`
localStorage state) from `DashboardView`. The study-time target now lives in
the profile as a time tag (F2), which is where the user asked for it.

---

## F11 — "Log Out" → "Sign Out"

Every user-facing occurrence of "Log Out"/"Logout" becomes "Sign Out",
including the Header quick button, its tooltip, and the i18n resource files.

---

## Verification (runs at the end of every phase)

1. `npm run typecheck`
2. `npm run test:unit`
3. `npm run build`
4. Manual/live check of the specific feature where it is observable.

Every deviation from this spec is recorded, with its reason, in
`docs/UX_REFRESH_TRACKER.md`.
