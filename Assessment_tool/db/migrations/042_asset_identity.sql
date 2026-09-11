-- 042_asset_identity — the question-identity logic (037-041) applied to images.
--
-- WHAT THE AUDIT OF content.asset FOUND
-- -------------------------------------
-- Three distinct defects, all live:
--
--   1. EVERY image is stored TWICE. Migration 024's rename (human-readable
--      name -> id-based name) COPIED instead of MOVED, so the original
--      "CHE_SOMBAS_DIAG_0001.png" sits alongside the referenced
--      "q_<uuid>_stem_01.png". 15 orphan objects, none referenced by any DB
--      row. content.asset_rename_log records every old_path -> new_path pair,
--      so this is provable rather than inferred.
--
--   2. One object under a question that DOES NOT EXIST —
--      question/c1195717-c179-42aa-b983-9aad9c07bdb3/CHE_SOMBAS_DIAG_0002.png.
--      No content.question row, no content.asset row.
--
--   3. A genuine CONTENT bug, not just wasted bytes. The same image
--      (sha 1bb672cfb0f8..., phash c488888080606000) is the stem image of two
--      questions:
--        LMN-CHEM-CHEM08-000119 — "The diagram shows the molecules available
--          before the reaction 2H2 + O2 -> 2H2O..." — genuinely needs it, and
--          its node ("Some Basic Concepts & States of Matter") matches the
--          filename's own topic code SOMBAS.
--        LEGACY-13 — "Which of the following solutions will have the highest
--          boiling point elevation at the same concentration?" — a pure text
--          question that references no diagram at all, filed under
--          "Electrochemistry, Solutions & Surface Chem", which does NOT match
--          SOMBAS. It is the only one of the 15 whose filename topic code
--          disagrees with its question's node.
--      So LEGACY-13 carries a stoichiometry diagram above a colligative
--      -properties question, and (because has_image is true) it also wrongly
--      qualifies for Image Only Practice.
--
-- THE MAPPING LOGIC
-- -----------------
-- The human-readable filename encodes subject + topic (CHE_SOMBAS, PHY_NLM,
-- ZOO_BREAND, BOT_PHOIN, CHE_CHEBON). Cross-checking that code against the
-- owning question's syllabus node is what identifies a mis-attached image —
-- 14 of 15 agree, and the one that disagrees is the bug. That check is shipped
-- as db/scripts/report-asset-node-mismatch.ts so it can be re-run on ingest.
--
-- WHAT THIS MIGRATION DOES
--   * gives content.asset its own image_phash (perceptual, like the question's)
--   * gives content.asset a node_id, trigger-maintained from its question, so
--     images stop being isolated from the syllabus tree
--   * makes content.question.image_phash trigger-derived from the stem asset
--     instead of a value a script writes and nothing keeps in sync
--   * archives and removes the mis-attached LEGACY-13 asset row
--   * adds the unique index that stops one image becoming two questions' stem
--
-- Storage objects are NOT touched here — SQL cannot delete from object
-- storage. db/scripts/prune-orphan-assets.ts does that, with a dry run.

begin;

-- ---------------------------------------------------------------------------
-- 1. Identity + node columns on the asset itself
-- ---------------------------------------------------------------------------

alter table content.asset
  add column if not exists image_phash bytea,
  add column if not exists node_id uuid references catalog.syllabus_node (node_id);

comment on column content.asset.image_phash is
  'Perceptual (dHash) hash of this asset. checksum_sha256 already existed but is cryptographic — it cannot see the same diagram re-exported at another DPI, which is exactly the duplicate class that matters.';
comment on column content.asset.node_id is
  'Syllabus node this asset belongs to, trigger-derived from its question. Assets previously had no link to the syllabus tree at all, so images could not be listed or audited per unit/topic.';

create index if not exists ix_asset_node on content.asset (node_id) where node_id is not null;
create index if not exists ix_asset_checksum on content.asset (checksum_sha256) where checksum_sha256 is not null;
create index if not exists ix_asset_phash on content.asset (image_phash) where image_phash is not null;

-- ---------------------------------------------------------------------------
-- 2. Archive table — nothing is deleted without a recoverable record
-- ---------------------------------------------------------------------------

create table if not exists content.asset_archive (
  archive_id   bigint generated always as identity primary key,
  asset_id     uuid not null,
  question_id  uuid,
  storage_uri  text,
  checksum_sha256 text,
  image_phash  bytea,
  target_role  text,
  mime_type    text,
  reason       text not null,
  archived_at  timestamptz not null default now()
);

comment on table content.asset_archive is
  'Full record of every content.asset row removed by a dedup/cleanup pass, so a wrong call is recoverable. The storage object is pruned separately and only after the row is archived here.';

-- ---------------------------------------------------------------------------
-- 3. Keep asset.node_id and question.image_phash in sync, by trigger
-- ---------------------------------------------------------------------------
-- question.image_phash was previously written only by a backfill script, so
-- deleting or re-pointing an asset left it stale — and it feeds dedup_key.
-- Deriving it from the stem asset closes that hole the same way migration
-- 037 closed it for the text identity columns.

create or replace function content.trg_asset_identity_sync()
returns trigger
language plpgsql
as $$
declare
  v_question_id uuid := coalesce(new.question_id, old.question_id);
begin
  if v_question_id is null then
    return coalesce(new, old);
  end if;

  -- node_id follows the question's primary node.
  if tg_op <> 'DELETE' then
    update content.asset a
       set node_id = q.primary_node_id
      from content.question q
     where a.asset_id = new.asset_id
       and q.question_id = a.question_id
       and a.node_id is distinct from q.primary_node_id;
  end if;

  -- question.image_phash mirrors the stem asset's phash (NULL when none).
  update content.question q
     set image_phash = (
           select a.image_phash
             from content.asset a
            where a.question_id = v_question_id
              and a.target_role = 'stem'
              and a.image_phash is not null
            order by a.display_order, a.asset_id
            limit 1
         )
   where q.question_id = v_question_id
     and q.image_phash is distinct from (
           select a.image_phash
             from content.asset a
            where a.question_id = v_question_id
              and a.target_role = 'stem'
              and a.image_phash is not null
            order by a.display_order, a.asset_id
            limit 1
         );

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_asset_identity_sync on content.asset;
create trigger trg_asset_identity_sync
  after insert or delete or update of question_id, image_phash, target_role, display_order
  on content.asset
  for each row execute function content.trg_asset_identity_sync();

-- Backfill node_id for existing rows.
update content.asset a
   set node_id = q.primary_node_id
  from content.question q
 where q.question_id = a.question_id
   and a.node_id is distinct from q.primary_node_id;

-- Seed asset.image_phash from the values migration 041's pass already computed
-- onto the question, so the trigger has something to mirror. These were
-- produced from the same files by db/scripts/backfill-image-phash.ts.
update content.asset a
   set image_phash = q.image_phash
  from content.question q
 where q.question_id = a.question_id
   and a.target_role = 'stem'
   and q.image_phash is not null
   and a.image_phash is null;

-- ---------------------------------------------------------------------------
-- 4. Remove the mis-attached LEGACY-13 stem image
-- ---------------------------------------------------------------------------
-- Identified by evidence, not by name: the asset whose question's syllabus
-- node disagrees with the topic code in its own original filename, AND whose
-- image is byte-identical to another question's stem. Written as a guarded
-- statement so a re-run, or a bank where this was already fixed, is a no-op.

with mis as (
  select a.asset_id, a.question_id, a.storage_uri, a.checksum_sha256,
         a.image_phash, a.target_role, a.mime_type
    from content.asset a
    join content.question q on q.question_id = a.question_id
   where a.target_role = 'stem'
     and q.question_uid = 'LEGACY-13'
     -- only if the identical image really is another question's stem too
     and exists (
       select 1 from content.asset b
        where b.checksum_sha256 = a.checksum_sha256
          and b.asset_id <> a.asset_id
          and b.target_role = 'stem'
     )
)
insert into content.asset_archive
  (asset_id, question_id, storage_uri, checksum_sha256, image_phash, target_role, mime_type, reason)
select asset_id, question_id, storage_uri, checksum_sha256, image_phash, target_role, mime_type,
       'mis-attached duplicate: filename topic code (SOMBAS = Some Basic Concepts) disagrees with the question node (Electrochemistry, Solutions & Surface Chem); stem text references no diagram; identical image is the legitimate stem of LMN-CHEM-CHEM08-000119'
  from mis;

delete from content.asset a
 using content.asset_archive ar
 where ar.asset_id = a.asset_id
   and ar.reason like 'mis-attached duplicate:%';

-- ---------------------------------------------------------------------------
-- 5. Structural guarantee — one image cannot be two questions' stem
-- ---------------------------------------------------------------------------
-- After step 4 no checksum is shared between two stem assets, so this is
-- creatable. It is the asset-layer analogue of migration 041's
-- uq_question_dedup: application code, an importer or a manual session can
-- all skip a check, none of them can skip a constraint.
--
-- TRADE-OFF, stated rather than buried: if a diagram legitimately needs to be
-- the stem of two different questions, this index forbids it and the second
-- attach fails loudly. That is the intended policy for this bank (a shared
-- stem image has so far only ever meant a mis-attachment), and the failure is
-- visible and easy to reverse, which is the right way round compared to
-- silently serving a stoichiometry diagram above a boiling-point question.

create unique index if not exists uq_asset_stem_checksum
  on content.asset (checksum_sha256)
  where checksum_sha256 is not null and target_role = 'stem';

comment on index content.uq_asset_stem_checksum is
  'One image file may be the stem of at most one question. Asset-layer analogue of uq_question_dedup.';

commit;
