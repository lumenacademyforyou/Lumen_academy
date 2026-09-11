# Edge-Case Review — Lumen Academy NEET Assessment Tool

LA-UX-REFRESH-003 H10. A module-by-module, layer-by-layer review of what
happens at the edges: empty states, failures, races, hostile input, and
scale. Written 2026-09-08 against the live codebase and the live database.

Each item is graded:

| Grade | Meaning |
|---|---|
| ✅ | Handled today, verified in code |
| ⚠️ | Partly handled — works, but has a real gap |
| ❌ | Not handled |

And each recommendation carries a priority: **P0** (can lose or corrupt a
student's work), **P1** (visibly broken or misleading), **P2** (polish).

A general note before the modules: this codebase is already unusually
disciplined about *honest* empty states — several passes have gone through
removing fabricated numbers. The gaps below are mostly about **failure** and
**concurrency**, not about missing empty states.

---

## 1. Dashboard

### Frontend

| Case | Grade | Notes |
|---|---|---|
| No attempts yet | ✅ | Hero switches to "Start your journey" + "Take Your First Test"; `hasRealAttempt` gates every narrated number |
| Analytics still loading | ✅ | Every derived value defaults to `0`/`—` rather than rendering `undefined` |
| Analytics request fails | ⚠️ | `useDashboardAnalytics` captures the error, but the dashboard never renders it — the screen just stays permanently empty and looks like "no data" instead of "we couldn't load your data" |
| Paused attempt lookup fails | ✅ | `useResumableAttempt` logs and returns null; the banner and bell simply don't appear |
| Scorecard share fails | ✅ | Reports the real reason (round 2 G1) |
| Attempt shown ≠ attempt in the breakdown | ⚠️ | Matched by test *title*, falling back to most recent. Two attempts of the same test are indistinguishable here. The panel prints its own title/date so it can't lie, but it can show a different attempt than the hero |

**Recommendations**

- **P1** — render the analytics error. One conditional; the state already exists.
- **P2** — carry `attemptId` through `TestAttempt` so the breakdown joins exactly instead of by title.

### Backend

| Case | Grade | Notes |
|---|---|---|
| Attempt with zero responses | ✅ | `left join` in the history lateral counts served-but-unanswered as unattempted |
| Scorecard row missing for a scored attempt | ❌ | `getAttemptHistory` **inner joins** `assess.scorecard`; an attempt scored without a scorecard row silently vanishes from history and from `totalScoredAttempts` |
| Division by zero in accuracy | ✅ | `accuracyPercentOf` guards `attempted > 0` |
| A user with thousands of attempts | ⚠️ | History/trend capped at 20, but `getSubjectAccuracy`/`getUnitAccuracy`/`getTimeDistribution` scan **every** scored response with no bound |

**Recommendations**

- **P1** — make the scorecard join a `left join` and treat a missing scorecard as an explicit anomaly rather than a disappearance.
- **P2** — bound the aggregate queries (last N attempts, or a rolling window) before a heavy user makes the dashboard slow.

### Database

| Case | Grade | Notes |
|---|---|---|
| `marks_awarded` null | ✅ | `coalesce(...)` in the F6 sums |
| Attempt deleted mid-query | ✅ | FKs + single-statement reads |
| No index on the history lateral | ⚠️ | `ix_attempt_question_attempt` exists; `attempt_response` is keyed by `(attempt_id, test_question_id)`, but the lateral joins on `question_id` — worth confirming the plan doesn't fall back to a scan on large attempts |

---

## 2. Core (auth, profile, session)

### Frontend

| Case | Grade | Notes |
|---|---|---|
| Session expires mid-use | ✅ | `apiFetch` 401 → sign out → redirect; `useIdleSessionGuard` warns first |
| Account switch leaking cached profile | ✅ | `clearMeCache()` on sign-out — explicitly reasoned about in `meApi.ts` |
| Duplicate e-mail at registration | ✅ | Round 1 F4, with the post-hoc auth error as backstop |
| E-mail check fails (offline/429) | ✅ | Returns `null` = "no objection"; never blocks a real signup |
| Profile save partially fails | ❌ | `updateMe` sends `app_user` fields and `student_profile` fields in one request that runs as **two separate SQL statements with no transaction** — the first can succeed and the second fail, leaving a half-saved profile and a generic error |
| Mobile number format | ⚠️ | Backend enforces length 7–20 only; `"aaaaaaa"` is accepted |

**Recommendations**

- **P0** — wrap `updateProfile`'s writes in a transaction. It is the one place in this module where a failure can leave inconsistent persisted state.
- **P2** — validate mobile numbers as digits/`+`, not just length.

### Backend

| Case | Grade | Notes |
|---|---|---|
| Unknown fields in a profile patch | ✅ | `.strict()` rejects rather than ignoring — deliberate, documented |
| Privilege fields (role/status/institution) | ✅ | Excluded from the schema by design |
| E-mail enumeration | ⚠️ | Rate-limited to 30/min per IP, in-memory. Resets on deploy, and per-IP only — a distributed sweep is not stopped |
| Onboarding auto-advance | ✅ | Promote-only, never demotes; documented reasoning |
| `req.ip` behind a proxy | ⚠️ | Depends on Express `trust proxy` being set; if it isn't, every request shares one bucket |

**Recommendations**

- **P1** — confirm `trust proxy` is set in production, or the limiter is either useless or a global throttle.
- **P2** — add a small per-address cooldown alongside the per-IP one.

### Database

| Case | Grade | Notes |
|---|---|---|
| Two devices saving a profile at once | ⚠️ | Last write wins, silently. Acceptable for a self-service profile; worth knowing |
| `student_profile` row absent | ✅ | `insert … on conflict do update` upserts |
| Partial patch clearing fields | ✅ | `coalesce($n, existing)` — a null means "unchanged", not "erase" |
| **Can a field ever be cleared?** | ❌ | Consequence of the above: there is **no way to blank a field once set**. Setting institution name to empty saves nothing |

**Recommendations**

- **P1** — distinguish "absent" from "explicitly null" (e.g. only `coalesce` keys not present in the patch body). Today a student cannot correct a mistyped institution to empty.

---

## 3. Course

### Frontend

| Case | Grade | Notes |
|---|---|---|
| Catalog fails to load | ✅ | `catalogError` rendered; `CoursesView` guards on it |
| Catalog still loading | ✅ | Spinner |
| Unit with no published questions | ✅ | Start returns `POOL_INSUFFICIENT`, surfaced with a real message |
| JEE tabs with no content | ✅ | Round 3 H6 — explicit empty state, no invented syllabus |
| Syllabus data drifting from the DB | ⚠️ | `syllabusData.ts` is a **hardcoded 620-line file**; unit names/weightages live in code while questions are mapped to `catalog.syllabus_node`. Nothing keeps them in step |
| Study plan goals when a unit disappears | ❌ | Goals key on unit ids from the static file; a renamed/removed node leaves an orphan goal |

**Recommendations**

- **P1** — reconcile `syllabusData.ts` against `catalog.syllabus_node` (at minimum a test asserting every static unit id resolves to a real node).
- **P2** — make study-plan goals tolerate an unresolvable unit rather than rendering a blank row.

### Backend / Database

| Case | Grade | Notes |
|---|---|---|
| Node with no descendants | ✅ | `includeDescendants` handles the leaf case |
| Deleted syllabus node with questions attached | ⚠️ | FK protects the row, but nothing prevents a node being orphaned from its version |
| Materials (Drive) unreachable | ⚠️ | Known open item from an earlier pass — external sharing settings, not code |

---

## 4. Tests (the highest-risk module)

### Frontend

| Case | Grade | Notes |
|---|---|---|
| Pool too small for the request | ✅ | Availability probe + blocking dialog + "build with N" (Defect 6) |
| Availability drifting from what's submitted | ✅ | Server-computed `configHash` compared before rendering — genuinely well done |
| Browser Back during an attempt | ✅ | Routed into the exit dialog; history re-pushed immediately |
| Tab closed mid-attempt | ✅ | `beforeunload` guard; answers flushed on change |
| Exit vs Pause | ✅ | Round 3 G6 — two controls, each confirmed, neither discards |
| Timer while the tab is backgrounded | ⚠️ | Countdown is `setInterval`-driven; throttling makes the **displayed** clock drift. Server-side expiry is authoritative, so the score is safe, but the student can see a wrong number |
| Double-submit | ✅ | `isSubmitting` guard + server idempotency |
| Network loss mid-attempt | ⚠️ | Save failures surface as a banner, but there is no offline queue — answers since the last successful flush are at risk |

**Recommendations**

- **P0** — reconcile the countdown against a server-anchored deadline on visibility change, rather than counting local ticks.
- **P1** — buffer unsaved responses in `sessionStorage` so a network drop plus a refresh cannot lose answers.

### Backend

| Case | Grade | Notes |
|---|---|---|
| Two sessions started at once | ✅ | `ACTIVE_ATTEMPT_EXISTS` |
| Expired attempt submitted | ✅ | `enforceExpiry` scores it rather than rejecting |
| Image mode with no image questions | ✅ | `NO_IMAGE_QUESTIONS_AVAILABLE`, and availability reports 0 rather than erroring |
| Blueprint asking for more than exists | ✅ | `PoolInsufficientError` — never silently short |
| Duplicate questions in one paper | ✅ | Enforced at assembly and by a unique index |
| Scoring rule missing for a question | ⚠️ | Worth confirming the fallback is explicit rather than a default that silently awards zero |

### Database

| Case | Grade | Notes |
|---|---|---|
| Question edited mid-attempt | ⚠️ | `attempt_question` snapshots marks, but the **stem text is read live** — an edit mid-attempt changes the question under the student |
| Question deleted mid-attempt | ✅ | FK from `attempt_question` blocks it |
| Concurrent submit | ✅ | Unique constraint on `scorecard.attempt_id` |

**Recommendation** — **P1**: snapshot stem/option text into the attempt, or forbid editing a question with a live attempt.

---

## 5. Analytics

### Frontend

| Case | Grade | Notes |
|---|---|---|
| No data | ✅ | Every chart has its own empty state |
| One data point | ⚠️ | Trend chart renders a single dot; peak/trough logic degenerates (`troughIndex` is cleared when it equals the peak — correct, but the chart is meaningless at n=1) |
| PDF export fails | ✅ | Fixed in round 2 (G1); errors now surface |
| Very long unit names | ✅ | `truncate` throughout |

### Backend

| Case | Grade | Notes |
|---|---|---|
| Attempts with no timing data | ✅ | Time buckets simply come back empty |
| Weakest unit from one question | ✅ | `minAttempted = 3` threshold — deliberately guarded |
| Percentile / rank | ✅ | Removed rather than faked; documented |

**Recommendation** — **P2**: suppress the trend chart below ~3 points and say so, instead of drawing a line through one value.

---

## 6. Landing / auth

### Frontend

| Case | Grade | Notes |
|---|---|---|
| Already signed in | ✅ | Picked up on landing (P0-1) |
| E-mail send quota exhausted | ✅ | Client-side guard before Supabase is contacted; documented against the 2/hour project quota |
| OTP expired | ✅ | Mapped to a clear message with a resend |
| Password mismatch / weak | ✅ | Validated before submit |
| Google One Tap after sign-out | ✅ | Suppressed to avoid instant re-sign-in |
| Register form on a slow network | ⚠️ | The e-mail check is fire-and-forget on blur; a slow response can land after the user has already typed a different address |

**Recommendation** — **P2**: tag each check with the address it was for and ignore stale responses.

---

## Cross-cutting

| Area | Grade | Notes |
|---|---|---|
| Error boundaries | ❌ | **No React error boundary anywhere.** One render-time exception in any view blanks the entire app to a white screen |
| Loading skeletons | ✅ | Consistent across views |
| Retry on transient failure | ❌ | `apiFetch` never retries — every blip is a user-visible error |
| Offline | ❌ | No detection; failures read as server errors |
| Timezone | ✅ | Explicitly handled for date-only columns (round 1 F2/F3) |
| Long/hostile strings | ⚠️ | Zod caps lengths server-side; the UI truncates. No XSS risk — React escapes by default and nothing uses `dangerouslySetInnerHTML` |
| DB connection exhaustion | ⚠️ | One shared pool; no explicit queue/timeout tuning visible |

---

## The list, ranked

If only the top items get done, do these:

| # | Priority | Item | Module | Layer |
|---|---|---|---|---|
| 1 | **P0** | Wrap `updateProfile` in a transaction | Core | Backend |
| 2 | **P0** | Anchor the attempt countdown to a server deadline | Tests | Frontend |
| 3 | **P1** | Add a React error boundary at the route level | All | Frontend |
| 4 | **P1** | Buffer unsaved responses in `sessionStorage` | Tests | Frontend |
| 5 | **P1** | `left join` the scorecard in attempt history | Dashboard | Backend |
| 6 | **P1** | Let a profile field be explicitly cleared | Core | Backend/DB |
| 7 | **P1** | Snapshot question text into the attempt | Tests | Database |
| 8 | **P1** | Reconcile `syllabusData.ts` with `catalog.syllabus_node` | Course | Frontend/DB |
| 9 | **P1** | Confirm Express `trust proxy` in production | Core | Backend |
| 10 | **P1** | Render the analytics load error | Dashboard | Frontend |

Items 1–4 are the ones that can cost a student real work. The rest are
correctness and honesty issues that show up as confusing screens rather than
lost data.
