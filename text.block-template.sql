-- =====================================================================
-- Plain prose block
-- Template LA-TPL-BLK-TEXT
--
-- Ordinary sentences with no mathematical markup. The cheapest block
-- type, and the one most stems begin with.
--
-- USE THIS FOR:  narrative setup, instructions, a statement to be judged true or false
-- DO NOT USE FOR: anything containing a formula — use LATEX so it renders instead of showing raw backslashes
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
select 'd0000000-0000-0000-0000-000000000001',
       content.next_lumen_id('PHY', 'DEMO'),
       subject_id, 'MCQ_SINGLE', 'APPLY', 'L3', 'DRAFT'
  from catalog.subject where subject_code = 'PHY';

-- ---------- STORE ----------------------------------------------------
insert into content.content_block
  (question_id, block_role, seq, block_type, text_content, text_format)
values
  ('d0000000-0000-0000-0000-000000000001', 'STEM', 1, 'TEXT',
   'A uniform solid cylinder rolls without slipping down a rough incline.',
   'PLAIN');

-- text_format may be PLAIN, MARKDOWN or HTML here. MARKDOWN is useful when
-- the prose needs a bulleted list or bold emphasis; the renderer is told
-- which by this column and never has to guess.
insert into content.content_block
  (question_id, block_role, seq, block_type, text_content, text_format)
values
  ('d0000000-0000-0000-0000-000000000001', 'STEM', 2, 'TEXT',
   'Assume that:\n\n- friction is sufficient to prevent slipping\n- air resistance is negligible',
   'MARKDOWN');

-- ---------- RETRIEVE -------------------------------------------------
select seq, block_type, text_format, text_content
  from content.content_block
 where question_id = 'd0000000-0000-0000-0000-000000000001' and block_role = 'STEM' and language_code = 'en'
 order by seq;

rollback;
