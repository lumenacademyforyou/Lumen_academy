-- verify_content.sql
-- STAGE 3 — asserts content/catalog data integrity after seeding.
-- At this point: 0 content.question rows (Stage 2 mapped 0/20 legacy
-- questions — see db/reports/unmapped_questions.json), so the
-- question-specific assertions are vacuously true. Written now so they run
-- for real the moment real questions land, per Stage 3's request.

do $$
declare
  failures text[] := array[]::text[];
  n int;
begin
  -- every question resolves to an existing syllabus_node (FK already
  -- enforces this at the DB level, but confirm no orphaned primary_node_id
  -- values slipped through some other path)
  select count(*) into n
    from content.question q
    left join catalog.syllabus_node sn on sn.node_id = q.primary_node_id
   where sn.node_id is null;
  if n > 0 then
    failures := array_append(failures, format('%s questions with a primary_node_id not in catalog.syllabus_node', n));
  end if;

  -- every question has >=1 option and exactly one is_correct = true
  select count(*) into n
    from content.question q
   where (select count(*) from content.question_option o where o.question_id = q.question_id) = 0;
  if n > 0 then
    failures := array_append(failures, format('%s questions with zero options', n));
  end if;

  select count(*) into n
    from content.question q
   where (select count(*) from content.question_option o where o.question_id = q.question_id and o.is_correct) <> 1;
  if n > 0 then
    failures := array_append(failures, format('%s questions without exactly one correct option', n));
  end if;

  -- no orphan options (question_id FK already enforces this; double-check)
  select count(*) into n
    from content.question_option o
    left join content.question q on q.question_id = o.question_id
   where q.question_id is null;
  if n > 0 then
    failures := array_append(failures, format('%s orphan question_option rows', n));
  end if;

  -- node parent chains terminate at a root for the seeded exam (walk up
  -- parent_node_id at most 20 hops; report anything that doesn't reach null)
  select count(*) into n
    from catalog.syllabus_node sn
   where sn.parent_node_id is not null
     and not exists (
       with recursive chain as (
         select sn.node_id, sn.parent_node_id, 0 as depth
         union all
         select c.parent_node_id, p.parent_node_id, c.depth + 1
           from chain c
           join catalog.syllabus_node p on p.node_id = c.parent_node_id
          where c.depth < 20
       )
       select 1 from chain where parent_node_id is null
     );
  if n > 0 then
    failures := array_append(failures, format('%s syllabus_node rows whose parent chain does not terminate at a root within 20 hops', n));
  end if;

  if array_length(failures, 1) is not null then
    raise exception 'verify_content FAILED: %', array_to_string(failures, '; ');
  end if;

  raise notice 'verify_content: OK — all assertions pass (content.question is empty; catalog.syllabus_node chains are flat/valid)';
end $$;
