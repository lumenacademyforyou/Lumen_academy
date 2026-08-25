-- =====================================================================
-- NEET (UG) — exam template
-- Template LA-TPL-EXAM-NEET-UG
--
-- NEET has one response mechanic throughout: the four-option single-correct MCQ.
-- A calculation-heavy item is still MCQ_SINGLE; the calculation is recorded on
-- the question as is_numerical, which is a characteristic and not a format.
--
-- OPEN ITEM: sources disagree on whether the 2026 paper carries an optional
-- Section B with internal choice. The template below assumes one compulsory
-- section of 45. If the bulletin says otherwise, change the section rows only —
-- attempt_count already carries "answer any N of M" and no migration is needed.
--
-- Prerequisites: 010_question_model.sql, 000_template_helpers.sql,
--                and the concept trees for the subjects used below.
-- Re-running this file is safe.
-- =====================================================================

-- ---------- the exam itself ----------------------------------------

insert into catalog.exam_family (family_code, family_name)
values ('NEET', 'National Eligibility cum Entrance Test')
on conflict (family_code) do nothing;

insert into catalog.exam (family_id, exam_code, exam_name, exam_level,
                          conducting_body, default_language, supported_languages)
select f.family_id, 'NEET-UG', 'NEET (UG)', 'UG', 'NTA', 'en', array['en','ta','hi']
  from catalog.exam_family f where f.family_code = 'NEET'
on conflict (exam_code) do nothing;

-- ---------- the scoped subject pairings ----------------------------
-- One row per subject this exam scores. display_label is what the
-- student sees, and it is the reason NEET Physics and JEE Physics stay
-- distinguishable while catalog.subject holds one Physics.

insert into catalog.exam_subject (exam_id, subject_id, display_label,
                                  question_count, total_marks, duration_minutes, sort_order)
select e.exam_id, s.subject_id, v.label, v.qc, v.marks, v.mins, v.ord
  from (values
    ('PHY', 'NEET Physics', 45::smallint, 180::smallint, 180::smallint, 1::smallint),
    ('CHE', 'NEET Chemistry', 45::smallint, 180::smallint, 180::smallint, 2::smallint),
    ('BOT', 'NEET Botany', 45::smallint, 180::smallint, 180::smallint, 3::smallint),
    ('ZOO', 'NEET Zoology', 45::smallint, 180::smallint, 180::smallint, 4::smallint)
  ) as v(subj, label, qc, marks, mins, ord)
  join catalog.exam e on e.exam_code = 'NEET-UG'
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
  join catalog.exam e on e.exam_id = es.exam_id and e.exam_code = 'NEET-UG'
  cross join (values
    ('A', 'MCQ_SINGLE', 45::smallint, null::smallint, 4::numeric, 1::numeric, 'NONE', null::numeric, 1::smallint)
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
 where e.exam_code = 'NEET-UG'
on conflict (exam_id, level_no) do nothing;

-- ---------- worked syllabus branch ---------------------------------
-- One branch of PHY filled in end to end, so the shape is unambiguous.
-- Copy this block per unit and replace the paths and names.

insert into catalog.syllabus_version (exam_subject_id, version_code, effective_from, version_status)
select es.exam_subject_id, '2026', date '2025-06-01', 'active'
  from catalog.exam_subject es
  join catalog.exam e on e.exam_id = es.exam_id and e.exam_code = 'NEET-UG'
  join catalog.subject s on s.subject_id = es.subject_id and s.subject_code = 'PHY'
on conflict (exam_subject_id, version_code) do nothing;

select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY', 'Physics', 'subject', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U08', 'Motion of System of Particles and Rigid Body', 'unit', 8, 7.5);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U08/CH01', 'Rotational Motion', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U08/CH01/T01', 'Rolling motion without slipping', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U08/CH01/T02', 'Moment of inertia and radius of gyration', 'topic', 2, null);

-- The bridge. These lines are what make a question reusable across exams:
-- this exam's node and another exam's node point at the SAME concept.
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U08/CH01/T01', 'PHY/MECH/ROTMO/ROLL');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U08/CH01/T02', 'PHY/MECH/ROTMO/MOMIN');

-- Check your work:
--   select tree, node_path from catalog.v_syllabus_tree where exam_code='NEET-UG';
--   select * from catalog.v_concept_coverage where exam_code='NEET-UG';
