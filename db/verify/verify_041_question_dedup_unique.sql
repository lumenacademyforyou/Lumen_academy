-- verify_041_question_dedup_unique — the constraint must exist AND actually bite.

do $$
declare
  v_target uuid;
  v_twin   uuid;
  v_caught boolean := false;
begin
  if not exists (
    select 1 from pg_indexes where schemaname = 'content' and indexname = 'uq_question_dedup'
  ) then
    raise exception 'verify_041 FAILED — uq_question_dedup missing';
  end if;

  -- It must be UNIQUE and PARTIAL. A non-partial index here would make every
  -- duplicate_archived row un-storable and break the retirement model.
  if not exists (
    select 1 from pg_index i
     where i.indexrelid = 'content.uq_question_dedup'::regclass
       and i.indisunique and i.indpred is not null
  ) then
    raise exception 'verify_041 FAILED — uq_question_dedup is not a partial unique index';
  end if;

  -- The directive forbids this one at any granularity.
  if exists (
    select 1 from pg_indexes
     where schemaname = 'content'
       and indexdef ilike '%unique%'
       and indexdef ilike '%primary_node_id%'
       and indexdef ilike '%answer_key%'
  ) then
    raise exception 'verify_041 FAILED — a (primary_node_id, answer_key) unique index exists; it is unsafe at any node granularity';
  end if;

  -- PROVE it bites: clone a real published row's identity and confirm the
  -- insert is rejected. Done inside a savepoint so nothing is left behind.
  select question_id into v_target
    from content.question
   where lifecycle_status = 'published' and dedup_key is not null and canonical_question_id is null
   limit 1;

  if v_target is not null then
    begin
      insert into content.question
        (question_uid, primary_node_id, job_id, question_type, stem_text,
         lifecycle_status, stem_format, solution_format, dedup_key)
      select 'VERIFY041-DUP-PROBE', primary_node_id, job_id, question_type, stem_text,
             'published', stem_format, solution_format, dedup_key
        from content.question where question_id = v_target
      returning question_id into v_twin;
      -- If we got here the constraint did NOT fire.
      raise exception 'verify_041 FAILED — a byte-identical published question was accepted; the constraint does not bite';
    exception
      when unique_violation then
        v_caught := true;
    end;

    if not v_caught then
      raise exception 'verify_041 FAILED — duplicate insert was not rejected by unique_violation';
    end if;
  end if;

  raise notice 'verify_041 OK — uq_question_dedup exists, is partial+unique, and rejected a byte-identical published duplicate';
end $$;

-- Belt and braces: the probe row must never survive, whatever happened above.
delete from content.question where question_uid = 'VERIFY041-DUP-PROBE';
