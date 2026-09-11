-- verify_021_attempt_response_question_unique.sql

do $$
begin
  if not exists (select 1 from pg_indexes where schemaname='assess' and indexname='ux_attempt_response_attempt_question') then
    raise exception 'verify_021 FAILED — missing index:ux_attempt_response_attempt_question';
  end if;
  raise notice 'verify_021_attempt_response_question_unique: OK';
end $$;
