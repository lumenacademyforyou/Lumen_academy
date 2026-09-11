import { supabase } from "./supabase.js";
import { apiFetch } from "./api";

// The "Quick Demo" entry point on the landing page has no credential form —
// it needs a real session to exercise the real test-taking API, so it signs
// into (or creates, on first use) one fixed demo account by password. This is
// the one account on the project that uses password auth; every real user
// signs in via email/phone OTP (see supabaseAuth.ts).
// Exported (not module-private) so callers that only need to *recognize* the
// demo account — e.g. Header.tsx's "Demo mode" badge (P1-6) — can compare
// against it without duplicating the literal string.
export const DEMO_EMAIL = "demo.student@lumenacademy.dev";
const DEMO_PASSWORD = "Demo-Student-Session-2026";
const DEMO_DISPLAY_NAME = "Prince A";

export function isDemoEmail(email: string | null | undefined): boolean {
  return email === DEMO_EMAIL;
}

// BUG-10-verification fallout (docs/assessment-tool-debug-plan.md) — a real,
// live-reproduced race, not guessed: App.tsx's global supabase.auth.onAuthStateChange
// listener flips isAuthenticated=true (revealing the full authenticated app,
// every button interactive) the instant ensureDemoSession()'s
// signInWithPassword resolves — which is BEFORE handleDemoAccountLogin's own
// sequential `await resetDemoAccountData()` has actually finished wiping the
// account. A user (or a script) fast enough to click through to "Start
// Practice" in that window creates a real assess.test/attempt row that the
// still-in-flight reset then deletes moments later — confirmed live via a
// 404 "assess.test not found" straight out of startAttempt. This flag lets
// App.tsx's listener defer to the explicit onLoginSuccess call the demo
// login flow already makes once reset genuinely completes, instead of
// racing ahead of it.
let demoLoginInFlight = false;
export function isDemoLoginInFlight(): boolean {
  return demoLoginInFlight;
}
export function setDemoLoginInFlight(value: boolean): void {
  demoLoginInFlight = value;
}

export async function ensureDemoSession(): Promise<void> {
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (!signInError) return;

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    options: { data: { display_name: DEMO_DISPLAY_NAME } },
  });
  if (signUpError) throw signUpError;
  // Real bug this used to have: with "Confirm email" enabled on this
  // Supabase project (see supabaseAuth.ts's signUpWithPassword comment),
  // signUp() above can succeed with no error but also no session — the
  // account exists but is stuck unconfirmed. Silently returning "ok" here
  // let the caller (LandingView.tsx's handleDemoAccountLogin) call
  // onLoginSuccess with no real session behind it, reintroducing the exact
  // 401-bounce-back bug documented at that call site as already fixed.
  // db/scripts/demo/seed-demo-account.ts is what actually provisions this
  // account pre-confirmed (via the admin API) — this path should only ever
  // be a fallback for an already-confirmed account's password changing out
  // from under it, and must fail loudly, not silently, if that's not what
  // happened.
  if (!signUpData.session) {
    throw new Error("The demo account exists but isn't confirmed yet. Please try again in a moment, or contact support if this persists.");
  }
}

// BUG-02 (docs/assessment-tool-debug-plan.md) — "must always open fresh...
// automatically delete the data." The demo account is one single shared
// identity (no per-login isolation exists), so every "Quick Demo" login
// wipes whatever the account accumulated last time — its own attempts,
// plans, tasks, notes — before the caller is let into the app. Best-effort:
// a failure here must never block the demo login itself (a stale dashboard
// is a much smaller problem than the whole demo flow being unusable because
// a cleanup call 500'd).
export async function resetDemoAccountData(): Promise<void> {
  try {
    await apiFetch<void>("/auth/demo/reset", { method: "POST" });
  } catch (err) {
    console.warn("Demo account reset failed (continuing anyway):", err);
  }
}
