-- 015_core_invitation.sql
-- LA-BE-CORE-002 CL-P6 task 5. Every user type that cannot self-register
-- (platform_admin, institution_admin, educator) needs an invitation record;
-- self-registration (student) never touches this table.
--
-- Delivery reuses Supabase Auth's own admin.inviteUserByEmail() rather than
-- a second custom email path — it creates the auth.users row and sends
-- GoTrue's built-in "Invite user" template through the same email service
-- (and the same two-per-hour project quota) CL-P2 already had to respect.
-- That call is link-based, not code-based like CL-P2's Mechanism A: the
-- person accepting an invitation was never at the app with a tab open
-- before being invited, so S-2's "return to the tab you registered from"
-- problem — the reason Mechanism A exists — does not apply here. There is
-- deliberately no token/code column on this table; core.invitation only
-- records *what role/institution the person should get*, matched by email
-- once they complete Supabase's own invite-acceptance flow. See
-- backend/services/invitation.service.ts and
-- backend/services/provisionUser.service.ts.
--
-- invited_auth_user_id is populated right after inviteUserByEmail() creates
-- the row, specifically so revocation can call admin.deleteUser() and
-- actually stop the already-sent link from working — a status of 'revoked'
-- on this table alone would be metadata only; the person could still click
-- the email they already received.
create table core.invitation (
  invitation_id           uuid primary key default gen_random_uuid(),
  email                   text not null,
  role_code               text not null,
  institution_id          uuid,
  invited_by              uuid not null,
  invited_auth_user_id    uuid,
  status                  text not null default 'pending',
  created_at              timestamptz not null default now(),
  expires_at              timestamptz not null,
  accepted_at             timestamptz,
  revoked_at              timestamptz,
  resend_count            smallint not null default 0,
  last_sent_at            timestamptz not null default now(),
  constraint fk_invitation_role foreign key (role_code) references core.role (role_code),
  constraint fk_invitation_institution foreign key (institution_id) references core.institution (institution_id),
  constraint fk_invitation_invited_by foreign key (invited_by) references core.app_user (user_id),
  constraint ck_invitation_status check (status in ('pending', 'accepted', 'expired', 'revoked'))
);

-- One pending invitation per (email, role) at a time — a second create for
-- the same email+role while one is already pending must revoke or wait, not
-- silently produce a duplicate the resend-limit logic can't see as related.
create unique index uq_invitation_pending_email_role
  on core.invitation (lower(email), role_code)
  where status = 'pending';

create index ix_invitation_email on core.invitation (lower(email));
