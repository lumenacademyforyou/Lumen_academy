-- verify_013_content_import.sql

do $$
declare
  missing text[] := array[]::text[];
begin
  if not exists (select 1 from information_schema.tables where table_schema='content' and table_name='import_batch') then
    missing := array_append(missing, 'table:content.import_batch');
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='content' and table_name='import_row') then
    missing := array_append(missing, 'table:content.import_row');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'uq_import_batch_checksum') then
    missing := array_append(missing, 'constraint:uq_import_batch_checksum');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'uq_import_row_batch_no') then
    missing := array_append(missing, 'constraint:uq_import_row_batch_no');
  end if;

  if array_length(missing, 1) is not null then
    raise exception 'verify_013_content_import FAILED — missing: %', array_to_string(missing, ', ');
  end if;

  raise notice 'verify_013_content_import: OK — import_batch, import_row, checksum uniqueness, batch+row_no uniqueness all present';
end $$;

-- Functional proof: re-inserting the same file_checksum is rejected (the
-- idempotency guarantee the import CLI relies on). Rolls back via its own
-- exception handler.
do $$
declare
  v_exam_id uuid;
  v_syllabus_version_id uuid;
  v_user_id uuid;
  v_rejected boolean;
begin
  select exam_id into v_exam_id from catalog.exam limit 1;
  select syllabus_version_id into v_syllabus_version_id from catalog.syllabus_version limit 1;
  select user_id into v_user_id from core.app_user limit 1;

  insert into content.import_batch (batch_label, exam_id, syllabus_version_id, source_file, file_checksum, submitted_by)
    values ('verify proof batch', v_exam_id, v_syllabus_version_id, 'verify.json', 'VERIFY_CHECKSUM_ABC', v_user_id);

  begin
    insert into content.import_batch (batch_label, exam_id, syllabus_version_id, source_file, file_checksum, submitted_by)
      values ('verify proof batch retry', v_exam_id, v_syllabus_version_id, 'verify.json', 'VERIFY_CHECKSUM_ABC', v_user_id);
    v_rejected := false;
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'verify_013: a duplicate file_checksum was NOT rejected';
  end if;

  raise notice 'verify_013_content_import: functional proof OK — duplicate file_checksum rejected';
  raise exception 'verify_013_content_import: proof complete, rolling back (not seed data)';
exception when others then
  if sqlerrm like 'verify_013_content_import: proof complete%' then
    raise notice '%', sqlerrm;
  else
    raise;
  end if;
end $$;
