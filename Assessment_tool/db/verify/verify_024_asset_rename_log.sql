-- verify_024_asset_rename_log.sql

do $$
begin
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'content' and indexname = 'ux_asset_question_slot_sequence'
  ) then
    raise exception 'verify_024 FAILED — missing index: ux_asset_question_slot_sequence';
  end if;

  if not exists (
    select 1 from information_schema.tables
     where table_schema = 'content' and table_name = 'asset_rename_log'
  ) then
    raise exception 'verify_024 FAILED — missing table: content.asset_rename_log';
  end if;

  raise notice 'verify_024_asset_rename_log: OK';
end $$;
