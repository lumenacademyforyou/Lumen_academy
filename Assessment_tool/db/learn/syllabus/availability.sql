-- availability.sql — reference copy of LL-P0's per-node question-availability
-- count. Documentation only; the executed copy lives inline in tree.ts
-- (this codebase's established convention — see attempt-flow.ts,
-- assemble.ts). Keep both in sync by hand.
--
-- "Available" = published questions reachable from a syllabus_node via
-- content.question_node_map. No content.v_question_eligibility view exists
-- in this schema (docs/DB_STATE.md §6) — this is the direct equivalent.

select sn.node_id,
       count(q.question_id) filter (where q.lifecycle_status = 'published') as available_questions
  from catalog.syllabus_node sn
  left join content.question_node_map qnm on qnm.node_id = sn.node_id
  left join content.question q on q.question_id = qnm.question_id
 where sn.syllabus_version_id = $1
 group by sn.node_id;
