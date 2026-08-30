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

// P2-13 (docs/assessment-tool-fix-prompt.md) — "cache the profile
// response": before this, every mount of every one of fetchMe's several
// callers (Header, NotificationBell, DashboardView, ProfileCard) triggered
// a fresh network round trip the moment inFlightMe settled — the dedup
// above only collapsed truly-concurrent calls, not a second call a moment
// later (e.g. navigating Dashboard -> Profile -> Dashboard re-fetched every
// time). A short TTL cache fixes that without risking properly-stale data:
// 60s is long enough to absorb normal tab-switching, short enough that
// nothing meaningfully time-sensitive here (display name, target exam,
// student profile fields) is ever wrong for long. Explicitly cleared on
// sign-out (clearMeCache, called from App.tsx's endSession) — otherwise a
// demo-account or account-switch sign-in within that window could
// momentarily show the PREVIOUS account's cached profile, which would be a
// real data-leak bug, not just a staleness inconvenience.
const ME_CACHE_TTL_MS = 60_000;
let cachedMe: { data: MeProfile; expiresAt: number } | null = null;

export async function fetchMe(): Promise<MeProfile> {
  if (cachedMe && cachedMe.expiresAt > Date.now()) return cachedMe.data;
  if (inFlightMe) return inFlightMe;
  inFlightMe = apiFetch<{ user: MeProfile }>("/me")
    .then(({ user }) => {
      cachedMe = { data: user, expiresAt: Date.now() + ME_CACHE_TTL_MS };
      return user;
    })
    .finally(() => {
      inFlightMe = null;
    });
  return inFlightMe;
}

export function clearMeCache(): void {
  cachedMe = null;
}

export async function updateMe(patch: UpdateMeInput): Promise<MeProfile> {
  const { user } = await apiFetch<{ user: MeProfile }>("/me", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  // A save must be reflected immediately, not up to 60s stale for whoever
  // calls fetchMe next (e.g. Header's own copy of the name/avatar).
  cachedMe = { data: user, expiresAt: Date.now() + ME_CACHE_TTL_MS };
  return user;
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
