-- 009_core_rbac.sql
-- LA-CC-DB-001 Stage 2. Closes S-07 (no RBAC / no super-admin concept) and
-- is the schema half of B-05 (catalog writes gated only by requireAuth).
--
-- Discrepancy vs the brief: core.app_user.user_role currently holds 2
-- distinct values — 'student' (3 rows) and 'system' (1 row). 'system' isn't
-- in the brief's proposed code list (super_admin/platform_admin/
-- content_admin/content_reviewer/institution_admin/educator/student).
-- Rather than silently reclassify a live account's role to fit an external
-- document's vocabulary, 'system' is added to the allowed set below as a
-- service/automation-account role (scope_level 'platform', no human
-- assignment expected). Flagging per rule 2, proceeding.

create table core.role (
  role_id     uuid primary key default gen_random_uuid(),
  role_code   text not null,
  role_name   text not null,
  scope_level text not null,
  is_system   boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint uq_role_code  unique (role_code),
  constraint ck_role_scope check (scope_level in ('platform','institution')),
  constraint ck_role_code  check (role_code in
    ('super_admin','platform_admin','content_admin','content_reviewer',
     'institution_admin','educator','student','system'))
);

create table core.permission (
  permission_id   uuid primary key default gen_random_uuid(),
  permission_code text not null,
  description     text not null,
  constraint uq_permission_code unique (permission_code)
);

create table core.role_permission (
  role_id       uuid not null references core.role(role_id) on delete cascade,
  permission_id uuid not null references core.permission(permission_id) on delete cascade,
  constraint pk_role_permission primary key (role_id, permission_id)
);

create table core.user_role_assignment (
  assignment_id  uuid primary key default gen_random_uuid(),
  user_id        uuid not null references core.app_user(user_id) on delete cascade,
  role_id        uuid not null references core.role(role_id) on delete restrict,
  institution_id uuid references core.institution(institution_id) on delete cascade,
  granted_by     uuid references core.app_user(user_id) on delete set null,
  granted_at     timestamptz not null default now(),
  revoked_at     timestamptz
);

create unique index uq_user_role_active
  on core.user_role_assignment (user_id, role_id, coalesce(institution_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where revoked_at is null;

create index ix_user_role_assignment_user on core.user_role_assignment (user_id) where revoked_at is null;

-- Scope enforcement: a platform-scoped role must have institution_id NULL;
-- an institution-scoped role must have institution_id NOT NULL. Can't be a
-- CHECK on user_role_assignment because scope_level lives on core.role.
create or replace function core.trg_role_assignment_scope() returns trigger as $$
declare
  v_scope text;
begin
  select scope_level into v_scope from core.role where role_id = new.role_id;
  if v_scope = 'platform' and new.institution_id is not null then
    raise exception 'user_role_assignment: role % is platform-scoped but institution_id was given', new.role_id;
  end if;
  if v_scope = 'institution' and new.institution_id is null then
    raise exception 'user_role_assignment: role % is institution-scoped but institution_id is missing', new.role_id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_role_assignment_scope
  before insert or update of role_id, institution_id on core.user_role_assignment
  for each row execute function core.trg_role_assignment_scope();

-- Refuse to revoke the last active super_admin assignment, rather than a
-- rigid one-row-ever unique index (too rigid for operations — you must be
-- able to grant a second super_admin before handing off, then revoke the
-- first). Logs every grant/revoke to learn.audit_log.
create or replace function core.trg_role_assignment_audit() returns trigger as $$
declare
  v_role_code text;
  v_remaining int;
begin
  if tg_op = 'UPDATE' and old.revoked_at is null and new.revoked_at is not null then
    select role_code into v_role_code from core.role where role_id = old.role_id;
    if v_role_code = 'super_admin' then
      select count(*) into v_remaining
        from core.user_role_assignment ura
        join core.role r on r.role_id = ura.role_id
       where r.role_code = 'super_admin' and ura.revoked_at is null and ura.assignment_id <> old.assignment_id;
      if v_remaining = 0 then
        raise exception 'user_role_assignment: cannot revoke the last active super_admin assignment';
      end if;
    end if;
    insert into learn.audit_log (actor_user_id, actor_type, action_name, entity_name, entity_key, change_payload, occurred_at)
      values (new.granted_by, 'user', 'role_revoked', 'core.user_role_assignment', old.assignment_id::text,
              jsonb_build_object('user_id', old.user_id, 'role_id', old.role_id, 'institution_id', old.institution_id), now());
  elsif tg_op = 'INSERT' then
    insert into learn.audit_log (actor_user_id, actor_type, action_name, entity_name, entity_key, change_payload, occurred_at)
      values (new.granted_by, 'user', 'role_granted', 'core.user_role_assignment', new.assignment_id::text,
              jsonb_build_object('user_id', new.user_id, 'role_id', new.role_id, 'institution_id', new.institution_id), now());
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_role_assignment_audit
  before insert or update of revoked_at on core.user_role_assignment
  for each row execute function core.trg_role_assignment_audit();

-- Denormalised convenience column stays, but constrained to the same code
-- set and no longer the source of truth for authorization — see the
-- backend requirePermission middleware (Stage 7), which reads
-- user_role_assignment, never this column.
alter table core.app_user add constraint ck_app_user_user_role check (user_role in
  ('super_admin','platform_admin','content_admin','content_reviewer',
   'institution_admin','educator','student','system'));

-- Maintains core.app_user.user_role from the highest-privilege active
-- assignment, so the denormalised column doesn't drift from
-- user_role_assignment (same failure mode as C-05's primary_node_id, closed
-- here proactively rather than left to happen again).
create or replace function core.trg_sync_app_user_role() returns trigger as $$
declare
  v_user_id uuid;
  v_top_role text;
begin
  v_user_id := coalesce(new.user_id, old.user_id);
  select r.role_code into v_top_role
    from core.user_role_assignment ura
    join core.role r on r.role_id = ura.role_id
   where ura.user_id = v_user_id and ura.revoked_at is null
   order by case r.role_code
     when 'super_admin' then 1 when 'platform_admin' then 2
     when 'content_admin' then 3 when 'institution_admin' then 4
     when 'content_reviewer' then 5 when 'educator' then 6
     when 'student' then 7 when 'system' then 8 else 9 end
   limit 1;

  if v_top_role is not null then
    update core.app_user set user_role = v_top_role where user_id = v_user_id and user_role <> v_top_role;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger trg_sync_app_user_role
  after insert or update of revoked_at on core.user_role_assignment
  for each row execute function core.trg_sync_app_user_role();
