-- candidate-pool.sql — reference copy of TE-P3's BLUEPRINT candidate-pool
-- query. This file is documentation only; the executed copy lives as the
-- CANDIDATE_POOL_SQL constant in assemble.ts (this codebase's existing
-- convention keeps hot-path SQL inline as a template string next to the
-- code that runs it — see db/assess/test/attempt/attempt-flow.ts — rather
-- than reading .sql files at runtime). Keep both in sync by hand; assemble.ts
-- is the one that actually runs.
--
-- $1 = test_id, $2 = user_id, $3 = student's current completed-attempt
-- count (assess.attempt.attempt_seq, max over submitted/scored attempts),
-- $4 = per-attempt random seed (assess.attempt.generation_seed, added by
-- db/migrations/019_attempt_generation_seed.sql).
--
-- One LATERAL subquery per assess.test_blueprint row belonging to the test,
-- executed as a single statement — one round trip regardless of section
-- count, per the brief's TE-P3 requirement.

select bp.blueprint_id, bp.test_section_id, bp.pick_count, picked.question_id
  from assess.test_blueprint bp
  cross join lateral (
    select q.question_id
      from content.question q
      join content.question_node_map qnm on qnm.question_id = q.question_id
      join catalog.syllabus_node sn on sn.node_id = qnm.node_id
     where sn.subject_id = bp.subject_id
       and q.lifecycle_status = 'published'
       and (
             bp.syllabus_node_id is null
             or qnm.node_id = bp.syllabus_node_id
             or (
                  bp.include_descendants
                  and sn.node_path like (select target.node_path || '%' from catalog.syllabus_node target where target.node_id = bp.syllabus_node_id)
                )
           )
       and (bp.difficulty_band is null or q.difficulty_band = bp.difficulty_band)
       and (bp.question_format is null or q.question_type = bp.question_format)
       and not exists (
             select 1 from assess.user_question_seen s
              where s.user_id = $2
                and s.question_id = q.question_id
                and s.last_seen_attempt_seq > ($3::int - 50)
           )
     order by md5(q.question_id::text || $4::text)
     limit bp.pick_count
  ) picked
 where bp.test_id = $1;
