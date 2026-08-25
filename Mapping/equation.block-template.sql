-- =====================================================================
-- Named equation block
-- Template LA-TPL-BLK-EQUATION
--
-- A displayed equation stored as a first-class object with a name and
-- defined variables, rather than as a string buried in a stem. This is
-- what makes "which questions exercise the rolling-acceleration relation"
-- a query instead of a text search, and it renders identically everywhere
-- the same relation appears.
--
-- USE THIS FOR:  a displayed formula, a relation the syllabus names, anything reused across questions
-- DO NOT USE FOR: a symbol inside a sentence — that is a LATEX block
--
-- This file runs as a live demonstration: it creates a scratch question,
-- stores the content, reads it back, and rolls everything back so nothing
-- is left behind. To use it for real, delete the BEGIN and ROLLBACK lines
-- and point question_id at your own question.
-- =====================================================================

begin;

-- scratch question so the file runs standalone
insert into content.question (question_id, lumen_id, subject_id, base_format,
                              cognitive_skill, base_difficulty, review_status)
select 'd0000000-0000-0000-0000-000000000003',
       content.next_lumen_id('PHY', 'DEMO'),
       subject_id, 'MCQ_SINGLE', 'APPLY', 'L3', 'DRAFT'
  from catalog.subject where subject_code = 'PHY';

-- ---------- STORE ----------------------------------------------------
insert into content.equation (equation_id, latex_source, display_mode, equation_name)
values ('f0000000-0000-0000-0000-000000000001',
        'a = \frac{{g \sin\theta}}{{1 + I/MR^{{2}}}}',
        'DISPLAY',
        'Acceleration of a rolling body on an incline');

-- Naming each symbol is what turns the equation from a picture into data.
insert into content.equation_variable (equation_id, symbol, meaning, si_unit, sort_order) values
  ('f0000000-0000-0000-0000-000000000001', 'a',      'linear acceleration of the centre of mass', 'm s^-2', 1),
  ('f0000000-0000-0000-0000-000000000001', 'g',      'acceleration due to gravity',               'm s^-2', 2),
  ('f0000000-0000-0000-0000-000000000001', 'theta',  'angle of the incline',                      'rad',    3),
  ('f0000000-0000-0000-0000-000000000001', 'I',      'moment of inertia about the symmetry axis', 'kg m^2', 4),
  ('f0000000-0000-0000-0000-000000000001', 'M',      'mass of the body',                          'kg',     5),
  ('f0000000-0000-0000-0000-000000000001', 'R',      'radius of the body',                        'm',      6);

insert into content.content_block
  (question_id, block_role, seq, block_type, equation_id, caption)
values
  ('d0000000-0000-0000-0000-000000000003', 'STEM', 1, 'EQUATION', 'f0000000-0000-0000-0000-000000000001',
   'General result for a body rolling without slipping');

-- ---------- RETRIEVE -------------------------------------------------
select b.seq, e.equation_name, e.display_mode, e.latex_source, b.caption
  from content.content_block b
  join content.equation e on e.equation_id = b.equation_id
 where b.question_id = 'd0000000-0000-0000-0000-000000000003'
 order by b.seq;

select symbol, meaning, si_unit
  from content.equation_variable
 where equation_id = 'f0000000-0000-0000-0000-000000000001'
 order by sort_order;

-- Every question that uses this relation, across every subject and exam:
select q.lumen_id
  from content.content_block b
  join content.question q on q.question_id = b.question_id
 where b.equation_id = 'f0000000-0000-0000-0000-000000000001';

rollback;
