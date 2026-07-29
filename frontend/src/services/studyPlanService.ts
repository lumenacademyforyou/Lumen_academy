import type { StudyPlan, StudyPreferences, StudySession, WeekdayKey } from "../types/studyPlan";
import { buildDemoPlan } from "../data/mockStudyPlan";
import { addDaysISO, getUpcomingWeekend, todayISO } from "../utils/dates";
import { generateSessions } from "../utils/planHelpers";

const STORAGE_KEY = "lumen.studyPlan.v1";

/**
 * This module is the ONLY place that touches localStorage. Every function here
 * is shaped like the backend REST endpoint it will eventually be replaced by
 * (getStudyPlan -> GET /study-plan, createStudyPlan -> POST /study-plan, etc.)
 * so swapping to real API calls later does not require touching components.
 */

function readRaw(): StudyPlan | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StudyPlan;
  } catch {
    return null;
  }
}

function writeRaw(plan: StudyPlan | null): void {
  try {
    if (plan === null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
    }
  } catch {
    // Storage may be unavailable (private browsing, quota). The context layer
    // surfaces a "Storage Error" state to the user when writes fail.
  }
}

// Simulated network latency so loading states are demonstrable.
const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getStudyPlan(): Promise<StudyPlan | null> {
  await delay(150);
  return readRaw();
}

export async function createStudyPlan(preferences: StudyPreferences): Promise<StudyPlan> {
  await delay(600);
  const sessions = generateSessions(preferences, { daysToGenerate: 21 });
  const plan: StudyPlan = {
    id: `plan-${Date.now()}`,
    createdAt: new Date().toISOString(),
    preferences,
    sessions,
  };
  writeRaw(plan);
  return plan;
}

export async function loadDemoStudyPlan(): Promise<StudyPlan> {
  await delay(400);
  const plan = buildDemoPlan();
  writeRaw(plan);
  return plan;
}

export async function updateStudyPlan(preferences: StudyPreferences, existing: StudyPlan): Promise<StudyPlan> {
  await delay(500);
  const today = todayISO();
  const completedOrPast = existing.sessions.filter((s) => s.status === "completed" || s.date < today);
  const regenerated = generateSessions(preferences, { daysToGenerate: 21 }).filter((s) => s.date >= today);

  const plan: StudyPlan = {
    ...existing,
    preferences,
    sessions: [...completedOrPast, ...regenerated],
  };
  writeRaw(plan);
  return plan;
}

export async function completeStudySession(plan: StudyPlan, sessionId: string): Promise<StudyPlan> {
  await delay(150);
  const updated: StudyPlan = {
    ...plan,
    sessions: plan.sessions.map((s) => (s.id === sessionId ? { ...s, status: "completed" as const } : s)),
  };
  writeRaw(updated);
  return updated;
}

export type MoveOption = "tomorrow" | "weekend" | "custom";

export async function moveStudySession(
  plan: StudyPlan,
  sessionId: string,
  option: MoveOption,
  customDate?: string
): Promise<StudyPlan> {
  await delay(200);
  const session = plan.sessions.find((s) => s.id === sessionId);
  if (!session) return plan;

  let newDate = session.date;
  if (option === "tomorrow") newDate = addDaysISO(session.date, 1);
  else if (option === "weekend") newDate = getUpcomingWeekend(session.date);
  else if (option === "custom" && customDate) newDate = customDate;

  const movedSession: StudySession = { ...session, date: newDate, status: "pending" };

  const updated: StudyPlan = {
    ...plan,
    sessions: plan.sessions.map((s) => (s.id === sessionId ? movedSession : s)),
  };
  writeRaw(updated);
  return updated;
}

export async function skipStudySession(plan: StudyPlan, sessionId: string): Promise<StudyPlan> {
  await delay(150);
  const updated: StudyPlan = {
    ...plan,
    sessions: plan.sessions.map((s) => (s.id === sessionId ? { ...s, status: "skipped" as const } : s)),
  };
  writeRaw(updated);
  return updated;
}

export async function resetStudyPlan(): Promise<void> {
  await delay(150);
  writeRaw(null);
}

export const BUFFER_DAY_LABEL: Record<WeekdayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};
