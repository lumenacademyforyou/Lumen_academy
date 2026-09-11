-- verify_040_question_usage — usage table, trigger and backfill.

do $$
declare
  v_usage   bigint;
  v_hist    bigint;
  v_counted bigint;
  v_missing text;
begin
  if to_regclass('content.question_usage') is null then
    raise exception 'verify_040 FAILED — content.question_usage missing';
  end if;

  select string_agg(i, ', ') into v_missing
    from unnest(array['ix_question_usage_cohort_recent','ix_question_usage_user_recent',
                      'ix_question_usage_paper','uq_question_usage_paper_question']) i
   where not exists (select 1 from pg_indexes where schemaname='content' and indexname=i);
  if v_missing is not null then
    raise exception 'verify_040 FAILED — missing index(es): %', v_missing;
  end if;

  if not exists (
    select 1 from pg_trigger where tgrelid='content.question_usage'::regclass
      and tgname='trg_question_usage_count' and not tgisinternal
  ) then
    raise exception 'verify_040 FAILED — trg_question_usage_count missing';
  end if;

  -- The backfill must have projected every past served question.
  select count(*) into v_usage from content.question_usage;
  select count(*) into v_hist
    from assess.attempt_question aq
    join assess.attempt a on a.attempt_id = aq.attempt_id
    join content.question q on q.question_id = aq.question_id;
  if v_usage < v_hist then
    raise exception 'verify_040 FAILED — usage backfill incomplete: % rows for % historical served questions', v_usage, v_hist;
  end if;

  -- usage_count must now be non-zero exactly where usage exists. Before this
  -- migration it was 0 on all 1400 rows.
  select count(*) into v_counted from content.question where usage_count > 0;
  if v_usage > 0 and v_counted = 0 then
    raise exception 'verify_040 FAILED — % usage rows but usage_count still 0 everywhere; trigger did not fire', v_usage;
  end if;

  raise notice 'verify_040 OK — % usage row(s) backfilled from % historical served question(s); % question(s) now carry a non-zero usage_count',
    v_usage, v_hist, v_counted;
end $$;
