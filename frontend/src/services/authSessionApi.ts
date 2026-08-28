import { apiFetch } from "./api";
import type { SessionStatus } from "../types";

// LA-APP-COMPLETION-001 Phase E — client for backend/src/controllers/authSessionController.ts.
// Deliberately three separate calls (not one "ping" endpoint) so idle time
// only ever resets on genuine activity: getSessionStatus is safe to poll
// (never touches last_activity_at server-side), heartbeat is the only thing
// that does, and logoutSession is the explicit revoke.

export async function getSessionStatus(): Promise<SessionStatus> {
  const res = await apiFetch<{ data: SessionStatus }>("/auth/session", { skipAuth: false });
  return res.data;
}

export async function sendHeartbeat(): Promise<void> {
  await apiFetch<void>("/auth/session/heartbeat", { method: "POST" });
}

export async function logoutSession(reason: string): Promise<void> {
  await apiFetch<void>("/auth/session/logout", { method: "POST", body: JSON.stringify({ reason }) });
}
