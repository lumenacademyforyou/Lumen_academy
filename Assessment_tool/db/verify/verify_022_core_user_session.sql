-- verify_022_core_user_session.sql

do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema='core' and table_name='user_session') then
    raise exception 'verify_022 FAILED — missing table: core.user_session';
  end if;
  if not exists (select 1 from pg_indexes where schemaname='core' and indexname='ix_user_session_user_id') then
    raise exception 'verify_022 FAILED — missing index: ix_user_session_user_id';
  end if;
  if not exists (
    select 1 from information_schema.table_constraints
     where table_schema='core' and table_name='user_session' and constraint_name='fk_user_session_user_id'
  ) then
    raise exception 'verify_022 FAILED — missing fk: fk_user_session_user_id';
  end if;
  raise notice 'verify_022_core_user_session: OK';
end $$;
