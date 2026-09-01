-- verify_043_stem_norm_dash_fold — the fold must exist AND actually collapse
-- the two spellings onto one key.
--
-- Asserting the function was replaced is not enough: a `create or replace`
-- that compiled but left the behaviour unchanged would pass that check and
-- fail the only thing that matters.

do $$
declare
  v_en    text;
  v_em    text;
  v_ascii text;
  v_minus text;
  v_prose text;
begin
  -- 1. Every dash variant must normalise to the ASCII-hyphen form.
  v_ascii := content.fn_question_stem_norm('a well-known result');
  v_en    := content.fn_question_stem_norm('a well' || U&'\2013' || 'known result');
  v_em    := content.fn_question_stem_norm('a well' || U&'\2014' || 'known result');
  v_minus := content.fn_question_stem_norm('a well' || U&'\2212' || 'known result');

  if v_en is distinct from v_ascii then
    raise exception 'verify_043 FAILED — en dash normalises to %, ASCII hyphen to %', v_en, v_ascii;
  end if;
  if v_em is distinct from v_ascii then
    raise exception 'verify_043 FAILED — em dash normalises to %, ASCII hyphen to %', v_em, v_ascii;
  end if;
  if v_minus is distinct from v_ascii then
    raise exception 'verify_043 FAILED — minus sign normalises to %, ASCII hyphen to %', v_minus, v_ascii;
  end if;

  -- 2. The hyphen itself must SURVIVE. If the fold were implemented by
  --    stripping dashes instead of folding them, every check above would
  --    still pass while silently changing the key for every hyphenated stem
  --    in the bank.
  if v_ascii not like '%-%' then
    raise exception 'verify_043 FAILED — the hyphen was stripped, not folded: %', v_ascii;
  end if;

  -- 3. The pre-existing behaviour this migration must NOT disturb: the
  --    decorative chapter lead-in strip (037/039) still fires, and ordinary
  --    lowercase prose openings are still left alone.
  if content.fn_question_stem_norm('In Work, Energy and Power, a body of mass m = 12.0 kg')
     is distinct from content.fn_question_stem_norm('a body of mass m = 12.0 kg') then
    raise exception 'verify_043 FAILED — the comma-tolerant chapter lead-in strip regressed';
  end if;

  v_prose := content.fn_question_stem_norm('In the reaction below, identify X.');
  if v_prose not like 'in the reaction below%' then
    raise exception 'verify_043 FAILED — an ordinary lowercase "In the ..." opening was stripped: %', v_prose;
  end if;

  raise notice 'verify_043 passed — all dash variants fold onto ASCII hyphen, hyphen preserved, 037/039 behaviour intact.';
end $$;
