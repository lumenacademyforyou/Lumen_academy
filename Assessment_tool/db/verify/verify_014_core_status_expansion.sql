-- verify_014_core_status_expansion.sql

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ck_app_user_status') then
    raise exception 'verify_014 FAILED — ck_app_user_status constraint missing';
  end if;
  raise notice 'verify_014: OK — ck_app_user_status present';
end $$;

do $$
begin
  raise notice 'after-survey: app_user.status = %', (select string_agg(distinct status, ',') from core.app_user);
end $$;

-- Functional proof: each of the two newly-allowed values is accepted on a
-- real existing row, and a still-invalid value is still rejected, then the
-- row is restored to its original status. Uses an existing row rather than
-- inserting a fabricated one, since core.app_user.auth_user_id has a real
-- FK to auth.users that a made-up uuid would fail regardless of what this
-- CHECK constraint does.
do $$
declare
  sample_user_id uuid;
  original_status text;
begin
  select user_id, status into sample_user_id, original_status from core.app_user limit 1;
  if sample_user_id is null then
    raise notice 'verify_014: skipping functional proof — no core.app_user rows exist to test against';
    return;
  end if;

  update core.app_user set status = 'awaiting_verification' where user_id = sample_user_id;
  update core.app_user set status = 'locked' where user_id = sample_user_id;

  begin
    update core.app_user set status = 'not_a_real_status' where user_id = sample_user_id;
    raise exception 'verify_014 FAILED — an invalid status value was accepted';
  exception
    when check_violation then
      null; -- expected
  end;

  update core.app_user set status = original_status where user_id = sample_user_id;
  raise notice 'verify_014: OK — awaiting_verification/locked accepted, invalid value rejected, sample row restored to %', original_status;
end $$;
