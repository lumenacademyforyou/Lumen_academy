-- verify_017_core_member_code.sql

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'core' and table_name = 'app_user' and column_name = 'member_code'
  ) then
    raise exception 'verify_017 FAILED — core.app_user.member_code column missing';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'uq_app_user_member_code') then
    raise exception 'verify_017 FAILED — uq_app_user_member_code constraint missing';
  end if;
  raise notice 'verify_017: OK — member_code column and unique constraint present';
end $$;

-- Functional proof: setting two existing rows to the same member_code is
-- rejected. Tests via UPDATE on two already-valid rows, not INSERT — an
-- inserted row would also need to satisfy auth_user_id's FK to auth.users,
-- which isn't this constraint's concern and would just add an unrelated
-- failure mode to a test that's specifically about uniqueness.
do $$
declare
  user_a uuid;
  user_b uuid;
  code_a text;
  code_b text;
begin
  select user_id, member_code into user_a, code_a from core.app_user order by user_id limit 1;
  select user_id, member_code into user_b, code_b from core.app_user where user_id <> user_a order by user_id limit 1;
  if user_a is null or user_b is null then
    raise notice 'verify_017: skipping functional proof — fewer than 2 core.app_user rows exist to test uniqueness against';
    return;
  end if;

  update core.app_user set member_code = 'LATT999991' where user_id = user_a;
  begin
    update core.app_user set member_code = 'LATT999991' where user_id = user_b;
    raise exception 'verify_017 FAILED — two rows were allowed the same member_code';
  exception
    when unique_violation then
      null; -- expected
  end;

  update core.app_user set member_code = code_a where user_id = user_a;
  update core.app_user set member_code = code_b where user_id = user_b;
  raise notice 'verify_017: OK — duplicate member_code across two rows rejected, both restored';
end $$;
