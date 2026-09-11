import { apiFetch } from "./api";
import type {
  AttemptEnvelope,
  AttemptSummary,
  CreateSessionRequest,
  ReviewQuestion,
  Scorecard,
  SessionResult,
  IrtReport,
  DetailedScorecardResponse,
  CohortComparison,
  AvailabilityResult,
} from "../types";

// LA-APP-COMPLETION-001 Phase D — the real session/attempt lifecycle client.
// Replaces services/testApi.ts (legacy Prisma /tests/*) and the older
// per-step chain in services/assessApi.ts (start/paper/responses/submit
// without the one-call session endpoint). One call to createSession gets a
// ready-to-render envelope; everything after that talks to
// /assess/attempts/:id/* directly.

export async function createSession(body: CreateSessionRequest): Promise<SessionResult> {
  const res = await apiFetch<{ data: SessionResult }>("/assess/sessions", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

// docs/test-engine-fix-prompt.md Defect 6. Takes the identical body
// createSession takes, so the count shown on the config screen is measured
// against the exact configuration Start will submit — there is no second,
// drifting description of "the test you asked for".
export async function checkAvailability(body: CreateSessionRequest, signal?: AbortSignal): Promise<AvailabilityResult> {
  const res = await apiFetch<{ data: AvailabilityResult }>("/assess/availability", {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  });
  return res.data;
}

export async function getEnvelope(attemptId: string): Promise<AttemptEnvelope> {
  const res = await apiFetch<{ data: AttemptEnvelope }>(`/assess/attempts/${attemptId}/envelope`);
  return res.data;
}

export interface ResponseUpdate {
  questionId: string;
  optionId?: string | null;
  numericAnswer?: string | null;
  timeSpentSeconds?: number | null;
  isMarkedForReview?: boolean;
}

// Batch autosave — each item independently ok/failed server-side; a partial
// failure here is a soft signal (caller can retry that one item), never
// blocks the rest of the attempt.
export interface BatchSaveResultItem {
  questionId: string;
  ok: boolean;
  error?: string;
}

export async function saveResponses(attemptId: string, responses: ResponseUpdate[]): Promise<BatchSaveResultItem[]> {
  const res = await apiFetch<{ data: BatchSaveResultItem[] }>(`/assess/attempts/${attemptId}/responses`, {
    method: "PATCH",
    body: JSON.stringify({ responses }),
  });
  return res.data;
}

export async function submitAttempt(attemptId: string): Promise<Scorecard> {
  const res = await apiFetch<{ data: Scorecard }>(`/assess/attempts/${attemptId}/submit`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return res.data;
}

// Test-layer hardening B4: assess.attempt_event already existed (used for
// ATTEMPT_STARTED) but nothing ever logged tab-visibility changes to it —
// the existing visibilitychange handler only triggered a silent autosave
// flush, with no record for later integrity review of how many times, or
// for how long, a student left the test tab during an attempt.
export async function postAttemptEvent(attemptId: string, eventType: string, eventPayload?: unknown): Promise<void> {
  await apiFetch<void>(`/assess/attempts/${attemptId}/events`, {
    method: "POST",
    body: JSON.stringify({ event_type: eventType, event_payload: eventPayload }),
  });
}

export async function pauseAttempt(attemptId: string): Promise<void> {
  await apiFetch<void>(`/assess/attempts/${attemptId}/pause`, { method: "POST" });
}

export async function resumeAttempt(attemptId: string): Promise<void> {
  await apiFetch<void>(`/assess/attempts/${attemptId}/resume`, { method: "POST" });
}

// Phase G (G4) — per-attempt review, one question at a time with the real
// answer key + the student's own response. Only ever succeeds once the
// attempt is scored (attemptFlowController.ts's getReviewHandler throws
// ReviewNotAvailableError otherwise, surfaced here as a normal apiFetch
// rejection) — callers should only invoke this for attempts already known
// to be scored (e.g. from attemptHistory).
export async function getAttemptReview(attemptId: string): Promise<ReviewQuestion[]> {
  const res = await apiFetch<{ data: ReviewQuestion[] }>(`/assess/attempts/${attemptId}/review`);
  return res.data;
}

// P1-7 — real IRT ability estimate for a scored attempt (db/assess/analytics/irt.ts).
export async function getAttemptIrtReport(attemptId: string): Promise<IrtReport> {
  const res = await apiFetch<{ data: IrtReport }>(`/assess/attempts/${attemptId}/irt`);
  return res.data;
}

// P1-10 — detailed report: overall score/accuracy, section-wise breakdown, time taken vs allotted.
export async function getAttemptScorecardDetail(attemptId: string): Promise<DetailedScorecardResponse> {
  const res = await apiFetch<{ data: DetailedScorecardResponse }>(`/assess/attempts/${attemptId}/scorecard`);
  return res.data;
}

// P1-10 — comparison against the cohort average (same test shape, see db/assess/analytics/dashboard.ts).
export async function getAttemptCohortComparison(attemptId: string): Promise<CohortComparison | null> {
  const res = await apiFetch<{ data: CohortComparison | null }>(`/assess/attempts/${attemptId}/cohort`);
  return res.data;
}

// Phase E (E1/E4) — reload/re-login survival. Finds the caller's most recent
// in-progress-or-paused attempt (if any), resumes it server-side if it was
// paused, and returns a ready-to-render SessionResult built entirely from
// one GET .../envelope call (envelope.ts now carries testCode/mode on every
// response, not just at session-creation time). Returns null when there's
// nothing to resume — the normal case for most app loads.
export async function getActiveSession(): Promise<SessionResult | null> {
  const res = await apiFetch<{ data: AttemptSummary[] }>("/assess/attempts");
  const active = res.data.find((a) => a.attemptState === "in_progress" || a.attemptState === "paused");
  if (!active) return null;

  if (active.attemptState === "paused") {
    await resumeAttempt(active.attemptId);
  }
  const envelope = await getEnvelope(active.attemptId);
  return { ...envelope, testId: envelope.test.testId };
}

/**
 * Resume one specific paused attempt, by id — the "Resume" action on a paused
 * row in View Results (docs/test-engine-fix-prompt.md Defect 3).
 *
 * Same two-step sequence getActiveSession already uses (resume server-side,
 * then rebuild a full SessionResult from one envelope call), with one
 * difference that matters: the attempt's state is re-read from the server
 * before deciding whether to resume, rather than trusted from the list row
 * that rendered the button. resumeAttempt throws InvalidStateTransitionError
 * on anything that is not `paused` (attempt-flow.ts:452), and a results list
 * can easily be seconds stale — the attempt may have been resumed in another
 * tab, or expired and been closed by the sweeper, since it was fetched.
 * Reading the envelope first makes the decision on current truth instead.
 */
export async function resumeSessionById(attemptId: string): Promise<SessionResult> {
  const envelope = await getEnvelope(attemptId);
  if (envelope.status !== "paused") {
    // Already in progress (e.g. resumed in another tab) — nothing to
    // transition, just hand back what is already live.
    return { ...envelope, testId: envelope.test.testId };
  }
  await resumeAttempt(attemptId);
  // Re-read: resuming closes the open pause row and flips attempt_state, so
  // the envelope fetched a moment ago now describes a state that no longer
  // exists. TestTakingView reads `status` off the session it is handed.
  const resumed = await getEnvelope(attemptId);
  return { ...resumed, testId: resumed.test.testId };
}

// P1-11 — "View results": every attempt the caller has ever made, any
// state, most recent first. Same GET /assess/attempts getActiveSession
// already calls; this just returns the whole list instead of filtering
// down to the one resumable attempt.
export async function listMyAttempts(): Promise<AttemptSummary[]> {
  const res = await apiFetch<{ data: AttemptSummary[] }>("/assess/attempts");
  return res.data;
}
