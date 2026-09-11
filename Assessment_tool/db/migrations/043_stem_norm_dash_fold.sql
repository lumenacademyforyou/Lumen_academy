-- 043_stem_norm_dash_fold --- normalise en/em dashes, which the existing
-- normaliser treats inconsistently.
--
-- THE DEFECT
-- ----------
-- content.fn_normalize_stem (migration 030) strips punctuation with an
-- allow-list that KEEPS the ASCII hyphen, because "-" is a math operator:
--
--     [^a-z0-9\s+\-*/=<>]
--
-- U+2013 EN DASH, U+2014 EM DASH, U+2212 MINUS SIGN and their relatives are
-- not in that allow-list, so they are removed entirely. The result is that
-- two spellings of the same stem normalise differently:
--
--     "the ideal gas - expands"   ->  "the ideal gas - expands"
--     "the ideal gas — expands"   ->  "the ideal gas expands"
--
-- Different normalised text, different stem_fp, different dedup_key,
-- different match_hash. Two byte-equivalent questions that differ only in
-- which dash character the author typed will not collapse.
--
-- question-dedup-promptnew.md section 2 lists "en/em dashes" among the
-- characters normalisation must handle. This is that rule.
--
-- MEASURED BLAST RADIUS (run before writing this file)
-- ---------------------------------------------------
--     published rows containing an en/em dash : 1  of 533
--     published rows containing a smart quote : 0  of 533
--
-- Smart quotes need no rule: the curly forms AND the straight forms are both
-- outside the allow-list, so both are already stripped and already agree.
--
-- One row is a small number, which is exactly why this is worth doing now
-- rather than later — the change is provably almost inert on today's data and
-- becomes progressively riskier as content grows.
--
-- SCOPE
-- -----
-- The fold is applied inside fn_question_stem_norm, NOT inside
-- fn_normalize_stem. fn_normalize_stem is frozen: migration 030's
-- content_fp / stem_fp / skeleton_fp are computed from it and the assembler
-- filters on those live. Changing it would re-key fingerprints the engine
-- reads at runtime. fn_question_stem_norm feeds stem_norm / dedup_key /
-- match_hash, which this pass owns.
--
-- AFTER APPLYING, RE-DERIVE THE IDENTITY COLUMNS. The trigger from migration
-- 037 recomputes stem_norm and dedup_key on write, not retroactively, so the
-- affected rows keep their old values until touched:
--
--     npx tsx db/scripts/backfill-question-identity.ts --execute
--
-- and confirm it reports no new cluster before trusting the result. With one
-- affected row a new collision is very unlikely, but "unlikely" is not a
-- verification.

begin;

create or replace function content.fn_question_stem_norm(input text)
returns text
language sql
immutable
as $$
  select content.fn_normalize_stem(
    regexp_replace(
      regexp_replace(
        -- Decorative chapter/topic lead-in, comma-tolerant (migration 039).
        translate(
          coalesce(input, ''),
          -- U+2010 HYPHEN, U+2011 NON-BREAKING HYPHEN, U+2012 FIGURE DASH,
          -- U+2013 EN DASH, U+2014 EM DASH, U+2015 HORIZONTAL BAR,
          -- U+2212 MINUS SIGN -> ASCII hyphen-minus.
          U&'\2010\2011\2012\2013\2014\2015\2212',
          '-------'
        ),
        '^\s*In\s+[A-Z][A-Za-z]*(\s+[A-Za-z]+)*(,\s*[A-Z][A-Za-z]*(\s+[A-Za-z]+)*)*,\s*(?=[a-z])',
        ''
      ),
      -- Semantically null leading interrogative frames.
      '^\s*(which\s+one\s+of\s+the\s+following|which\s+of\s+the\s+following|which\s+of\s+these|what\s+is\s+the\s+specific|what\s+is\s+the)\s+',
      '',
      'i'
    )
  );
$$;

commit;
