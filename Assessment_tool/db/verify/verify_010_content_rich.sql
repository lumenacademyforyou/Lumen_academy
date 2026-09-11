-- verify_010_content_rich.sql

do $$
declare
  missing text[] := array[]::text[];
begin
  if not exists (select 1 from information_schema.tables where table_schema='content' and table_name='question_group') then
    missing := array_append(missing, 'table:content.question_group');
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='content' and table_name='question_source') then
    missing := array_append(missing, 'table:content.question_source');
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='content' and table_name='node_resource_ref') then
    missing := array_append(missing, 'table:content.node_resource_ref');
  end if;
  if not exists (
    select 1 from information_schema.columns where table_schema='content' and table_name='question'
      and column_name in ('group_id','group_sequence','stem_format','solution_text','solution_format',
                           'has_image','has_table','has_math','revision_no','external_ref')
    having count(*) = 10
  ) then
    missing := array_append(missing, 'columns:content.question rich-content set');
  end if;
  if not exists (
    select 1 from information_schema.columns where table_schema='content' and table_name='asset'
      and column_name in ('option_id','group_id','target_role','mime_type','inline_payload',
                           'width_px','height_px','byte_size','checksum_sha256','display_order')
    having count(*) = 10
  ) then
    missing := array_append(missing, 'columns:content.asset rich-content set');
  end if;
  if not exists (
    select 1 from pg_constraint con join pg_namespace n on n.oid=con.connamespace
    where n.nspname='content' and con.conname='ck_asset_type'
  ) then
    missing := array_append(missing, 'constraint:ck_asset_type');
  end if;
  if not exists (select 1 from pg_indexes where schemaname='content' and indexname='uq_source_document_natural') then
    missing := array_append(missing, 'index:uq_source_document_natural');
  end if;
  if not exists (select 1 from pg_indexes where schemaname='content' and indexname='uq_question_source_pyq') then
    missing := array_append(missing, 'index:uq_question_source_pyq');
  end if;
  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='content' and c.relname='question' and t.tgname='trg_question_primary_node_sync'
  ) then
    missing := array_append(missing, 'trigger:trg_question_primary_node_sync');
  end if;
  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='content' and c.relname='question_node_map' and t.tgname='trg_question_node_map_guard'
  ) then
    missing := array_append(missing, 'trigger:trg_question_node_map_guard');
  end if;

  -- Backfill proof: every live question's primary_node_id must already have
  -- a matching question_node_map row (the migration's backfill statement).
  if exists (
    select 1 from content.question q
    where not exists (select 1 from content.question_node_map m where m.question_id = q.question_id and m.node_id = q.primary_node_id)
  ) then
    missing := array_append(missing, 'backfill:some live question has no question_node_map row for its primary_node_id');
  end if;

  if array_length(missing, 1) is not null then
    raise exception 'verify_010_content_rich FAILED — missing: %', array_to_string(missing, ', ');
  end if;

  raise notice 'verify_010_content_rich: OK — question_group/question_source/node_resource_ref tables, rich-content columns, sync/guard triggers, natural-key indexes, backfill all present';
end $$;

-- Functional proof: a passage group with 2 member questions, one image
-- asset, one table asset, and primary_node_id auto-mapping. Rolls back via
-- its own exception handler — proof only.
do $$
declare
  v_node_id uuid;
  v_group_id uuid;
  v_job_id uuid;
  v_requester uuid;
  v_q1 uuid;
  v_q2 uuid;
  v_mapped boolean;
begin
  select node_id into v_node_id from catalog.syllabus_node limit 1;
  select user_id into v_requester from core.app_user limit 1;

  -- job_type must be one of ck_ai_generation_job_type's allowed values
  -- (012_domain_checks.sql); 'other' is the catch-all meant for proof/test rows.
  insert into content.ai_generation_job (requested_by, job_type, job_status)
    values (v_requester, 'other', 'completed')
    returning job_id into v_job_id;

  insert into content.question_group (group_type, stem_text, stem_format, primary_node_id)
    values ('passage', 'Read the passage and answer 2 and 3.', 'latex', v_node_id)
    returning group_id into v_group_id;

  insert into content.question
    (question_uid, primary_node_id, job_id, question_type, stem_text, usage_count, lifecycle_status, group_id, group_sequence)
    values ('VERIFY-GRP-Q1', v_node_id, v_job_id, 'single_choice', 'Verify group question 1', 0, 'draft', v_group_id, 1)
    returning question_id into v_q1;

  insert into content.question
    (question_uid, primary_node_id, job_id, question_type, stem_text, usage_count, lifecycle_status, group_id, group_sequence)
    values ('VERIFY-GRP-Q2', v_node_id, v_job_id, 'single_choice', 'Verify group question 2', 0, 'draft', v_group_id, 2)
    returning question_id into v_q2;

  insert into content.asset (question_id, target_role, asset_type, storage_uri, alt_text, mime_type)
    values (v_q1, 'stem', 'image', 'verify/proof-image.png', 'Verify proof image', 'image/png');

  insert into content.asset (question_id, target_role, asset_type, inline_payload)
    values (v_q2, 'stem', 'table', '| a | b |\n|---|---|\n| 1 | 2 |');

  select exists (
    select 1 from content.question_node_map where question_id = v_q1 and node_id = v_node_id
  ) into v_mapped;
  if not v_mapped then
    raise exception 'verify_010: primary_node_id did NOT auto-map into question_node_map';
  end if;

  raise notice 'verify_010_content_rich: functional proof OK — passage group with 2 questions, image asset, table asset, primary_node_id auto-mapped';
  raise exception 'verify_010_content_rich: proof complete, rolling back proof rows (not seed data)';
exception when others then
  if sqlerrm like 'verify_010_content_rich: proof complete%' then
    raise notice '%', sqlerrm;
  else
    raise;
  end if;
end $$;
