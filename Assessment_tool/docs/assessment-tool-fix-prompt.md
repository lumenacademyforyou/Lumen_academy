# Assessment Tool — Fix & Feature Prompt

You are working on our existing assessment/test-taking web app. Implement the items below. Do not rewrite unrelated modules. For each item, follow the existing project structure, state management, and styling conventions. Where DB fields are missing, add migrations rather than hardcoding.

Work in this order: **P0 (blocking bugs) → P1 (missing features) → P2 (polish)**.

---

## P0 — Blocking bugs

### 1. Google auto-login / session detection
**Current:** If a Google account is already signed in on the browser, the app doesn't pick it up. The user has to log in manually every time.

**Expected:**
- On landing/login page load, check for an existing Google session (Google One Tap / `prompt()` or silent `signIn` with `prompt: 'none'`).
- If the signed-in Google account matches an existing user record, auto-authenticate and redirect to the dashboard without a manual click.
- If it matches no user, show One Tap as a suggestion — do not auto-create an account silently.
- Respect a "sign out" action: after explicit logout, suppress auto-login for that session (set a flag so we don't immediately re-login the user).
- Handle the failure path silently — if silent auth fails, fall back to the normal login form with no error toast.

### 2. Test entry: countdown + consent checkbox
**Current:** The consent/instructions checkbox isn't validated at all, and after the countdown finishes the user isn't taken into the test.

**Expected:**
- The "Start test" flow must check the checkbox state **before** the countdown begins.
- If unticked: block entry and show an inline message — *"Please tick the checkbox to enter the test."* Highlight the checkbox. No countdown starts.
- If ticked: run the countdown, and **on countdown completion automatically navigate into the test** — no extra click needed.
- Guard against double-navigation (countdown finishing twice, back button re-entry).
- Persist that the countdown was consumed, so a refresh mid-test doesn't restart the countdown.

### 3. Duplicate questions in a single test
**Current:** The same question appears more than once within one test attempt.

**Expected:**
- Question selection must be de-duplicated by question ID at the point of paper generation, not at render time.
- Use a shuffle-then-slice (Fisher–Yates on a distinct ID pool) rather than repeated random picks.
- If the requested question count exceeds the available pool for that unit/difficulty, serve the maximum available and log a warning — never pad by repeating.
- Add a unit test asserting `new Set(questionIds).size === questionIds.length` for a generated paper.

### 4. Question images not rendering
**Current:** Questions that should have an image show nothing; there's no layout slot for it either.

**Expected:**
- Fetch the image reference from the DB for each question (`question.image_url` / media table join) and render the correct image for the correct question — verify the mapping, since this is where it's most likely breaking.
- Reserve a fixed-height image container in the question layout so the text doesn't jump when the image loads. Show a skeleton/placeholder while loading.
- If a question has no image, collapse the container entirely (no empty gap).
- Handle broken/missing images with a fallback state instead of a broken-image icon.
- Images must also appear in review/solution views and in downloaded reports.

### 5. Notifications module
**Current:** Marking as read doesn't reflect in the UI, "Clear" doesn't clear, and nothing persists.

**Expected:**
- "Mark as read" updates both the DB and local state immediately (optimistic update with rollback on failure); unread badge count recalculates instantly.
- "Clear" / "Clear all" removes notifications from the list and persists the change.
- Read/cleared state is stored per user and tied to the user session — it must survive logout, login, and device change.
- Add "Mark all as read".

---

## P1 — Missing features

### 6. Demo account login
- Add a **"Try demo account"** option, listed on the signup form (and ideally on the login screen too).
- One click logs into a shared demo user — no email, no password entry.
- The demo user has **all features unlocked**: practice tests, full mock tests, scorecards, IRT report, notifications, profile results.
- Seed the demo account with realistic sample data (a few completed attempts) so reports and analysis aren't empty.
- Show a subtle "Demo mode" badge in the header.
- Reset or sandbox demo data on a schedule so it doesn't degrade over time.

### 7. IRT analysis report
**Current:** Doesn't exist.

**Expected:**
- Add an IRT (Item Response Theory) analysis section to the results/report view.
- Report per attempt: estimated ability (θ), standard error of θ, and item-level difficulty/discrimination where available. Plot the item characteristic curve or an ability-vs-item-difficulty view.
- Show ability trend across attempts over time.
- Add an **info ("What is IRT?") button** next to the heading — opens a tooltip/modal with a plain-English explanation: what IRT measures, how it differs from a raw percentage score, and how to read the θ value. Keep it non-technical.
- If there aren't enough attempts/items to estimate reliably, show a clear "not enough data yet" state instead of a misleading number.

### 8. Practice test → unit flow
- After a practice test, suggest the specific units the user should work on (based on weakest performance).
- Each suggested unit must be a link that routes directly into that unit's test — not back to a generic list.
- Show the unit name, the user's current accuracy in it, and a "Start unit test" CTA.

### 9. Unlock full mock test
- The full mock test is currently locked. Remove the lock and make it accessible to all users.
- Remove or hide the lock icon and any "upgrade/unlock" copy.
- Keep the gating logic behind a feature flag so it can be re-enabled later without a rewrite.

### 10. Detailed report + overall user analysis
**Current:** The detailed report is thin/incomplete.

**Expected — a proper report containing:**
- Overall score, accuracy, attempted vs unattempted, time taken vs allotted.
- Section/unit-wise breakdown with strengths and areas to improve.
- Question-level review: user's answer, correct answer, explanation, image (where applicable), time spent.
- Comparison across attempts (progress over time) and against the cohort average.
- The IRT section from item 7.
- Downloadable as PDF.

### 11. "View results" in the profile menu
- Add **View results** under the profile icon.
- Lists **every test the user has attempted** — test name, type (practice / unit / full mock), date, score, duration, status.
- Sortable and filterable by test type and date range; paginated.
- Each row opens the detailed report (item 10).
- Each row and the list view have a **Download report** action (PDF).

### 12. Report PDF branding
All generated report PDFs must follow our existing question-paper branding:
- **"LUMEN ACADEMY"** as the heading, with the Lumen Academy logo (mountain / graduation cap / sun, tagline *"Empowering Futures through Learning"*) inserted into the document.
- Theme synced to the logo: teal/navy blue with orange/gold accents.

---

## P2 — Performance & polish

### 13. Lag and loading performance
**Current:** Noticeable lag in several places — profile loading, the test evaluation animation, and general navigation.

**Expected:**
- Profile: paginate/lazy-load attempt history instead of fetching everything; cache the profile response; show skeletons rather than blank screens.
- Test evaluation animation: it's blocking on the results computation. Decouple them — run evaluation async, keep the animation to a fixed short duration (≤ 2s), and never let the animation loop while waiting. If evaluation is slow, show progress, not a spinning animation with no end.
- Audit the obvious causes: N+1 queries on results/report endpoints, unindexed columns on `attempts` / `answers` / `questions`, oversized images served uncompressed, re-renders from unmemoized components, and heavy chart libraries loaded on routes that don't need them.
- Code-split the report/analysis routes.
- Add basic timing logs so we can see which endpoint is actually slow rather than guessing.

### 14. Dashboard scorecard text fixes
- Fix the grammar: `1 units` → `1 unit`. Use proper singular/plural everywhere (units, questions, tests, attempts, days).
- Fix the spacing between the number and the label in the scorecard — it's cramped/missing.
- Sweep the dashboard for other pluralisation and spacing issues while in there.

### 15. Motivational scorecard adjectives
- Replace the current single/static label with a varied set of encouraging descriptors mapped to performance bands and scenarios.
- **No negative or discouraging wording at any score** — a low score gets encouragement plus a next step, never "Poor", "Weak", "Bad", "Failed".
- Vary the copy so a user doesn't see the same phrase every time; rotate within the band.
- Cover scenarios beyond raw score: improvement since last attempt, first attempt, completing a full test, consistency streak, strong speed, high accuracy on attempted questions.
- Suggested direction (write more per band, and vary):
  - **High:** "Outstanding work!", "You're mastering this.", "Excellent command of the material."
  - **Mid:** "Solid progress!", "You're getting there.", "Good foundation — keep building."
  - **Low:** "Great start — every attempt counts.", "You're building momentum.", "Good effort — here's where to focus next."
  - **Improved since last attempt:** "You're improving — up X% from last time!"
  - **First attempt:** "Nice work getting started!"
- Always pair the adjective with one concrete, actionable next step (e.g. the weakest unit to practise).

---

## General requirements

- Don't break existing flows; add regression tests for items 2, 3, 5 and 14.
- All new copy in the same tone as the rest of the app: plain, encouraging, no jargon.
- All new views must be responsive and match the existing design system.
- Handle loading, empty, and error states explicitly for every new screen.
- Log errors to the existing error handler — no silent failures.

## Deliverable

For each item: a short note on what changed, which files were touched, and anything you couldn't complete with the reason.
