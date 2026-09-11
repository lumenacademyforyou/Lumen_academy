# LA-UX-REFRESH-003 — Course Layer, Image Mode & Edge-Case Review

Refined from the user's 2026-09-08 third message, layered on
`docs/ux-refresh-prompt.md` (round 1) and `docs/ux-refresh-round2-prompt.md`
(round 2). Ten items. Same operating rules as every pass in `CLAUDE.md`:
work through in order without pausing, except before a genuinely
destructive or irreversible action against shared state.

---

## H1 — Daily Flashcard is not scaled properly

**Ask:** "the daily flash card is not properly scaled it is having issues."

Round 2's G4 removed the Pomodoro timer, and the flashcard — previously one
half of a two-column row — inherited the full page width while keeping a
fixed `min-h-[380px]` and a `h-full` flip container. On a wide screen the
card becomes a very wide, short box; the absolutely-positioned flip faces
stretch with it, the "Tap to flip" hint drifts far from the concept, and the
back face's `overflow-y-auto` never engages because the box is wide rather
than tall.

Rebuilt so the card holds a sensible reading measure at any width, the flip
faces keep a stable aspect, and long definitions scroll inside the face
instead of overflowing it.

---

## H2 — Image-only practice maps nothing

**Ask:** "the image only practice test is not working, it doesnt mapped
anything, we have to use the images map correctly to the test actually."

**Measured cause (live database, 2026-09-08) — this is a content gap, not a
UI bug:**

| Check | Result |
|---|---|
| `content.asset` rows | **0** |
| Published questions with `has_image = true` | **0** (all 1140 are `false`) |
| Image files on disk | 23 PNGs, all under `content-batches/assets/batch-2` and `batch-5` |
| Questions referencing those images | only in `db/content/_quarantine/pre-new-content-2026-09-02/` |
| Questions in the live `new_content` set with a non-empty `images` array | **0 of 1140** |

`content.question.has_image` is not authored — migration 028 makes it a
trigger-maintained mirror of "does this question own a `content.asset` row".
With the asset table empty it is necessarily `false` everywhere, so
image-practice correctly finds nothing and raises
`NO_IMAGE_QUESTIONS_AVAILABLE`. The engine is behaving; the bank has no
image questions in it.

The images that *do* exist belong to the 2026-09-02 quarantined batches —
they were displaced when the content set was replaced, and their questions
never came back.

**Deliverable, in three parts:**

1. **Honest UI.** The "Image Only Practice" tile checks real availability and
   says plainly that no image questions are published yet, instead of
   offering a start button that dead-ends.
2. **The mapping tool.** `db/scripts/import/import-content.ts` already
   uploads an `images[]` array to `content.asset` (and the trigger then
   flips `has_image`). What is missing is a way to attach images to
   questions that are *already imported*. Add
   `db/scripts/import/attach-question-images.ts`: matches asset files to
   questions by `questionUid`, dry-run by default, idempotent, reporting
   every unmatched file and every matched pair before it writes anything.
3. **Restoring real content.** The quarantined batches hold genuine
   image-bearing NEET questions (9 in batch-5, more in batch-2). Re-importing
   them gives image mode actual content. That writes to the shared live
   question bank, so it is **dry-run first, and the live run is put to the
   user** rather than done unilaterally.

---

## H3 — A paused test must be visible on the dashboard and in the bell

**Ask:** "it must show you have a paused test in the dashboard as well as it
must show a notification in the notification bell."

- **Dashboard:** a banner when the account has a paused or in-progress
  attempt, naming the test, with Resume.
- **Notification bell:** the same fact as a bell item, so the badge count
  reflects it.

Computed client-side from the attempt list rather than written into
`learn.notification`. The bell already does exactly this for the
"complete your profile" nudge, so the pattern exists. A stored row would
need writing when an attempt pauses and deleting when it resumes or expires,
and any missed transition would leave a stale notification pointing at a
test that no longer exists.

---

## H4 — "View Results" → "Recent Test & Results" in the profile bar

The header profile dropdown's entry is relabelled. The tab itself and its
route are untouched.

---

## H5 — Info and quick links in the Course Overview

The Overview tab is currently one paragraph and two buttons. It gains:

- an **info panel** — what the course area actually contains, and where the
  syllabus/study-plan/test surfaces connect;
- a **quick links** grid routing straight to the things students go looking
  for (syllabus units, study plan, tests, results, analytics).

---

## H6 — NEET / JEE Mains / JEE Advanced in the course layer

**Ask:** "add jee mains and jee advanced adjacently to the right of the
neet and remove the word syllabus from the neet syllabus in the course layer
and leave blank in the jee mains and advanced areas we can add the things
later."

Course tabs become: **Overview · NEET · JEE Mains · JEE Advanced · Build
Study Plan**. The NEET tab keeps today's `CoursesView` content and drops the
word "Syllabus" from its label. The two JEE tabs render a deliberate, honest
placeholder — not fabricated syllabus data — stating the content is not
loaded yet.

---

## H7 — Chemistry unit badge colour

Chemical Kinetics (`chem_09`) and d & f Block Elements (`chem_10`) are the
only two chemistry units carrying an `emerald` badge in
`frontend/src/data/syllabusData.ts`; every other chemistry unit uses `amber`.
Two lines, brought in line with the rest.

---

## H8 — NEET / JEE Mains / JEE Advanced tabs on the Tests page

Three exam tabs above the test directory. NEET holds the existing content;
the JEE tabs state honestly that no JEE test content exists yet. There is
one exam in `catalog.exam` today, so the JEE tabs are UI scaffolding for
content that has to arrive before they can do anything real — and they say
so rather than pretending.

---

## H9 — Bug sweep

A pass over the app for real defects, fixing what is found and recording
each one with its evidence. Not a refactor: only things that are actually
wrong.

---

## H10 — Edge-case handling review

**Ask:** "tell me what are the things we can do for edge case handling in the
module wise like dashboard, core, course, tests, analytics, landing page …
and tell me it with frontend, backend, database wise."

A written review, module × layer, covering: what is already handled, what is
not, and what is worth doing — ranked, with the reasoning, so it can be
turned into work items. Delivered as `docs/EDGE_CASE_REVIEW.md`.

---

## Verification

`npm run typecheck`, `npm run test:unit`, `npm run test:frontend`,
`npm run build`, plus live database checks for anything content-related.
Deviations are recorded in `docs/UX_REFRESH_TRACKER.md`.
