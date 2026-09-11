// Client-side send guard for confirmation-email sends (LA-BE-CORE-002 CL-P2).
// Supabase's own email service permits only two messages per hour for the
// whole project — this cannot enforce that project-wide number (it only
// sees this one browser), but it does exactly what the brief asks for at
// the application layer: refuse a resend before it reaches Supabase at all
// when the same address has sent too recently or too often. Persisted in
// localStorage (not memory) so a page reload doesn't reset the cooldown.

const STORAGE_KEY = "lumen_email_send_guard_v1";
const COOLDOWN_MS = 60_000;
const MAX_SENDS_PER_HOUR = 3;
const HOUR_MS = 60 * 60 * 1000;

interface SendRecord {
  sends: number[];
}

function readStore(): Record<string, SendRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, SendRecord>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Private browsing / storage disabled / quota exceeded: fail open. The
    // cooldown just won't survive a reload for this one visit — better than
    // blocking registration entirely over a storage write failure.
  }
}

export interface SendGuardResult {
  allowed: boolean;
  reason?: "cooldown" | "hourly_cap";
  retryAfterMs?: number;
}

// Checks whether a confirmation-email send to `email` is allowed right now.
// Does NOT record anything — call recordSend() only after Supabase actually
// accepts the request, so a failed send doesn't burn the address's budget.
export function checkSendAllowed(email: string): SendGuardResult {
  const store = readStore();
  const now = Date.now();
  const record = store[email.toLowerCase()];
  if (!record) return { allowed: true };

  const recentSends = record.sends.filter((t) => now - t < HOUR_MS);
  const lastSend = recentSends[recentSends.length - 1];

  if (lastSend !== undefined && now - lastSend < COOLDOWN_MS) {
    return { allowed: false, reason: "cooldown", retryAfterMs: COOLDOWN_MS - (now - lastSend) };
  }
  if (recentSends.length >= MAX_SENDS_PER_HOUR) {
    return { allowed: false, reason: "hourly_cap", retryAfterMs: HOUR_MS - (now - recentSends[0]) };
  }
  return { allowed: true };
}

export function recordSend(email: string): void {
  const store = readStore();
  const now = Date.now();
  const key = email.toLowerCase();
  const existing = store[key]?.sends ?? [];
  store[key] = { sends: [...existing.filter((t) => now - t < HOUR_MS), now] };
  writeStore(store);
}

export function formatRetryAfter(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.ceil(seconds / 60)} min`;
}

export function describeSendGuardRefusal(result: SendGuardResult): string {
  if (result.reason === "cooldown") {
    return `Please wait ${formatRetryAfter(result.retryAfterMs ?? 0)} before requesting another code.`;
  }
  return `You've reached the limit of confirmation emails for this address this hour. Try again in ${formatRetryAfter(result.retryAfterMs ?? 0)}.`;
}
