import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// Google Identity Services (GIS) One Tap — separate from supabaseAuth.ts's
// signInWithGoogle(), which is the explicit full-page OAuth redirect. This
// module implements P0-1: detect an already-signed-in Google session on
// landing/login page load and resolve it in place, no click required.
//
// Requires VITE_GOOGLE_CLIENT_ID (a Google Cloud OAuth 2.0 Web Client ID,
// registered as an authorized JavaScript origin for this app's domain, and
// the same client ID Supabase's Google provider is configured to accept for
// ID-token sign-in). Until that env var is set, tryGoogleOneTap() is a no-op
// — the normal email/password + OAuth-redirect login form is unaffected.

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          prompt: (momentListener?: (notification: GsiPromptMomentNotification) => void) => void;
          disableAutoSelect: () => void;
          cancel: () => void;
        };
      };
    };
  }
}

interface GsiPromptMomentNotification {
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
  isDismissedMoment: () => boolean;
}

const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
// Session-scoped (not localStorage) — "suppress for that session" per the
// spec, so a later fresh browser session is free to try auto-login again.
const SUPPRESS_KEY = "lumen_suppress_google_onetap";

let scriptLoadPromise: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("gis_script_failed")));
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("gis_script_failed"));
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

function isSuppressed(): boolean {
  try {
    return sessionStorage.getItem(SUPPRESS_KEY) === "1";
  } catch {
    return false;
  }
}

// Called from the central sign-out path (App.tsx's endSession, explicit
// logout only) so a signed-out user isn't immediately silently re-signed-in
// by GIS the moment they land back on "/".
export function suppressGoogleOneTapForSession(): void {
  try {
    sessionStorage.setItem(SUPPRESS_KEY, "1");
  } catch {
    // sessionStorage unavailable (private mode) — nothing to persist; the
    // in-memory GIS disableAutoSelect() call below still applies for the
    // rest of this page life.
  }
  window.google?.accounts?.id?.disableAutoSelect();
}

async function exchangeGoogleCredential(idToken: string): Promise<Session | null> {
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });
  if (error) throw error;
  return data.session;
}

// Attempts a silent/One Tap Google sign-in. Every failure path — GIS script
// blocked, no eligible Google session, user dismissed the prompt, or the
// token exchange itself failing — resolves quietly with no thrown error and
// no UI feedback, so the caller can always just fall back to the normal
// login form (P0-1's "handle the failure path silently" requirement).
export async function tryGoogleOneTap(onSuccess: (session: Session) => void): Promise<void> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  if (!clientId || isSuppressed()) return;

  try {
    await loadGisScript();
    const id = window.google?.accounts?.id;
    if (!id) return;

    id.initialize({
      client_id: clientId,
      // auto_select lets GIS itself decide silent vs. visible: it only
      // resolves with no UI for a browser Google already recognizes as a
      // returning, previously-consented session for this site — a Google
      // account that has never signed in here surfaces the small,
      // dismissable One Tap bubble instead and requires an explicit click,
      // which is what keeps a brand-new match from being auto-created
      // silently (P0-1's second requirement).
      auto_select: true,
      cancel_on_tap_outside: true,
      callback: (response) => {
        exchangeGoogleCredential(response.credential)
          .then((session) => {
            if (session) onSuccess(session);
          })
          .catch(() => {
            // No matching/creatable account, or the exchange failed —
            // silent fallback to the manual form.
          });
      },
    });

    id.prompt();
  } catch {
    // Script failed to load (network/ad-block) — silent fallback.
  }
}
