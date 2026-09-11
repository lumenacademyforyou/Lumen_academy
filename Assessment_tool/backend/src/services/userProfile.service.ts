// Shared types for the Supabase access-token payload requireAuth passes
// through to provisioning/profile code. Provisioning itself lives in
// backend/services/provisionUser.service.ts; the full "who is signed in"
// read lives in backend/services/meProfile.service.ts (LA-BE-CORE-002
// CL-P3/CL-P4) — this file previously held both and is now just the shared
// shapes both depend on.
export interface SupabaseAccessTokenPayload {
  sub: string;
  email?: string;
  phone?: string;
  user_metadata?: Record<string, unknown>;
}

export interface UserProfile {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string;
  role: string;
  locale: string;
  targetExam: string;
}
