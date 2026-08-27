# Joint end-to-end run — test plan

**Date:** 27-08-2026
**Test under trial:** `LMN-NEET-MOCK-ALL-000001` — "NEET Full Mock — I-17 Fixed Paper", 139 questions,
556 marks, 154 minutes, `test_status='published'`, `source_type='authored'` (FIXED mode).
**Accounts:** two real, already-registered accounts — Santhosh (`lumenacademyforyou@gmail.com`) and
Prince (`princeprince45613@gmail.com`), both `student` role. No new accounts needed.

## Setup (Santhosh, before the call)

1. `npm run dev:api` (backend) and `npm run dev` (frontend), both running locally.
2. Confirm `VITE_USE_REAL_API=true` in `.env` (already set).
3. Have a second terminal open on `db/scripts/` ready to run verification queries live during the call.

## Steps

1. **Both log in** with their own real accounts, in separate browser sessions.
2. **Both start the same test** (`LMN-NEET-MOCK-ALL-000001`) independently — two separate
   `assess.attempt` rows, `attempt_no=1` each (different `user_id`, so no collision).
3. **Content read-through** — as each of you moves through the paper, flag anything wrong out loud:
   typos, a broken image, LaTeX not rendering, a missing Tamil translation. This is the part neither
   of us can automate; it needs real eyes on the real render.
4. **Answer a deliberate mix** — some correct, some incorrect, some left blank — so the scorecard has
   something real to differentiate. Doesn't need to be all 139; enough to exercise all three outcomes
   is enough (10-15 questions per person is plenty).
5. **Mid-attempt ownership check (Santhosh runs this while both attempts are still open):**
   ```sql
   -- Santhosh's attempt_id must not appear when queried as Prince's user, and vice versa.
   select attempt_id, user_id from assess.attempt where test_id = 'dede0418-ea9b-4866-a032-cb9753432a24';
   ```
   Then confirm via the API directly: `GET /api/assess/attempts/<the-other-person's-attempt-id>` with
   your own token must return 404, not their data.
6. **Forbidden-key scan (Santhosh, before either submits):**
   ```sql
   -- content.question.numeric_answer / content.question_option.is_correct / any solution text must
   -- never appear in what the frontend actually received. Cross-check the browser's network tab
   -- response for GET /api/assess/attempts/:id/paper against this — the API layer already excludes
   -- these by construction (R-9), this step confirms it held over the real wire, not just in the
   -- query.
   ```
   Concretely: open browser devtools -> Network -> the `paper` request -> Response, search for
   `isCorrect`, `is_correct`, `correctAnswerIndex` (anything but the sentinel `-1`), `numeric_answer`,
   `explanation`, `solution`. None should appear.
7. **Both submit.**
8. **Scorecard check** — each of you should see a scorecard matching what you actually answered.
   Santhosh cross-checks against the DB directly:
   ```sql
   select a.user_id, sc.obtained_marks, sc.total_marks, sc.accuracy_percent
     from assess.scorecard sc join assess.attempt a on a.attempt_id = sc.attempt_id
    where sc.attempt_id in ('<santhosh-attempt-id>', '<prince-attempt-id>');
   ```
9. **Review check** — each of you opens the review screen (or Santhosh calls
   `GET /api/assess/attempts/:id/review` directly) and confirms the correct answers/explanations shown
   now match `content.question_solution` for the questions you got wrong.
10. **Log any content defects found in step 3** into a short follow-up note (same style as
    `docs/CL2_Error_Triage_Batch1-4.md`) so they route back to the right owner — a content fix (Prince)
    vs a rendering bug (Santhosh).

## Pass/fail

- **Pass** if: both attempts complete independently, neither can read the other's attempt/review,
  no answer key appears in any pre-submission response, and both scorecards match hand-checkable
  arithmetic against what was actually answered.
- **Fail** conditions are named explicitly, not just "something felt off" — record which step failed
  and the exact response/data that shows it, same discipline as every proof script this session has
  used.
