-- verify_001_catalog.sql
-- Asserts every table and constraint created by db/migrations/001_catalog.sql
-- exists. A migration is not done until this passes (CLAUDE.md migration rule 3).

do $$
declare
  missing text[] := array[]::text[];
  t text;
  c text;
begin
  -- 9 tables
  foreach t in array array[
    'exam', 'marking_scheme', 'exam_cycle', 'subject', 'syllabus_version',
    'exam_pattern', 'pattern_section', 'syllabus_node', 'node_weightage'
  ] loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'catalog' and table_name = t
    ) then
      missing := array_append(missing, 'table:catalog.' || t);
    end if;
  end loop;

  -- named constraints: PKs, AKs (unique), FKs, and the recursive-guard check
  foreach c in array array[
    'exam_pkey', 'uq_exam_exam_code',
    'marking_scheme_pkey', 'uq_marking_scheme_scheme_code',
    'exam_cycle_pkey', 'fk_exam_cycle_exam_id', 'uq_exam_cycle_exam_id_cycle_year',
    'subject_pkey', 'fk_subject_exam_id', 'uq_subject_exam_id_subject_code',
    'syllabus_version_pkey', 'fk_syllabus_version_exam_id',
    'exam_pattern_pkey', 'fk_exam_pattern_cycle_id', 'fk_exam_pattern_scheme_id', 'uq_exam_pattern_cycle_id_version_no',
    'pattern_section_pkey', 'fk_pattern_section_pattern_id', 'fk_pattern_section_subject_id', 'fk_pattern_section_scheme_id', 'uq_pattern_section_pattern_id_sequence_no',
    'syllabus_node_pkey', 'fk_syllabus_node_syllabus_version_id', 'fk_syllabus_node_subject_id', 'fk_syllabus_node_parent_node_id', 'uq_syllabus_node_version_tag', 'ck_syllabus_node_not_self_parent',
    'node_weightage_pkey', 'fk_node_weightage_pattern_id', 'fk_node_weightage_node_id', 'uq_node_weightage_pattern_id_node_id'
  ] loop
    if not exists (
      select 1 from pg_constraint con
      join pg_namespace n on n.oid = con.connamespace
      where n.nspname = 'catalog' and con.conname = c
    ) then
      missing := array_append(missing, 'constraint:catalog.' || c);
    end if;
  end loop;

  if array_length(missing, 1) is not null then
    raise exception 'verify_001_catalog FAILED — missing: %', array_to_string(missing, ', ');
  end if;

  raise notice 'verify_001_catalog: OK — 9 tables, 30 constraints present';
end $$;
