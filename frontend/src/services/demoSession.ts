import { supabase } from "./supabase.js";

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
