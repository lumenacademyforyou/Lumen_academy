-- verify_031_collapse_duplicate_questions.sql

do $$
declare
  v_dup_groups int;
  v_orphaned_seen int;
  v_archived_count int;
  v_canonical_without_id int;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'content' and table_name = 'question' and column_name = 'canonical_question_id'
  ) then
    raise exception 'verify_031 FAILED — content.question.canonical_question_id column missing';
  end if;

  if not exists (
    select 1 from pg_constraint c
     where c.conname = 'ck_question_lifecycle'
       and pg_get_constraintdef(c.oid) ilike '%duplicate_archived%'
  ) then
    raise exception 'verify_031 FAILED — ck_question_lifecycle does not allow duplicate_archived';
  end if;

  select count(*) into v_dup_groups
    from (select content_fp from content.question where lifecycle_status = 'published' group by content_fp having count(*) > 1) t;
  if v_dup_groups > 0 then
    raise exception 'verify_031 FAILED — % content_fp groups with more than one PUBLISHED row remain', v_dup_groups;
  end if;

  select count(*) into v_archived_count from content.question where lifecycle_status = 'duplicate_archived';
  if v_archived_count = 0 then
    raise exception 'verify_031 FAILED — expected some rows archived (POOL_CENSUS.md showed 94 duplicate groups); got 0';
  end if;

  select count(*) into v_canonical_without_id
    from content.question where lifecycle_status = 'duplicate_archived' and canonical_question_id is null;
  if v_canonical_without_id > 0 then
    raise exception 'verify_031 FAILED — % duplicate_archived rows have no canonical_question_id', v_canonical_without_id;
  end if;

  -- Every archived row's canonical target must itself be published, not archived.
  if exists (
    select 1 from content.question dup
      join content.question canon on canon.question_id = dup.canonical_question_id
     where dup.lifecycle_status = 'duplicate_archived' and canon.lifecycle_status <> 'published'
  ) then
    raise exception 'verify_031 FAILED — some duplicate_archived rows point at a non-published canonical_question_id';
  end if;

  select count(*) into v_orphaned_seen
    from assess.user_question_seen uqs
    join content.question q on q.question_id = uqs.question_id
   where q.lifecycle_status = 'duplicate_archived';
  if v_orphaned_seen > 0 then
    raise exception 'verify_031 FAILED — % assess.user_question_seen rows still point at an archived (non-canonical) question_id', v_orphaned_seen;
  end if;

  raise notice 'verify_031: % rows archived, 0 duplicate content_fp groups remain among published rows, 0 orphaned user_question_seen rows', v_archived_count;
  raise notice 'verify_031_collapse_duplicate_questions: OK';
end $$;
