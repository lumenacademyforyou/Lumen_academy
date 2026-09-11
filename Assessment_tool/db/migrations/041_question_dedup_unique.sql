-- 041_question_dedup_unique — Layer 2's permanence guarantee.
--
-- ****************************************************************************
-- PREREQUISITE — this migration WILL FAIL until the backfill has run:
--
--     npx tsx db/scripts/backfill-question-identity.ts --dry-run    (review)
--     npx tsx db/scripts/backfill-question-identity.ts --execute
--
-- As measured on 2026-09-01, 67 published rows across 30 groups currently
-- share a dedup_key with another published row (all of them Physics template
-- families differing only by a decorative chapter name — see
-- docs/QUESTION_DEDUP_AUDIT.md Finding 1). The unique index cannot be created
-- while they are all still published and canonical. That is deliberate: the
-- index failing loudly is far better than silently creating something that
-- does not actually constrain anything.
--
-- The failure is safe and non-destructive — CREATE UNIQUE INDEX either
-- succeeds or does nothing.
-- ****************************************************************************
--
-- WHY THIS IS THE PERMANENCE GUARANTEE
-- ------------------------------------
-- Every other layer can be bypassed. An authoring UI, a bulk importer, a
-- migration script or a manual psql session can all skip application-level
-- checks. None of them can skip a database constraint. Combined with
-- migration 037's trigger — which recomputes dedup_key from the row's own
-- content and discards whatever the writer supplied — there is no way to
-- insert a duplicate question into the published bank.
--
-- WHY IT IS PARTIAL
-- -----------------
--   lifecycle_status = 'published'  — drafts, retired rows and, critically,
--     duplicate_archived rows must be allowed to keep their (now duplicate)
--     dedup_key. The whole retirement model depends on a duplicate CONTINUING
--     to exist with the same identity, pointed at its canonical.
--   canonical_question_id IS NULL   — a row that has been merged into a
--     canonical is exempt for the same reason.
--
-- WHAT IS DELIBERATELY NOT CREATED
-- --------------------------------
-- A (primary_node_id, answer_key) unique index. The directive rules it out at
-- any node granularity, and the audit confirmed why empirically on this
-- database: the node taxonomy is 38 flat units averaging 16 published
-- questions, and one template family spans 7 of them, so such an index would
-- simultaneously be too coarse to be safe and too narrow to catch the real
-- duplicates. dedup_key excludes primary_node_id entirely.

begin;

-- Guard rail: fail with an explanation rather than a bare 23505 from the
-- index build, so the operator is told exactly what to do next.
do $$
declare
  v_dupes bigint;
  v_null  bigint;
begin
  select count(*) into v_null
    from content.question
   where lifecycle_status = 'published' and dedup_key is null;
  if v_null > 0 then
    raise exception
      'migration 041 prerequisite not met — % published row(s) have no dedup_key. Run: npx tsx db/scripts/backfill-question-identity.ts --execute',
      v_null;
  end if;

  select coalesce(sum(c - 1), 0) into v_dupes
    from (
      select count(*) c from content.question
       where lifecycle_status = 'published' and canonical_question_id is null and dedup_key is not null
       group by dedup_key having count(*) > 1
    ) z;
  if v_dupes > 0 then
    raise exception
      'migration 041 prerequisite not met — % published row(s) still share a dedup_key. Run the clustering pass: npx tsx db/scripts/backfill-question-identity.ts --execute',
      v_dupes;
  end if;
end $$;

create unique index if not exists uq_question_dedup
  on content.question (dedup_key)
  where lifecycle_status = 'published'
    and canonical_question_id is null;

comment on index content.uq_question_dedup is
  'Layer 2 permanence guarantee: no authoring tool, bulk importer, migration script or manual session can insert a second published question with the same identity. Partial so that duplicate_archived rows may keep their duplicate dedup_key.';

commit;
