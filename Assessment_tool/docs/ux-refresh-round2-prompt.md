# LA-UX-REFRESH-002 — Capture, Focus Mode & Attempt-Control Round 2

Refined from the user's 2026-09-08 follow-up on LA-UX-REFRESH-001
(`docs/ux-refresh-prompt.md`). Seven features, implemented feature by
feature, each functional end to end. Same operating rules as every pass
recorded in `CLAUDE.md`: work through in order without pausing for
confirmation, except before a genuinely destructive action against shared
state.

---

## G1 — Fix screenshot/PDF capture (root cause, not a workaround)

**Ask:** "i can't share the score card pic, it shows couldn't create the
score card image" — and, later in the same message, "make it work for
generating pdf in view report and view results like everywhere."

**Root cause (measured, not guessed):** this project is on Tailwind CSS v4,
whose default palette is emitted in the `oklch()` color space — the built
stylesheet contains **109** `oklch()` occurrences. `html2canvas@1.4.1` (last
released 2022) cannot parse `oklch()`/`oklab()`/`lab()`/`color-mix()` and
throws `Attempting to parse an unsupported color function` the moment it
walks a styled node. That single failure breaks **every** capture path in
the app at once:

- the F6 "Share Scorecard" button (`services/shareScorecard.ts`),
- Analytics → "Download PDF" (`services/pdfExport.ts`),
- Attempt Review → "Download PDF",
- My Results → the per-row download icon.

They are one bug, not four.

**Fix:** replace `html2canvas` with `html2canvas-pro` (the maintained fork
of the same codebase, same API, with explicit `oklch`/`oklab`/`lab`/`lch`/
`color()` support) in both `shareScorecard.ts` and `pdfExport.ts`. No call
site changes beyond the import.

**Also fixed while here:** `shareElementAsImage` currently swallows the real
error into a generic "failed", which is why the user saw an unactionable
message. It now surfaces the underlying reason so a future capture failure
is diagnosable from the UI instead of only from the console.

**Done when:** the scorecard shares/downloads as a PNG, and all three PDF
buttons produce a real PDF.

---

## G2 — Focus Mode: a sleek notification-style timer, not a Pomodoro clone

**Ask:** "the focus mode it can has small notification style timer only with
fixed time stamps and manual setting — it is pomodoro timer but in name of
the focus mode … sleek design … add scrolling feature to the focus mode."

The v1 implementation was a full-screen takeover with a large progress dial:
functionally a second Pomodoro timer wearing a different name, and it locked
page scrolling, so the student could not actually study *in the app* while
it ran. Rebuilt as:

- A **compact, notification-shaped panel** pinned to a corner — the size and
  shape of a system toast, not a page.
- **The page stays live and scrollable behind it.** No body-scroll lock, no
  backdrop. This is the "add scrolling feature" ask: focus mode must not stop
  you moving around the app.
- **Fixed presets and a manual entry** side by side (25 / 30 / 45 / 60 / 90,
  plus a minutes box for anything else).
- **Minimises to a pill** showing just the remaining time, so it can sit in
  the corner all session without taking space.
- Its own internal scroll when the panel is taller than the viewport allows.
- Sessions still log through the existing pomodoro-session API so they keep
  counting toward the study streak.

---

## G3 — Move the Focus Mode control to the header

**Ask:** "move this feature hero bar near to dark mode toggle button."

The entry point moves out of `DashboardView`'s hero into `Header.tsx`,
immediately beside the dark-mode toggle, so focus mode is reachable from
every screen rather than only the dashboard. The timer is owned by the
header (which is always mounted), so it survives tab navigation.

---

## G4 — Remove the Pomodoro timer from the dashboard

**Ask:** "remove the pomodoro timer from the dashboard."

`<PomodoroTimer />` comes off `DashboardView`. Focus Mode (G2) is now the
single study-timer surface, so there is no longer a reason for two of them.
`DailyFlashcard`, which shared that row, stays and takes the full width.
The `PomodoroTimer` component and its API are left in the tree — nothing
else changes about the sessions it wrote, and the history it saved is still
what the streak reads.

---

## G5 — PDF export working everywhere

Covered mechanically by G1, but verified separately at each of its three
surfaces because each mounts different content:

1. Analytics tab → "Download PDF" (`#analytics-report-container`).
2. Attempt Review ("View Detailed Report") → "Download PDF"
   (`#attempt-report-content`).
3. My Results → per-row download icon (mounts the report, then captures).

Each must produce a non-empty, multi-page-correct A4 PDF.

---

## G6 — Two separate, adjacent buttons in the test console: Exit and Pause

**Ask:** "i want two button seperately adjacently exit and pause button in
the test console."

Today there is one "Exit & Pause Test" button that opens a three-way modal.
It becomes two buttons side by side in the console footer:

- **Pause** — flush unsaved answers, pause the attempt server-side, leave.
  The attempt stays resumable (this is exactly what the current
  `handleExitAndPause` does).
- **Exit** — leave the exam for good: confirm, then submit and exit.

Both keep a confirmation step. That is deliberate and is *not* negotiable
down to a bare click: `docs/test-engine-fix-prompt.md` Defect 3 exists
because an unconfirmed exit during a live attempt was a real defect. Neither
path ever discards answers.

---

## G7 — A prominent Resume on the results page

**Ask:** "add a resume button to view results page."

A per-row `Resume` already exists but only appears on the paused row itself,
which can be anywhere in a paginated, filtered table — easy to miss and
easy to page past. Added: a **banner at the top of My Results** whenever the
account has a resumable (paused or in-progress) attempt, naming the test and
resuming it in one click. The row button stays.

---

## Verification

1. `npm run typecheck`
2. `npm run test:unit` and `npm run test:frontend`
3. `npm run build`
4. A live browser pass for the capture paths (G1/G5) and Focus Mode (G2/G3),
   since those are exactly the things unit tests cannot confirm.

Deviations are recorded, with reasons, in `docs/UX_REFRESH_TRACKER.md`.
