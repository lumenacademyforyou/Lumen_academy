-- 007_core_mobile_nullable.sql
-- Lumen Academy — relax core.app_user.mobile_number to nullable.
--
-- Reason: mobile_number was built NOT NULL + UNIQUE per the low-level ER's AK
-- listing, but real Supabase Auth signups are commonly email-only (no phone
-- collected) — confirmed hitting this live while lazily provisioning
-- core.app_user for a real authenticated user (see backend/middleware/
-- requireAuth.ts's ensureAppUser). A NOT NULL AK that real signups can't
-- satisfy blocks account creation entirely, so this is a genuine correction,
-- not a loosening of an invariant that matters — confirmed with the user
-- before making it (per CLAUDE.md: "if real data contradicts the schema,
-- stop and report — do not loosen the schema silently").
--
-- Drops uq_app_user_mobile_number (a plain UNIQUE, which rejects multiple
-- NULLs under NOT NULL removal is fine, but Postgres UNIQUE already treats
-- NULL as distinct from NULL — the actual reason for the drop+recreate is
-- switching to an explicit partial index so the intent is documented, not a
-- workaround for different behavior) and replaces it with a partial unique
-- index: uniqueness still enforced whenever a phone number IS given.

alter table core.app_user
  alter column mobile_number drop not null;

alter table core.app_user
  drop constraint if exists uq_app_user_mobile_number;

create unique index if not exists uq_app_user_mobile_number
  on core.app_user (mobile_number)
  where mobile_number is not null;
