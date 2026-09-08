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
    // LA-UX-REFRESH-001 F2 (migration 048) — where the student studies, what
    // stage/year they are in, and their date of birth.
    institutionKind: string | null;
    institutionName: string | null;
    institutionLocation: string | null;
    studyStage: string | null;
    studyYear: string | null;
    dateOfBirth: string | null;
  } | null;
  // LA-UX-REFRESH-001 F3 — the real plan behind the header's profile bar,
  // which until now rendered a hardcoded "Achiever Pro Plan / Valid till May
  // 2026" for every account regardless of whether one had ever been bought.
  // null means genuinely no subscription row; `status` carries expired/
  // cancelled rows honestly rather than hiding them.
  subscription: {
    subscriptionId: string;
    tierCode: string;
    tierName: string;
    status: string;
    startedOn: string | null;
    expiresOn: string | null;
    isActive: boolean;
  } | null;
}

// LA-UX-REFRESH-001 F3 — "most relevant" subscription for the profile bar:
// an active, unexpired row first (newest start date wins if there are
// several), otherwise the most recent row of any status so an expired or
// cancelled plan is still shown honestly rather than reading as "never
// subscribed". Ordering is done in SQL so the tie-break is deterministic
// rather than dependent on physical row order.
const SUBSCRIPTION_QUERY = `
  select s.subscription_id, s.subscription_status, s.started_on, s.expires_on,
         p.tier_code, p.tier_name,
         (s.subscription_status = 'active'
          and (s.expires_on is null or s.expires_on >= current_date)) as is_active
    from core.subscription s
    join core.subscription_plan p on p.plan_id = s.plan_id
   where s.user_id = $1
   order by (s.subscription_status = 'active'
             and (s.expires_on is null or s.expires_on >= current_date)) desc,
            s.started_on desc nulls last,
            s.expires_on desc nulls last
   limit 1`;

export async function getFullProfile(appUserId: string, authUserId: string): Promise<FullProfile> {
  const [appUserResult, rolesResult, studentProfileResult, subscriptionResult, prismaUser] = await Promise.all([
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
      `select target_year, class_level, guardian_contact, daily_study_minutes, onboarding_state,
              institution_kind, institution_name, institution_location,
              study_stage, study_year, date_of_birth
         from core.student_profile where user_id = $1`,
      [appUserId]
    ),
    pool.query(SUBSCRIPTION_QUERY, [appUserId]),
    prisma.user.findUnique({ where: { id: authUserId } }),
  ]);

  const row = appUserResult.rows[0];
  if (!row) throw new AppError(404, "USER_NOT_FOUND", "User not found.");

  const sp = studentProfileResult.rows[0];
  const sub = subscriptionResult.rows[0];

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
          institutionKind: sp.institution_kind,
          institutionName: sp.institution_name,
          institutionLocation: sp.institution_location,
          studyStage: sp.study_stage,
          studyYear: sp.study_year,
          // date, not timestamptz — serialised as plain YYYY-MM-DD so a
          // browser in any timezone renders the same birthday the student
          // typed. node-postgres hands back a JS Date for `date`, so the
          // conversion is done here rather than left to JSON.stringify's
          // UTC-shifting toISOString().
          dateOfBirth: toDateOnly(sp.date_of_birth),
        }
      : null,
    subscription: sub
      ? {
          subscriptionId: sub.subscription_id,
          tierCode: sub.tier_code,
          tierName: sub.tier_name,
          status: sub.subscription_status,
          startedOn: toDateOnly(sub.started_on),
          expiresOn: toDateOnly(sub.expires_on),
          isActive: sub.is_active === true,
        }
      : null,
  };
}

// A Postgres `date` has no time and no zone. node-postgres parses it into a
// JS Date at local midnight, and JSON.stringify would then emit a UTC instant
// that is the previous day for anyone east of UTC — turning a birthday into
// the day before it. Formatting from the local components avoids that.
function toDateOnly(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
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
        // LA-UX-REFRESH-001 F2. The two enums mirror migration 048's CHECK
        // constraints exactly — validated here so a bad value is a 400 with a
        // field name rather than a raw Postgres constraint violation.
        institutionKind: z
          .enum(["school", "college", "university", "coaching_centre", "other"])
          .nullable()
          .optional(),
        institutionName: z.string().trim().max(200).nullable().optional(),
        institutionLocation: z.string().trim().max(200).nullable().optional(),
        studyStage: z
          .enum(["secondary", "higher_secondary", "undergraduate", "postgraduate", "dropper", "other"])
          .nullable()
          .optional(),
        studyYear: z.string().trim().max(100).nullable().optional(),
        // Plain YYYY-MM-DD, the same shape getFullProfile returns — not a
        // full ISO timestamp, which would reintroduce the timezone shift
        // toDateOnly() exists to avoid.
        dateOfBirth: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be YYYY-MM-DD")
          .nullable()
          .optional(),
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
      `insert into core.student_profile (
         user_id, target_year, class_level, guardian_contact, daily_study_minutes, onboarding_state,
         institution_kind, institution_name, institution_location, study_stage, study_year, date_of_birth)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       on conflict (user_id) do update set
         target_year = coalesce($2, core.student_profile.target_year),
         class_level = coalesce($3, core.student_profile.class_level),
         guardian_contact = coalesce($4, core.student_profile.guardian_contact),
         daily_study_minutes = coalesce($5, core.student_profile.daily_study_minutes),
         onboarding_state = coalesce($6, core.student_profile.onboarding_state),
         institution_kind = coalesce($7, core.student_profile.institution_kind),
         institution_name = coalesce($8, core.student_profile.institution_name),
         institution_location = coalesce($9, core.student_profile.institution_location),
         study_stage = coalesce($10, core.student_profile.study_stage),
         study_year = coalesce($11, core.student_profile.study_year),
         date_of_birth = coalesce($12, core.student_profile.date_of_birth)`,
      [
        appUserId,
        sp.targetYear ?? null,
        sp.classLevel ?? null,
        sp.guardianContact ?? null,
        sp.dailyStudyMinutes ?? null,
        sp.onboardingState ?? null,
        sp.institutionKind ?? null,
        sp.institutionName ?? null,
        sp.institutionLocation ?? null,
        sp.studyStage ?? null,
        sp.studyYear ?? null,
        sp.dateOfBirth ?? null,
      ]
    );
  }

  await syncOnboardingState(appUserId);

  return getFullProfile(appUserId, authUserId);
}

// LA-UX-REFRESH-001 F3 — "automatic onboarding updation if the user has
// subscribed for any plan."
//
// Onboarding was a dropdown the student set by hand, which is not a decision
// a student should be making about themselves. It is now derived: a user who
// holds an active, unexpired subscription AND has filled in the profile
// fields the rest of the app depends on (target year + class level) is
// onboarded, full stop.
//
// Deliberately one-directional — it only ever promotes to 'completed', never
// demotes. A plan lapsing does not un-onboard someone who has been using the
// app for months, and an admin who set 'completed' by hand is not overridden
// by a missing field. The `is distinct from` guard also makes this a no-op
// write when nothing changes.
export async function syncOnboardingState(appUserId: string): Promise<void> {
  await pool.query(
    `update core.student_profile sp
        set onboarding_state = 'completed'
      where sp.user_id = $1
        and sp.onboarding_state is distinct from 'completed'
        and sp.target_year is not null
        and sp.class_level is not null
        and exists (
          select 1
            from core.subscription s
           where s.user_id = $1
             and s.subscription_status = 'active'
             and (s.expires_on is null or s.expires_on >= current_date)
        )`,
    [appUserId]
  );
}
