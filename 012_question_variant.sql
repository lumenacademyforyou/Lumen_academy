-- =====================================================================
-- 012_question_variant.sql
--
-- Resolves open item O-3.
--
-- The conflict: content.question_option hangs off content.question, so a
-- question has exactly one answer set. When the same stem is served as a
-- single-correct item in one exam and a multiple-correct item in another,
-- the answer sets differ and one row cannot hold both.
--
-- The resolution: they are two questions, explicitly linked. The variant
-- carries its own options, its own blocks and its own exam usage, and
-- records what it varies from and why. Analytics can then treat them as
-- one item where that is wanted, and the paper generator never puts both
-- into the same paper.
-- =====================================================================

alter table content.question
  add column variant_of_question_id uuid references content.question(question_id) on delete restrict,
  add column variant_reason text;

alter table content.question
  add constraint ck_question_variant_self
    check (variant_of_question_id is distinct from question_id);

alter table content.question
  add constraint ck_question_variant_reason
    check ((variant_of_question_id is null) = (variant_reason is null));

alter table content.question
  add constraint ck_question_variant_reason_value
    check (variant_reason is null or variant_reason in
      ('ANSWER_SET','FORMAT','DIFFICULTY_REWRITE','LANGUAGE_REWRITE','NUMERIC_RECAST'));

create index ix_question_variant_of on content.question (variant_of_question_id)
  where variant_of_question_id is not null;

-- A variant may not itself be varied: the chain is one level deep, so
-- "the original" is always a single hop away and never a walk.
create or replace function content.check_variant_depth()
returns trigger
language plpgsql
as $$
begin
  if new.variant_of_question_id is not null then
    if exists (select 1 from content.question p
                where p.question_id = new.variant_of_question_id
                  and p.variant_of_question_id is not null) then
      raise exception
        'Question % would be a variant of a variant. Point it at the original instead.',
        coalesce(new.lumen_id, new.question_id::text)
        using errcode = 'check_violation';
    end if;
  end if;

  if exists (select 1 from content.question c
              where c.variant_of_question_id = new.question_id)
     and new.variant_of_question_id is not null then
    raise exception
      'Question % already has variants and cannot itself become a variant.',
      coalesce(new.lumen_id, new.question_id::text)
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger trg_question_variant_depth
before insert or update of variant_of_question_id on content.question
for each row execute function content.check_variant_depth();

-- A question and its variants must never both land in one paper. This
-- view gives the generator the exclusion set in one lookup.
create or replace view content.v_question_variant_family as
select q.question_id,
       q.lumen_id,
       coalesce(q.variant_of_question_id, q.question_id) as family_id,
       q.variant_reason
  from content.question q;

comment on column content.question.variant_of_question_id is
  'The original this question was derived from. Set when the stem is shared but the answer set, format or numeric recast differs. One level deep only.';
comment on view content.v_question_variant_family is
  'family_id groups an original with its variants. The generator excludes a whole family once any member is selected, so a student never meets the same stem twice in one paper.';
