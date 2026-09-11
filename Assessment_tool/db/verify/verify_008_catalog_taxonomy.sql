-- verify_008_catalog_taxonomy.sql

do $$
declare
  missing text[] := array[]::text[];
begin
  if not exists (select 1 from information_schema.tables where table_schema='catalog' and table_name='exam_family') then
    missing := array_append(missing, 'table:catalog.exam_family');
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='catalog' and table_name='node_level') then
    missing := array_append(missing, 'table:catalog.node_level');
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='catalog' and table_name='exam' and column_name='family_id') then
    missing := array_append(missing, 'column:catalog.exam.family_id');
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema='catalog' and table_name='syllabus_node'
       and column_name in ('level_no','node_code','node_path','sort_order','is_active')
    having count(*) = 5
  ) then
    missing := array_append(missing, 'columns:catalog.syllabus_node taxonomy set');
  end if;

  if not exists (select 1 from pg_indexes where schemaname='catalog' and indexname='uq_syllabus_node_path') then
    missing := array_append(missing, 'index:uq_syllabus_node_path');
  end if;
  if not exists (select 1 from pg_indexes where schemaname='catalog' and indexname='uq_syllabus_node_code_parent') then
    missing := array_append(missing, 'index:uq_syllabus_node_code_parent');
  end if;
  if not exists (select 1 from pg_indexes where schemaname='catalog' and indexname='ix_syllabus_node_path_prefix') then
    missing := array_append(missing, 'index:ix_syllabus_node_path_prefix');
  end if;
  if not exists (select 1 from pg_indexes where schemaname='catalog' and indexname='uq_exam_pattern_current_per_cycle') then
    missing := array_append(missing, 'index:uq_exam_pattern_current_per_cycle');
  end if;

  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='catalog' and c.relname='syllabus_node' and t.tgname='trg_syllabus_node_hierarchy'
  ) then
    missing := array_append(missing, 'trigger:trg_syllabus_node_hierarchy');
  end if;
  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='catalog' and c.relname='syllabus_node' and t.tgname='trg_syllabus_node_path_cascade'
  ) then
    missing := array_append(missing, 'trigger:trg_syllabus_node_path_cascade');
  end if;

  if exists (
    select 1 from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'catalog' and c.relname = 'pattern_section' and a.attname = 'scheme_id' and a.attnotnull
  ) then
    missing := array_append(missing, 'pattern_section.scheme_id is still NOT NULL');
  end if;

  if not exists (select 1 from information_schema.views where table_schema='catalog' and table_name='v_section_marking') then
    missing := array_append(missing, 'view:catalog.v_section_marking');
  end if;

  if array_length(missing, 1) is not null then
    raise exception 'verify_008_catalog_taxonomy FAILED — missing: %', array_to_string(missing, ', ');
  end if;

  raise notice 'verify_008_catalog_taxonomy: OK — exam_family, node_level, syllabus_node taxonomy, hierarchy triggers, pattern currency index, section-marking view all present';
end $$;

-- Functional proof: a well-formed 4-level NEET tree, a rejected
-- misparented node, and node_path auto-computation. Runs inside its own
-- transaction and rolls back — this is a proof, not seed data (014 owns
-- seeding).
do $$
declare
  v_exam_id uuid;
  v_syllabus_version_id uuid;
  v_subject uuid;
  v_unit uuid;
  v_chapter uuid;
  v_topic uuid;
  v_path text;
  v_rejected boolean := false;
begin
  select exam_id into v_exam_id from catalog.exam where exam_code = 'NEET';
  select syllabus_version_id into v_syllabus_version_id from catalog.syllabus_version where exam_id = v_exam_id limit 1;

  insert into catalog.node_level (exam_id, level_no, level_code, level_label, is_taggable) values
    (v_exam_id, 1, 'subject', 'Subject', false),
    (v_exam_id, 2, 'unit', 'Unit', false),
    (v_exam_id, 3, 'chapter', 'Chapter', true),
    (v_exam_id, 4, 'topic', 'Topic', true)
  on conflict do nothing;

  insert into catalog.syllabus_node (syllabus_version_id, subject_id, tag_code, node_code, title, node_type, depth)
    select v_syllabus_version_id, subject_id, 'VERIFY_PHY', 'VERIFY_PHY', 'Verify Physics', 'unit', 0
      from catalog.subject limit 1
    returning node_id into v_subject;

  insert into catalog.syllabus_node (syllabus_version_id, subject_id, parent_node_id, tag_code, node_code, title, node_type, depth)
    values (v_syllabus_version_id, (select subject_id from catalog.syllabus_node where node_id = v_subject), v_subject, 'VERIFY_U1', 'VERIFY_U1', 'Verify Unit 1', 'unit', 1)
    returning node_id into v_unit;

  insert into catalog.syllabus_node (syllabus_version_id, subject_id, parent_node_id, tag_code, node_code, title, node_type, depth)
    values (v_syllabus_version_id, (select subject_id from catalog.syllabus_node where node_id = v_unit), v_unit, 'VERIFY_CH1', 'VERIFY_CH1', 'Verify Chapter 1', 'unit', 2)
    returning node_id into v_chapter;

  insert into catalog.syllabus_node (syllabus_version_id, subject_id, parent_node_id, tag_code, node_code, title, node_type, depth)
    values (v_syllabus_version_id, (select subject_id from catalog.syllabus_node where node_id = v_chapter), v_chapter, 'VERIFY_T1', 'VERIFY_T1', 'Verify Topic 1', 'unit', 3)
    returning node_id into v_topic;

  select node_path into v_path from catalog.syllabus_node where node_id = v_topic;
  if v_path <> '/VERIFY_PHY/VERIFY_U1/VERIFY_CH1/VERIFY_T1' then
    raise exception 'verify_008: node_path not computed correctly, got %', v_path;
  end if;

  begin
    insert into catalog.syllabus_node (syllabus_version_id, subject_id, parent_node_id, tag_code, node_code, title, node_type, depth, level_no)
      values (v_syllabus_version_id, (select subject_id from catalog.syllabus_node where node_id = v_topic), v_topic, 'VERIFY_BAD', 'VERIFY_BAD', 'Bad level', 'unit', 4, 1);
    v_rejected := false;
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'verify_008: a misparented node (wrong level_no) was NOT rejected';
  end if;

  raise notice 'verify_008_catalog_taxonomy: functional proof OK — node_path=%, misparented node correctly rejected', v_path;
  raise exception 'verify_008_catalog_taxonomy: proof complete, rolling back proof rows (not seed data)';
exception when others then
  if sqlerrm like 'verify_008_catalog_taxonomy: proof complete%' then
    raise notice '%', sqlerrm;
  else
    raise;
  end if;
end $$;
