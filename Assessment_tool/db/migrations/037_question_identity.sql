-- 037_question_identity — Layer 1/2/3 of question-dedup-audit-and-fix.md.
--
-- Findings that shaped this migration are in docs/QUESTION_DEDUP_AUDIT.md.
-- The short version, because it changes what this file does and does not do:
--
--   * Migrations 030/031/036 already built exact-content fingerprinting and
--     collapsed 799 byte-identical clones. There are ZERO content_fp or
--     stem_fp collisions left among the 600 published rows.
--   * What survives is narrower and was missed by every prior pass: 28% of
--     published stems open with a decorative "In <Chapter Name>, " lead-in
--     that the generator interpolated. It is a *text* difference, so
--     skeleton_fp's number-collapsing does not touch it, and content_fp /
--     stem_fp differ too. Three byte-identical questions with identical
--     option sets and identical correct answers therefore hash three
--     different ways and can all land in one paper.
--   * Measured blast radius of the identity key below: 600 published rows
--     collapse to 542 distinct identities — 29 groups, 58 rows to retire.
--     All 29 groups were hand-reviewed; all 29 are genuine duplicates.
--
-- Deliberate scope decisions, each with its evidence:
--
--   * Layer 5 (node_leaf_id) is NOT built. catalog.syllabus_node is flat —
--     38 nodes, all roots, all depth 0, one node_type. The directive scopes
--     Layer 5 to "only if 1.1 shows mixed depths"; there is only one depth.
--   * primary_node_id is absent from the identity key, per the directive's
--     design decision, and the audit validated it empirically: one template
--     family spans 7 different units, so a node-scoped key would have
--     compared none of its members.
--   * stem_vec/embed_model_version are provisioned but left NULL. No
--     embedding provider is configured in this environment. Near-duplicate
--     review ships on the pg_trgm lexical tier (Layer 3's own cheaper tier),
--     which is tunable with real precision/recall today.
--   * The UNIQUE index is NOT created here. It cannot be: 58 published rows
--     currently violate it. Migration 038 adds it after the backfill and
--     clustering pass have retired those rows. Splitting it is what makes
--     this migration safe to run on a live bank.
--
-- Idempotent throughout (if not exists / or replace), so a re-run is a no-op.

begin;

-- ---------------------------------------------------------------------------
-- 1. Identity columns (Layer 1)
-- ---------------------------------------------------------------------------

alter table content.question
  add column if not exists stem_norm           text,
  add column if not exists answer_key          text,
  add column if not exists dedup_key           bytea,
  add column if not exists stem_vec            vector(1024),
  add column if not exists embed_model_version text,
  add column if not exists image_phash         bytea;

comment on column content.question.stem_norm is
  'Aggressively normalised stem: fn_normalize_stem plus decorative-lead-in and framing-boilerplate removal. Trigger-maintained; never supplied by application code.';
comment on column content.question.answer_key is
  'Normalised correct answer. MCQ: normalised text of the is_correct option. Numeric/integer: numeric_answer rounded to 6 decimal places. The global blocking key for duplicate detection — deliberately NOT scoped by primary_node_id.';
comment on column content.question.dedup_key is
  'sha256(stem_norm, sorted normalised option texts, answer_key, image_phash, question_type). Composite identity. primary_node_id is deliberately excluded.';
comment on column content.question.stem_vec is
  'Embedding of stem_norm || answer_key. Provisioned, currently unpopulated — no embedding provider is configured. Re-embed rather than mix generations on model upgrade.';
comment on column content.question.embed_model_version is
  'Pinned embedding model version for stem_vec. Mixing generations silently corrupts similarity.';
comment on column content.question.image_phash is
  'Perceptual (dHash) hash of the attached stem image, not cryptographic — the same diagram re-exported at another DPI keeps its phash. Maintained by db/scripts/backfill-image-phash.ts, not by the trigger (it requires object-storage access).';

-- ---------------------------------------------------------------------------
-- 2. Normalisation functions
-- ---------------------------------------------------------------------------

-- The decorative lead-in and framing strips, applied BEFORE the existing
-- fn_normalize_stem so that function stays untouched (migration 030's
-- content_fp/stem_fp/skeleton_fp keep their current values — this migration
-- must not silently re-key the fingerprints the assembler already filters on).
--
-- Rule set derived from frequency analysis of the live corpus, not guesswork,
-- exactly as the directive requires. Measured marginal contribution of each
-- rule to collision groups among the 600 published rows:
--
--   baseline (fn_normalize_stem alone)      0 groups /  0 rows
--   + chapter lead-in strip                29 groups / 58 rows   <-- the whole win
--   + framing boilerplate strip            29 groups / 58 rows   <-- exactly 0 more
--
-- The framing strip is kept even though it contributes nothing on today's
-- corpus, precisely BECAUSE it measured zero: it introduces no false merges
-- here, and it is the rule that catches a re-authored paraphrase on a future
-- import. It is deliberately narrow — only semantically null leading
-- interrogative frames, never mid-stem text.
create or replace function content.fn_question_stem_norm(input text)
returns text
language sql
immutable
as $$
  select content.fn_normalize_stem(
    regexp_replace(
      regexp_replace(
        -- 1. Decorative chapter/topic lead-in: "In Wave Optics, ...".
        --    Title-cased phrase in an opening "In <Topic>," position. The
        --    generator interpolated the chapter name; it carries no
        --    information the rest of the stem does not already carry.
        coalesce(input, ''),
        '^\s*In\s+[A-Z][A-Za-z]*(\s+(of|and|in|the|a)\s+[A-Za-z]+|\s+[A-Z][A-Za-z]*)*\s*,\s*',
        ''
      ),
      -- 2. Semantically null leading interrogative frames.
      '^\s*(which\s+one\s+of\s+the\s+following|which\s+of\s+the\s+following|which\s+of\s+these|what\s+is\s+the\s+specific|what\s+is\s+the)\s+',
      '',
      'i'
    )
  );
$$;

-- answer_key — the highest-value field in the whole fix, and the global
-- blocking key. MCQ types take the normalised text of the correct option;
-- numeric/integer types take the value at a defined precision so that
-- 2.50 and 2.5000 block together. Returns NULL when a question has no
-- determinable answer, and a NULL answer_key deliberately makes dedup_key
-- NULL too (below) so an incomplete row is never merged with anything.
create or replace function content.fn_question_answer_key(p_question_id uuid)
returns text
language sql
stable
as $$
  select case
    when q.question_type in ('integer', 'numeric')
      then trim(to_char(round(q.numeric_answer, 6), 'FM9999999999990.999999'))
    else (
      -- multi_choice can legitimately have several correct options; ordering
      -- them makes the key independent of insertion/display order.
      select nullif(string_agg(content.fn_normalize_stem(o.option_text), chr(31)
                               order by content.fn_normalize_stem(o.option_text)), '')
        from content.question_option o
       where o.question_id = q.question_id
         and o.is_correct
    )
  end
  from content.question q
  where q.question_id = p_question_id;
$$;

-- has_math / has_table recomputed from actual content, never read back from
-- the stored flags (directive Bug 4: LEGACY rows carry stem_format='latex'
-- with has_math=false). has_image is NOT recomputed here — migration 028's
-- trg_asset_sync_has_image already derives it from content.asset rows, which
-- is a content-derived source of truth, so it is already trustworthy.
create or replace function content.fn_question_detect_math(p_question_id uuid)
returns boolean
language sql
stable
as $$
  select bool_or(
           t ~ '\\[a-zA-Z]+'                       -- a LaTeX command
        or t ~ '[\^_]\{?[A-Za-z0-9]'               -- super/subscript
        or t ~ '\$[^$]+\$'                         -- inline math delimiters
        or t ~ '[0-9]\s*[+\-*/=<>]\s*[0-9A-Za-z]'  -- an actual expression
         )
    from (
      select q.stem_text as t from content.question q where q.question_id = p_question_id
      union all
      select o.option_text from content.question_option o where o.question_id = p_question_id
      union all
      select q.solution_text from content.question q where q.question_id = p_question_id and q.solution_text is not null
    ) s(t);
$$;

create or replace function content.fn_question_detect_table(p_question_id uuid)
returns boolean
language sql
stable
as $$
  select bool_or(
           t ~* '<table'                           -- HTML table
        or t ~ '\\begin\{(array|tabular)\}'        -- LaTeX table
        or t ~ '(?n)^\s*\|.*\|\s*$'                -- markdown table row
         )
    from (
      select q.stem_text as t from content.question q where q.question_id = p_question_id
      union all
      select o.option_text from content.question_option o where o.question_id = p_question_id
    ) s(t);
$$;

-- The composite identity. primary_node_id is absent by design.
-- dedup_key is NULL when answer_key is NULL: a question whose answer cannot
-- be determined must never collide with anything, and a NULL is exempt from
-- the unique index by definition.
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
        select string_agg(content.fn_normalize_stem(o.option_text), chr(31)
                          order by content.fn_normalize_stem(o.option_text))
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

-- ---------------------------------------------------------------------------
-- 3. Layer 2 — the enforcement trigger
-- ---------------------------------------------------------------------------
--
-- AFTER, not BEFORE, and the reason is structural rather than stylistic:
-- answer_key and the option hash both read content.question_option, whose
-- rows are inserted AFTER the parent question row. A BEFORE trigger on
-- content.question cannot see them. Migration 030's existing
-- trg_question_fingerprint_sync solved the identical problem the identical
-- way. The permanence guarantee is unaffected — the recompute and the
-- unique-index check both happen inside the writer's own transaction, so a
-- violating INSERT still aborts that transaction.
--
-- Application code can never supply these values: the trigger overwrites
-- whatever was passed, on every insert and on every relevant update. An
-- importer that sets dedup_key by hand has its value discarded.
--
-- No recursion: this function UPDATEs stem_norm/answer_key/dedup_key/
-- has_math/has_table, and the trigger below is scoped to a column list that
-- contains none of them.
create or replace function content.trg_question_identity_sync()
returns trigger
language plpgsql
as $$
declare
  v_question_id uuid := coalesce(new.question_id, old.question_id);
  ident record;
begin
  select * into ident from content.fn_question_identity(v_question_id);

  -- A question row deleted in the same statement (option cascade) leaves
  -- nothing to update; fn_question_identity returns no row for it.
  if not found then
    return coalesce(new, old);
  end if;

  update content.question
     set stem_norm  = ident.stem_norm,
         answer_key = ident.answer_key,
         dedup_key  = ident.dedup_key,
         has_math   = coalesce(content.fn_question_detect_math(v_question_id), false),
         has_table  = coalesce(content.fn_question_detect_table(v_question_id), false)
   where question_id = v_question_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_question_identity_sync on content.question;
create trigger trg_question_identity_sync
  after insert or update of stem_text, question_type, numeric_answer, solution_text, image_phash, lifecycle_status
  on content.question
  for each row execute function content.trg_question_identity_sync();

drop trigger if exists trg_question_option_identity_sync on content.question_option;
create trigger trg_question_option_identity_sync
  after insert or delete or update of option_text, is_correct
  on content.question_option
  for each row execute function content.trg_question_identity_sync();

-- ---------------------------------------------------------------------------
-- 4. Reversibility — the audit log (Layer 1: "log every mutation")
-- ---------------------------------------------------------------------------

create table if not exists content.question_identity_audit (
  audit_id        bigint generated always as identity primary key,
  question_id     uuid not null references content.question (question_id),
  run_id          uuid not null,
  action          text not null check (action in ('backfill', 'cluster_retire', 'cluster_restore')),
  old_lifecycle   text,
  new_lifecycle   text,
  old_canonical   uuid,
  new_canonical   uuid,
  old_dedup_key   bytea,
  new_dedup_key   bytea,
  note            text,
  created_at      timestamptz not null default now()
);

create index if not exists ix_question_identity_audit_run
  on content.question_identity_audit (run_id, created_at);
create index if not exists ix_question_identity_audit_question
  on content.question_identity_audit (question_id);

comment on table content.question_identity_audit is
  'Every mutation made by the identity backfill and the clustering pass, so the pass is fully reversible if a threshold proves wrong. Never deleted from.';

-- ---------------------------------------------------------------------------
-- 5. Layer 3 — asynchronous near-duplicate review queue
-- ---------------------------------------------------------------------------
--
-- The unique index (migration 038) catches exact-identity collisions.
-- Anything short of that lands here for a human. Nothing in this system
-- auto-merges on similarity — the audit found live pairs that share an
-- answer key and are genuinely distinct questions (oxidation number +6 in
-- H2SO4 vs in K2Cr2O7; 2 A from Ohm's law vs from a series network), which
-- is exactly the directive's Bug 3.

create table if not exists content.question_duplicate_candidate (
  candidate_id     uuid primary key default gen_random_uuid(),
  question_id_a    uuid not null references content.question (question_id),
  question_id_b    uuid not null references content.question (question_id),
  similarity_score numeric(6,5) not null,
  detection_method text not null check (detection_method in ('trigram', 'answer_key_exact', 'embedding', 'image_phash')),
  status           text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  reviewed_by      uuid references core.app_user (user_id),
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now(),
  -- a < b enforced so a pair can never be queued twice in mirror order
  constraint ck_qdc_ordered check (question_id_a < question_id_b)
);

-- One row per pair, ever. A rejection is permanent: the nightly job skips any
-- pair that already has a row here regardless of status, so a reviewer never
-- sees the same pair twice.
create unique index if not exists uq_question_duplicate_candidate_pair
  on content.question_duplicate_candidate (question_id_a, question_id_b);

create index if not exists ix_question_duplicate_candidate_pending
  on content.question_duplicate_candidate (status, similarity_score desc)
  where status = 'pending';

comment on table content.question_duplicate_candidate is
  'Near-duplicate pairs awaiting human review. Rejections are permanent — the unique pair index means a rejected pair is never re-queued.';

-- ---------------------------------------------------------------------------
-- 6. Detection indexes
-- ---------------------------------------------------------------------------
-- pg_trgm is already installed (verified live). The GIN index backs the
-- Layer 3 lexical tier; the answer_key btree backs the blocking step.

create index if not exists ix_question_stem_norm_trgm
  on content.question using gin (stem_norm gin_trgm_ops);

create index if not exists ix_question_answer_key
  on content.question (answer_key)
  where answer_key is not null;

create index if not exists ix_question_dedup_key
  on content.question (dedup_key)
  where dedup_key is not null;

create index if not exists ix_question_canonical
  on content.question (canonical_question_id)
  where canonical_question_id is not null;

commit;
