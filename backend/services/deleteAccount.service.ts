import { pool } from "../../db/shared/pool.js";
import { supabaseAuth } from "../supabaseClient.js";
import { getSupabaseAdmin } from "../supabaseAdmin.js";
import { AppError } from "../middleware/errorHandler.js";

// A destructive, irreversible action needs proof the caller is still
// actually the account owner right now, not just holding a still-valid
// session from whenever they last signed in. Supabase's own reauthenticate()
// API is wired specifically for password updates (its nonce only plugs into
// updateUser()), so this reuses the email-OTP sign-in flow already built for
// registration (frontend/lib/supabaseAuth.ts's sendEmailOtp/verifyEmailOtp)
// as the reauthentication step instead: verifying that OTP mints a fresh
// session whose JWT carries an amr entry of {method: "otp", timestamp}
// (confirmed against the real GoTrue server, not assumed — see the amr
// check run while building this). Requiring the most recent amr entry to be
// both otp-verified and within the last 10 minutes is what actually gates
// deletion; requireAuth already proves the token is valid for this user, but
// says nothing about *how recently* they proved it.
const REAUTH_WINDOW_SECONDS = 10 * 60;

export async function requireRecentOtpReauthentication(accessToken: string): Promise<void> {
  const { data, error } = await supabaseAuth.auth.getClaims(accessToken);
  if (error || !data) {
    throw new AppError(401, "UNAUTHORIZED", "Could not verify your session.");
  }

  const amr = data.claims.amr ?? [];
  const latest = [...amr]
    .filter((entry): entry is { method: string; timestamp: number } => typeof entry === "object" && entry !== null)
    .sort((a, b) => b.timestamp - a.timestamp)[0];

  const nowSeconds = Date.now() / 1000;
  const isRecentOtp = !!latest && latest.method === "otp" && nowSeconds - latest.timestamp < REAUTH_WINDOW_SECONDS;

  if (!isRecentOtp) {
    throw new AppError(
      403,
      "REAUTH_REQUIRED",
      "Please verify the code we emailed you before deleting your account."
    );
  }
}

const BLOCKING_ERROR = new AppError(
  409,
  "ACCOUNT_HAS_HISTORY",
  "Your account has activity on record (e.g. a completed test history, authored content, or a role in inviting/reviewing others) that can't be deleted automatically. Please contact support to finish deleting your account."
);

// Every foreign key that points at core.app_user or public.users, found by
// querying pg_catalog directly against the live schema rather than trusting
// information_schema (a first pass over information_schema silently missed
// every cross-schema FK — e.g. learn.audit_log -> core.app_user — because it
// joined constraint_column_usage on "same schema as the constraint", which
// doesn't hold across schemas. pg_catalog has no such gap.
//
// Two categories fell out of that query:
// - Tables holding the user's own data (progress, notifications, profile
//   extensions, error/audit noise): deleted outright below.
// - Tables where this user is only an *author/actor* referenced by a NOT
//   NULL column other people's rows depend on (who created a test, imported
//   content, reviewed a question, invited another user) or their own
//   completed-attempt history (public.test_attempts / assess.attempt,
//   RESTRICT and NO ACTION respectively): none of those columns are
//   nullable, so there is no safe automatic action — self-deletion is
//   blocked with a clear error instead of either crashing on a NOT NULL
//   violation or silently reassigning someone else's data's authorship.
// idKind matters: public.test_attempts.user_id references public.users.id
// (authUserId) while every other table here references core.app_user.user_id
// (appUserId) — the two are different uuids for the same person, and mixing
// them up silently checks the wrong column's worth of rows (found by
// actually running this: it first threw a raw FK-violation 500 instead of
// the intended 409, because the query ran with the wrong id).
const BLOCKING_TABLES: { schema: string; table: string; column: string; idKind: "auth" | "app" }[] = [
  { schema: "public", table: "test_attempts", column: "user_id", idKind: "auth" },
  { schema: "assess", table: "attempt", column: "user_id", idKind: "app" },
  { schema: "assess", table: "test", column: "created_by", idKind: "app" },
  { schema: "content", table: "ai_generation_job", column: "requested_by", idKind: "app" },
  { schema: "content", table: "import_batch", column: "submitted_by", idKind: "app" },
  { schema: "content", table: "question_review", column: "reviewer_user_id", idKind: "app" },
  { schema: "core", table: "invitation", column: "invited_by", idKind: "app" },
];

// Deletes the caller's own identity across every schema that references it.
// Scoped entirely to the authenticated caller's own ids — there is no path
// here for one user to delete another's account.
export async function deleteOwnAccount(authUserId: string, appUserId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("begin");

    for (const { schema, table, column, idKind } of BLOCKING_TABLES) {
      const id = idKind === "auth" ? authUserId : appUserId;
      const res = await client.query(`select 1 from ${schema}.${table} where ${column} = $1 limit 1`, [id]);
      if (res.rowCount) {
        await client.query("rollback");
        throw BLOCKING_ERROR;
      }
    }

    // The user's own data — safe to delete along with their account.
    await client.query("delete from learn.flashcard where user_id = $1", [appUserId]);
    await client.query("delete from learn.study_plan where user_id = $1", [appUserId]);
    await client.query("delete from learn.study_session where user_id = $1", [appUserId]);
    await client.query("delete from learn.topic_mastery where user_id = $1", [appUserId]);
    await client.query("delete from learn.notification where user_id = $1", [appUserId]);
    await client.query("delete from learn.error_log where user_id = $1", [appUserId]);
    await client.query("delete from assess.test_assignment where user_id = $1", [appUserId]);
    await client.query("delete from core.batch_member where user_id = $1", [appUserId]);
    await client.query("delete from core.educator_profile where user_id = $1", [appUserId]);
    await client.query("delete from core.enrollment where user_id = $1", [appUserId]);
    await client.query("delete from core.subscription where user_id = $1", [appUserId]);
    await client.query("delete from core.student_profile where user_id = $1", [appUserId]);

    // The audit trail survives the actor being deleted — detached, not
    // deleted (actor_user_id is nullable; every column in BLOCKING_TABLES
    // above is not, which is exactly why those are blocked instead).
    await client.query("update learn.audit_log set actor_user_id = null where actor_user_id = $1", [appUserId]);

    // user_role_assignment isn't touched here — it CASCADEs on
    // core.app_user and SET NULLs its own granted_by, both already declared
    // on the table.
    await client.query("delete from core.app_user where user_id = $1", [appUserId]);
    await client.query("delete from public.users where id = $1", [authUserId]);

    await client.query("commit");
  } catch (err) {
    if (err !== BLOCKING_ERROR) {
      await client.query("rollback");
    }
    throw err;
  } finally {
    client.release();
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.admin.deleteUser(authUserId);
  if (error) {
    throw new AppError(
      500,
      "AUTH_DELETE_FAILED",
      "Your account data was removed, but signing you out fully failed. Please contact support."
    );
  }
}
