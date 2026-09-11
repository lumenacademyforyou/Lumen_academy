-- 030_question_fingerprints.sql
-- docs/no-repeat-questions-fix.md Phase 1. Root cause (read-only
-- investigation, this session): ~54% of the published bank (1399 rows, 643
-- distinct stems) are byte-for-byte content clones under distinct
-- question_id — the assembler's exclusion logic (question_id-keyed, and
-- correctly so for what it was designed to guard) has no way to know two
-- different question_id rows render as the identical visible question. This
-- migration adds the fingerprint columns that make content, not question_id,
-- the enforced unit of identity from Phase 3 onward.
--
-- content.fn_normalize_stem is mirrored byte-for-byte in TypeScript as
-- db/shared/normalizeStem.ts — verified in this session against 16 hand-
-- built edge-case fixtures (HTML, markdown, LaTeX tokens, $ delimiters,
-- leading enumeration, decimal points, unit spacing) plus a live random
-- sample of 200 real stems from this bank: 216/216 matched exactly before
-- this function was finalized. db/content/fingerprint-normalizer.test.ts
-- keeps that guarantee live going forward. If you ever change one side,
-- change the other the same way, in the same step order — a silent
-- divergence here makes every fingerprint downstream unreliable.
--
-- content_fp is the enforced dedup key (Phase 3/4): sha256 of the
-- normalized stem plus every option's normalized text, options sorted
-- first — sorting matters because the investigation confirmed clone rows
-- carry the same options in different insertion order, so an unsorted hash
-- would treat two clones as different. stem_fp (same stem, re-authored
-- options) and skeleton_fp (digits collapsed to '#', catches numeric drill
-- variants) are computed and indexed now but are report-only per Phase 1.4
-- — skeleton_fp is deliberately not enforced anywhere yet, since it would
-- also collapse legitimate "same formula, different numbers" practice
-- questions that arguably should both exist.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create or replace function content.fn_normalize_stem(input text) returns text
language plpgsql immutable as $$
declare
  s text;
begin
  if input is null then
    return null;
  end if;

  -- 1. NFKC normalize.
  s := normalize(input, NFKC);

  -- 2. Strip HTML tags and markdown formatting/link syntax.
  s := regexp_replace(s, '<[^>]*>', '', 'g');
  s := regexp_replace(s, '\[([^\]]*)\]\([^)]*\)', '\1', 'g');
  s := regexp_replace(s, '[*_~`]', '', 'g');
  s := regexp_replace(s, '^\s*#+\s*', '', 'gn');

  -- 3. Strip LaTeX spacing tokens and collapse $ delimiters.
  s := regexp_replace(s, '\\,|\\!|\\;|\\quad|\\qquad', ' ', 'g');
  s := regexp_replace(s, '\$+', '', 'g');

  -- 4. Strip leading enumeration ("1.", "(2)", "[3]" at the start).
  s := regexp_replace(s, '^\s*[(\[]?\d+[)\].:]\s*', '');

  -- 5. Lowercase.
  s := lower(s);

  -- 6. Strip punctuation except decimal points inside numbers and math operators.
  -- chr(1) is used as a placeholder to protect a decimal point's dot from
  -- the punctuation strip; it cannot appear in real input (already stripped
  -- as a control character by this same step) so there is no collision risk.
  s := regexp_replace(s, '(\d)\.(\d)', '\1' || chr(1) || '\2', 'g');
  s := regexp_replace(s, '[^a-z0-9\s+\-*/=<>' || chr(1) || ']', '', 'g');
  s := replace(s, chr(1), '.');

  -- 7. Normalize unit spacing ("5kg" -> "5 kg").
  s := regexp_replace(s, '(\d)([a-z])', '\1 \2', 'g');

  -- 8. Collapse whitespace, trim.
  s := trim(regexp_replace(s, '\s+', ' ', 'g'));

  return s;
end;
$$;

-- Recomputes all three fingerprint columns for one question from its
-- current stem_text and its content.question_option rows. A single shared
-- function so the trigger (fires per row-level change) and the one-time
-- backfill below can never compute it two different ways.
create or replace function content.fn_question_fingerprints(p_question_id uuid)
returns table(content_fp bytea, stem_fp bytea, skeleton_fp bytea)
language sql stable as $$
  select
    digest(
      content.fn_normalize_stem(q.stem_text) || chr(31) ||
      coalesce((
        select string_agg(content.fn_normalize_stem(qo.option_text), chr(31) order by content.fn_normalize_stem(qo.option_text))
          from content.question_option qo
         where qo.question_id = q.question_id
      ), ''),
      'sha256'
    ) as content_fp,
    digest(content.fn_normalize_stem(q.stem_text), 'sha256') as stem_fp,
    digest(regexp_replace(content.fn_normalize_stem(q.stem_text), '\d+(\.\d+)?', '#', 'g'), 'sha256') as skeleton_fp
    from content.question q
   where q.question_id = p_question_id;
$$;

alter table content.question
  add column if not exists content_fp  bytea,
  add column if not exists stem_fp     bytea,
  add column if not exists skeleton_fp bytea;

create index if not exists idx_question_content_fp  on content.question (content_fp);
create index if not exists idx_question_stem_fp     on content.question (stem_fp);
create index if not exists idx_question_skeleton_fp on content.question (skeleton_fp);

-- One-time backfill for every row that exists today. A correlated scalar
-- subquery, not `UPDATE ... FROM` — the target table's own alias isn't
-- visible inside a FROM item's function-call arguments in that form.
update content.question q
   set (content_fp, stem_fp, skeleton_fp) =
       (select content_fp, stem_fp, skeleton_fp from content.fn_question_fingerprints(q.question_id));

-- Keeps the fingerprints correct going forward regardless of write path —
-- same shape as content.trg_asset_sync_has_image (028_has_image_computed):
-- a stale fingerprint is worse than no fingerprint, so any change to a
-- question's stem or any of its options recomputes all three columns on
-- the owning question row.
create or replace function content.trg_question_fingerprint_sync() returns trigger as $$
declare
  v_question_id uuid := coalesce(new.question_id, old.question_id);
  f record;
begin
  select * into f from content.fn_question_fingerprints(v_question_id);
  update content.question
     set content_fp = f.content_fp, stem_fp = f.stem_fp, skeleton_fp = f.skeleton_fp
   where question_id = v_question_id;

  return coalesce(new, old);
end;
$$ language plpgsql;

drop trigger if exists trg_question_fingerprint_sync on content.question;
create trigger trg_question_fingerprint_sync
  after insert or update of stem_text on content.question
  for each row execute function content.trg_question_fingerprint_sync();

drop trigger if exists trg_question_option_fingerprint_sync on content.question_option;
create trigger trg_question_option_fingerprint_sync
  after insert or delete or update of option_text on content.question_option
  for each row execute function content.trg_question_fingerprint_sync();

insert into util.applied_migration (migration_name) values ('030_question_fingerprints')
on conflict (migration_name) do nothing;
