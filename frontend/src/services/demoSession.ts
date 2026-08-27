import { supabase } from "./supabase.js";

// The "Quick Demo" entry point on the landing page has no credential form —
// it needs a real session to exercise the real test-taking API, so it signs
// into (or creates, on first use) one fixed demo account by password. This is
// the one account on the project that uses password auth; every real user
// signs in via email/phone OTP (see supabaseAuth.ts).
const DEMO_EMAIL = "demo.student@lumenacademy.dev";
const DEMO_PASSWORD = "Demo-Student-Session-2026";
const DEMO_DISPLAY_NAME = "Prince A";

export async function ensureDemoSession(): Promise<void> {
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (!signInError) return;

  const { error: signUpError } = await supabase.auth.signUp({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    options: { data: { display_name: DEMO_DISPLAY_NAME } },
  });
  if (signUpError) throw signUpError;
}
