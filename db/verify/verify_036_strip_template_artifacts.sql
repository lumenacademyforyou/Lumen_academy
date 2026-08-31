-- verify_036_strip_template_artifacts.sql
-- Every check must return ok = true.

-- 1. No stored question stem still carries an artifact.
select 'no dirty question stems' as check,
       count(*) = 0 as ok, count(*) as offending
  from content.question
 where content.fn_strip_question_artifacts(stem_text) is distinct from stem_text;

-- 2. Same for translations, options, solutions.
select 'no dirty translations' as check,
       count(*) = 0 as ok, count(*) as offending
  from content.question_translation
 where content.fn_strip_question_artifacts(stem_text) is distinct from stem_text;

select 'no dirty options' as check,
       count(*) = 0 as ok, count(*) as offending
  from content.question_option
 where content.fn_strip_question_artifacts(option_text) is distinct from option_text;

select 'no dirty solutions' as check,
       count(*) = 0 as ok, count(*) as offending
  from content.question_solution
 where content.fn_strip_question_artifacts(explanation_text) is distinct from explanation_text;

-- 3. The literal word "case" followed by an identifier appears nowhere in
--    user-facing content at all (the spec's strictest acceptance criterion).
select 'no "case #n" anywhere in published content' as check,
       count(*) = 0 as ok, count(*) as offending
  from content.question
 where lifecycle_status = 'published'
   and (stem_text ~* 'case[ ]*#?[ ]*[0-9]' or stem_text ~ '#[ ]*[0-9]+[_.-][0-9]+');

-- 4. Idempotence: applying the stripper a second time changes nothing.
select 'stripper is a fixpoint' as check,
       count(*) = 0 as ok, count(*) as offending
  from content.question
 where content.fn_strip_question_artifacts(content.fn_strip_question_artifacts(stem_text))
       is distinct from content.fn_strip_question_artifacts(stem_text);

-- 5. The dedup invariant still holds after the strip collapsed variants:
--    one published row per content_fp.
select 'one published row per content_fp' as check,
       count(*) = 0 as ok, count(*) as offending
  from (select content_fp from content.question
         where lifecycle_status = 'published'
         group by content_fp having count(*) > 1) d;

-- 6. Every archived duplicate points at a real canonical row.
select 'archived duplicates have a canonical' as check,
       count(*) = 0 as ok, count(*) as offending
  from content.question
 where lifecycle_status = 'duplicate_archived' and canonical_question_id is null;

-- 7. The write-time guards exist.
select 'write guards installed' as check,
       count(*) = 2 as ok, count(*) as found
  from pg_trigger
 where tgname in ('trg_question_reject_artifacts', 'trg_translation_reject_artifacts')
   and not tgisinternal;
