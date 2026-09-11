import { useCallback, useEffect, useRef, useState } from "react";
import { getSessionStatus, sendHeartbeat } from "../services/authSessionApi";

// LA-APP-COMPLETION-001 Phase E (E2) — idle-timeout warning + countdown.
// Real enforcement happens server-side (requireAuth.ts rejects a stale
// session with 401 regardless of this hook); this hook is purely the UX
// layer that warns *before* that happens and lets genuine activity push the
// deadline back out, so a real user is never surprised by a hard logout.

const WARNING_THRESHOLD_MS = 120_000; // show the countdown modal this far out
const STATUS_POLL_MS = 30_000; // read-only — never resets the idle clock itself
const HEARTBEAT_THROTTLE_MS = 60_000; // real-activity signal, at most this often
const ACTIVITY_EVENTS = ["mousemove", "keydown", "mousedown", "scroll", "touchstart"] as const;

export type SessionExpiryReason = "idle_timeout" | "absolute_timeout";

export interface IdleSessionGuardState {
  showWarning: boolean;
  secondsRemaining: number;
  reason: SessionExpiryReason;
  stayActive: () => void;
}

export function useIdleSessionGuard(enabled: boolean, onExpire: (reason: SessionExpiryReason) => void): IdleSessionGuardState {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [warningReason, setWarningReason] = useState<SessionExpiryReason>("idle_timeout");

  // Deadline is kept in *local* clock terms (server value shifted by a
  // measured clock offset), same discipline as TestTakingView's timer —
  // this is only ever a UX countdown, though; the actual bound is enforced
  // server-side on every request regardless of what this local clock says.
  const deadlineRef = useRef<number | null>(null);
  const reasonRef = useRef<SessionExpiryReason>("idle_timeout");
  const lastHeartbeatAtRef = useRef(0);
  const showWarningRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  showWarningRef.current = showWarning;

  const refreshStatus = useCallback(async () => {
    try {
      const status = await getSessionStatus();
      const offsetMs = Date.now() - new Date(status.serverNow).getTime();
      const idleDeadline = new Date(status.lastActivityAt).getTime() + status.idleTimeoutMs + offsetMs;
      const absoluteDeadline = new Date(status.absoluteExpiresAt).getTime() + offsetMs;
      if (idleDeadline <= absoluteDeadline) {
        deadlineRef.current = idleDeadline;
        reasonRef.current = "idle_timeout";
      } else {
        deadlineRef.current = absoluteDeadline;
        reasonRef.current = "absolute_timeout";
      }
    } catch {
      // A failed status check (including a 401, which apiFetch already turns
      // into its own sign-out+redirect) just means this hook stops driving
      // the countdown until the next poll — not this hook's job to recover.
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      deadlineRef.current = null;
      setShowWarning(false);
      return;
    }
    refreshStatus();
    const interval = setInterval(refreshStatus, STATUS_POLL_MS);
    return () => clearInterval(interval);
  }, [enabled, refreshStatus]);

  useEffect(() => {
    if (!enabled) return;
    const tick = setInterval(() => {
      if (deadlineRef.current === null) return;
      const remainingMs = deadlineRef.current - Date.now();
      if (remainingMs <= 0) {
        deadlineRef.current = null;
        setShowWarning(false);
        onExpireRef.current(reasonRef.current);
        return;
      }
      if (remainingMs <= WARNING_THRESHOLD_MS) {
        setShowWarning(true);
        setSecondsRemaining(Math.ceil(remainingMs / 1000));
        setWarningReason(reasonRef.current);
      } else if (showWarningRef.current) {
        setShowWarning(false);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [enabled]);

  // Real user activity, throttled to a heartbeat at most once/minute — this
  // is the only thing that ever resets the idle clock server-side (status
  // polling above deliberately never does).
  useEffect(() => {
    if (!enabled) return;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastHeartbeatAtRef.current < HEARTBEAT_THROTTLE_MS) return;
      lastHeartbeatAtRef.current = now;
      sendHeartbeat()
        .then(refreshStatus)
        .catch(() => {});
    };
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));
    return () => ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity));
  }, [enabled, refreshStatus]);

  const stayActive = useCallback(() => {
    lastHeartbeatAtRef.current = Date.now();
    setShowWarning(false);
    sendHeartbeat()
      .then(refreshStatus)
      .catch(() => {});
  }, [refreshStatus]);

  return { showWarning, secondsRemaining, reason: warningReason, stayActive };
}
