import { apiFetch } from "./api.js";

/**
 * LA-UX-REFRESH-001 F4 — asks the backend whether an address is already
 * registered, so the register form can say so inline instead of letting the
 * user submit and find out from a failed (or, with e-mail confirmation on,
 * a deliberately indistinguishable "successful") signUp.
 *
 * `skipAuth` because the caller is, by definition, not signed in: without it
 * apiFetch's 401 handler would treat the anonymous response as an expired
 * session and bounce the visitor off the landing page.
 *
 * Never throws. A network failure, a 429, or a backend that is down must not
 * block someone from registering — the real signUp still reports a duplicate
 * afterwards (describeAuthError's user_already_exists/email_exists mapping),
 * so this check is an improvement to the message, never the gate.
 */
export async function checkEmailRegistered(email: string): Promise<boolean | null> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes("@")) return null;

  try {
    const { exists } = await apiFetch<{ exists: boolean }>(
      `/auth/email-exists?email=${encodeURIComponent(trimmed)}`,
      { skipAuth: true }
    );
    return exists;
  } catch {
    return null;
  }
}
