-- verify_048_student_profile_details.sql

do $$
declare
  missing text[] := array[]::text[];
  expected_columns text[] := array[
    'institution_kind', 'institution_name', 'institution_location',
    'study_stage', 'study_year', 'date_of_birth'
  ];
  expected_constraints text[] := array[
    'ck_student_profile_institution_kind',
    'ck_student_profile_study_stage',
    'ck_student_profile_date_of_birth'
  ];
  c text;
begin
  foreach c in array expected_columns loop
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'core' and table_name = 'student_profile' and column_name = c
    ) then
      missing := array_append(missing, 'column:' || c);
    end if;
  end loop;

  foreach c in array expected_constraints loop
    if not exists (select 1 from pg_constraint con where con.conname = c) then
      missing := array_append(missing, 'constraint:' || c);
    end if;
  end loop;

  -- daily_study_minutes must still exist: the UI switched to fixed time tags
  -- but the stored column (and its unit) is deliberately unchanged, so tags
  -- stay comparable with values recorded before this migration.
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'core' and table_name = 'student_profile' and column_name = 'daily_study_minutes'
  ) then
    missing := array_append(missing, 'column:daily_study_minutes (must be retained)');
  end if;

  if array_length(missing, 1) is not null then
    raise exception 'verify_048 failed, missing: %', array_to_string(missing, ', ');
  end if;

  raise notice 'verify_048_student_profile_details: OK';
end $$;
