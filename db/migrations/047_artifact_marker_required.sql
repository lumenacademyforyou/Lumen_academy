-- 047 — content.fn_strip_question_artifacts: require the case/# marker on the
-- bracketed artifact form.
--
-- Migration 036 introduced the function with this contract, stated in its own
-- header: "Every artifact carries either the literal word `case` or a `#`".
-- Step (a) did not enforce it — `(case[ \t]*)?#?` made both markers optional,
-- so the pattern matched ANY bracketed bare number. That is not an artifact
-- shape; it is ordinary content.
--
-- It went unnoticed because the bank 036 was written against contained no
-- bracketed bare numbers. The 2026-09-02 replacement bank does: measured over
-- its 1140 questions, the optional form matched 89, and stripping them would
-- have deleted publication years and mathematical notation --
--   "Five Kingdom Classification (1969)"  -> "Five Kingdom Classification"
--   "Schleiden (1838) and Schwann (1839)" -> "Schleiden and Schwann"
--   "sqrt(2)"                             -> "sqrt"
--   "sin^-1(0.6)"                         -> "sin^-1"
-- none of which is a generator artifact.
--
-- Steps (b) and (c) already required their markers and are unchanged. The
-- documented artifact forms -- " (case #5_0)", " [case 5_0]", " (#5_0)",
-- " (case #2)" -- all still match.
--
-- Mirrored byte-for-byte in db/shared/questionArtifacts.ts (BRACKETED_TAG);
-- db/content/question-artifacts.test.ts asserts the two agree.

begin;

create or replace function content.fn_strip_question_artifacts(input text)
returns text
language plpgsql
immutable
as $$
declare
  s    text;
  prev text;
begin
  if input is null then
    return null;
  end if;

  s := input;

  -- Repeat until stable — "… (case #5_0) (case #5_1)?" needs more than one pass.
  loop
    prev := s;
    -- a. Bracketed tag. The `case` or `#` marker is REQUIRED (see header):
    --    " (case #5_0)"  " [case 5_0]"  " (#5_0)"  " (case #2)"
    --    A bracketed bare number — "(1969)", "(2)" — is content, not a tag.
    s := regexp_replace(s, '[ \t]*[(\[][ \t]*(case[ \t]*#?|#)[ \t]*[0-9]+([_.-][0-9]+)?[ \t]*[)\]]', '', 'gi');
    -- b. Unbracketed tag carrying the literal word "case": "… case#5_0", "… case 5_0".
    s := regexp_replace(s, '[ \t]*case[ \t]*#?[ \t]*[0-9]+([_.-][0-9]+)?', '', 'gi');
    -- c. Unbracketed hash tag: "… radius of curvature #16_2?". The '#' is required.
    s := regexp_replace(s, '[ \t]*#[ \t]*[0-9]+([_.-][0-9]+)?', '', 'g');
    exit when s = prev;
  end loop;

  -- Nothing was removed -> return the input byte for byte, so a clean
  -- multi-line stem is never silently reflowed by the tidy-up below.
  if s = input then
    return input;
  end if;

  -- Tidy only what the removal itself broke: an orphaned space before the
  -- sentence's own punctuation, and the doubled space a tag left behind.
  -- Deliberately [ \t] and not \s — newlines in a real stem must survive.
  s := regexp_replace(s, '[ \t]+([?.:,;])', '\1', 'g');
  s := regexp_replace(s, '[ \t][ \t]+', ' ', 'g');
  return btrim(s);
end;
$$;

insert into util.applied_migration (migration_name) values ('047_artifact_marker_required')
on conflict (migration_name) do nothing;

commit;
