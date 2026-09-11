-- verify_023_analytics_indexes.sql

do $$
begin
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'assess' and indexname = 'ix_attempt_user_submitted_scored'
  ) then
    raise exception 'verify_023 FAILED — missing index: ix_attempt_user_submitted_scored';
  end if;
  raise notice 'verify_023_analytics_indexes: OK';
end $$;
