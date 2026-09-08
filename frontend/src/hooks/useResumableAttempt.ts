import { useEffect, useState } from "react";
import { listMyAttempts } from "../services/sessionApi";
import type { AttemptSummary } from "../types";

/**
 * LA-UX-REFRESH-003 H3 — "it must show you have a paused test in the
 * dashboard as well as ... a notification in the notification bell."
 *
 * One source of truth for "does this account have a test it can carry on
 * with", shared by the dashboard banner and the bell so the two can never
 * disagree about it.
 *
 * Derived from the attempt list rather than stored as a `learn.notification`
 * row on purpose: a stored row would have to be written when an attempt
 * pauses and deleted when it resumes, is submitted, or expires, and any
 * missed transition leaves a notification pointing at a test that no longer
 * exists. Computing it means it is right by construction, and it disappears
 * the moment the attempt does.
 */

export interface ResumableAttempt {
  attemptId: string;
  testTitle: string;
  attemptState: AttemptSummary["attemptState"];
  startedAt: string | null;
}

// The two states a student can return to. `in_progress` counts because an
// attempt the browser was closed on is never marked paused — it simply stops
// being touched, and it is still resumable until the server expires it.
const RESUMABLE_STATES = new Set(["paused", "in_progress"]);

// One in-flight request shared by every caller, and a short TTL, for the
// same reason meApi.ts caches /me: the dashboard and the header's bell both
// mount at once after sign-in and would otherwise fire this twice (four
// times under React StrictMode's double-invoked effects).
const CACHE_TTL_MS = 30_000;
let cached: { data: ResumableAttempt | null; expiresAt: number } | null = null;
let inFlight: Promise<ResumableAttempt | null> | null = null;

function pickMostRecent(attempts: AttemptSummary[]): ResumableAttempt | null {
  const resumable = attempts.filter((a) => RESUMABLE_STATES.has(a.attemptState));
  if (resumable.length === 0) return null;
  const latest = resumable.reduce((best, a) => ((a.startedAt ?? "") > (best.startedAt ?? "") ? a : best));
  return {
    attemptId: latest.attemptId,
    testTitle: latest.testTitle,
    attemptState: latest.attemptState,
    startedAt: latest.startedAt,
  };
}

async function loadResumableAttempt(): Promise<ResumableAttempt | null> {
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  if (inFlight) return inFlight;
  inFlight = listMyAttempts()
    .then((attempts) => {
      const result = pickMostRecent(attempts);
      cached = { data: result, expiresAt: Date.now() + CACHE_TTL_MS };
      return result;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Called after resuming or submitting, so the banner and the bell clear immediately rather than up to 30s later. */
export function clearResumableAttemptCache(): void {
  cached = null;
}

export function useResumableAttempt(): { resumable: ResumableAttempt | null; loading: boolean } {
  const [resumable, setResumable] = useState<ResumableAttempt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadResumableAttempt()
      .then((result) => {
        if (!cancelled) setResumable(result);
      })
      .catch((err) => {
        // A failed lookup must not break the screen it sits on: no banner and
        // no bell item is the same outcome as having no paused test, and the
        // results page still lists every attempt either way.
        console.error("Failed to check for a resumable attempt:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { resumable, loading };
}
