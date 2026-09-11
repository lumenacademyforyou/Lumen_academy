-- verify_037_question_identity — asserts migration 037 landed correctly.
-- Runs automatically after the migration via db/scripts/run-migration.mjs.

do $$
declare
  v_missing text;
  v_count   bigint;
  v_norm    text;
begin
  -- 1. Every identity column exists.
  select string_agg(c, ', ') into v_missing
    from unnest(array['stem_norm','answer_key','dedup_key','stem_vec','embed_model_version','image_phash']) c
   where not exists (
     select 1 from pg_attribute a
      where a.attrelid = 'content.question'::regclass
        and a.attname = c and a.attnum > 0 and not a.attisdropped
   );
  if v_missing is not null then
    raise exception 'verify_037 FAILED — missing column(s) on content.question: %', v_missing;
  end if;

  -- 2. stem_vec really is a pgvector column of the expected dimension.
  if not exists (
    select 1 from pg_attribute a
     where a.attrelid = 'content.question'::regclass
       and a.attname = 'stem_vec'
       and format_type(a.atttypid, a.atttypmod) = 'vector(1024)'
  ) then
    raise exception 'verify_037 FAILED — stem_vec is not vector(1024)';
  end if;

  -- 3. Both identity triggers are attached.
  select string_agg(t, ', ') into v_missing
    from unnest(array['trg_question_identity_sync']) t
   where not exists (
     select 1 from pg_trigger g
      where g.tgrelid = 'content.question'::regclass and g.tgname = t and not g.tgisinternal
   );
  if v_missing is not null then
    raise exception 'verify_037 FAILED — trigger(s) missing on content.question: %', v_missing;
  end if;

  if not exists (
    select 1 from pg_trigger g
     where g.tgrelid = 'content.question_option'::regclass
       and g.tgname = 'trg_question_option_identity_sync' and not g.tgisinternal
  ) then
    raise exception 'verify_037 FAILED — trg_question_option_identity_sync missing on content.question_option';
  end if;

  -- 4. The decorative lead-in strip actually fires. This is the whole point
  --    of the migration, so it is asserted on real text rather than assumed.
  v_norm := content.fn_question_stem_norm('In Kinetic Theory of Gases, a body of mass m = 10.0 kg moves.');
  if v_norm <> content.fn_question_stem_norm('In Waves, a body of mass m = 10.0 kg moves.') then
    raise exception 'verify_037 FAILED — chapter lead-in strip does not collapse two chapters onto one stem_norm (got %)', v_norm;
  end if;
  if v_norm like 'in %' then
    raise exception 'verify_037 FAILED — lead-in survived normalisation: %', v_norm;
  end if;

  -- 5. ...and does NOT eat a stem that merely starts with "In" as real prose.
  if content.fn_question_stem_norm('In the reaction below, identify X.')
     = content.fn_question_stem_norm('In another reaction below, identify X.') then
    raise exception 'verify_037 FAILED — lead-in strip is over-eager, it collapsed two genuinely different stems';
  end if;

  -- 6. Audit and review-queue tables exist.
  if to_regclass('content.question_identity_audit') is null then
    raise exception 'verify_037 FAILED — content.question_identity_audit missing';
  end if;
  if to_regclass('content.question_duplicate_candidate') is null then
    raise exception 'verify_037 FAILED — content.question_duplicate_candidate missing';
  end if;

  -- 7. The pair-uniqueness guarantee that makes rejections permanent.
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'content' and indexname = 'uq_question_duplicate_candidate_pair'
  ) then
    raise exception 'verify_037 FAILED — uq_question_duplicate_candidate_pair missing; rejections would not be permanent';
  end if;

  -- 8. Detection indexes.
  select string_agg(i, ', ') into v_missing
    from unnest(array['ix_question_stem_norm_trgm','ix_question_answer_key','ix_question_dedup_key','ix_question_canonical']) i
   where not exists (
     select 1 from pg_indexes where schemaname = 'content' and indexname = i
   );
  if v_missing is not null then
    raise exception 'verify_037 FAILED — missing index(es): %', v_missing;
  end if;

  -- 9. The UNIQUE dedup index must NOT exist yet — 58 published rows still
  --    violate it. Migration 038 adds it after the clustering pass.
  if exists (
    select 1 from pg_indexes where schemaname = 'content' and indexname = 'uq_question_dedup'
  ) then
    raise exception 'verify_037 FAILED — uq_question_dedup exists already; 037 must not create it before the backfill retires the 58 duplicate rows';
  end if;

  -- 10. Migration 030's fingerprints must be untouched — the assembler
  --     filters on them live, so re-keying them here would be a silent
  --     behaviour change.
  select count(*) into v_count from content.question where content_fp is null;
  if v_count > 0 then
    raise exception 'verify_037 FAILED — % rows lost content_fp', v_count;
  end if;

  raise notice 'verify_037 OK — identity columns, functions, triggers, audit + review tables and detection indexes all present; fingerprints intact';
end $$;
