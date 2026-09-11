-- verify_007_core_mobile_nullable.sql

do $$
declare
  missing text[] := array[]::text[];
  is_nullable text;
begin
  select c.is_nullable into is_nullable
    from information_schema.columns c
   where c.table_schema = 'core' and c.table_name = 'app_user' and c.column_name = 'mobile_number';

  if is_nullable is distinct from 'YES' then
    missing := array_append(missing, 'core.app_user.mobile_number is still NOT NULL');
  end if;

  if not exists (
    select 1 from pg_indexes
     where schemaname = 'core' and tablename = 'app_user' and indexname = 'uq_app_user_mobile_number'
  ) then
    missing := array_append(missing, 'index:core.uq_app_user_mobile_number');
  end if;

  if exists (
    select 1 from pg_constraint con
    join pg_namespace n on n.oid = con.connamespace
    where n.nspname = 'core' and con.conname = 'uq_app_user_mobile_number' and con.contype = 'u'
  ) then
    missing := array_append(missing, 'old plain UNIQUE constraint uq_app_user_mobile_number still present (should be the partial index now)');
  end if;

  if array_length(missing, 1) is not null then
    raise exception 'verify_007_core_mobile_nullable FAILED — missing: %', array_to_string(missing, ', ');
  end if;

  raise notice 'verify_007_core_mobile_nullable: OK — mobile_number nullable, partial unique index present';
end $$;
