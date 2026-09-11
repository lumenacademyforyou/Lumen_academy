-- 038_answer_key_normaliser — corrects fn_question_answer_key's normalisation.
--
-- Found while producing the Layer 3 threshold-tuning report, before any of
-- 037's identity columns had been backfilled, so no stored value is affected.
--
-- THE DEFECT
-- ----------
-- 037 normalised answer text with content.fn_normalize_stem. That function is
-- tuned for STEMS, and its step 4 strips a leading enumeration marker:
--
--     regexp_replace(s, '^\s*[(\[]?\d+[)\].:]\s*', '')
--
-- which is correct for "1. Which of the following..." but catastrophic for an
-- answer, because a numeric answer *begins* with digits followed by a decimal
-- point. Measured on the live published bank:
--
--     '1125.0 Joules'   -> '0 joules'     (75 distinct answers collapsed here)
--     '10.00 SI units'  -> '0 si units'   (64 collapsed)
--     '2.50 SI units'   -> '50 si units'  (11 collapsed)
--
-- answer_key is THE blocking key for duplicate detection. Over-collapsing it
-- does not create false merges (dedup_key still carries stem_norm, which
-- disambiguates — the 29/58 blast radius was unaffected), but it destroys the
-- key's value as a block: one 75-member pseudo-group alone generates 2,775
-- candidate pairs of pure noise for the nightly reviewer queue.
--
-- THE FIX
-- -------
-- A dedicated answer normaliser that never strips a leading number and keeps
-- the characters that carry answer meaning (decimal points, signs, exponents,
-- solidus for units like m/s). content.fn_normalize_stem is deliberately left
-- untouched: migration 030's content_fp / stem_fp / skeleton_fp are computed
-- from it and the assembler filters on them live, so changing it would
-- silently re-key values the running system depends on.
--
-- Option texts in the identity hash move to the same function for the same
-- reason — options are answers.

begin;

create or replace function content.fn_normalize_answer(input text)
returns text
language plpgsql
immutable
as $function$
declare
  s text;
begin
  if input is null then
    return null;
  end if;

  -- 1. NFKC, then strip HTML tags and markdown emphasis/link syntax.
  s := normalize(input, NFKC);
  s := regexp_replace(s, '<[^>]*>', '', 'g');
  s := regexp_replace(s, '\[([^\]]*)\]\([^)]*\)', '\1', 'g');
  s := regexp_replace(s, '[*_~`]', '', 'g');

  -- 2. LaTeX spacing tokens and $ delimiters.
  s := regexp_replace(s, '\\,|\\!|\\;|\\quad|\\qquad', ' ', 'g');
  s := regexp_replace(s, '\$+', '', 'g');

  -- 3. Strip an option LABEL prefix only — "A)", "(b)", "C." — never a bare
  --    number. This is the one thing 037 got wrong: the label alternation
  --    requires a single letter, so "1125.0 Joules" is left completely alone.
  s := regexp_replace(s, '^\s*[(\[]?[A-Za-z][)\].]\s+', '');

  -- 4. Fold unicode minus / en dash / em dash onto ASCII hyphen so that
  --    "-22.98 kJ" and its typographic twin block together.
  s := translate(s, U&'\2212' || U&'\2013' || U&'\2014', '---');

  -- 5. Lowercase.
  s := lower(s);

  -- 6. Keep alphanumerics, whitespace, and the characters that carry answer
  --    meaning: . - + / ^ = < >. Everything else goes.
  s := regexp_replace(s, '[^a-z0-9\s.\-+/^=<>]', '', 'g');

  -- 7. Unit spacing: "5kg" -> "5 kg", so "5kg" and "5 kg" agree.
  s := regexp_replace(s, '(\d)([a-z])', '\1 \2', 'g');

  -- 8. Drop a trailing period, collapse whitespace, trim.
  s := regexp_replace(s, '\.\s*$', '');
  s := trim(regexp_replace(s, '\s+', ' ', 'g'));

  return nullif(s, '');
end;
$function$;

comment on function content.fn_normalize_answer(text) is
  'Answer-text normaliser. Distinct from fn_normalize_stem because that one strips a leading enumeration marker, which destroys any answer beginning with a decimal number (1125.0 Joules -> 0 joules).';

-- Re-point answer_key at the correct normaliser.
create or replace function content.fn_question_answer_key(p_question_id uuid)
returns text
language sql
stable
as $$
  select case
    when q.question_type in ('integer', 'numeric')
      then trim(to_char(round(q.numeric_answer, 6), 'FM9999999999990.999999'))
    else (
      select nullif(string_agg(content.fn_normalize_answer(o.option_text), chr(31)
                               order by content.fn_normalize_answer(o.option_text)), '')
        from content.question_option o
       where o.question_id = q.question_id
         and o.is_correct
    )
  end
  from content.question q
  where q.question_id = p_question_id;
$$;

-- ...and the option set inside the identity hash, for the same reason.
create or replace function content.fn_question_identity(p_question_id uuid)
returns table (stem_norm text, answer_key text, dedup_key bytea)
language sql
stable
as $$
  with base as (
    select
      content.fn_question_stem_norm(q.stem_text) as sn,
      content.fn_question_answer_key(q.question_id) as ak,
      coalesce((
        select string_agg(content.fn_normalize_answer(o.option_text), chr(31)
                          order by content.fn_normalize_answer(o.option_text))
          from content.question_option o
         where o.question_id = q.question_id
      ), '') as opts,
      coalesce(encode(q.image_phash, 'hex'), '') as ph,
      coalesce(q.question_type, '') as qt
    from content.question q
    where q.question_id = p_question_id
  )
  select
    base.sn,
    base.ak,
    case when base.ak is null then null
         else digest(base.sn || chr(30) || base.opts || chr(30) || base.ak
                     || chr(30) || base.ph || chr(30) || base.qt, 'sha256')
    end
  from base;
$$;

commit;
