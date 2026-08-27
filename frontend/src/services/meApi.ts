import { apiFetch } from "./api.js";

// Mirrors backend/services/meProfile.service.ts's FullProfile exactly
// (LA-BE-CORE-002 CL-P4) — the single authoritative "who is signed in"
// shape, replacing frontend/supabase.ts's fetchAppUser()/fetchStudentProfile()
// direct-PostgREST reads.
export interface MeProfile {
  appUserId: string;
  authUserId: string;
  memberCode: string | null;
  email: string | null;
  mobileNumber: string | null;
  fullName: string;
  preferredLanguage: string | null;
  status: string;
  primaryRole: string;
  lastLoginAt: string | null;
  institution: { id: string; name: string; code: string } | null;
  roles: { code: string; name: string; scopeLevel: string; institutionId: string | null }[];
  targetExam: string;
  locale: string;
  studentProfile: {
    targetYear: number | null;
    classLevel: string | null;
    guardianContact: string | null;
    dailyStudyMinutes: number | null;
    onboardingState: string | null;
  } | null;
}

export interface UpdateMeInput {
  fullName?: string;
  mobileNumber?: string | null;
  preferredLanguage?: string | null;
  targetExam?: "NEET" | "JEE";
  studentProfile?: {
    targetYear?: number | null;
    classLevel?: string | null;
    guardianContact?: string | null;
    dailyStudyMinutes?: number | null;
    // string, not the narrower literal union: MeProfile.studentProfile (the
    // read shape a draft is usually built from) types this as plain string,
    // and the backend's zod schema is the actual source of truth for which
    // values are valid — matching it here just avoids an awkward cast at
    // every call site.
    onboardingState?: string;
  };
}

// Header, DashboardView and ProfileCard each call fetchMe() independently
// on mount — found live, testing this: React StrictMode's dev-mode double
// effect invocation plus two components meant up to 4 concurrent /api/me
// requests firing within milliseconds of sign-in, and whichever one the
// backend/connection pool got to last could lag noticeably behind the
// others. Sharing one in-flight request instead of firing a new one per
// caller collapses those back down to one real network call — the same
// "collapse redundant round trips" goal CL-P4 already applies server-side,
// just needed here too once multiple components legitimately want the same
// data. Cleared as soon as it settles, so a call after that (e.g. right
// after updateMe()) always gets a fresh request rather than a stale cache.
let inFlightMe: Promise<MeProfile> | null = null;

export async function fetchMe(): Promise<MeProfile> {
  if (inFlightMe) return inFlightMe;
  inFlightMe = apiFetch<{ user: MeProfile }>("/me")
    .then(({ user }) => user)
    .finally(() => {
      inFlightMe = null;
    });
  return inFlightMe;
}

export async function updateMe(patch: UpdateMeInput): Promise<MeProfile> {
  const { user } = await apiFetch<{ user: MeProfile }>("/me", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return user;
}

// Requires the caller's current session to carry a recent OTP-verified amr
// claim — see backend/services/deleteAccount.service.ts. The frontend flow
// this is meant to be called from: sendEmailOtp(email, false) to send the
// code, then verifyEmailOtp(email, code) to mint that fresh OTP session,
// then this call immediately after (apiFetch always sends the client's
// current session token, so it picks up the fresh one automatically).
export async function deleteAccount(): Promise<void> {
  await apiFetch<void>("/me", { method: "DELETE" });
}

// A profile counts as "complete enough" once the fields the dashboard/
// notifications actually use are present — kept in one place so every
// caller (Header, NotificationBell, DashboardView) agrees on the same
// definition instead of each inventing its own.
export function getMissingProfileFields(profile: MeProfile | null): string[] {
  if (!profile) return ["Name", "Class / Grade", "Target Year"];
  const missing: string[] = [];
  if (!profile.fullName?.trim()) missing.push("Name");
  if (!profile.studentProfile?.classLevel) missing.push("Class / Grade");
  if (!profile.studentProfile?.targetYear) missing.push("Target Year");
  return missing;
}
