-- =====================================================================
-- Table block
-- Template LA-TPL-BLK-TABLE
--
-- A table stored as structure — columns and rows as JSONB — rather than
-- as a picture of a table. It stays searchable, translatable and readable
-- by a screen reader, and re-renders at any width. Match-the-following
-- grids use the same table with table_kind = MATCHING_GRID.
--
-- USE THIS FOR:  data-interpretation tables, given-value tables, matching grids, comparison tables
-- DO NOT USE FOR: a table that is genuinely part of a photographed figure — that is IMAGE
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
select 'd0000000-0000-0000-0000-000000000007',
       content.next_lumen_id('CHE', 'DEMO'),
       subject_id, 'MCQ_SINGLE', 'APPLY', 'L3', 'DRAFT'
  from catalog.subject where subject_code = 'CHE';

-- ---------- STORE ----------------------------------------------------
insert into content.data_table (table_id, table_kind, caption, column_defs, row_data, units)
values
  ('b0000000-0000-0000-0000-000000000003', 'TABLE',
   'Masses taken in each trial',
   '["Trial","Mass of Mg","Mass of HCl"]'::jsonb,
   '[["I",2.4,7.3],["II",4.8,7.3],["III",2.4,14.6],["IV",4.8,14.6]]'::jsonb,
   '["","g","g"]'::jsonb);

insert into content.content_block
  (question_id, block_role, seq, block_type, table_id, caption)
values
  ('d0000000-0000-0000-0000-000000000007', 'STEM', 1, 'TABLE', 'b0000000-0000-0000-0000-000000000003',
   'Table 1');

-- A matching grid is the same structure with a different kind, so the
-- renderer knows to lay it out as two labelled lists.
insert into content.data_table (table_id, table_kind, caption, column_defs, row_data)
values
  ('b0000000-0000-0000-0000-000000000004', 'MATCHING_GRID',
   'Match List-I with List-II',
   '["List-I","List-II"]'::jsonb,
   '[["P. Solid sphere","1. 2/7"],["Q. Solid cylinder","2. 1/3"],["R. Hollow cylinder","3. 1/2"]]'::jsonb);

-- ---------- RETRIEVE -------------------------------------------------
select b.seq, dt.table_kind, dt.caption, dt.column_defs, dt.row_data, dt.units
  from content.content_block b
  join content.data_table dt on dt.table_id = b.table_id
 where b.question_id = 'd0000000-0000-0000-0000-000000000007'
 order by b.seq;

-- Flatten to rows for a console view or a CSV export:
select ordinality as row_no, value as row_values
  from content.data_table dt,
       jsonb_array_elements(dt.row_data) with ordinality
 where dt.table_id = 'b0000000-0000-0000-0000-000000000003';

-- Search inside table content, which a screenshot could never support:
select table_id, caption
  from content.data_table
 where row_data::text ilike '%14.6%';

rollback;
