-- verify_015_core_invitation.sql

do $$
declare
  missing text[] := array[]::text[];
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'core' and table_name = 'invitation') then
    missing := array_append(missing, 'table:core.invitation');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_invitation_role') then
    missing := array_append(missing, 'constraint:fk_invitation_role');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_invitation_institution') then
    missing := array_append(missing, 'constraint:fk_invitation_institution');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_invitation_invited_by') then
    missing := array_append(missing, 'constraint:fk_invitation_invited_by');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ck_invitation_status') then
    missing := array_append(missing, 'constraint:ck_invitation_status');
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'core' and indexname = 'uq_invitation_pending_email_role') then
    missing := array_append(missing, 'index:uq_invitation_pending_email_role');
  end if;

  if array_length(missing, 1) is not null then
    raise exception 'verify_015 FAILED — missing: %', array_to_string(missing, ', ');
  end if;
  raise notice 'verify_015: OK — core.invitation table, FKs, check constraint and partial unique index all present';
end $$;

-- Functional proof: a fabricated invitation row is inserted (using a real
-- role_code, a real institution and a real inviting app_user so both FKs
-- resolve), the partial-unique-index refuses a second pending row for the
-- same email+role, an invalid status is rejected, and everything is rolled
-- back so no test data survives.
do $$
declare
  test_role_id uuid;
  test_inviter uuid;
  test_institution uuid;
  test_email text := 'verify-015-functional-proof@lumen.internal';
begin
  select role_id into test_role_id from core.role where role_code = 'educator';
  select user_id into test_inviter from core.app_user limit 1;
  select institution_id into test_institution from core.institution limit 1;

  if test_role_id is null or test_inviter is null then
    raise notice 'verify_015: skipping functional proof — core.role(educator) or an existing core.app_user row not found';
    return;
  end if;

  begin
    insert into core.invitation (email, role_code, institution_id, invited_by, expires_at)
    values (test_email, 'educator', test_institution, test_inviter, now() + interval '7 days');

    begin
      insert into core.invitation (email, role_code, institution_id, invited_by, expires_at)
      values (test_email, 'educator', test_institution, test_inviter, now() + interval '7 days');
      raise exception 'verify_015 FAILED — a second pending invitation for the same email+role was accepted';
    exception
      when unique_violation then
        null; -- expected
    end;

    begin
      update core.invitation set status = 'not_a_real_status' where email = test_email;
      raise exception 'verify_015 FAILED — an invalid invitation status was accepted';
    exception
      when check_violation then
        null; -- expected
    end;

    raise notice 'verify_015: OK — functional proof passed (duplicate pending invite rejected, invalid status rejected)';
    raise exception 'verify_015_rollback_marker'; -- always roll back the test insert
  exception
    when others then
      if sqlerrm != 'verify_015_rollback_marker' then
        raise;
      end if;
  end;
end $$;
