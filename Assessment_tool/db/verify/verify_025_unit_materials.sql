-- verify_025_unit_materials.sql

do $$
begin
  if not exists (
    select 1 from information_schema.tables
     where table_schema = 'learn' and table_name = 'unit_material'
  ) then
    raise exception 'verify_025 FAILED — missing table: learn.unit_material';
  end if;

  if not exists (
    select 1 from pg_indexes
     where schemaname = 'learn' and indexname = 'ix_unit_material_unit'
  ) then
    raise exception 'verify_025 FAILED — missing index: ix_unit_material_unit';
  end if;

  raise notice 'verify_025_unit_materials: OK';
end $$;
