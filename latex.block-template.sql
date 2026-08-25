-- =====================================================================
-- Inline LaTeX block
-- Template LA-TPL-BLK-LATEX
--
-- Prose that carries mathematical notation inline. The text is stored
-- as LaTeX source and rendered by KaTeX in the browser — the database
-- never stores an image of an equation that sits inside a sentence.
--
-- USE THIS FOR:  a sentence containing symbols, fractions, subscripts or Greek letters
-- DO NOT USE FOR: a standalone displayed equation that is referenced or reused — use an
-- EQUATION block so it becomes a named object with defined variables
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
select 'd0000000-0000-0000-0000-000000000002',
       content.next_lumen_id('PHY', 'DEMO'),
       subject_id, 'MCQ_SINGLE', 'APPLY', 'L3', 'DRAFT'
  from catalog.subject where subject_code = 'PHY';

-- ---------- STORE ----------------------------------------------------
-- Note the doubled backslashes: this is SQL string escaping, not LaTeX.
-- What lands in the column is a single backslash.
insert into content.content_block
  (question_id, block_role, seq, block_type, text_content, text_format)
values
  ('d0000000-0000-0000-0000-000000000002', 'STEM', 1, 'LATEX',
   'Given $I = \tfrac{{1}}{{2}}MR^{{2}}$ and $\theta = 30^\circ$, find the acceleration $a$.',
   'LATEX');

-- Options carry their own blocks, so an option may be pure notation.
insert into content.question_option (option_id, question_id, option_label, is_correct, display_order)
values ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'A', true, 1);

insert into content.content_block
  (option_id, block_role, seq, block_type, text_content, text_format)
values
  ('e0000000-0000-0000-0000-000000000001', 'OPTION', 1, 'LATEX',
   '$\tfrac{{2}}{{3}}g\sin\theta$', 'LATEX');

-- ---------- RETRIEVE -------------------------------------------------
-- The client renders text_content with KaTeX whenever text_format = 'LATEX'.
select b.block_role, b.seq, b.text_format, b.text_content
  from content.content_block b
  left join content.question_option o on o.option_id = b.option_id
 where b.question_id = 'd0000000-0000-0000-0000-000000000002' or o.question_id = 'd0000000-0000-0000-0000-000000000002'
 order by b.block_role, b.seq;

-- ---------- VALIDATE BEFORE IMPORT -----------------------------------
-- The database cannot tell whether LaTeX parses. The importer must run
-- every LATEX block through KaTeX and reject the row if it throws, so a
-- broken formula fails at load rather than in front of a student.

rollback;
