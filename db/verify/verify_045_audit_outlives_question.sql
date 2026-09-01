-- verify_045_audit_outlives_question — the audit trail must survive its subject.

do $$
declare
  v_missing_uid bigint;
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema='content' and table_name='question_identity_audit'
                    and column_name='question_uid') then
    raise exception 'verify_045 FAILED — question_identity_audit.question_uid missing';
  end if;

  if exists (select 1 from information_schema.columns
              where table_schema='content' and table_name='question_identity_audit'
                and column_name='question_id' and is_nullable='NO') then
    raise exception 'verify_045 FAILED — question_id is still NOT NULL, so a delete cannot null it';
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'content.question_identity_audit'::regclass
       and conname = 'question_identity_audit_question_id_fkey'
       and confdeltype = 'n'
  ) then
    raise exception 'verify_045 FAILED — the FK is not ON DELETE SET NULL';
  end if;

  -- Every audit row that still has a live question must carry its uid, or the
  -- row becomes anonymous the moment that question is deleted.
  select count(*) into v_missing_uid
    from content.question_identity_audit a
    join content.question q on q.question_id = a.question_id
   where a.question_uid is null;

  if v_missing_uid > 0 then
    raise exception 'verify_045 FAILED — % audit row(s) reference a live question but carry no question_uid', v_missing_uid;
  end if;

  raise notice 'verify_045 passed — audit rows carry question_uid and survive deletion of their question.';
end $$;
