-- =====================================================================
-- Image block
-- Template LA-TPL-BLK-IMAGE
--
-- A photograph, micrograph or scanned figure. The bytes live in object
-- storage; the database holds the URI, the dimensions and a checksum.
-- The checksum is what deduplicates: the same figure used in twelve
-- questions is one row in content.asset.
--
-- USE THIS FOR:  photographs, micrographs, scanned figures, labelled anatomical diagrams
-- DO NOT USE FOR: a table — store that structurally; a formula — store that as LaTeX;
-- a screenshot of text of any kind, which is unsearchable and untranslatable
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
select 'd0000000-0000-0000-0000-000000000004',
       content.next_lumen_id('BOT', 'DEMO'),
       subject_id, 'MCQ_SINGLE', 'APPLY', 'L3', 'DRAFT'
  from catalog.subject where subject_code = 'BOT';

-- ---------- STORE ----------------------------------------------------
-- One row per distinct binary. Compute the SHA-256 at upload time and pass
-- it here; the unique index means a re-upload of the same file is caught.
insert into content.asset
  (asset_id, asset_kind, storage_uri, mime_type, byte_size, width_px, height_px, checksum_sha256)
values
  ('c0000000-0000-0000-0000-000000000001', 'LABELLED_DIAGRAM',
   'assets/bot/anatomy/ts-dicot-stem.png', 'image/png', 184320, 900, 640,
   repeat('1', 64));

-- The block attaches that asset to a question. alt_text is compulsory and
-- is enforced by constraint: a visual with no alt text is a visual a
-- student on a slow connection or a screen reader cannot use.
insert into content.content_block
  (question_id, block_role, seq, block_type, asset_id, alt_text, caption)
values
  ('d0000000-0000-0000-0000-000000000004', 'STEM', 1, 'IMAGE', 'c0000000-0000-0000-0000-000000000001',
   'Transverse section of a dicotyledonous stem showing epidermis, cortex, vascular bundles arranged in a ring, and central pith',
   'Figure 1: T.S. of a dicot stem');

-- Reuse: the SAME asset attached to a different question is a second block
-- row, never a second upload.

-- ---------- RETRIEVE -------------------------------------------------
select b.seq, b.block_type, a.storage_uri, a.mime_type,
       a.width_px, a.height_px, b.alt_text, b.caption
  from content.content_block b
  join content.asset a on a.asset_id = b.asset_id
 where b.question_id = 'd0000000-0000-0000-0000-000000000004'
 order by b.seq;

-- How many questions share this asset:
select count(*) as used_by_questions
  from content.content_block
 where asset_id = 'c0000000-0000-0000-0000-000000000001';

rollback;
