-- verify_030_question_fingerprints.sql

do $$
declare
  v_null_fp_count int;
  v_dup_content_fp_groups int;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'content' and table_name = 'question' and column_name = 'content_fp'
  ) then
    raise exception 'verify_030 FAILED — content.question.content_fp column missing';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'content' and p.proname = 'fn_normalize_stem'
  ) then
    raise exception 'verify_030 FAILED — content.fn_normalize_stem missing';
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'trg_question_fingerprint_sync'
  ) then
    raise exception 'verify_030 FAILED — missing trigger trg_question_fingerprint_sync on content.question';
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'trg_question_option_fingerprint_sync'
  ) then
    raise exception 'verify_030 FAILED — missing trigger trg_question_option_fingerprint_sync on content.question_option';
  end if;

  select count(*) into v_null_fp_count from content.question where content_fp is null;
  if v_null_fp_count > 0 then
    raise exception 'verify_030 FAILED — % rows have a null content_fp after backfill', v_null_fp_count;
  end if;

  -- Sanity: fingerprint function is deterministic and normalization actually
  -- does something (not a no-op identity function).
  if content.fn_normalize_stem('  Hello,  WORLD!  ') is distinct from content.fn_normalize_stem('hello world') then
    raise exception 'verify_030 FAILED — fn_normalize_stem is not normalizing as expected';
  end if;

  select count(*) into v_dup_content_fp_groups
    from (select content_fp from content.question where lifecycle_status = 'published' group by content_fp having count(*) > 1) t;
  raise notice 'verify_030: % duplicate content_fp groups remain among published rows (expected — Phase 2 has not run yet)', v_dup_content_fp_groups;

  raise notice 'verify_030_question_fingerprints: OK';
end $$;
