# Joint verification call — content defect log

**Date:** 2026-08-27
**Slot:** 19:00 – 20:00, `docs/LA-PLAN-002_Two_Day_Roadmap.md`
**Attendees:** Santhosh (operating — drives the end-to-end attempt), Prince (content correctness — watches and logs)
**Scope:** The I-17 fixed paper (`LMN-NEET-MOCK-ALL-000001`, see `docs/I17_Fixed_Paper_Composition.md`), attempted end-to-end on two accounts.

## Before the call starts

- [ ] I-17 fixed paper seeded live (`npx tsx db/scripts/compose-fixed-paper-i17.ts --live`) — gate G8.
- [ ] Confirm with Santhosh how he's driving the run: the frontend (`TestListView`/`TestTakingView`) currently only calls `POST /tests` (ad-hoc blueprint generator, `subjectId`/`unitId`/`topicId`) — it has no path to attempt a specific FIXED `test_id`. The real engine is `POST /attempts/start` with `{test_id}` (`backend/routes/assess.routes.ts`, proven in `db/scripts/prove-te-p3-assembly.ts`). If Santhosh hasn't wired a UI path since, expect this to run via curl/Postman against the API, not a browser screen-share of the app.
- [ ] Have `docs/I17_Fixed_Paper_Composition.md` open — it's the answer key and question order to check against as each question comes up.
- [ ] Two test accounts ready (per Santhosh's 14:00–16:00 end-to-end test plan — ownership isolation, forbidden-key scan of the attempt envelope).

## What "confirming content correctness" means, concretely

For each question as it's walked through (via `GET /attempts/:id/paper` or the UI, whichever is used):

1. **Stem renders correctly** — LaTeX/markdown formatting intact, no raw markup leaking, no truncation.
2. **Images load** — any diagram (see `content-batches/assets/batch-2/` for the 9 asset-bearing questions) resolves to a real image, not a broken link or placeholder.
3. **Options match the authored content** — same text, same order, no option dropped or duplicated.
4. **No answer-key leakage before submission** — the pre-submission attempt envelope must not reveal `is_correct` or the solution (Santhosh's own scan checks this at the API level; flag here if you spot it in what's rendered).

After submission, cross-check against `docs/I17_Fixed_Paper_Composition.md`'s answer key:

5. **Scorecard total matches** — sum of correct answers × 4, minus incorrect × 1, against what you'd expect from the answers actually submitted.
6. **Review screen shows the correct explanation** — `question_solution.explanation_text` attributed to the right question, not swapped with a neighbour.
7. **Topic/subject attribution correct** — especially the 6 legacy questions with the known subject-label quirk (legacy ids 3, 4, 7, 8, 9, 10 — see the composition doc's "known pre-existing mapping quirk" section) — these should show under their *real* node-derived subject, not the old legacy label.

## Defect log

| # | Time | Question UID | Defect | Severity | Reported by | Status |
|---|---|---|---|---|---|---|
| | | | | | | |

**Severity guide:** Blocker (wrong answer marked correct / test can't be completed) · Major (broken image, garbled stem, wrong solution shown) · Minor (formatting glitch, cosmetic) · Note (not a defect, just worth recording).

## Summary (fill in after the call)

- Total defects logged:
- Blockers:
- Fix owner(s):
- Does this change the I-17 PASS verdict in `docs/CL2_Coverage_Verification.md`? (Y/N — if Y, note why)
