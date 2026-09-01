-- verify_042_asset_identity — asset identity, node mapping, and the
-- mis-attachment removal.

do $$
declare
  v_missing  text;
  v_assets   bigint;
  v_nodeless bigint;
  v_dupes    bigint;
  v_legacy   bigint;
  v_stale    bigint;
begin
  -- 1. Columns.
  select string_agg(c, ', ') into v_missing
    from unnest(array['image_phash','node_id']) c
   where not exists (
     select 1 from pg_attribute a
      where a.attrelid = 'content.asset'::regclass and a.attname = c
        and a.attnum > 0 and not a.attisdropped
   );
  if v_missing is not null then
    raise exception 'verify_042 FAILED — missing column(s) on content.asset: %', v_missing;
  end if;

  if to_regclass('content.asset_archive') is null then
    raise exception 'verify_042 FAILED — content.asset_archive missing; deletions would be unrecoverable';
  end if;

  if not exists (
    select 1 from pg_trigger where tgrelid = 'content.asset'::regclass
      and tgname = 'trg_asset_identity_sync' and not tgisinternal
  ) then
    raise exception 'verify_042 FAILED — trg_asset_identity_sync missing';
  end if;

  -- 2. Every asset attached to a question must now carry its node — this is
  --    the "images are isolated from the syllabus tree" defect.
  select count(*) into v_nodeless
    from content.asset where question_id is not null and node_id is null;
  if v_nodeless > 0 then
    raise exception 'verify_042 FAILED — % asset(s) still have no node_id', v_nodeless;
  end if;

  -- 3. node_id must actually agree with the owning question.
  select count(*) into v_stale
    from content.asset a join content.question q on q.question_id = a.question_id
   where a.node_id is distinct from q.primary_node_id;
  if v_stale > 0 then
    raise exception 'verify_042 FAILED — % asset(s) have a node_id that disagrees with their question', v_stale;
  end if;

  -- 4. No image may be the stem of two questions any more.
  select coalesce(sum(c - 1), 0) into v_dupes
    from (
      select count(*) c from content.asset
       where target_role = 'stem' and checksum_sha256 is not null
       group by checksum_sha256 having count(*) > 1
    ) z;
  if v_dupes > 0 then
    raise exception 'verify_042 FAILED — % duplicate stem image(s) remain', v_dupes;
  end if;

  if not exists (
    select 1 from pg_indexes where schemaname = 'content' and indexname = 'uq_asset_stem_checksum'
  ) then
    raise exception 'verify_042 FAILED — uq_asset_stem_checksum missing; duplicates could return';
  end if;

  -- 5. The specific mis-attachment must be gone, archived, and has_image must
  --    have self-corrected via migration 028's trigger.
  select count(*) into v_legacy
    from content.asset a join content.question q on q.question_id = a.question_id
   where q.question_uid = 'LEGACY-13' and a.target_role = 'stem';
  if v_legacy > 0 then
    raise exception 'verify_042 FAILED — LEGACY-13 still carries a stem image';
  end if;

  if not exists (select 1 from content.asset_archive where reason like 'mis-attached duplicate:%') then
    raise exception 'verify_042 FAILED — the removed asset was not archived';
  end if;

  if (select has_image from content.question where question_uid = 'LEGACY-13') then
    raise exception 'verify_042 FAILED — LEGACY-13.has_image is still true after its asset was removed';
  end if;

  if (select image_phash from content.question where question_uid = 'LEGACY-13') is not null then
    raise exception 'verify_042 FAILED — LEGACY-13.image_phash is stale; the sync trigger did not clear it';
  end if;

  -- 6. The legitimate owner must be untouched.
  if not (select has_image from content.question where question_uid = 'LMN-CHEM-CHEM08-000119') then
    raise exception 'verify_042 FAILED — LMN-CHEM-CHEM08-000119 lost its stem image; the wrong row was removed';
  end if;

  select count(*) into v_assets from content.asset;
  raise notice 'verify_042 OK — % asset(s), all node-mapped, no duplicate stem images, LEGACY-13 mis-attachment archived and removed', v_assets;
end $$;
