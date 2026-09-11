-- 036_strip_template_artifacts.sql
-- docs/test-engine-fix-prompt.md Defect 1 — "template artifacts leaking into
-- question text".
--
-- Live evidence gathered before writing this (not assumed from the report):
--   * 73 published content.question rows carry a generator/template tag in
--     stem_text — 46 of the "(case #N_N)" / "#N_N" trailing form and 27 of a
--     mid-stem "(case #N)" form the spec's own regex did not cover.
--   * The same 46 stems appear again in content.question_translation.
--   * 0 content.question_option rows are affected.
--   * 0 rows carry a *trailing unit-name suffix* ("… — Ray Optics"); the unit
--     name in this bank is interpolated mid-sentence ("conservation laws in
--     Current Electricity"), which is a content-quality problem, not an
--     artifact — reported by db/scripts/report-template-family-questions.ts
--     for a subject expert, never auto-edited (spec's own instruction).
--   * Every artifact carries either the literal word `case` or a `#`; zero
--     rows match a bare `\d+_\d+` with neither, and every one of the 73 stems
--     containing a `#` at all is an artifact. That is why the patterns below
--     require one of those two markers instead of the spec's looser regex,
--     which would also have matched decimals and ratios in real stems.
--
-- content.fn_strip_question_artifacts is mirrored byte-for-byte in TypeScript
-- as db/shared/questionArtifacts.ts, the same two-sided discipline migration
-- 030's fn_normalize_stem already established. db/content/question-artifacts.
-- test.ts keeps the two from drifting.
--
-- Idempotent by construction: the function is a fixpoint (running it on its
-- own output changes nothing), and each UPDATE is guarded by
-- `where stripped is distinct from current`, so a second run touches 0 rows.

-- ---------------------------------------------------------------------------
-- 1. The stripper.
-- ---------------------------------------------------------------------------
create or replace function content.fn_strip_question_artifacts(input text) returns text
language plpgsql immutable as $$
declare
  s text;
  prev text;
begin
  if input is null then
    return null;
  end if;

  s := input;

  -- Repeat until stable — "… (case #5_0) (case #5_1)?" needs more than one pass.
  loop
    prev := s;
    -- a. Bracketed tag, with or without the word "case":
    --    " (case #5_0)"  " [case 5_0]"  " (#5_0)"  " (case #2)"
    s := regexp_replace(s, '[ \t]*[(\[][ \t]*(case[ \t]*)?#?[ \t]*[0-9]+([_.-][0-9]+)?[ \t]*[)\]]', '', 'gi');
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

-- ---------------------------------------------------------------------------
-- 2. Backfill content.question.
--    The migration-030 trigger on this table recomputes content_fp/stem_fp/
--    skeleton_fp automatically on stem_text change, so the fingerprints stay
--    correct with no explicit recompute here. That is also what makes step 4
--    necessary: stripping the variant tag is exactly what collapses
--    "…(case #5_0)?" and "…(case #5_1)?" onto one content_fp.
-- ---------------------------------------------------------------------------
update content.question
   set stem_text = content.fn_strip_question_artifacts(stem_text)
 where content.fn_strip_question_artifacts(stem_text) is distinct from stem_text;

update content.question
   set solution_text = content.fn_strip_question_artifacts(solution_text)
 where content.fn_strip_question_artifacts(solution_text) is distinct from solution_text;

-- ---------------------------------------------------------------------------
-- 3. Backfill the translations and the options.
--    Options are 0 rows in this bank today; included so a future import that
--    does leak a tag into an option is covered by the same one-time pass.
-- ---------------------------------------------------------------------------
update content.question_translation
   set stem_text = content.fn_strip_question_artifacts(stem_text)
 where content.fn_strip_question_artifacts(stem_text) is distinct from stem_text;

update content.question_option
   set option_text = content.fn_strip_question_artifacts(option_text)
 where content.fn_strip_question_artifacts(option_text) is distinct from option_text;

update content.question_solution
   set explanation_text = content.fn_strip_question_artifacts(explanation_text)
 where content.fn_strip_question_artifacts(explanation_text) is distinct from explanation_text;

-- ---------------------------------------------------------------------------
-- 4. Re-collapse the duplicates the strip just created.
--    Reuses migration 031's canonical-pick rule verbatim (highest revision_no,
--    then a non-null solution, then has_image/has_table/has_math richness,
--    then lowest question_id as a stable tiebreak) so the survivor of a group
--    is chosen the same way here as it was there — and so re-running is a
--    no-op rather than picking a different survivor each time. Rows are never
--    deleted: assess.test_question / assess.attempt_response hold FKs and
--    historical attempts must stay reconstructible.
-- ---------------------------------------------------------------------------
with grp as (
  select content_fp, sum(usage_count) as total_usage
    from content.question
   where lifecycle_status = 'published'
   group by content_fp
  having count(*) > 1
),
ranked as (
  select question_id, content_fp,
         row_number() over (
           partition by content_fp
           order by revision_no desc nulls last,
                    (solution_text is not null) desc,
                    (coalesce(has_image, false)::int + coalesce(has_table, false)::int + coalesce(has_math, false)::int) desc,
                    question_id asc
         ) as rn
    from content.question
   where lifecycle_status = 'published'
)
update content.question q
   set usage_count = grp.total_usage
  from ranked r
  join grp on grp.content_fp = r.content_fp
 where q.question_id = r.question_id and r.rn = 1;

with ranked as (
  select question_id, content_fp,
         row_number() over (
           partition by content_fp
           order by revision_no desc nulls last,
                    (solution_text is not null) desc,
                    (coalesce(has_image, false)::int + coalesce(has_table, false)::int + coalesce(has_math, false)::int) desc,
                    question_id asc
         ) as rn,
         first_value(question_id) over (
           partition by content_fp
           order by revision_no desc nulls last,
                    (solution_text is not null) desc,
                    (coalesce(has_image, false)::int + coalesce(has_table, false)::int + coalesce(has_math, false)::int) desc,
                    question_id asc
         ) as canonical_id
    from content.question
   where lifecycle_status = 'published'
)
update content.question q
   set lifecycle_status = 'duplicate_archived',
       canonical_question_id = r.canonical_id
  from ranked r
 where q.question_id = r.question_id
   and r.rn > 1;

-- ---------------------------------------------------------------------------
-- 5. Write-time guard (spec's requirement 4).
--    Rejects any insert/update that would put an artifact back into the bank,
--    naming the offending question id. A trigger, not application-layer
--    validation alone, because this repo's own audit already found a generic
--    CRUD route writing content rows directly (BUGS.md#G1) — the database is
--    the only choke point every write path shares. db/scripts/import/import-content.ts
--    mirrors the same check at the import layer so a bad batch fails naming
--    the row and the offending text, instead of aborting mid-insert on a raw
--    trigger exception with no row context.
-- ---------------------------------------------------------------------------
create or replace function content.fn_reject_question_artifacts() returns trigger
language plpgsql as $$
begin
  if content.fn_strip_question_artifacts(new.stem_text) is distinct from new.stem_text then
    raise exception
      'question % rejected: stem_text contains a template artifact (generator/case identifier). Store it in metadata, never in the stem. Offending text: %',
      new.question_id, left(new.stem_text, 200)
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_question_reject_artifacts on content.question;
create trigger trg_question_reject_artifacts
  before insert or update of stem_text on content.question
  for each row execute function content.fn_reject_question_artifacts();

create or replace function content.fn_reject_translation_artifacts() returns trigger
language plpgsql as $$
begin
  if content.fn_strip_question_artifacts(new.stem_text) is distinct from new.stem_text then
    raise exception
      'translation for question % rejected: stem_text contains a template artifact. Offending text: %',
      new.question_id, left(new.stem_text, 200)
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_translation_reject_artifacts on content.question_translation;
create trigger trg_translation_reject_artifacts
  before insert or update of stem_text on content.question_translation
  for each row execute function content.fn_reject_translation_artifacts();
