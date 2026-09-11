import { pool } from "../../shared/pool.js";
import { NotFoundError } from "../../shared/errors.js";
import type { StudyPlanModel } from "./study_plan.model.js";
import type { StudyPlanGoalModel } from "./study_plan_goal/study_plan_goal.model.js";

// BUG-19 (docs/assessment-tool-debug-plan.md Phase 7) — "create once, edit
// anytime": one active plan per user is enforced at the DB level
// (026_learn_study_tools.sql's uq_study_plan_one_active_per_user partial
// unique index), and every function here is written to respect that rather
// than fight it — getOrCreateActivePlan never inserts a second active row,
// resetPlan always archives the old one in the same transaction it creates
// the new one so the unique index is never violated mid-flight.

const DEFAULT_GOALS: Array<Pick<StudyPlanGoalModel, "subject" | "chapter" | "high_yield_tag" | "hours_needed">> = [
  { subject: "Physics", chapter: "Mechanics & Rotational Dynamics", high_yield_tag: "32 Marks", hours_needed: 12 },
  { subject: "Physics", chapter: "Electrostatics & Current Electricity", high_yield_tag: "36 Marks", hours_needed: 10 },
  { subject: "Chemistry", chapter: "Organic Reactions & Mechanisms", high_yield_tag: "40 Marks", hours_needed: 14 },
  { subject: "Chemistry", chapter: "Inorganic Coordination & p-Block", high_yield_tag: "36 Marks", hours_needed: 8 },
  { subject: "Botany", chapter: "Genetics & Molecular Inheritance", high_yield_tag: "48 Marks", hours_needed: 16 },
  { subject: "Botany", chapter: "Plant Physiology & Photosynthesis", high_yield_tag: "32 Marks", hours_needed: 10 },
  { subject: "Zoology", chapter: "Human Physiology & Neuro-Endocrine", high_yield_tag: "52 Marks", hours_needed: 18 },
  { subject: "Zoology", chapter: "Human Reproduction & ART Tech", high_yield_tag: "36 Marks", hours_needed: 8 },
];

/**
 * NEET's exam_cycle rows are seeded per-year (db/scripts/seed/03_assess_fixture.ts),
 * not guaranteed to have every year a user might pick in the plan
 * configurator — falls back to the latest available cycle for NEET rather
 * than failing the whole plan save over a cosmetic year mismatch.
 */
async function resolveCycleId(examYear: number): Promise<string> {
  const exact = await pool.query<{ cycle_id: string }>(
    `select c.cycle_id from catalog.exam_cycle c join catalog.exam e on e.exam_id = c.exam_id
     where e.exam_code = 'NEET' and c.cycle_year = $1`,
    [examYear]
  );
  if (exact.rowCount && exact.rowCount > 0) return exact.rows[0].cycle_id;

  const latest = await pool.query<{ cycle_id: string }>(
    `select c.cycle_id from catalog.exam_cycle c join catalog.exam e on e.exam_id = c.exam_id
     where e.exam_code = 'NEET' order by c.cycle_year desc limit 1`
  );
  if (latest.rowCount === 0) throw new Error("resolveCycleId: no catalog.exam_cycle exists for NEET — seed one first");
  return latest.rows[0].cycle_id;
}

async function insertGoals(client: { query: typeof pool.query }, planId: string): Promise<void> {
  for (let i = 0; i < DEFAULT_GOALS.length; i++) {
    const g = DEFAULT_GOALS[i];
    await client.query(
      `insert into learn.study_plan_goal (plan_id, subject, chapter, high_yield_tag, hours_needed, sort_order)
       values ($1, $2, $3, $4, $5, $6)`,
      [planId, g.subject, g.chapter, g.high_yield_tag, g.hours_needed, i]
    );
  }
}

export async function findActivePlan(userId: string): Promise<StudyPlanModel | null> {
  const res = await pool.query<StudyPlanModel>(
    `select * from learn.study_plan where user_id = $1 and plan_status = 'active'`,
    [userId]
  );
  return res.rows[0] ?? null;
}

/**
 * "Create once, edit anytime": returns the existing active plan untouched if
 * one exists (the frontend's create action redirects to editing it), only
 * inserting a new plan + its default goal checklist the first time a user
 * ever saves one.
 */
export async function getOrCreateActivePlan(
  userId: string,
  examYear: number,
  config: Record<string, unknown>
): Promise<StudyPlanModel> {
  const existing = await findActivePlan(userId);
  if (existing) return existing;

  const cycleId = await resolveCycleId(examYear);
  const client = await pool.connect();
  try {
    await client.query("begin");
    const res = await client.query<StudyPlanModel>(
      `insert into learn.study_plan (user_id, cycle_id, plan_title, plan_status, config)
       values ($1, $2, $3, 'active', $4) returning *`,
      [userId, cycleId, "AI-Powered 720 Score Master Plan", JSON.stringify(config)]
    );
    const plan = res.rows[0];
    await insertGoals(client, plan.plan_id);
    await client.query("commit");
    return plan;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * @throws {NotFoundError} planId does not belong to an active plan (ownership
 *   is already checked once by requirePlanOwnership before this runs; this
 *   additionally guards against editing an already-archived plan)
 */
export async function updatePlanConfig(planId: string, config: Record<string, unknown>): Promise<StudyPlanModel> {
  const res = await pool.query<StudyPlanModel>(
    `update learn.study_plan set config = $1, updated_at = now() where plan_id = $2 and plan_status = 'active' returning *`,
    [JSON.stringify(config), planId]
  );
  if (res.rowCount === 0) throw new NotFoundError("learn.study_plan", planId);
  return res.rows[0];
}

/**
 * Explicit "Reset plan" — archives the current active plan (not a delete;
 * its goal history stays queryable) and creates a fresh one with the
 * default goal checklist, inside one transaction so the one-active-plan
 * constraint is never violated mid-flight.
 */
export async function resetPlan(userId: string, examYear: number, config: Record<string, unknown>): Promise<StudyPlanModel> {
  const cycleId = await resolveCycleId(examYear);
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `update learn.study_plan set plan_status = 'abandoned', updated_at = now() where user_id = $1 and plan_status = 'active'`,
      [userId]
    );
    const res = await client.query<StudyPlanModel>(
      `insert into learn.study_plan (user_id, cycle_id, plan_title, plan_status, config)
       values ($1, $2, $3, 'active', $4) returning *`,
      [userId, cycleId, "AI-Powered 720 Score Master Plan", JSON.stringify(config)]
    );
    const plan = res.rows[0];
    await insertGoals(client, plan.plan_id);
    await client.query("commit");
    return plan;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

export async function listGoals(planId: string): Promise<StudyPlanGoalModel[]> {
  const res = await pool.query<StudyPlanGoalModel>(
    `select * from learn.study_plan_goal where plan_id = $1 order by sort_order`,
    [planId]
  );
  return res.rows;
}

export async function createGoal(
  planId: string,
  data: Pick<StudyPlanGoalModel, "subject" | "chapter"> & Partial<StudyPlanGoalModel>
): Promise<StudyPlanGoalModel> {
  const maxOrder = await pool.query<{ max: number | null }>(
    `select max(sort_order) as max from learn.study_plan_goal where plan_id = $1`,
    [planId]
  );
  const nextOrder = (maxOrder.rows[0].max ?? -1) + 1;
  const res = await pool.query<StudyPlanGoalModel>(
    `insert into learn.study_plan_goal (plan_id, subject, chapter, high_yield_tag, hours_needed, sort_order)
     values ($1, $2, $3, $4, $5, $6) returning *`,
    [planId, data.subject, data.chapter, data.high_yield_tag ?? null, data.hours_needed ?? null, nextOrder]
  );
  return res.rows[0];
}

/**
 * @throws {NotFoundError} goalId does not belong to planId
 */
export async function updateGoal(
  planId: string,
  goalId: string,
  data: Partial<Pick<StudyPlanGoalModel, "subject" | "chapter" | "high_yield_tag" | "hours_needed" | "is_completed">>
): Promise<StudyPlanGoalModel> {
  const cols = Object.keys(data) as (keyof typeof data)[];
  if (cols.length === 0) {
    const res = await pool.query<StudyPlanGoalModel>(`select * from learn.study_plan_goal where goal_id = $1 and plan_id = $2`, [goalId, planId]);
    if (res.rowCount === 0) throw new NotFoundError("learn.study_plan_goal", goalId);
    return res.rows[0];
  }
  const setClause = cols.map((c, i) => `${c} = $${i + 3}`).join(", ");
  const res = await pool.query<StudyPlanGoalModel>(
    `update learn.study_plan_goal set ${setClause}, updated_at = now() where goal_id = $1 and plan_id = $2 returning *`,
    [goalId, planId, ...cols.map((c) => data[c])]
  );
  if (res.rowCount === 0) throw new NotFoundError("learn.study_plan_goal", goalId);
  return res.rows[0];
}

/**
 * @throws {NotFoundError} goalId does not belong to planId
 */
export async function deleteGoal(planId: string, goalId: string): Promise<void> {
  const res = await pool.query(`delete from learn.study_plan_goal where goal_id = $1 and plan_id = $2`, [goalId, planId]);
  if (res.rowCount === 0) throw new NotFoundError("learn.study_plan_goal", goalId);
}

/**
 * Full reorder: caller supplies the complete, new goal_id ordering for the
 * plan; each row's sort_order is set to its index in that list. Silently
 * ignores any id that isn't actually one of this plan's goals rather than
 * erroring the whole reorder over a stale client-side id.
 */
export async function reorderGoals(planId: string, orderedGoalIds: string[]): Promise<StudyPlanGoalModel[]> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    for (let i = 0; i < orderedGoalIds.length; i++) {
      await client.query(
        `update learn.study_plan_goal set sort_order = $1, updated_at = now() where goal_id = $2 and plan_id = $3`,
        [i, orderedGoalIds[i], planId]
      );
    }
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
  return listGoals(planId);
}
