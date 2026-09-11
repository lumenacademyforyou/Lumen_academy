-- verify_034_wipe_fk_gaps_nullable.sql

do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'content' and table_name = 'ai_generation_job' and column_name = 'requested_by' and is_nullable = 'NO'
  ) then
    raise exception 'verify_034 FAILED — content.ai_generation_job.requested_by is still NOT NULL';
  end if;

  if exists (
    select 1 from information_schema.columns
     where table_schema = 'content' and table_name = 'import_batch' and column_name = 'submitted_by' and is_nullable = 'NO'
  ) then
    raise exception 'verify_034 FAILED — content.import_batch.submitted_by is still NOT NULL';
  end if;

  if exists (
    select 1 from information_schema.columns
     where table_schema = 'content' and table_name = 'question_review' and column_name = 'reviewer_user_id' and is_nullable = 'NO'
  ) then
    raise exception 'verify_034 FAILED — content.question_review.reviewer_user_id is still NOT NULL';
  end if;

  if exists (
    select 1 from information_schema.columns
     where table_schema = 'core' and table_name = 'invitation' and column_name = 'invited_by' and is_nullable = 'NO'
  ) then
    raise exception 'verify_034 FAILED — core.invitation.invited_by is still NOT NULL';
  end if;

  raise notice 'verify_034_wipe_fk_gaps_nullable: OK';
end $$;
