-- =====================================================================
-- JEE Advanced — exam template
-- Template LA-TPL-EXAM-JEE-ADV
--
-- JEE Advanced carries all four response mechanics in every subject, across two
-- compulsory papers, and its section structure and marking change from year to
-- year. That is why the section rows below are per paper AND per section, and
-- why a question may additionally override marking in question_exam_usage.
--
-- Section 2 carries the partial-credit rule: a strict non-empty subset of the
-- correct options, with nothing incorrect chosen, earns partial_marks_per_correct
-- for each correct option chosen.
--
-- Prerequisites: 010_question_model.sql, 000_template_helpers.sql,
--                and the concept trees for the subjects used below.
-- Re-running this file is safe.
-- =====================================================================

-- ---------- the exam itself ----------------------------------------

insert into catalog.exam_family (family_code, family_name)
values ('JEE', 'Joint Entrance Examination')
on conflict (family_code) do nothing;

insert into catalog.exam (family_id, exam_code, exam_name, exam_level,
                          conducting_body, default_language, supported_languages)
select f.family_id, 'JEE-ADV', 'JEE Advanced', 'UG', 'JAB', 'en', array['en','ta']
  from catalog.exam_family f where f.family_code = 'JEE'
on conflict (exam_code) do nothing;

-- ---------- the scoped subject pairings ----------------------------
-- One row per subject this exam scores. display_label is what the
-- student sees, and it is the reason NEET Physics and JEE Physics stay
-- distinguishable while catalog.subject holds one Physics.

insert into catalog.exam_subject (exam_id, subject_id, display_label,
                                  question_count, total_marks, duration_minutes, sort_order)
select e.exam_id, s.subject_id, v.label, v.qc, v.marks, v.mins, v.ord
  from (values
    ('PHY', 'JEE Advanced Physics', null::smallint, null::smallint, 180::smallint, 1::smallint),
    ('CHE', 'JEE Advanced Chemistry', null::smallint, null::smallint, 180::smallint, 2::smallint),
    ('MAT', 'JEE Advanced Mathematics', null::smallint, null::smallint, 180::smallint, 3::smallint)
  ) as v(subj, label, qc, marks, mins, ord)
  join catalog.exam e on e.exam_code = 'JEE-ADV'
  join catalog.subject s on s.subject_code = v.subj
on conflict (exam_id, subject_id) do nothing;

-- ---------- the paper template -------------------------------------
-- Which shapes of question appear, in which section, how many, and what
-- each is worth. attempt_count is NULL when every question is
-- compulsory, and set when a section offers internal choice.
-- negative_marks is a POSITIVE magnitude: the scorer subtracts.

insert into catalog.exam_subject_format
  (exam_subject_id, section_code, question_format, question_count, attempt_count,
   full_marks, negative_marks, unattempted_marks, partial_scheme,
   partial_marks_per_correct, sort_order)
select es.exam_subject_id, v.sec, v.fmt, v.qc, v.ac, v.fm, v.nm, 0, v.ps, v.pmc, v.ord
  from catalog.exam_subject es
  join catalog.exam e on e.exam_id = es.exam_id and e.exam_code = 'JEE-ADV'
  cross join (values
    ('P1-S1', 'MCQ_SINGLE', 4::smallint, null::smallint, 3::numeric, 1::numeric, 'NONE', null::numeric, 1::smallint),
    ('P1-S2', 'MCQ_MULTIPLE', 6::smallint, null::smallint, 4::numeric, 2::numeric, 'PER_CORRECT_OPTION', 1::numeric, 2::smallint),
    ('P1-S3', 'NUMERICAL', 6::smallint, null::smallint, 4::numeric, 0::numeric, 'NONE', null::numeric, 3::smallint),
    ('P1-S4', 'MATCHING_LIST', 4::smallint, null::smallint, 3::numeric, 1::numeric, 'NONE', null::numeric, 4::smallint),
    ('P2-S1', 'MCQ_SINGLE', 4::smallint, null::smallint, 3::numeric, 1::numeric, 'NONE', null::numeric, 5::smallint),
    ('P2-S2', 'MCQ_MULTIPLE', 6::smallint, null::smallint, 4::numeric, 2::numeric, 'PER_CORRECT_OPTION', 1::numeric, 6::smallint),
    ('P2-S3', 'NUMERICAL', 6::smallint, null::smallint, 4::numeric, 0::numeric, 'NONE', null::numeric, 7::smallint),
    ('P2-S4', 'MATCHING_LIST', 4::smallint, null::smallint, 3::numeric, 1::numeric, 'NONE', null::numeric, 8::smallint)
  ) as v(sec, fmt, qc, ac, fm, nm, ps, pmc, ord)
on conflict (exam_subject_id, section_code, question_format) do nothing;

-- ---------- how deep this exam's syllabus tree runs -----------------

insert into catalog.node_level (exam_id, level_no, level_code, level_label, is_taggable)
select e.exam_id, v.n, v.code, initcap(v.code), v.tag
  from catalog.exam e
  cross join (values
    (1::smallint, 'subject', false),
    (2::smallint, 'unit', false),
    (3::smallint, 'chapter', true),
    (4::smallint, 'topic', true)
  ) as v(n, code, tag)
 where e.exam_code = 'JEE-ADV'
on conflict (exam_id, level_no) do nothing;

-- ---------- worked syllabus branch ---------------------------------
-- One branch of PHY filled in end to end, so the shape is unambiguous.
-- Copy this block per unit and replace the paths and names.

insert into catalog.syllabus_version (exam_subject_id, version_code, effective_from, version_status)
select es.exam_subject_id, '2026', date '2025-06-01', 'active'
  from catalog.exam_subject es
  join catalog.exam e on e.exam_id = es.exam_id and e.exam_code = 'JEE-ADV'
  join catalog.subject s on s.subject_id = es.subject_id and s.subject_code = 'PHY'
on conflict (exam_subject_id, version_code) do nothing;

select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY', 'Physics', 'subject', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH', 'Mechanics', 'unit', 1, 34.0);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/RIGID', 'Rigid Body Dynamics', 'chapter', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/RIGID/ROLL', 'Rolling on inclined surfaces', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/RIGID/ANGM', 'Angular momentum and its conservation', 'topic', 2, null);

-- The bridge. These lines are what make a question reusable across exams:
-- this exam's node and another exam's node point at the SAME concept.
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/RIGID/ROLL', 'PHY/MECH/ROTMO/ROLL');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/RIGID/ANGM', 'PHY/MECH/ROTMO/ANGMOM');

-- Check your work:
--   select tree, node_path from catalog.v_syllabus_tree where exam_code='JEE-ADV';
--   select * from catalog.v_concept_coverage where exam_code='JEE-ADV';
