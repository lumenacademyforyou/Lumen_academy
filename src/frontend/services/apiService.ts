import { Question, TestAttempt } from "../../types";

export interface AIStudyPlanResponse {
  title: string;
  focusSummary: string;
  weeklyRoadmap: {
    weekNumber: number;
    mainFocus: string;
    keyChapters: string[];
    targetMockScore: number;
  }[];
  aiTips: string[];
}

export interface AIEvaluationResponse {
  executiveSummary: string;
  keyRecommendations: string[];
  projectedAIR: string;
}

export interface AdminStatsResponse {
  overview: {
    totalRegisteredStudents: number;
    activeTestTakersToday: number;
    totalMocksCompleted: number;
    averagePlatformScore: number;
    serverStatus: string;
    dbLatencyMs: number;
  };
  recentStudents: {
    id: string;
    name: string;
    target: string;
    avgScore: number;
    status: string;
  }[];
}

export async function fetchQuestionsFromBackend(subject?: string): Promise<Question[]> {
  try {
    const url = subject ? `/api/questions?subject=${subject}` : `/api/questions`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch questions");
    const data = await res.json();
    return data.questions || [];
  } catch (err) {
    console.warn("Backend API fetch failed, fallback to client state", err);
    return [];
  }
}

export async function fetchAnalyticsFromBackend(): Promise<any> {
  try {
    const res = await fetch("/api/analytics");
    if (!res.ok) throw new Error("Failed to fetch analytics");
    return await res.json();
  } catch (err) {
    console.warn("Backend API fetch failed, fallback to client state", err);
    return null;
  }
}

export async function submitAttemptToBackend(payload: {
  attemptId: string;
  userAnswers: Record<number, number>;
  durationSeconds: number;
}): Promise<any> {
  try {
    const res = await fetch("/api/submit-attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to submit attempt");
    return await res.json();
  } catch (err) {
    console.warn("Backend API submit failed, fallback to client evaluation", err);
    return null;
  }
}

export async function generateAIStudyPlanBackend(studentName: string, weakSubjects: string[]): Promise<AIStudyPlanResponse | null> {
  try {
    const res = await fetch("/api/ai/study-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentName, targetExam: "NEET", weakSubjects }),
    });
    if (!res.ok) throw new Error("Failed to generate AI study plan");
    const data = await res.json();
    return data.plan;
  } catch (err) {
    console.warn("Backend AI study plan generation error", err);
    return null;
  }
}

export async function evaluateAttemptAIBackend(score: number, totalScore: number, subjectBreakdown: any, incorrectTopics: string[]): Promise<AIEvaluationResponse | null> {
  try {
    const res = await fetch("/api/ai/evaluate-attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score, totalScore, subjectBreakdown, incorrectTopics }),
    });
    if (!res.ok) throw new Error("Failed AI attempt evaluation");
    const data = await res.json();
    return data.evaluation;
  } catch (err) {
    console.warn("Backend AI evaluation error", err);
    return null;
  }
}

export async function fetchAdminStatsBackend(): Promise<AdminStatsResponse | null> {
  try {
    const res = await fetch("/api/admin/stats");
    if (!res.ok) throw new Error("Failed to fetch admin stats");
    return await res.json();
  } catch (err) {
    console.warn("Backend admin stats fetch error", err);
    return null;
  }
}
