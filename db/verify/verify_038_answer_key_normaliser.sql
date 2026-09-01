-- verify_038_answer_key_normaliser — asserts the answer normaliser no longer
-- eats leading numbers, and that fn_normalize_stem was left alone.

do $$
declare
  v text;
  v_groups bigint;
  v_max    bigint;
begin
  -- 1. The exact regression that motivated this migration.
  v := content.fn_normalize_answer('1125.0 Joules');
  if v <> '1125.0 joules' then
    raise exception 'verify_038 FAILED — "1125.0 Joules" normalised to "%" (expected "1125.0 joules")', v;
  end if;

  v := content.fn_normalize_answer('10.00 SI units');
  if v <> '10.00 si units' then
    raise exception 'verify_038 FAILED — "10.00 SI units" normalised to "%"', v;
  end if;

  -- 2. An option label prefix IS still stripped (that part was correct).
  if content.fn_normalize_answer('A) 1125.0 Joules') <> '1125.0 joules' then
    raise exception 'verify_038 FAILED — option label prefix not stripped';
  end if;

  -- 3. Typographic minus folds onto ASCII hyphen.
  if content.fn_normalize_answer(U&'\2212' || '22.98 kJ') <> content.fn_normalize_answer('-22.98 kJ') then
    raise exception 'verify_038 FAILED — unicode minus does not fold onto ASCII hyphen';
  end if;

  -- 4. Unit spacing agrees.
  if content.fn_normalize_answer('5kg') <> content.fn_normalize_answer('5 kg') then
    raise exception 'verify_038 FAILED — "5kg" and "5 kg" disagree';
  end if;

  -- 5. fn_normalize_stem must be UNCHANGED — migration 030's fingerprints are
  --    computed from it and the assembler filters on them live.
  if content.fn_normalize_stem('1. Which of the following is correct?') <> 'which of the following is correct' then
    raise exception 'verify_038 FAILED — fn_normalize_stem behaviour changed; 030 fingerprints would be re-keyed';
  end if;

  -- 6. The blocking key must no longer over-collapse. Before this migration
  --    the largest pseudo-group held 75 published rows; a real answer group
  --    in this bank is small.
  select count(*), coalesce(max(c), 0) into v_groups, v_max
    from (
      select content.fn_question_answer_key(q.question_id) as ak, count(*) c
        from content.question q
       where q.lifecycle_status = 'published'
       group by 1
      having content.fn_question_answer_key(q.question_id) is not null
         and count(*) > 1
    ) z;

  if v_max > 25 then
    raise exception 'verify_038 FAILED — answer_key still over-collapses: largest group has % rows', v_max;
  end if;

  raise notice 'verify_038 OK — answer normaliser preserves leading numbers; % duplicate answer_key group(s), largest %', v_groups, v_max;
end $$;
