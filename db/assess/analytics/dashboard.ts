import { pool } from "../../shared/pool.js";
import { deriveSessionModeFromTestCode } from "../test/definition/test-code.js";

/**
 * LA-APP-COMPLETION-001 Phase G, G1/G2 — real dashboard/analytics
 * aggregation, entirely in SQL (per G2's own "aggregation happens in SQL,
 * not in the browser"). Every query here is scoped to one user's own scored
 * attempts (assess.attempt.user_id = $1 and attempt_state = 'scored') —
 * in-progress/paused/abandoned attempts carry no scorecard yet and are
 * correctly excluded, matching the same "only ever read a persisted score,
 * never recompute one" discipline as getScorecardWithSections/getReview.
 *
 * "Unattempted" for a served question is: no assess.attempt_response row at
 * all (never visited/saved), or a row whose is_correct stayed null — see
 * db/assess/test/attempt/attempt-flow.ts's submitAttempt, which only ever
 * UPDATEs an attempt_response row that already exists; a question the
 * student never interacted with has no such row, so `ar.is_correct is null`
 * (via the left join below) is the correct, complete test for it.
 */

export interface AttemptHistoryEntry {
  attemptId: string;
  testId: string;
  testTitle: string;
  testCode: string;
  mode: "subject-wise" | "full-mock" | "custom";
  submittedAt: string;
  obtainedMarks: string;
  totalMarks: string;
  accuracyPercent: string;
}

export interface ScoreTrendPoint {
  attemptId: string;
  submittedAt: string;
  obtainedMarks: string;
  totalMarks: string;
  accuracyPercent: string;
}

export interface SubjectAccuracy {
  subjectCode: string;
  subjectName: string;
  correct: number;
  incorrect: number;
  unattempted: number;
  total: number;
  accuracyPercent: number;
}

export interface UnitAccuracy {
  subjectCode: string;
  nodeId: string;
  tagCode: string;
  unitTitle: string;
  correct: number;
  incorrect: number;
  unattempted: number;
  total: number;
  accuracyPercent: number;
}

export interface DifficultyAccuracy {
  difficultyBand: string;
  correct: number;
  incorrect: number;
  unattempted: number;
  total: number;
  accuracyPercent: number;
}

export interface TimeBucket {
  bucketLabel: string;
  questionCount: number;
  averageSeconds: number | null;
}

export interface DashboardAnalytics {
  attemptHistory: AttemptHistoryEntry[];
  scoreTrend: ScoreTrendPoint[];
  subjectAccuracy: SubjectAccuracy[];
  unitAccuracy: UnitAccuracy[];
  difficultyAccuracy: DifficultyAccuracy[];
  timeDistribution: TimeBucket[];
  weakestUnits: UnitAccuracy[];
  unattemptedRate: { servedCount: number; unattemptedCount: number; unattemptedPercent: number };
  // BUG-23 (docs/assessment-tool-debug-plan.md) — "Tests Taken" definition,
  // recorded here since this is its one real source of truth: count of
  // attempts with attempt_state = 'scored' for this user. Excludes created
  // (never persisted at all), in_progress, paused, and abandoned — an
  // attempt that expired with zero answers still gets scored (0/total) by
  // enforceExpiry/submitAttempt, same as a real zero-score submission, so it
  // correctly counts as "taken." attemptHistory above is capped at 20 rows
  // for chart/list rendering; this is the real, uncapped total.
  totalScoredAttempts: number;
}

// Shared by every accuracy-shaped row (subject/unit/difficulty) — SQL does
// the count(*) filter aggregation; this only derives the display percentage,
// which is arithmetic on already-aggregated numbers, not a scoring verdict.
function accuracyPercentOf(correct: number, incorrect: number): number {
  const attempted = correct + incorrect;
  return attempted > 0 ? Math.round((correct / attempted) * 10000) / 100 : 0;
}

const SCORED_QUESTION_JOIN = `
    from assess.attempt_question aq
    join assess.attempt a on a.attempt_id = aq.attempt_id
    left join assess.attempt_response ar on ar.attempt_id = aq.attempt_id and ar.question_id = aq.question_id
    join content.question q on q.question_id = aq.question_id
    join catalog.syllabus_node sn on sn.node_id = q.primary_node_id
    join catalog.subject s on s.subject_id = sn.subject_id
   where a.user_id = $1 and a.attempt_state = 'scored'`;

type QueryClient = Pick<import("pg").PoolClient, "query">;

async function getAttemptHistory(client: QueryClient, userId: string, limit: number): Promise<AttemptHistoryEntry[]> {
  const res = await client.query<{
    attempt_id: string;
    test_id: string;
    test_title: string;
    test_code: string;
    submitted_at: string;
    obtained_marks: string;
    total_marks: string;
    accuracy_percent: string;
  }>(
    `select a.attempt_id, a.test_id, t.title as test_title, t.test_code, a.submitted_at,
            sc.obtained_marks, sc.total_marks, sc.accuracy_percent
       from assess.attempt a
       join assess.test t on t.test_id = a.test_id
       join assess.scorecard sc on sc.attempt_id = a.attempt_id
      where a.user_id = $1 and a.attempt_state = 'scored'
      order by a.submitted_at desc
      limit $2`,
    [userId, limit]
  );
  return res.rows.map((r) => ({
    attemptId: r.attempt_id,
    testId: r.test_id,
    testTitle: r.test_title,
    testCode: r.test_code,
    mode: deriveSessionModeFromTestCode(r.test_code),
    submittedAt: r.submitted_at,
    obtainedMarks: r.obtained_marks,
    totalMarks: r.total_marks,
    accuracyPercent: r.accuracy_percent,
  }));
}

async function getScoreTrend(client: QueryClient, userId: string, limit: number): Promise<ScoreTrendPoint[]> {
  const res = await client.query<{
    attempt_id: string;
    submitted_at: string;
    obtained_marks: string;
    total_marks: string;
    accuracy_percent: string;
  }>(
    `select attempt_id, submitted_at, obtained_marks, total_marks, accuracy_percent
       from (
         select a.attempt_id, a.submitted_at, sc.obtained_marks, sc.total_marks, sc.accuracy_percent
           from assess.attempt a
           join assess.scorecard sc on sc.attempt_id = a.attempt_id
          where a.user_id = $1 and a.attempt_state = 'scored'
          order by a.submitted_at desc
          limit $2
       ) recent
      order by submitted_at asc`,
    [userId, limit]
  );
  return res.rows.map((r) => ({
    attemptId: r.attempt_id,
    submittedAt: r.submitted_at,
    obtainedMarks: r.obtained_marks,
    totalMarks: r.total_marks,
    accuracyPercent: r.accuracy_percent,
  }));
}

async function getSubjectAccuracy(client: QueryClient, userId: string): Promise<SubjectAccuracy[]> {
  const res = await client.query<{
    subject_code: string;
    subject_name: string;
    correct: string;
    incorrect: string;
    unattempted: string;
    total: string;
  }>(
    `select s.subject_code, s.subject_name,
            count(*) filter (where ar.is_correct = true) as correct,
            count(*) filter (where ar.is_correct = false) as incorrect,
            count(*) filter (where ar.is_correct is null) as unattempted,
            count(*) as total
     ${SCORED_QUESTION_JOIN}
     group by s.subject_code, s.subject_name
     order by s.subject_code`,
    [userId]
  );
  return res.rows.map((r) => {
    const correct = Number(r.correct);
    const incorrect = Number(r.incorrect);
    return {
      subjectCode: r.subject_code,
      subjectName: r.subject_name,
      correct,
      incorrect,
      unattempted: Number(r.unattempted),
      total: Number(r.total),
      accuracyPercent: accuracyPercentOf(correct, incorrect),
    };
  });
}

async function getUnitAccuracy(client: QueryClient, userId: string): Promise<UnitAccuracy[]> {
  const res = await client.query<{
    subject_code: string;
    node_id: string;
    tag_code: string;
    unit_title: string;
    correct: string;
    incorrect: string;
    unattempted: string;
    total: string;
  }>(
    `select s.subject_code, sn.node_id, sn.tag_code, sn.title as unit_title,
            count(*) filter (where ar.is_correct = true) as correct,
            count(*) filter (where ar.is_correct = false) as incorrect,
            count(*) filter (where ar.is_correct is null) as unattempted,
            count(*) as total
     ${SCORED_QUESTION_JOIN}
     group by s.subject_code, sn.node_id, sn.tag_code, sn.title
     order by s.subject_code, sn.tag_code`,
    [userId]
  );
  return res.rows.map((r) => {
    const correct = Number(r.correct);
    const incorrect = Number(r.incorrect);
    return {
      subjectCode: r.subject_code,
      nodeId: r.node_id,
      tagCode: r.tag_code,
      unitTitle: r.unit_title,
      correct,
      incorrect,
      unattempted: Number(r.unattempted),
      total: Number(r.total),
      accuracyPercent: accuracyPercentOf(correct, incorrect),
    };
  });
}

async function getDifficultyAccuracy(client: QueryClient, userId: string): Promise<DifficultyAccuracy[]> {
  const res = await client.query<{
    difficulty_band: string | null;
    correct: string;
    incorrect: string;
    unattempted: string;
    total: string;
  }>(
    `select coalesce(q.difficulty_band, 'unrated') as difficulty_band,
            count(*) filter (where ar.is_correct = true) as correct,
            count(*) filter (where ar.is_correct = false) as incorrect,
            count(*) filter (where ar.is_correct is null) as unattempted,
            count(*) as total
     ${SCORED_QUESTION_JOIN}
     group by coalesce(q.difficulty_band, 'unrated')
     order by case coalesce(q.difficulty_band, 'unrated') when 'easy' then 1 when 'medium' then 2 when 'hard' then 3 else 4 end`,
    [userId]
  );
  return res.rows.map((r) => {
    const correct = Number(r.correct);
    const incorrect = Number(r.incorrect);
    return {
      difficultyBand: r.difficulty_band ?? "unrated",
      correct,
      incorrect,
      unattempted: Number(r.unattempted),
      total: Number(r.total),
      accuracyPercent: accuracyPercentOf(correct, incorrect),
    };
  });
}

async function getTimeDistribution(client: QueryClient, userId: string): Promise<TimeBucket[]> {
  // ar.time_spent_seconds is null whenever a question was never visited (no
  // attempt_response row) or visited but never timed — excluded via the
  // where clause rather than bucketed, since "not timed" isn't a real
  // time-per-question data point.
  const res = await client.query<{ bucket_label: string; bucket_order: number; question_count: string; average_seconds: string | null }>(
    `select
        case
          when ar.time_spent_seconds < 15 then '< 15s'
          when ar.time_spent_seconds < 30 then '15-30s'
          when ar.time_spent_seconds < 60 then '30-60s'
          when ar.time_spent_seconds < 120 then '1-2m'
          else '> 2m'
        end as bucket_label,
        case
          when ar.time_spent_seconds < 15 then 0
          when ar.time_spent_seconds < 30 then 1
          when ar.time_spent_seconds < 60 then 2
          when ar.time_spent_seconds < 120 then 3
          else 4
        end as bucket_order,
        count(*) as question_count,
        avg(ar.time_spent_seconds) as average_seconds
       from assess.attempt_question aq
       join assess.attempt a on a.attempt_id = aq.attempt_id
       join assess.attempt_response ar on ar.attempt_id = aq.attempt_id and ar.question_id = aq.question_id
      where a.user_id = $1 and a.attempt_state = 'scored' and ar.time_spent_seconds is not null
      group by 1, 2
      order by 2`,
    [userId]
  );
  return res.rows.map((r) => ({
    bucketLabel: r.bucket_label,
    questionCount: Number(r.question_count),
    averageSeconds: r.average_seconds !== null ? Math.round(Number(r.average_seconds)) : null,
  }));
}

async function getUnattemptedRate(
  client: QueryClient,
  userId: string
): Promise<{ servedCount: number; unattemptedCount: number; unattemptedPercent: number }> {
  const res = await client.query<{ served: string; unattempted: string }>(
    `select count(*) as served, count(*) filter (where ar.is_correct is null) as unattempted
     ${SCORED_QUESTION_JOIN}`,
    [userId]
  );
  const served = Number(res.rows[0]?.served ?? 0);
  const unattempted = Number(res.rows[0]?.unattempted ?? 0);
  return {
    servedCount: served,
    unattemptedCount: unattempted,
    unattemptedPercent: served > 0 ? Math.round((unattempted / served) * 10000) / 100 : 0,
  };
}

async function getTotalScoredAttempts(client: QueryClient, userId: string): Promise<number> {
  const res = await client.query<{ n: string }>(`select count(*) as n from assess.attempt where user_id = $1 and attempt_state = 'scored'`, [userId]);
  return Number(res.rows[0]?.n ?? 0);
}

/** Weakest units: derived in JS from the already-fetched unit-accuracy rows (not a second query) — restricted to units with a minimum sample size (avoids a 1-question outlier reading as "weakest"), ordered worst-first. This is a re-sort of SQL-aggregated rows, not client-side aggregation of raw responses. */
function pickWeakestUnits(unitAccuracy: UnitAccuracy[], limit: number, minAttempted: number): UnitAccuracy[] {
  return unitAccuracy
    .filter((u) => u.correct + u.incorrect >= minAttempted)
    .sort((a, b) => a.accuracyPercent - b.accuracyPercent)
    .slice(0, limit);
}

// Runs all 7 queries on one checked-out connection, sequentially, rather
// than 7 concurrent pool.query() calls each grabbing their own connection.
// Found live while running this repo's own E2E suite: Supabase's
// session-mode pooler caps concurrent connections per project at
// pool_size=15 (a shared, low ceiling — not this app's own `pg.Pool` max,
// which has no `max` set and would happily open more). Every dashboard load
// used to burn 7 of that shared 15-connection budget at once; two users
// loading it around the same moment could exhaust it. These are simple,
// fast aggregate queries over one user's own bounded attempt history, so
// serializing them costs little latency in exchange for using exactly 1
// connection instead of 7.
export async function getDashboardAnalytics(userId: string): Promise<DashboardAnalytics> {
  const client = await pool.connect();
  try {
    const attemptHistory = await getAttemptHistory(client, userId, 20);
    const scoreTrend = await getScoreTrend(client, userId, 20);
    const subjectAccuracy = await getSubjectAccuracy(client, userId);
    const unitAccuracy = await getUnitAccuracy(client, userId);
    const difficultyAccuracy = await getDifficultyAccuracy(client, userId);
    const timeDistribution = await getTimeDistribution(client, userId);
    const unattemptedRate = await getUnattemptedRate(client, userId);
    const totalScoredAttempts = await getTotalScoredAttempts(client, userId);
    const weakestUnits = pickWeakestUnits(unitAccuracy, 5, 3);
    return { attemptHistory, scoreTrend, subjectAccuracy, unitAccuracy, difficultyAccuracy, timeDistribution, weakestUnits, unattemptedRate, totalScoredAttempts };
  } finally {
    client.release();
  }
}

export interface CohortComparison {
  cohortAverageAccuracy: number;
  cohortSize: number;
}

// P1-10 (docs/assessment-tool-fix-prompt.md's detailed report — "comparison
// ... against the cohort average"). "Cohort" here is every OTHER scored
// attempt of the same test shape — same TEST_TYPE + SCOPE_CODE segment of
// test_code (db/assess/test/definition/test-code.ts's own naming
// convention: e.g. every PHY subject-wise practice test, or every full
// mock) — not "the same test_id": createPracticeTest creates a brand-new
// assess.test row per session (LA-APP-COMPLETION-001 Phase C1), so almost
// no two attempts ever literally share one test_id to compare against.
// Comparing by shape instead is what makes a real cohort exist at all.
export async function getCohortComparison(attemptId: string): Promise<CohortComparison | null> {
  const selfRes = await pool.query<{ test_code: string }>(
    `select t.test_code from assess.attempt a join assess.test t on t.test_id = a.test_id where a.attempt_id = $1`,
    [attemptId]
  );
  const testCode = selfRes.rows[0]?.test_code;
  if (!testCode) return null;
  const prefixMatch = testCode.match(/^(LMN-[A-Z]+-[A-Z]+-[A-Z0-9]+-)\d{6}$/);
  if (!prefixMatch) return null;
  const prefix = prefixMatch[1];

  const res = await pool.query<{ avg_accuracy: string | null; cohort_size: string }>(
    `select avg(sc.accuracy_percent) as avg_accuracy, count(*) as cohort_size
       from assess.scorecard sc
       join assess.attempt a on a.attempt_id = sc.attempt_id
       join assess.test t on t.test_id = a.test_id
      where a.attempt_id != $1 and a.attempt_state = 'scored' and t.test_code like $2`,
    [attemptId, `${prefix}%`]
  );
  const cohortSize = Number(res.rows[0]?.cohort_size ?? 0);
  if (cohortSize === 0 || res.rows[0]?.avg_accuracy === null) return null;
  return { cohortAverageAccuracy: Math.round(Number(res.rows[0].avg_accuracy) * 100) / 100, cohortSize };
}
