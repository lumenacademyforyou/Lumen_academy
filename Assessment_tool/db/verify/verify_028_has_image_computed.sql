-- verify_028_has_image_computed.sql

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_asset_sync_has_image'
  ) then
    raise exception 'verify_028 FAILED — missing trigger trg_asset_sync_has_image';
  end if;

  if not exists (
    select 1 from pg_proc where proname = 'trg_asset_sync_has_image'
  ) then
    raise exception 'verify_028 FAILED — missing function content.trg_asset_sync_has_image';
  end if;

  if exists (
    select 1
      from content.question q
     where q.has_image is distinct from exists (
             select 1 from content.asset a
              where a.question_id = q.question_id and a.target_role in ('stem', 'option')
           )
  ) then
    raise exception 'verify_028 FAILED — content.question.has_image has rows that disagree with the actual content.asset rows (backfill did not converge)';
  end if;

  raise notice 'verify_028_has_image_computed: OK';
end $$;
