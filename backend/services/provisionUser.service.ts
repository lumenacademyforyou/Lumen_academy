import { prisma } from "../db.js";
import type { SupabaseAccessTokenPayload, UserProfile } from "./userProfile.service.js";

export interface ProvisionedUser {
  profile: UserProfile;
  appUserId: string;
}

function toProfile(user: {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string;
  role: string;
  locale: string;
  targetExam: string;
}): UserProfile {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    displayName: user.displayName,
    role: user.role,
    locale: user.locale,
    targetExam: user.targetExam,
  };
}

// Reads only — safe to run in parallel, unlike the writes below. True on
// every request after an identity's first (the overwhelmingly common case).
async function readExisting(authUserId: string): Promise<ProvisionedUser | null> {
  const [profile, appUserRows] = await Promise.all([
    prisma.user.findUnique({ where: { id: authUserId } }),
    prisma.$queryRaw<{ user_id: string }[]>`select user_id from core.app_user where auth_user_id = ${authUserId}::uuid`,
  ]);
  if (profile && appUserRows[0]) {
    return { profile: toProfile(profile), appUserId: appUserRows[0].user_id };
  }
  return null;
}

// Provisions the canonical identity for a verified Supabase Auth user,
// atomically, across both live schema tracks (LA-BE-CORE-002 CL-P3).
//
// Two tables, one transaction. public.users is Prisma's model — test
// attempts, bookmarks, ai_usage and other content/assessment-layer tables
// still FK to it, so it is not this phase's call to retire (LA-BE-CORE-002
// ground rule 6: that surface belongs to other engineers). core.app_user is
// the RBAC/tenancy/status model the rest of this document is built on.
// Previously these were two independent, non-transactional writes
// (userProfile.service.ts's ensureUserProfile and
// db/core/institution/app_user/ensure-app-user.ts's ensureAppUser, fired via
// Promise.all in requireAuth.ts): if one succeeded and the other failed, the
// identity was left half-provisioned with no way to detect or repair it.
// Both inserts now run through Prisma's own transaction so they share one
// connection — either both commit or neither does. This is why the
// core.app_user write is raw SQL run via tx.$queryRaw rather than
// db/core/institution/app_user/app_user.repository.ts's normal
// appUserRepository.create(): that repository opens its own connection from
// db/shared/pool.ts, which cannot participate in Prisma's transaction, and a
// second connection is exactly what atomicity here requires there not be.
//
// Idempotent under concurrent calls without any application-level locking —
// but this took an actual concurrency test against the real database to get
// right, not just reasoning about it (LA-BE-CORE-002 ground rule 3): the
// first version of this function called tx.user.upsert() for public.users,
// which is Prisma's check-then-write upsert, not a single atomic statement.
// Firing provisionCanonicalUser() twice at once for a brand-new identity had
// both calls see "no existing row" and both attempt to create one; the
// second create lost to the row the first had just committed and crashed
// with a raw Postgres unique-violation instead of returning the existing
// row. (The function this replaced, ensureUserProfile, called the exact
// same tx.user.upsert() shape non-transactionally — it had this same latent
// race, undiscovered until this test.) The public.users write below is
// therefore raw SQL with a real ON CONFLICT clause too, exactly like
// core.app_user's — that is what actually serializes two concurrent inserts
// at the database and guarantees one row, not two.
//
// Self-registration produces a student by default, but the same first
// authenticated request is also how an *invited* user's role is actually
// applied (CL-P6): Supabase's admin.inviteUserByEmail() only creates the
// auth.users row and sends the email — it has no way to also write
// core.app_user/core.user_role_assignment, so this function checks for a
// matching pending, unexpired core.invitation by email and, if found,
// provisions with that role and institution instead of the 'student'
// default, marking the invitation accepted in the same transaction. See
// backend/services/invitation.service.ts.
export async function provisionCanonicalUser(payload: SupabaseAccessTokenPayload): Promise<ProvisionedUser> {
  const existing = await readExisting(payload.sub);
  if (existing) return existing;

  // Supabase's JS SDK returns "" (not null/undefined) for an unset optional
  // field like phone on a real user object — matches the fallback logic the
  // two functions this replaces already used.
  const email = payload.email || null;
  const phone = payload.phone || null;
  const displayName =
    (payload.user_metadata?.display_name as string | undefined) ||
    (payload.user_metadata?.full_name as string | undefined) ||
    email?.split("@")[0] ||
    phone ||
    "Student";

  try {
    return await runProvisioningTransaction(payload, email, phone, displayName);
  } catch (err) {
    // A concurrent call can lose a genuine database-level race on a unique
    // constraint that isn't the one named in this transaction's ON CONFLICT
    // clauses — found live, testing this: public.users.email and
    // core.app_user.email are each independently unique, and Postgres only
    // suppresses a conflict for the specific constraint an ON CONFLICT
    // clause names (here, id / auth_user_id). Two truly concurrent inserts
    // for the same identity can still raise a raw "duplicate key" error on
    // the *email* constraint instead of taking the ON CONFLICT branch.
    // Rather than enumerate every unique constraint on both tables in the
    // SQL, the loser here just re-reads: by the time this error surfaces,
    // the winning transaction has committed, so the row now exists.
    const existingAfterRace = await readExisting(payload.sub);
    if (existingAfterRace) return existingAfterRace;
    throw err;
  }
}

// LA + the first two letters of the person's name (uppercased, non-letters
// stripped, padded with 'X' if the name can't supply two letters) + a
// random 6-digit number, e.g. LAPR384920 for "Prince" — the human-readable
// member/roll-number requested for every user entity. Built here rather
// than in SQL because it needs displayName, a provisioning-time input a
// migration has no access to (see 017_core_member_code.sql).
function buildMemberCodeCandidate(displayName: string): string {
  const letters = (displayName.toUpperCase().match(/[A-Z]/g) ?? []).join("").padEnd(2, "X").slice(0, 2);
  const digits = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  return `LA${letters}${digits}`;
}

async function runProvisioningTransaction(
  payload: SupabaseAccessTokenPayload,
  email: string | null,
  phone: string | null,
  displayName: string
): Promise<ProvisionedUser> {
  return prisma.$transaction(async (tx) => {
    // Collision space is 1,000,000 numbers per 2-letter prefix — a
    // pre-insert existence check inside this same transaction, rather than
    // catch-and-retry on the unique constraint, since Prisma's $queryRaw
    // wraps the underlying Postgres error code in ways not worth depending
    // on. Only spent on identities not already handled by
    // provisionCanonicalUser's readExisting() pre-check, i.e. effectively
    // once per brand-new signup.
    let memberCode: string | null = null;
    for (let attempt = 0; attempt < 20 && memberCode === null; attempt++) {
      const candidate = buildMemberCodeCandidate(displayName);
      const clash = await tx.$queryRaw<{ user_id: string }[]>`
        select user_id from core.app_user where member_code = ${candidate} limit 1
      `;
      if (clash.length === 0) memberCode = candidate;
    }
    if (memberCode === null) throw new Error("Could not generate a unique member code after 20 attempts");

    // Highest-authority pending, unexpired invitation for this email, if
    // any. Ordering by core.role's own hierarchy (mirrors
    // trg_sync_app_user_role's CASE in 009_core_rbac.sql / ROLE_RANK in
    // backend/lib/permissions.ts) rather than just "most recent", in case
    // someone somehow holds two different pending invitations at once.
    const invitationRows = await tx.$queryRaw<{ invitation_id: string; role_code: string; institution_id: string | null }[]>`
      select invitation_id, role_code, institution_id
        from core.invitation
       where lower(email) = lower(${email})
         and status = 'pending'
         and expires_at > now()
       order by case role_code
         when 'super_admin' then 1 when 'platform_admin' then 2
         when 'content_admin' then 3 when 'institution_admin' then 4
         when 'content_reviewer' then 5 when 'educator' then 6
         when 'student' then 7 when 'system' then 8 else 9 end
       limit 1
    `;
    const invitation = invitationRows[0] ?? null;
    const roleCode = invitation?.role_code ?? "student";
    const institutionId = invitation?.institution_id ?? null;

    // created_at/updated_at set explicitly, not left to a DB default: found
    // live, testing this — schema.prisma's @updatedAt is a Prisma-client-side
    // behaviour (the query engine stamps it on every write Prisma itself
    // issues), not a real column DEFAULT, so a raw INSERT that bypasses the
    // engine hits updated_at's NOT NULL constraint if it's omitted.
    const userRows = await tx.$queryRaw<
      { id: string; email: string | null; phone: string | null; displayName: string; role: string; locale: string; targetExam: string }[]
    >`
      insert into public.users (id, email, phone, display_name, created_at, updated_at)
      values (${payload.sub}::uuid, ${email}, ${phone}, ${displayName}, now(), now())
      on conflict (id) do update set id = excluded.id
      returning id, email, phone, display_name as "displayName", role, locale, target_exam as "targetExam"
    `;
    const user = userRows[0];

    // core.app_user.email is still NOT NULL — a phone-only signup (no email
    // at all) fails this insert with a constraint error rather than a fake
    // email being invented. Inherited unchanged from ensure-app-user.ts;
    // phone sign-in is unimplemented in the frontend today anyway (CL-P0/
    // CL-P2 findings), so this has never been hit in practice.
    // xmax = 0 is the standard Postgres idiom for "this row was just
    // inserted by this statement" versus "this statement hit ON CONFLICT and
    // touched an existing row" (xmax gets set to the updating transaction's
    // id on the conflict path, stays 0 on a fresh insert). Needed because
    // testing this against two real concurrent calls showed the audit insert
    // below firing once per call rather than once per identity — both calls
    // got a row back from RETURNING regardless of which one actually
    // inserted it, so without this check both wrote an audit row.
    const appUserRows = await tx.$queryRaw<{ user_id: string; wasInserted: boolean }[]>`
      insert into core.app_user (auth_user_id, email, mobile_number, full_name, user_role, status, institution_id, member_code)
      values (${payload.sub}::uuid, ${email}, ${phone}, ${displayName}, ${roleCode}, 'active', ${institutionId}::uuid, ${memberCode})
      on conflict (auth_user_id) do update set auth_user_id = excluded.auth_user_id
      returning user_id, (xmax = 0) as "wasInserted"
    `;
    const appUserId = appUserRows[0].user_id;

    if (appUserRows[0].wasInserted) {
      // Grants the resolved role via the real assignment table, not just
      // the denormalized core.app_user.user_role column — CL-P6's
      // requirePermission middleware reads user_role_assignment exclusively
      // (matching 009_core_rbac.sql's own stated intent), so a user
      // provisioned without a row here would pass every permission check
      // that self-registration is supposed to satisfy but fail every other
      // one, with no way to tell why.
      await tx.$executeRaw`
        insert into core.user_role_assignment (user_id, role_id, institution_id, granted_by, granted_at)
        select ${appUserId}::uuid, role_id, ${institutionId}::uuid, ${appUserId}::uuid, now()
          from core.role where role_code = ${roleCode}
      `;

      if (invitation) {
        await tx.$executeRaw`
          update core.invitation set status = 'accepted', accepted_at = now() where invitation_id = ${invitation.invitation_id}::uuid
        `;
      }

      await tx.$executeRaw`
        insert into learn.audit_log (actor_user_id, actor_type, action_name, entity_name, entity_key, change_payload, occurred_at)
        values (
          ${appUserId}::uuid,
          'user',
          'user_provisioned',
          'core.app_user',
          ${appUserId}::text,
          jsonb_build_object('auth_user_id', ${payload.sub}::text, 'email', ${email}::text, 'role_code', ${roleCode}::text, 'via_invitation', ${invitation !== null}::boolean),
          now()
        )
      `;

      // A real, honest first notification tied to the actual signup event —
      // not fabricated history. Gives NotificationBell.tsx something genuine
      // to show a brand-new user rather than an empty "you're all caught up"
      // on the very first load.
      await tx.$executeRaw`
        insert into learn.notification (user_id, channel, template_key, payload, sent_at)
        values (
          ${appUserId}::uuid,
          'in_app',
          'welcome',
          jsonb_build_object('title', 'Welcome to Lumen Academy!', 'body', 'Your account is ready. Take your first mock test to unlock your scorecard and a personalised prep plan.'),
          now()
        )
      `;
    }

    return { profile: toProfile(user), appUserId };
  });
}
