-- verify_044_dedup_toolkit — the schema must exist, the generated columns must
-- be genuinely non-writable, and the unique index must actually reject a
-- duplicate stem.
--
-- The last one is the point. An index that exists but does not bite is the
-- failure mode this whole pass is guarding against, so the check inserts a
-- real duplicate and requires the database to refuse it.

do $$
declare
  v_node   uuid;
  v_job    uuid;
  v_stem   text := 'verify_044 probe stem, 4242 widgets, deliberately unique.';
  v_first  uuid;
  v_caught boolean := false;
  v_col        text;
  v_audit_rows bigint;
begin
  -- 1. Columns exist, with the right generated-ness.
  if not exists (select 1 from information_schema.columns
                  where table_schema='content' and table_name='question'
                    and column_name='match_hash' and is_generated='ALWAYS') then
    raise exception 'verify_044 FAILED — question.match_hash missing or not GENERATED';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema='content' and table_name='question'
                    and column_name='is_deleted' and is_generated='ALWAYS') then
    raise exception 'verify_044 FAILED — question.is_deleted missing or not GENERATED';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema='content' and table_name='question'
                    and column_name='merged_into_id' and is_generated='ALWAYS') then
    raise exception 'verify_044 FAILED — question.merged_into_id missing or not GENERATED';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema='content' and table_name='question'
                    and column_name='deleted_at' and is_generated='NEVER') then
    raise exception 'verify_044 FAILED — question.deleted_at missing or unexpectedly generated';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema='content' and table_name='question'
                    and column_name='dedup_cluster_id' and is_generated='NEVER') then
    raise exception 'verify_044 FAILED — question.dedup_cluster_id missing';
  end if;

  -- 2. is_deleted must AGREE with lifecycle_status on every existing row.
  --    A generated column that disagrees with its source would be worse than
  --    no column, because reports would trust it.
  if exists (select 1 from content.question
              where is_deleted <> (lifecycle_status = 'duplicate_archived')) then
    raise exception 'verify_044 FAILED — is_deleted disagrees with lifecycle_status on at least one row';
  end if;

  -- 3. The EXISTING structures must have been extended, and no parallel
  --    structure must exist. Both halves are checked: an earlier draft of 044
  --    created content.question_dedup_audit and content.ingestion_run beside
  --    the tables that already did those jobs, so their ABSENCE is now part
  --    of what "correctly applied" means.
  if to_regclass('content.question_dedup_repoint') is null then
    raise exception 'verify_044 FAILED — content.question_dedup_repoint missing';
  end if;
  if to_regclass('content.question_dedup_audit') is not null then
    raise exception 'verify_044 FAILED — content.question_dedup_audit exists; it duplicates content.question_identity_audit and must not be created';
  end if;
  if to_regclass('content.ingestion_run') is not null then
    raise exception 'verify_044 FAILED — content.ingestion_run exists; it duplicates content.import_batch and must not be created';
  end if;

  for v_col in select unnest(array['tier', 'similarity_score', 'payload_json', 'actor']) loop
    if not exists (select 1 from information_schema.columns
                    where table_schema='content' and table_name='question_identity_audit'
                      and column_name = v_col) then
      raise exception 'verify_044 FAILED — question_identity_audit.% missing', v_col;
    end if;
  end loop;

  for v_col in select unnest(array['duplicate_count', 'detail']) loop
    if not exists (select 1 from information_schema.columns
                    where table_schema='content' and table_name='import_batch'
                      and column_name = v_col) then
      raise exception 'verify_044 FAILED — import_batch.% missing', v_col;
    end if;
  end loop;

  -- The existing audit history must survive the extension untouched.
  select count(*) into v_audit_rows from content.question_identity_audit;
  if v_audit_rows < 1467 then
    raise exception 'verify_044 FAILED — question_identity_audit has % rows, fewer than the 1467 that predate this migration', v_audit_rows;
  end if;

  -- migration 041's index must be GONE, not merely shadowed.
  if exists (select 1 from pg_indexes where schemaname='content' and indexname='uq_question_dedup') then
    raise exception 'verify_044 FAILED — uq_question_dedup still exists; it is subsumed by uq_question_match_hash and must be dropped';
  end if;

  -- 4. The index must be UNIQUE and PARTIAL. Non-partial would make it
  --    impossible for an archived duplicate to sit beside its survivor, which
  --    is exactly what soft delete needs.
  if not exists (
    select 1 from pg_index
     where indexrelid = 'content.uq_question_match_hash'::regclass
       and indisunique and indpred is not null
  ) then
    raise exception 'verify_044 FAILED — uq_question_match_hash is missing, not unique, or not partial';
  end if;

  -- 5. match_hash must match what fn_question_stem_norm produces RIGHT NOW.
  --    This is the migration-order check: match_hash is a STORED generated
  --    column, so if 043 were applied after this migration the stored value
  --    would be stale and this comparison would catch it.
  if exists (
    select 1 from content.question
     where lifecycle_status = 'published'
       and match_hash is distinct from digest(content.fn_question_stem_norm(stem_text), 'sha256')
  ) then
    raise exception 'verify_044 FAILED — stored match_hash disagrees with fn_question_stem_norm. '
                    'Run 043_stem_norm_dash_fold BEFORE 044, then re-apply 044.';
  end if;

  -- 6. The index must actually bite.
  --
  -- The probe rows are removed by UNWINDING a subtransaction, not by DELETE.
  -- That is not stylistic: content.trg_question_node_map_guard forbids
  -- deleting the question_node_map row matching a question's primary_node_id
  -- while that question exists, and fk_question_node_map_question_id (not
  -- deferrable) forbids deleting the question while the map row exists. A
  -- question that trg_question_primary_node_sync has given a map row
  -- therefore cannot be removed by ordinary DELETEs at all. Raising a
  -- sentinel and catching it rolls both inserts back cleanly, and plpgsql
  -- variables survive the unwind, so v_caught still carries the verdict.
  select node_id into v_node from catalog.syllabus_node limit 1;
  select job_id  into v_job  from content.ai_generation_job limit 1;

  begin
    insert into content.question
      (question_uid, primary_node_id, job_id, question_type, difficulty_band, stem_text,
       stem_format, solution_format, lifecycle_status)
    values ('VERIFY-044-A', v_node, v_job, 'single_choice', 'easy', v_stem, 'plain', 'plain', 'published')
    returning question_id into v_first;

    begin
      insert into content.question
        (question_uid, primary_node_id, job_id, question_type, difficulty_band, stem_text,
         stem_format, solution_format, lifecycle_status)
      values ('VERIFY-044-B', v_node, v_job, 'single_choice', 'hard', v_stem, 'plain', 'plain', 'published');
    exception when unique_violation then
      v_caught := true;
    end;

    raise exception using errcode = 'P0001', message = '__verify_044_unwind__';
  exception when others then
    if sqlerrm <> '__verify_044_unwind__' then raise; end if;
  end;

  if not v_caught then
    raise exception 'verify_044 FAILED — a second published row with an identical stem was ACCEPTED';
  end if;

  -- The unwind must have left nothing behind.
  if exists (select 1 from content.question where question_uid in ('VERIFY-044-A', 'VERIFY-044-B')) then
    raise exception 'verify_044 FAILED — probe rows survived the unwind';
  end if;

  raise notice 'verify_044 passed — existing structures extended (identity_audit +4 cols, import_batch +2), no parallel tables, uq_question_dedup retired, generated columns agree with their sources, and the unique index rejected a real duplicate.';
end $$;
