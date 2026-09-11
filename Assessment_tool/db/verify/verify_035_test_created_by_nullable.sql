-- verify_035_test_created_by_nullable.sql

do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'assess' and table_name = 'test' and column_name = 'created_by' and is_nullable = 'NO'
  ) then
    raise exception 'verify_035 FAILED — assess.test.created_by is still NOT NULL';
  end if;

  raise notice 'verify_035_test_created_by_nullable: OK';
end $$;
