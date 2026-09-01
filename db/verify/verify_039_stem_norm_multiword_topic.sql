-- verify_039_stem_norm_multiword_topic — the comma-containing chapter name
-- must now collapse onto its twins, and genuine prose must still survive.

do $$
declare
  v_comma text;
  v_plain text;
  v_groups bigint;
begin
  -- 1. The exact regression: a comma-containing chapter title must strip
  --    completely, and land on the same stem_norm as a one-word chapter.
  v_comma := content.fn_question_stem_norm('In Work, Energy and Power, a body of mass m = 12.0 kg operates.');
  v_plain := content.fn_question_stem_norm('In Waves, a body of mass m = 12.0 kg operates.');
  if v_comma <> v_plain then
    raise exception 'verify_039 FAILED — comma chapter gave "%" but plain chapter gave "%"', v_comma, v_plain;
  end if;
  if v_comma <> 'a body of mass m = 12.0 kg operates' then
    raise exception 'verify_039 FAILED — unexpected stem_norm: "%"', v_comma;
  end if;

  -- 2. Multi-comma chapter titles.
  if content.fn_question_stem_norm('In Motion in a Plane, a body falls.')
     <> content.fn_question_stem_norm('In Dual Nature of Radiation and Matter, a body falls.') then
    raise exception 'verify_039 FAILED — multi-word chapter titles do not collapse';
  end if;

  -- 3. SAFETY: genuine prose beginning with "In " must be untouched. The
  --    lookahead requires an uppercase word right after "In".
  if content.fn_question_stem_norm('In the reaction below, identify X.') <> 'in the reaction below identify x' then
    raise exception 'verify_039 FAILED — genuine prose was eaten: "%"', content.fn_question_stem_norm('In the reaction below, identify X.');
  end if;

  -- 4. SAFETY: two genuinely different stems must NOT collapse.
  if content.fn_question_stem_norm('In the reaction below, identify X.')
     = content.fn_question_stem_norm('In another reaction below, identify X.') then
    raise exception 'verify_039 FAILED — lead-in strip collapsed two different stems';
  end if;

  -- 5. SAFETY, and the whole point of the scope note in the migration:
  --    a MID-stem topic must survive, or the H2SO4 / K2Cr2O7 pair (both
  --    answer +6, genuinely different questions) would be merged.
  if content.fn_question_stem_norm('What is the oxidation number of the central atom in S in H2SO4?')
     = content.fn_question_stem_norm('What is the oxidation number of the central atom in Cr in K2Cr2O7?') then
    raise exception 'verify_039 FAILED — mid-stem topic was stripped; distinct questions merged (directive Bug 3)';
  end if;

  -- 6. The bank must now show MORE exact-identity collisions than before,
  --    since the comma family finally collapses. 037 measured 29 groups.
  select count(*) into v_groups from (
    select 1 from content.question q
     cross join lateral content.fn_question_identity(q.question_id) i
     where q.lifecycle_status = 'published' and q.canonical_question_id is null
       and i.dedup_key is not null
     group by i.dedup_key having count(*) > 1
  ) z;
  if v_groups < 29 then
    raise exception 'verify_039 FAILED — collision groups dropped to % (was 29 before this fix)', v_groups;
  end if;

  raise notice 'verify_039 OK — comma chapter titles collapse, prose and mid-stem topics preserved; % collision group(s) now detected', v_groups;
end $$;
