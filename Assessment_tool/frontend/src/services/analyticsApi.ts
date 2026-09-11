import { apiFetch } from "./api";
import type { DashboardAnalytics } from "../types";

// LA-APP-COMPLETION-001 Phase G — one call, real SQL-aggregated analytics
// scoped to the signed-in user (backend/src/controllers/analyticsController.ts's
// getDashboard, backed by db/assess/analytics/dashboard.ts). Replaces the old
// dead GET /api/analytics stub, which had no auth and no real data source.
export async function getDashboardAnalytics(): Promise<DashboardAnalytics> {
  const res = await apiFetch<{ data: DashboardAnalytics }>("/analytics/dashboard");
  return res.data;
}
