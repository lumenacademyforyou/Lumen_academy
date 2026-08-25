-- =====================================================================
-- Circuit diagram block
-- Template LA-TPL-BLK-CIRCUIT
--
-- A circuit schematic. Stored as a vector asset, with the component
-- values kept alongside as a structured table so the same schematic can
-- be reused with different values, and so the values remain searchable.
-- SVG is strongly preferred over PNG: it stays sharp at every zoom level,
-- which matters on a phone during a timed paper.
--
-- USE THIS FOR:  resistor networks, Wheatstone bridges, LCR circuits, logic gate diagrams
-- DO NOT USE FOR: an apparatus photograph — that is IMAGE or EXPERIMENTAL_SETUP
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
select 'd0000000-0000-0000-0000-000000000006',
       content.next_lumen_id('PHY', 'DEMO'),
       subject_id, 'MCQ_SINGLE', 'APPLY', 'L3', 'DRAFT'
  from catalog.subject where subject_code = 'PHY';

-- ---------- STORE ----------------------------------------------------
insert into content.asset
  (asset_id, asset_kind, storage_uri, mime_type, width_px, height_px, checksum_sha256)
values
  ('c0000000-0000-0000-0000-000000000003', 'CIRCUIT',
   'assets/phy/elec/wheatstone-bridge.svg', 'image/svg+xml', 720, 460,
   repeat('3', 64));

insert into content.content_block
  (question_id, block_role, seq, block_type, asset_id, alt_text, caption)
values
  ('d0000000-0000-0000-0000-000000000006', 'STEM', 1, 'CIRCUIT', 'c0000000-0000-0000-0000-000000000003',
   'Wheatstone bridge with resistors P and Q in the upper arms, R and S in the lower arms, a galvanometer across the bridge and a cell with a key in the main circuit',
   'Figure 1: Wheatstone bridge');

-- Component values as data, not as text baked into the drawing. The same
-- schematic then serves many questions with different values.
insert into content.data_table (table_id, table_kind, caption, column_defs, row_data, units)
values
  ('b0000000-0000-0000-0000-000000000002', 'TABLE',
   'Component values',
   '["Component","Value"]'::jsonb,
   '[["P","10"],["Q","20"],["R","30"],["S","unknown"],["EMF","6"]]'::jsonb,
   '["","ohm"]'::jsonb);

insert into content.content_block
  (question_id, block_role, seq, block_type, table_id, caption)
values
  ('d0000000-0000-0000-0000-000000000006', 'STEM', 2, 'TABLE', 'b0000000-0000-0000-0000-000000000002', 'Values used');

-- ---------- RETRIEVE -------------------------------------------------
select b.seq, b.block_type, a.storage_uri, a.mime_type, b.alt_text,
       dt.column_defs, dt.row_data, dt.units
  from content.content_block b
  left join content.asset a       on a.asset_id  = b.asset_id
  left join content.data_table dt on dt.table_id = b.table_id
 where b.question_id = 'd0000000-0000-0000-0000-000000000006'
 order by b.seq;

-- Every question that reuses this schematic:
select q.lumen_id
  from content.content_block b
  join content.question q on q.question_id = b.question_id
 where b.asset_id = 'c0000000-0000-0000-0000-000000000003';

rollback;
