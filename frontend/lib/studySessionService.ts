export interface StudySession {
  id?: string;
  userId: string;
  studentName: string;
  subject: string;
  taskTitle: string;
  durationMinutes: number;
  sessionType: "focus" | "shortBreak" | "longBreak";
  completedAt: string; // ISO string
  notes?: string;
  rating?: number; // 1-5 focus score
}

const LOCAL_STORAGE_SESSIONS_KEY = "lumen_study_sessions";

function getLocalSessions(): StudySession[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalSession(session: StudySession): void {
  try {
    const sessions = getLocalSessions();
    const existingIdx = sessions.findIndex(s => s.id === session.id);
    if (existingIdx >= 0) {
      sessions[existingIdx] = session;
    } else {
      sessions.unshift(session);
    }
    localStorage.setItem(LOCAL_STORAGE_SESSIONS_KEY, JSON.stringify(sessions));
  } catch (err) {
    console.error("Failed to save session to local storage:", err);
  }
}

export async function saveStudySession(
  sessionData: Omit<StudySession, "id" | "completedAt"> & { completedAt?: string }
): Promise<StudySession> {
  const id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const completedAt = sessionData.completedAt || new Date().toISOString();

  const newSession: StudySession = {
    ...sessionData,
    id,
    completedAt
  };

  saveLocalSession(newSession);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("lumen_session_saved"));
  }

  return newSession;
}

export async function fetchStudySessions(userId: string): Promise<StudySession[]> {
  return getLocalSessions().filter(s => s.userId === userId);
}

export async function deleteStudySession(sessionId: string): Promise<void> {
  try {
    const sessions = getLocalSessions();
    const updated = sessions.filter(s => s.id !== sessionId);
    localStorage.setItem(LOCAL_STORAGE_SESSIONS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Error deleting local session:", err);
  }
}

export function calculateStudyStreak(sessions: StudySession[]): number {
  const focusSessions = sessions.filter(s => s.sessionType === "focus");
  if (focusSessions.length === 0) return 0;

  // Get unique local dates (YYYY-MM-DD) sorted descending
  const dates = Array.from(new Set(
    focusSessions.map(s => {
      const d = new Date(s.completedAt);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })
  )).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

  if (dates.length === 0) return 0;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  // If the last session wasn't today or yesterday, streak is broken
  if (dates[0] !== todayStr && dates[0] !== yesterdayStr) {
    return 0;
  }

  let streak = 1;
  let currentDate = new Date(dates[0]);

  for (let i = 1; i < dates.length; i++) {
    const prevDate = new Date(currentDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;

    if (dates[i] === prevDateStr) {
      streak++;
      currentDate = prevDate;
    } else {
      break;
    }
  }

  return streak;
}

export function calculateSessionStats(sessions: StudySession[]) {
  const todayStr = new Date().toISOString().split("T")[0];

  const todaySessions = sessions.filter(s => s.completedAt.startsWith(todayStr));
  const focusSessions = sessions.filter(s => s.sessionType === "focus");

  const totalFocusMinutes = focusSessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  const todayFocusMinutes = todaySessions
    .filter(s => s.sessionType === "focus")
    .reduce((acc, s) => acc + (s.durationMinutes || 0), 0);

  // Subject breakdown
  const subjectMap: Record<string, number> = {};
  focusSessions.forEach(s => {
    subjectMap[s.subject] = (subjectMap[s.subject] || 0) + s.durationMinutes;
  });

  let topSubject = "Physics";
  let maxMin = 0;
  Object.entries(subjectMap).forEach(([sub, mins]) => {
    if (mins > maxMin) {
      maxMin = mins;
      topSubject = sub;
    }
  });

  return {
    totalSessionsCount: focusSessions.length,
    totalFocusMinutes,
    todayFocusMinutes,
    todaySessionsCount: todaySessions.filter(s => s.sessionType === "focus").length,
    topSubject,
    subjectBreakdown: subjectMap
  };
}
