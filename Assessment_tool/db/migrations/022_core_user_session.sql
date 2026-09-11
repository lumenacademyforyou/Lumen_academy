-- 022_core_user_session.sql
-- LA-APP-COMPLETION-001 Phase E (session management + auto logout).
--
-- Supabase Auth issues and verifies the bearer token itself
-- (backend/src/middleware/requireAuth.ts delegates to auth.getUser) — it has
-- no concept of *this app's* idle-timeout / absolute-session-cap policy, and
-- no local table existed before this migration to enforce one (confirmed:
-- grepped db/migrations/*.sql and prisma/schema.prisma for
-- session/refresh_token/auth_session/user_session — nothing). This table is
-- that policy layer, kept keyed by the Supabase JWT's own `session_id` claim
-- (stable across access-token refresh within one login, changes only on a
-- genuinely new sign-in) rather than by the access token itself, so a
-- background token refresh never looks like a brand-new session.
--
-- One row per (login) session, not per user: a user signed in on two devices
-- gets two rows, each independently idle/absolute-timed and independently
-- revocable — deliberately not a single per-user row, which would let one
-- device's activity keep a different device's session alive.

create table if not exists core.user_session (
  session_id           uuid primary key,
  user_id              uuid not null,
  issued_at            timestamptz not null default now(),
  last_activity_at     timestamptz not null default now(),
  absolute_expires_at  timestamptz not null,
  revoked_at           timestamptz,
  revoked_reason       text,
  constraint fk_user_session_user_id foreign key (user_id) references core.app_user (user_id)
);

create index if not exists ix_user_session_user_id on core.user_session (user_id);
-- Hot path (every authenticated request checks its own session_id, which is
-- already the primary key, so no extra index needed there); this one backs
-- "list a user's active sessions" (e.g. a future admin/force-logout view).
create index if not exists ix_user_session_user_id_active on core.user_session (user_id) where revoked_at is null;

insert into util.applied_migration (migration_name) values ('022_core_user_session')
on conflict (migration_name) do nothing;
