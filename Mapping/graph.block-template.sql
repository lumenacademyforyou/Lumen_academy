-- =====================================================================
-- Graph block
-- Template LA-TPL-BLK-GRAPH
--
-- A plot. Two storage strategies, and which you choose matters:
--   (a) a rendered figure in content.asset, when the plot is a fixed
--       picture the student reads off;
--   (b) the underlying series in content.data_table with a DATASET
--       block, when the plot should be drawn by the client — this keeps
--       it legible on a phone, re-themable, and readable aloud.
-- Prefer (b) whenever the data is simple enough to plot from.
--
-- USE THIS FOR:  v-t graphs, titration curves, population curves, any read-the-plot item
-- DO NOT USE FOR: a circuit or an apparatus sketch — those are CIRCUIT and EXPERIMENTAL_SETUP
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
select 'd0000000-0000-0000-0000-000000000005',
       content.next_lumen_id('PHY', 'DEMO'),
       subject_id, 'MCQ_SINGLE', 'APPLY', 'L3', 'DRAFT'
  from catalog.subject where subject_code = 'PHY';

-- ---------- STORE, strategy (a): a rendered figure --------------------
insert into content.asset
  (asset_id, asset_kind, storage_uri, mime_type, width_px, height_px, checksum_sha256)
values
  ('c0000000-0000-0000-0000-000000000002', 'GRAPH',
   'assets/phy/kinem/velocity-time-piecewise.svg', 'image/svg+xml', 640, 400,
   repeat('2', 64));

insert into content.content_block
  (question_id, block_role, seq, block_type, asset_id, alt_text, caption)
values
  ('d0000000-0000-0000-0000-000000000005', 'STEM', 1, 'GRAPH', 'c0000000-0000-0000-0000-000000000002',
   'Velocity-time graph rising linearly from 0 to 20 metres per second over 4 seconds, constant until 10 seconds, then falling to zero at 14 seconds',
   'Figure 1');

-- ---------- STORE, strategy (b): the series itself --------------------
-- The client plots this. It stays legible at any width and a screen reader
-- can read the values, which a rendered PNG cannot offer.
insert into content.data_table (table_id, table_kind, caption, column_defs, row_data, units)
values
  ('b0000000-0000-0000-0000-000000000001', 'DATASET',
   'Velocity against time',
   '["t","v"]'::jsonb,
   '[[0,0],[4,20],[10,20],[14,0]]'::jsonb,
   '["s","m s^-1"]'::jsonb);

insert into content.content_block
  (question_id, block_role, seq, block_type, table_id, caption)
values
  ('d0000000-0000-0000-0000-000000000005', 'STEM', 2, 'DATASET', 'b0000000-0000-0000-0000-000000000001',
   'Plot v against t');

-- ---------- RETRIEVE -------------------------------------------------
select b.seq, b.block_type,
       a.storage_uri            as figure_uri,
       dt.column_defs           as series_columns,
       dt.row_data              as series_points,
       dt.units,
       coalesce(b.alt_text, dt.caption) as description
  from content.content_block b
  left join content.asset a       on a.asset_id  = b.asset_id
  left join content.data_table dt on dt.table_id = b.table_id
 where b.question_id = 'd0000000-0000-0000-0000-000000000005'
 order by b.seq;

rollback;
