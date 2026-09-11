-- 014_core_status_expansion.sql
-- LA-BE-CORE-002 CL-P7 precondition (DC-7). Live survey before writing this:
-- core.app_user.status currently holds only 'active' (all rows) — no row
-- uses 'suspended' or 'deleted', so widening the CHECK cannot fail against
-- live data.
--
-- ck_app_user_status (012_domain_checks.sql) allowed only
-- ('active','suspended','deleted') — three of the five states section 5 of
-- LA-BE-CORE-002 names (awaiting_verification, active, suspended, locked,
-- deactivated). Adding the missing two. Not renaming 'deleted' to
-- 'deactivated': it is already this project's word for the same
-- soft-deactivation concept CL-P7's own database-conformance rule requires
-- ("deletion is not implemented... users are deactivated") — no row is ever
-- hard-deleted through this value, and renaming a live enum value for a
-- pilot with real accounts already using it is churn with no behavioural
-- upside. Recorded here so the vocabulary mismatch is a documented decision,
-- not a silent inconsistency.
do $$
begin
  raise notice 'before-survey: app_user.status = %', (select string_agg(distinct status, ',') from core.app_user);
end $$;

alter table core.app_user drop constraint ck_app_user_status;
alter table core.app_user add constraint ck_app_user_status
  check (status in ('awaiting_verification', 'active', 'suspended', 'locked', 'deleted'));
