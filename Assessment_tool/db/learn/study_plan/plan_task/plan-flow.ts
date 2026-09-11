import { pool } from "../../../shared/pool.js";
import { NotFoundError } from "../../../shared/errors.js";
import type { PlanTaskModel } from "./plan_task.model.js";

// Ownership of planId is verified ONCE per request by
// backend/middleware/ownership.ts's requirePlanOwnership before either of
// these run.

export async function listPlanTasks(planId: string): Promise<PlanTaskModel[]> {
  const res = await pool.query<PlanTaskModel>(
    "select * from learn.plan_task where plan_id = $1 order by scheduled_date nulls last",
    [planId]
  );
  return res.rows;
}

export async function updatePlanTaskStatus(planId: string, taskId: string, taskStatus: string): Promise<PlanTaskModel> {
  // planId in the WHERE clause is the data-integrity check that this task
  // actually belongs to the plan whose ownership was already verified —
  // not a second ownership lookup, just scoping the update correctly.
  const res = await pool.query<PlanTaskModel>(
    "update learn.plan_task set task_status = $1 where task_id = $2 and plan_id = $3 returning *",
    [taskStatus, taskId, planId]
  );
  if (res.rowCount === 0) throw new NotFoundError("learn.plan_task", taskId);
  return res.rows[0];
}
