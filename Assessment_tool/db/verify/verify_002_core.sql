-- verify_002_core.sql
-- Asserts every table and constraint created by db/migrations/002_core.sql
-- exists. A migration is not done until this passes (CLAUDE.md migration rule 3).

do $$
declare
  missing text[] := array[]::text[];
  t text;
  c text;
begin
  foreach t in array array[
    'institution', 'subscription_plan', 'app_user', 'student_profile',
    'educator_profile', 'batch', 'batch_member', 'subscription', 'enrollment'
  ] loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'core' and table_name = t
    ) then
      missing := array_append(missing, 'table:core.' || t);
    end if;
  end loop;

  foreach c in array array[
    'institution_pkey', 'uq_institution_institution_code',
    'subscription_plan_pkey', 'uq_subscription_plan_tier_code',
    'app_user_pkey', 'fk_app_user_institution_id', 'fk_app_user_auth_user_id',
      'uq_app_user_auth_user_id', 'uq_app_user_email',
    'student_profile_pkey', 'fk_student_profile_user_id',
    'educator_profile_pkey', 'fk_educator_profile_user_id',
    'batch_pkey', 'fk_batch_institution_id', 'fk_batch_cycle_id', 'uq_batch_batch_code',
    'pk_batch_member', 'fk_batch_member_batch_id', 'fk_batch_member_user_id',
    'subscription_pkey', 'fk_subscription_user_id', 'fk_subscription_plan_id',
    'enrollment_pkey', 'fk_enrollment_user_id', 'fk_enrollment_cycle_id', 'uq_enrollment_user_id_cycle_id'
  ] loop
    if not exists (
      select 1 from pg_constraint con
      join pg_namespace n on n.oid = con.connamespace
      where n.nspname = 'core' and con.conname = c
    ) then
      missing := array_append(missing, 'constraint:core.' || c);
    end if;
  end loop;

  -- 007_core_mobile_nullable.sql (committed, intentional) dropped
  -- uq_app_user_mobile_number as a plain UNIQUE constraint and replaced it
  -- with a partial unique index of the same name, so it belongs in pg_class
  -- via pg_indexes now, not in pg_constraint.
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'core' and tablename = 'app_user'
      and indexname = 'uq_app_user_mobile_number'
  ) then
    missing := array_append(missing, 'index:core.uq_app_user_mobile_number');
  end if;

  if array_length(missing, 1) is not null then
    raise exception 'verify_002_core FAILED — missing: %', array_to_string(missing, ', ');
  end if;

  raise notice 'verify_002_core: OK — 9 tables, 26 constraints, 1 partial unique index present';
end $$;
