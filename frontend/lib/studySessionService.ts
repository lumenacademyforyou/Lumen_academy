import { db, auth } from "../firebase";
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from "firebase/firestore";

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

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
    },
    operationType,
    path
  };
  console.warn("Firestore Operation Warning:", JSON.stringify(errInfo));
}

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
    // avoid duplicates by ID
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

  // 1. Save to Local Storage immediately for local responsiveness
  saveLocalSession(newSession);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("lumen_session_saved"));
  }

  // 2. Attempt Firestore DB logging if Firebase is initialized and user is valid
  if (db && newSession.userId && newSession.userId !== "demo_user") {
    const firestorePath = "study_sessions";
    try {
      const docRef = await addDoc(collection(db, firestorePath), {
        ...newSession,
        createdAt: serverTimestamp()
      });
      newSession.id = docRef.id;
      // Re-save with Firestore generated doc ID
      saveLocalSession(newSession);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, firestorePath);
    }
  }

  return newSession;
}

export async function fetchStudySessions(userId?: string): Promise<StudySession[]> {
  const localList = getLocalSessions();
  
  if (!db || !userId || userId === "demo_user") {
    return localList;
  }

  const firestorePath = "study_sessions";
  try {
    const q = query(collection(db, firestorePath), where("userId", "==", userId), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const firestoreSessions: StudySession[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as any;
      firestoreSessions.push({
        id: docSnap.id,
        userId: data.userId || "demo_user",
        studentName: data.studentName || "Student",
        subject: data.subject || "General",
        taskTitle: data.taskTitle || "Study Session",
        durationMinutes: Number(data.durationMinutes) || 25,
        sessionType: data.sessionType || "focus",
        completedAt: data.completedAt || new Date().toISOString(),
        notes: data.notes || "",
        rating: data.rating || 5
      });
    });

    if (firestoreSessions.length > 0) {
      // Merge Firestore sessions with local list, deduplicating
      const combined = [...firestoreSessions];
      localList.forEach(ls => {
        if (!combined.some(fs => fs.id === ls.id)) {
          combined.push(ls);
        }
      });
      // Sort newest first
      combined.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
      localStorage.setItem(LOCAL_STORAGE_SESSIONS_KEY, JSON.stringify(combined));
      return combined;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, firestorePath);
  }

  return localList;
}

export async function deleteStudySession(sessionId: string): Promise<void> {
  // Delete from Local Storage
  try {
    const sessions = getLocalSessions();
    const updated = sessions.filter(s => s.id !== sessionId);
    localStorage.setItem(LOCAL_STORAGE_SESSIONS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Error deleting local session:", err);
  }

  // Delete from Firestore if db is ready and it's a real firestore ID
  if (db && sessionId && !sessionId.startsWith("session_")) {
    const firestorePath = `study_sessions/${sessionId}`;
    try {
      await deleteDoc(doc(db, "study_sessions", sessionId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, firestorePath);
    }
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
