import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { PlanProgressSummary, StudyPlan, StudyPreferences, StudySession } from "../types/studyPlan";
import type { TestConfig } from "../types/test";
import * as studyPlanService from "../services/studyPlanService";
import type { MoveOption } from "../services/studyPlanService";
import { calculateProgress } from "../utils/planHelpers";
import { todayISO } from "../utils/dates";

export interface StudyPlanContextValue {
  plan: StudyPlan | null;
  hasPlan: boolean;
  loading: boolean;
  error: string | null;
  progress: PlanProgressSummary | null;

  createPlan: (preferences: StudyPreferences) => Promise<void>;
  loadDemoPlan: () => Promise<void>;
  updatePlan: (preferences: StudyPreferences) => Promise<void>;
  markSessionComplete: (sessionId: string) => Promise<void>;
  moveSession: (sessionId: string, option: MoveOption, customDate?: string) => Promise<void>;
  skipSession: (sessionId: string) => Promise<void>;
  resetPlan: () => Promise<void>;

  getTodaySessions: () => StudySession[];
  getSessionsForDate: (dateISO: string) => StudySession[];
  getRecommendedTest: () => TestConfig | null;
}

export const StudyPlanContext = createContext<StudyPlanContextValue | undefined>(undefined);

export function StudyPlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    studyPlanService
      .getStudyPlan()
      .then((loaded) => {
        if (!cancelled) setPlan(loaded);
      })
      .catch(() => {
        if (!cancelled) setError("We couldn't load your study plan. Please try refreshing the page.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const runAction = useCallback(async (action: () => Promise<StudyPlan | void>) => {
    setError(null);
    try {
      const result = await action();
      if (result) setPlan(result);
    } catch {
      setError("Something went wrong saving your changes. Please try again.");
    }
  }, []);

  const createPlan = useCallback(
    (preferences: StudyPreferences) => runAction(() => studyPlanService.createStudyPlan(preferences)),
    [runAction]
  );

  const loadDemoPlan = useCallback(() => runAction(() => studyPlanService.loadDemoStudyPlan()), [runAction]);

  const updatePlan = useCallback(
    (preferences: StudyPreferences) => {
      if (!plan) return Promise.resolve();
      return runAction(() => studyPlanService.updateStudyPlan(preferences, plan));
    },
    [plan, runAction]
  );

  const markSessionComplete = useCallback(
    (sessionId: string) => {
      if (!plan) return Promise.resolve();
      return runAction(() => studyPlanService.completeStudySession(plan, sessionId));
    },
    [plan, runAction]
  );

  const moveSession = useCallback(
    (sessionId: string, option: MoveOption, customDate?: string) => {
      if (!plan) return Promise.resolve();
      return runAction(() => studyPlanService.moveStudySession(plan, sessionId, option, customDate));
    },
    [plan, runAction]
  );

  const skipSession = useCallback(
    (sessionId: string) => {
      if (!plan) return Promise.resolve();
      return runAction(() => studyPlanService.skipStudySession(plan, sessionId));
    },
    [plan, runAction]
  );

  const resetPlan = useCallback(async () => {
    setError(null);
    try {
      await studyPlanService.resetStudyPlan();
      setPlan(null);
    } catch {
      setError("Something went wrong resetting your plan.");
    }
  }, []);

  const getTodaySessions = useCallback((): StudySession[] => {
    if (!plan) return [];
    const today = todayISO();
    return plan.sessions.filter((s) => s.date === today).sort((a, b) => a.order - b.order);
  }, [plan]);

  const getSessionsForDate = useCallback(
    (dateISO: string): StudySession[] => {
      if (!plan) return [];
      return plan.sessions.filter((s) => s.date === dateISO).sort((a, b) => a.order - b.order);
    },
    [plan]
  );

  const getRecommendedTest = useCallback((): TestConfig | null => {
    const today = getTodaySessions();
    const practiceSession = today.find((s) => s.activityType === "practice" && s.status === "pending");
    if (!practiceSession) return null;
    return {
      source: "study-plan",
      subjectId: practiceSession.subjectId,
      subjectName: capitalize(practiceSession.subjectId),
      chapterId: practiceSession.chapterId,
      chapterName: practiceSession.chapterName,
      topicId: practiceSession.topicId,
      topicName: practiceSession.topicName,
      questionCount: practiceSession.questionCount ?? 30,
    };
  }, [getTodaySessions]);

  const progress = useMemo(() => (plan ? calculateProgress(plan) : null), [plan]);

  const value: StudyPlanContextValue = {
    plan,
    hasPlan: plan !== null,
    loading,
    error,
    progress,
    createPlan,
    loadDemoPlan,
    updatePlan,
    markSessionComplete,
    moveSession,
    skipSession,
    resetPlan,
    getTodaySessions,
    getSessionsForDate,
    getRecommendedTest,
  };

  return <StudyPlanContext.Provider value={value}>{children}</StudyPlanContext.Provider>;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
