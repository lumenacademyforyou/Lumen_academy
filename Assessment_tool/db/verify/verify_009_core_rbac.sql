-- verify_009_core_rbac.sql

do $$
declare
  missing text[] := array[]::text[];
begin
  if not exists (select 1 from information_schema.tables where table_schema='core' and table_name='role') then
    missing := array_append(missing, 'table:core.role');
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='core' and table_name='permission') then
    missing := array_append(missing, 'table:core.permission');
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='core' and table_name='role_permission') then
    missing := array_append(missing, 'table:core.role_permission');
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='core' and table_name='user_role_assignment') then
    missing := array_append(missing, 'table:core.user_role_assignment');
  end if;
  if not exists (select 1 from pg_indexes where schemaname='core' and indexname='uq_user_role_active') then
    missing := array_append(missing, 'index:uq_user_role_active');
  end if;
  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='core' and c.relname='user_role_assignment' and t.tgname='trg_role_assignment_scope'
  ) then
    missing := array_append(missing, 'trigger:trg_role_assignment_scope');
  end if;
  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='core' and c.relname='user_role_assignment' and t.tgname='trg_role_assignment_audit'
  ) then
    missing := array_append(missing, 'trigger:trg_role_assignment_audit');
  end if;
  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='core' and c.relname='user_role_assignment' and t.tgname='trg_sync_app_user_role'
  ) then
    missing := array_append(missing, 'trigger:trg_sync_app_user_role');
  end if;
  if not exists (
    select 1 from pg_constraint con join pg_namespace n on n.oid=con.connamespace
    where n.nspname='core' and con.conname='ck_app_user_user_role'
  ) then
    missing := array_append(missing, 'constraint:ck_app_user_user_role');
  end if;

  if array_length(missing, 1) is not null then
    raise exception 'verify_009_core_rbac FAILED — missing: %', array_to_string(missing, ', ');
  end if;

  raise notice 'verify_009_core_rbac: OK — role/permission/role_permission/user_role_assignment tables, scope trigger, audit trigger, sync trigger, app_user CHECK all present';
end $$;

-- Functional proof: a platform-scoped role with an institution_id is
-- rejected, and the last active super_admin cannot be revoked. Rolls back
-- via its own exception handler — proof only, not seed data (014 owns
-- seeding real roles/permissions/the real super-admin bootstrap).
do $$
declare
  v_role_id uuid;
  v_inst_id uuid;
  v_user_id uuid;
  v_assignment_id uuid;
  v_rejected boolean;
begin
  insert into core.role (role_code, role_name, scope_level, is_system)
    values ('super_admin', 'Verify Super Admin', 'platform', true)
    on conflict (role_code) do update set role_name = excluded.role_name
    returning role_id into v_role_id;

  select institution_id into v_inst_id from core.institution limit 1;
  if v_inst_id is null then
    insert into core.institution (institution_code, name, status, created_at)
      values ('VERIFY_INST', 'Verify Institution', 'active', now())
      returning institution_id into v_inst_id;
  end if;

  select user_id into v_user_id from core.app_user limit 1;

  begin
    insert into core.user_role_assignment (user_id, role_id, institution_id)
      values (v_user_id, v_role_id, v_inst_id);
    v_rejected := false;
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'verify_009: a platform-scoped role WITH an institution_id was NOT rejected';
  end if;

  insert into core.user_role_assignment (user_id, role_id, institution_id)
    values (v_user_id, v_role_id, null)
    returning assignment_id into v_assignment_id;

  begin
    update core.user_role_assignment set revoked_at = now() where assignment_id = v_assignment_id;
    v_rejected := false;
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'verify_009: revoking the LAST active super_admin was NOT rejected';
  end if;

  raise notice 'verify_009_core_rbac: functional proof OK — platform-scope-with-institution rejected, last-super_admin-revoke rejected';
  raise exception 'verify_009_core_rbac: proof complete, rolling back proof rows (not seed data)';
exception when others then
  if sqlerrm like 'verify_009_core_rbac: proof complete%' then
    raise notice '%', sqlerrm;
  else
    raise;
  end if;
end $$;
