-- verify_016_core_rls_lockdown.sql

do $$
declare
  missing text[] := array[]::text[];
  t record;
begin
  for t in
    select schemaname, tablename
      from pg_tables
     where schemaname in ('core', 'catalog', 'content', 'assess', 'learn')
  loop
    if not exists (
      select 1 from pg_tables
       where schemaname = t.schemaname and tablename = t.tablename and rowsecurity = true
    ) then
      missing := array_append(missing, t.schemaname || '.' || t.tablename);
    end if;
  end loop;

  if array_length(missing, 1) is not null then
    raise exception 'verify_016 FAILED — RLS still disabled on: %', array_to_string(missing, ', ');
  end if;
  raise notice 'verify_016: OK — RLS enabled on every table across core/catalog/content/assess/learn';
end $$;

-- Functional proof: the backend's own role (postgres, bypassrls) must still
-- see rows normally — RLS-enabled-with-zero-policies only blocks roles
-- WITHOUT bypassrls, so this confirms the fix doesn't also lock out the
-- backend by mistake.
do $$
declare
  can_bypass boolean;
  row_count int;
begin
  select rolbypassrls into can_bypass from pg_roles where rolname = current_user;
  if not can_bypass then
    raise exception 'verify_016 FAILED — the role running this script (%) does not have BYPASSRLS; cannot confirm the backend is unaffected from here', current_user;
  end if;

  select count(*) into row_count from core.app_user;
  raise notice 'verify_016: OK — current role (%) has BYPASSRLS and can still read core.app_user (% rows) — the backend is unaffected', current_user, row_count;
end $$;
