import { useEffect, useState } from "react";
import { getDashboardAnalytics } from "../services/analyticsApi";
import type { DashboardAnalytics } from "../types";

export interface DashboardAnalyticsState {
  analytics: DashboardAnalytics | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * LA-APP-COMPLETION-001 Phase G — shared fetch for GET /analytics/dashboard.
 * Used independently by DashboardView and AnalyticsView (each mounts its own
 * copy) rather than threaded through App.tsx state — the payload is cheap to
 * recompute server-side and both views already fetch their own data
 * independently elsewhere in this codebase (see catalogApi/sessionApi
 * callers). `refetch` lets a caller re-pull after a test is completed, since
 * a freshly-scored attempt changes every number this returns.
 */
export function useDashboardAnalytics(): DashboardAnalyticsState {
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchToken, setRefetchToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDashboardAnalytics()
      .then((data) => {
        if (!cancelled) setAnalytics(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load analytics.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refetchToken]);

  return { analytics, loading, error, refetch: () => setRefetchToken((n) => n + 1) };
}
