-- =====================================================================
-- 000_template_helpers.sql
--
-- Load once, before any template file. These exist so a subject or exam
-- template is a readable list of one line per node rather than a chain
-- of nested CTEs. Parent, depth and level are derived from the path, so
-- a person editing a template only ever types the path and the name.
-- =====================================================================

-- ---------------------------------------------------------------------
-- catalog.upsert_concept('PHY', 'PHY/MECH/ROTMO', 'Rotational Motion', true, 1)
--   Path segments are codes. The parent is the path minus its last
--   segment and must already exist. Re-running is safe.
-- ---------------------------------------------------------------------
create or replace function catalog.upsert_concept(
  p_subject   text,
  p_path      text,
  p_name      text,
  p_taggable  boolean default false,
  p_sort      integer default 0
) returns uuid
language plpgsql
as $$
declare
  v_subject_id uuid;
  v_parent_id  uuid;
  v_parent_path text;
  v_code       text;
  v_depth      smallint;
  v_id         uuid;
begin
  select subject_id into v_subject_id
    from catalog.subject where subject_code = p_subject;
  if v_subject_id is null then
    raise exception 'No subject with code %', p_subject;
  end if;

  if split_part(p_path, '/', 1) <> p_subject then
    raise exception 'Path % must begin with the subject code %', p_path, p_subject;
  end if;

  v_depth := array_length(string_to_array(p_path, '/'), 1);
  v_code  := split_part(p_path, '/', v_depth);

  if v_depth > 1 then
    v_parent_path := left(p_path, length(p_path) - length(v_code) - 1);
    select concept_id into v_parent_id
      from catalog.concept_node
     where subject_id = v_subject_id and concept_path = v_parent_path;
    if v_parent_id is null then
      raise exception 'Parent % does not exist yet — define it before %', v_parent_path, p_path;
    end if;
  end if;

  insert into catalog.concept_node
    (subject_id, parent_id, concept_code, concept_name, concept_path, depth, is_taggable, sort_order)
  values
    (v_subject_id, v_parent_id, v_code, p_name, p_path, v_depth, p_taggable, p_sort::smallint)
  on conflict (subject_id, concept_path) do update
    set concept_name = excluded.concept_name,
        is_taggable  = excluded.is_taggable,
        sort_order   = excluded.sort_order
  returning concept_id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- catalog.upsert_syllabus_node('NEET-UG','PHY','2026','PHY/U08/CH01',
--                              'Rotational Motion','chapter', 1, null)
-- ---------------------------------------------------------------------
create or replace function catalog.upsert_syllabus_node(
  p_exam      text,
  p_subject   text,
  p_version   text,
  p_path      text,
  p_name      text,
  p_node_type text,
  p_sort      integer default 0,
  p_weightage numeric default null
) returns uuid
language plpgsql
as $$
declare
  v_version_id uuid;
  v_parent_id  uuid;
  v_parent_path text;
  v_code       text;
  v_level      smallint;
  v_id         uuid;
begin
  select sv.syllabus_version_id into v_version_id
    from catalog.syllabus_version sv
    join catalog.exam_subject es on es.exam_subject_id = sv.exam_subject_id
    join catalog.exam e          on e.exam_id = es.exam_id
    join catalog.subject s       on s.subject_id = es.subject_id
   where e.exam_code = p_exam and s.subject_code = p_subject and sv.version_code = p_version;

  if v_version_id is null then
    raise exception 'No syllabus version % for % %', p_version, p_exam, p_subject;
  end if;

  v_level := array_length(string_to_array(p_path, '/'), 1);
  v_code  := split_part(p_path, '/', v_level);

  if v_level > 1 then
    v_parent_path := left(p_path, length(p_path) - length(v_code) - 1);
    select node_id into v_parent_id
      from catalog.syllabus_node
     where syllabus_version_id = v_version_id and node_path = v_parent_path;
    if v_parent_id is null then
      raise exception 'Parent % does not exist yet — define it before %', v_parent_path, p_path;
    end if;
  end if;

  insert into catalog.syllabus_node
    (syllabus_version_id, parent_node_id, node_code, node_name, node_path,
     level_no, node_type, sort_order, weightage_pct)
  values
    (v_version_id, v_parent_id, v_code, p_name, p_path, v_level, p_node_type, p_sort, p_weightage)
  on conflict (syllabus_version_id, node_path) do update
    set node_name     = excluded.node_name,
        node_type     = excluded.node_type,
        sort_order    = excluded.sort_order,
        weightage_pct = excluded.weightage_pct
  returning node_id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- catalog.map_node_concept('NEET-UG','PHY','2026',
--                          'PHY/U08/CH01/T01','PHY/MECH/ROTMO/ROLL')
--   The bridge. This is the line that makes a question reusable across
--   exams: both exams' nodes point at the same canonical concept.
-- ---------------------------------------------------------------------
create or replace function catalog.map_node_concept(
  p_exam         text,
  p_subject      text,
  p_version      text,
  p_node_path    text,
  p_concept_path text,
  p_coverage     text default 'full'
) returns void
language plpgsql
as $$
declare
  v_node_id    uuid;
  v_concept_id uuid;
begin
  select sn.node_id into v_node_id
    from catalog.syllabus_node sn
    join catalog.syllabus_version sv on sv.syllabus_version_id = sn.syllabus_version_id
    join catalog.exam_subject es on es.exam_subject_id = sv.exam_subject_id
    join catalog.exam e   on e.exam_id = es.exam_id
    join catalog.subject s on s.subject_id = es.subject_id
   where e.exam_code = p_exam and s.subject_code = p_subject
     and sv.version_code = p_version and sn.node_path = p_node_path;

  if v_node_id is null then
    raise exception 'No syllabus node % for % % %', p_node_path, p_exam, p_subject, p_version;
  end if;

  select cn.concept_id into v_concept_id
    from catalog.concept_node cn
    join catalog.subject s on s.subject_id = cn.subject_id
   where s.subject_code = p_subject and cn.concept_path = p_concept_path;

  if v_concept_id is null then
    raise exception 'No concept % in subject %', p_concept_path, p_subject;
  end if;

  insert into catalog.syllabus_node_concept (node_id, concept_id, coverage)
  values (v_node_id, v_concept_id, p_coverage)
  on conflict (node_id, concept_id) do update set coverage = excluded.coverage;
end;
$$;

-- ---------------------------------------------------------------------
-- Readability views. These are what a person opens to check their work.
-- ---------------------------------------------------------------------

create or replace view catalog.v_concept_tree as
select s.subject_code,
       cn.depth,
       repeat('    ', cn.depth - 1) || cn.concept_name as tree,
       cn.concept_path,
       cn.is_taggable
  from catalog.concept_node cn
  join catalog.subject s on s.subject_id = cn.subject_id
 order by s.subject_code, cn.concept_path;

create or replace view catalog.v_syllabus_tree as
select e.exam_code,
       s.subject_code,
       sv.version_code,
       sn.level_no,
       repeat('    ', sn.level_no - 1) || sn.node_name as tree,
       sn.node_path,
       sn.node_type,
       sn.weightage_pct
  from catalog.syllabus_node sn
  join catalog.syllabus_version sv on sv.syllabus_version_id = sn.syllabus_version_id
  join catalog.exam_subject es on es.exam_subject_id = sv.exam_subject_id
  join catalog.exam e   on e.exam_id = es.exam_id
  join catalog.subject s on s.subject_id = es.subject_id
 order by e.exam_code, s.subject_code, sn.node_path;

-- Which exams can reach which concept, and by what path. Open this when
-- you want to know why a question is or is not eligible for an exam.
create or replace view catalog.v_concept_coverage as
select s.subject_code,
       cn.concept_path,
       cn.concept_name,
       e.exam_code,
       sn.node_path as exam_path,
       snc.coverage
  from catalog.concept_node cn
  join catalog.subject s on s.subject_id = cn.subject_id
  left join catalog.syllabus_node_concept snc on snc.concept_id = cn.concept_id
  left join catalog.syllabus_node sn on sn.node_id = snc.node_id
  left join catalog.syllabus_version sv on sv.syllabus_version_id = sn.syllabus_version_id
  left join catalog.exam_subject es on es.exam_subject_id = sv.exam_subject_id
  left join catalog.exam e on e.exam_id = es.exam_id
 where cn.is_taggable
 order by s.subject_code, cn.concept_path, e.exam_code;
