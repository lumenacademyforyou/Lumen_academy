-- verify_019_attempt_generation_seed.sql

do $$
declare
  missing text[] := array[]::text[];
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'assess' and table_name = 'attempt' and column_name = 'generation_seed'
  ) then
    missing := array_append(missing, 'column:assess.attempt.generation_seed');
  end if;
  if not exists (select 1 from util.applied_migration where migration_name = '019_attempt_generation_seed') then
    missing := array_append(missing, 'ledger:019_attempt_generation_seed not recorded');
  end if;

  if array_length(missing, 1) is not null then
    raise exception 'verify_019_attempt_generation_seed FAILED — missing: %', array_to_string(missing, ', ');
  end if;

  raise notice 'verify_019_attempt_generation_seed: OK — assess.attempt.generation_seed present, ledger updated';
end $$;
