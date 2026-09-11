-- verify_029_blueprint_has_image_only.sql

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'assess' and table_name = 'test_blueprint' and column_name = 'has_image_only'
  ) then
    raise exception 'verify_029 FAILED — assess.test_blueprint.has_image_only column missing';
  end if;

  if exists (
    select 1 from assess.test_blueprint where has_image_only is null
  ) then
    raise exception 'verify_029 FAILED — assess.test_blueprint has rows with a null has_image_only';
  end if;

  raise notice 'verify_029_blueprint_has_image_only: OK';
end $$;
