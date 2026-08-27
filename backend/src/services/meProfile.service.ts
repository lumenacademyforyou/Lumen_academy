import { z } from "zod";
import { pool } from "../../../db/shared/pool.js";
import { prisma } from "../lib/db.js";
import { AppError } from "../middleware/errorHandler.js";

// Single authoritative shape for "who is signed in" (LA-BE-CORE-002 CL-P4).
// Replaces frontend/supabase.ts's fetchAppUser() + fetchStudentProfile() —
// two sequential PostgREST calls from the browser straight into the core
// schema (fetchStudentProfile calls fetchAppUser a second time internally on
// top of that), which is both the S-3 latency this phase exists to remove
// and a rule-5 exposure question CL-P0 could never confirm (core is not
// supposed to be reachable via PostgREST at all). This assembles the same
// data server-side, in parallel queries, behind one HTTP round trip.
export interface FullProfile {
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
  // Always [] today — no invitation flow exists yet to populate
  // core.user_role_assignment (CL-P0/CL-P6 finding). Shaped now so CL-P6 can
  // start populating it without another response-shape change.
  roles: { code: string; name: string; scopeLevel: string; institutionId: string | null }[];
  targetExam: string;
  locale: string;
  // null until the user (or CL-P6/7's admin surface) has ever saved one —
  // provisioning (CL-P3) does not create this row.
  studentProfile: {
    targetYear: number | null;
    classLevel: string | null;
    guardianContact: string | null;
    dailyStudyMinutes: number | null;
    onboardingState: string | null;
  } | null;
}

export async function getFullProfile(appUserId: string, authUserId: string): Promise<FullProfile> {
  const [appUserResult, rolesResult, studentProfileResult, prismaUser] = await Promise.all([
    pool.query(
      `select au.user_id, au.institution_id, au.email, au.mobile_number, au.full_name, au.member_code,
              au.user_role, au.preferred_language, au.status, au.last_login_at,
              i.institution_id as inst_id, i.name as inst_name, i.institution_code as inst_code
         from core.app_user au
         left join core.institution i on i.institution_id = au.institution_id
        where au.user_id = $1`,
      [appUserId]
    ),
    pool.query(
      `select r.role_code, r.role_name, r.scope_level, ura.institution_id
         from core.user_role_assignment ura
         join core.role r on r.role_id = ura.role_id
        where ura.user_id = $1 and ura.revoked_at is null`,
      [appUserId]
    ),
    pool.query(
      `select target_year, class_level, guardian_contact, daily_study_minutes, onboarding_state
         from core.student_profile where user_id = $1`,
      [appUserId]
    ),
    prisma.user.findUnique({ where: { id: authUserId } }),
  ]);

  const row = appUserResult.rows[0];
  if (!row) throw new AppError(404, "USER_NOT_FOUND", "User not found.");

  const sp = studentProfileResult.rows[0];

  return {
    appUserId: row.user_id,
    authUserId,
    memberCode: row.member_code,
    email: row.email,
    mobileNumber: row.mobile_number,
    fullName: row.full_name,
    preferredLanguage: row.preferred_language,
    status: row.status,
    primaryRole: row.user_role,
    lastLoginAt: row.last_login_at,
    institution: row.inst_id ? { id: row.inst_id, name: row.inst_name, code: row.inst_code } : null,
    roles: rolesResult.rows.map((r) => ({
      code: r.role_code,
      name: r.role_name,
      scopeLevel: r.scope_level,
      institutionId: r.institution_id,
    })),
    targetExam: prismaUser?.targetExam ?? "NEET",
    locale: prismaUser?.locale ?? "en",
    studentProfile: sp
      ? {
          targetYear: sp.target_year,
          classLevel: sp.class_level,
          guardianContact: sp.guardian_contact,
          dailyStudyMinutes: sp.daily_study_minutes,
          onboardingState: sp.onboarding_state,
        }
      : null,
  };
}

// Fields a user may change about themselves. Deliberately excludes (and
// .strict() below rejects any attempt to set): email, appUserId/authUserId,
// status, primaryRole/roles, institution, lastLoginAt — all admin/
// verification-only, per CL-P4's requirement to state this explicitly
// rather than leave it implicit in whatever the SQL happens to touch.
export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(1).max(200).optional(),
    mobileNumber: z.string().trim().min(7).max(20).nullable().optional(),
    preferredLanguage: z.string().trim().max(10).nullable().optional(),
    targetExam: z.enum(["NEET", "JEE"]).optional(),
    studentProfile: z
      .object({
        targetYear: z.number().int().min(2000).max(2100).nullable().optional(),
        classLevel: z.string().trim().max(50).nullable().optional(),
        guardianContact: z.string().trim().max(100).nullable().optional(),
        dailyStudyMinutes: z.number().int().min(0).max(1440).nullable().optional(),
        onboardingState: z.enum(["not_started", "in_progress", "completed"]).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export async function updateProfile(appUserId: string, authUserId: string, patch: UpdateProfileInput): Promise<FullProfile> {
  const appUserSets: string[] = [];
  const appUserValues: unknown[] = [];
  const pushSet = (column: string, value: unknown) => {
    appUserValues.push(value);
    appUserSets.push(`${column} = $${appUserValues.length}`);
  };
  if (patch.fullName !== undefined) pushSet("full_name", patch.fullName);
  if (patch.mobileNumber !== undefined) pushSet("mobile_number", patch.mobileNumber);
  if (patch.preferredLanguage !== undefined) pushSet("preferred_language", patch.preferredLanguage);

  if (appUserSets.length > 0) {
    appUserValues.push(appUserId);
    await pool.query(`update core.app_user set ${appUserSets.join(", ")} where user_id = $${appUserValues.length}`, appUserValues);
  }

  if (patch.targetExam !== undefined) {
    await prisma.user.update({ where: { id: authUserId }, data: { targetExam: patch.targetExam } });
  }

  if (patch.studentProfile !== undefined) {
    const sp = patch.studentProfile;
    await pool.query(
      `insert into core.student_profile (user_id, target_year, class_level, guardian_contact, daily_study_minutes, onboarding_state)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (user_id) do update set
         target_year = coalesce($2, core.student_profile.target_year),
         class_level = coalesce($3, core.student_profile.class_level),
         guardian_contact = coalesce($4, core.student_profile.guardian_contact),
         daily_study_minutes = coalesce($5, core.student_profile.daily_study_minutes),
         onboarding_state = coalesce($6, core.student_profile.onboarding_state)`,
      [
        appUserId,
        sp.targetYear ?? null,
        sp.classLevel ?? null,
        sp.guardianContact ?? null,
        sp.dailyStudyMinutes ?? null,
        sp.onboardingState ?? null,
      ]
    );
  }

  return getFullProfile(appUserId, authUserId);
}
