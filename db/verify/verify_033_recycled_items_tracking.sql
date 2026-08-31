-- verify_033_recycled_items_tracking.sql

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'assess' and table_name = 'attempt' and column_name = 'has_recycled_items'
  ) then
    raise exception 'verify_033 FAILED — assess.attempt.has_recycled_items column missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'assess' and table_name = 'attempt' and column_name = 'recycled_item_count'
  ) then
    raise exception 'verify_033 FAILED — assess.attempt.recycled_item_count column missing';
  end if;

  if not exists (
    select 1 from information_schema.tables where table_schema = 'assess' and table_name = 'unit_recycle_log'
  ) then
    raise exception 'verify_033 FAILED — assess.unit_recycle_log table missing';
  end if;

  raise notice 'verify_033_recycled_items_tracking: OK';
end $$;
