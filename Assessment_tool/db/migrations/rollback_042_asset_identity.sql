-- rollback_042_asset_identity — reverses migration 042.
--
-- ****************************************************************************
-- WHAT THIS CAN AND CANNOT RESTORE
--
-- CAN: the schema (columns, trigger, index) and the removed content.asset ROW,
--      which was archived in full to content.asset_archive before deletion.
--
-- CANNOT: the storage BYTES. db/scripts/prune-orphan-assets.ts deleted 17
--      objects from the content-assets bucket and object storage has no undo.
--      Restoring the asset row below therefore recreates a row whose
--      storage_uri points at an object that no longer exists — the row will
--      resolve to a 404 until the file is re-uploaded from a backup.
--
--      Before running this, decide whether you actually want that. The removed
--      row was LEGACY-13's stem image, and it was removed because it was
--      MIS-ATTACHED: a stoichiometry diagram on a boiling-point-elevation
--      question whose stem references no diagram at all. Restoring it restores
--      a known content bug.
-- ****************************************************************************

begin;

-- 1. Drop the constraint first, or restoring a duplicate stem image fails.
drop index if exists content.uq_asset_stem_checksum;

-- 2. Restore archived asset rows (skip any whose question is gone).
insert into content.asset
  (asset_id, question_id, storage_uri, checksum_sha256, image_phash, target_role, mime_type, display_order, asset_type)
select ar.asset_id, ar.question_id, ar.storage_uri, ar.checksum_sha256, ar.image_phash,
       ar.target_role, ar.mime_type, 0, 'image'
  from content.asset_archive ar
 where ar.reason like 'mis-attached duplicate:%'
   and exists (select 1 from content.question q where q.question_id = ar.question_id)
   and not exists (select 1 from content.asset a where a.asset_id = ar.asset_id)
on conflict (asset_id) do nothing;

-- 3. Triggers and derived columns.
drop trigger if exists trg_asset_identity_sync on content.asset;
drop function if exists content.trg_asset_identity_sync();

drop index if exists content.ix_asset_node;
drop index if exists content.ix_asset_checksum;
drop index if exists content.ix_asset_phash;

alter table content.asset
  drop column if exists image_phash,
  drop column if exists node_id;

-- 4. The archive goes last — steps above read from it.
--    Commented out by default: it is the only record of what was removed, and
--    keeping it costs nothing. Uncomment only for a truly clean teardown.
-- drop table if exists content.asset_archive;

-- NOT reversed, deliberately:
--   * content.question.has_image / image_phash for LEGACY-13. Migration 028's
--     trigger recomputes has_image from the asset rows, so restoring the asset
--     in step 2 restores has_image on its own. image_phash was NULL before
--     migration 041's backfill anyway.
--   * The 17 deleted storage objects — see the header.

commit;
