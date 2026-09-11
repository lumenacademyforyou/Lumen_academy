-- 017_core_member_code.sql
-- Human-readable member/roll number for every user entity, requested
-- directly by the user: "LA" + the first two letters of the person's name
-- + a 6-digit number, e.g. LAPR384920 for "Prince". Lives on core.app_user
-- because that is the one table every role (student, educator,
-- institution_admin, platform_admin, super_admin) already shares — "every
-- user entity" is satisfied by putting it there once, not per-role.
--
-- Nullable at the schema level (existing rows, if any survive a future
-- session without going through provisioning, won't violate a NOT NULL
-- constraint) but enforced unique — generation and collision retry live in
-- backend/services/provisionUser.service.ts, not in SQL, since it needs the
-- person's name, which is a provisioning-time input, not something a
-- migration has access to.
alter table core.app_user add column member_code text;
alter table core.app_user add constraint uq_app_user_member_code unique (member_code);
