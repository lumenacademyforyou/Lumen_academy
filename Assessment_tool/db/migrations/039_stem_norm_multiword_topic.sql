-- 039_stem_norm_multiword_topic — the leading topic strip must survive a
-- chapter name that contains commas.
--
-- THE DEFECT
-- ----------
-- 037's lead-in pattern matched a title-cased phrase with no commas in it:
--
--     ^\s*In\s+[A-Z][A-Za-z]*(\s+(of|and|in|the|a)\s+[A-Za-z]+|\s+[A-Z][A-Za-z]*)*\s*,\s*
--
-- Several real NCERT chapter titles contain a comma. "In Work, Energy and
-- Power, a body of mass m = 12.0 kg ..." therefore stripped only "In Work,"
-- and left "energy and power a body of mass ..." behind, so those rows did
-- NOT collapse onto their twins from other chapters. Found while labelling
-- the Layer 3 threshold sample: 44 pairs at similarity 0.895+ were visibly
-- the same template question and were being missed.
--
-- THE FIX
-- -------
-- Consume comma-separated title-cased segments, and anchor the end of the
-- lead-in on the first comma that is followed by a LOWERCASE word — which is
-- where the chapter name stops and the question body begins. The lookahead is
-- what keeps this safe:
--
--   "In Work, Energy and Power, a body of mass..."  -> "a body of mass..."
--     (", Energy" is followed by uppercase, so it is treated as part of the
--      chapter name; ", a body" is followed by lowercase, so it terminates)
--   "In the reaction below, identify X."            -> unchanged
--     ("the" is lowercase, so the pattern never starts)
--
-- SCOPE NOTE — what this deliberately does NOT do
-- ----------------------------------------------
-- It does not strip a MID-stem "in <Topic>". The other template family in
-- this bank ("Which fundamental physical principle governs the conservation
-- laws in <Chapter>?") would collapse if it did — but so would
-- "What is the oxidation number of the central atom in S in H2SO4?" and its
-- K2Cr2O7 sibling, which are genuinely different questions that happen to
-- share the answer +6. That is exactly the directive's Bug 3, and it is the
-- reason mid-stem topics are left to the Layer 3 human review queue, where
-- the conservation-laws family lands at similarity 0.52-0.88 — comfortably
-- above threshold, and confirmed by a person rather than auto-merged.

begin;

create or replace function content.fn_question_stem_norm(input text)
returns text
language sql
immutable
as $$
  select content.fn_normalize_stem(
    regexp_replace(
      regexp_replace(
        -- Decorative chapter/topic lead-in, now comma-tolerant.
        coalesce(input, ''),
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
