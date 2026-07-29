import type { SubjectId, SyllabusChapter } from "../types/syllabus";
import { NEET_SYLLABUS } from "../data/neetSyllabus";
import type {
  ChapterPriorityLevel,
  DayAvailability,
  PlanProgressSummary,
  StudyPlan,
  StudyPreferences,
  StudySession,
  WeekdayKey,
} from "../types/studyPlan";
import { addDaysISO, toISODate } from "./dates";

export const WEEKDAYS: { key: WeekdayKey; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

export const DEFAULT_AVAILABILITY: DayAvailability[] = [
  { day: "mon", label: "Monday", enabled: true, hours: 4 },
  { day: "tue", label: "Tuesday", enabled: true, hours: 4 },
  { day: "wed", label: "Wednesday", enabled: true, hours: 5 },
  { day: "thu", label: "Thursday", enabled: true, hours: 4 },
  { day: "fri", label: "Friday", enabled: true, hours: 4 },
  { day: "sat", label: "Saturday", enabled: true, hours: 7 },
  { day: "sun", label: "Sunday", enabled: true, hours: 7 },
];

export function defaultPreferences(): StudyPreferences {
  return {
    targetExam: "NEET",
    targetDate: addDaysISO(toISODate(new Date()), 300),
    planStartDate: toISODate(new Date()),
    targetScore: "650+",
    availability: DEFAULT_AVAILABILITY.map((d) => ({ ...d })),
    sessionDurationMinutes: 60,
    preferredPeriods: ["flexible"],
    bufferDay: "sun",
    priorityPreset: "balanced",
    subjectPriorities: [
      { subjectId: "physics", percentage: 34 },
      { subjectId: "chemistry", percentage: 33 },
      { subjectId: "biology", percentage: 33 },
    ],
    chapterPriorities: [],
    studyPracticeRatio: { study: 60, practice: 40 },
    questionsPerSession: 30,
    revisionIntensity: "standard",
    autoRevisionScheduling: true,
    includeBufferSessions: true,
  };
}

const JS_DAY_TO_KEY: WeekdayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function weekdayKeyForDate(iso: string): WeekdayKey {
  const jsDay = new Date(`${iso}T00:00:00`).getDay();
  return JS_DAY_TO_KEY[jsDay];
}

function chapterPriorityWeight(level: ChapterPriorityLevel | undefined): number {
  if (level === "high") return 3;
  if (level === "low") return 0.5;
  return 1;
}

/** Chapters that still have work left, ordered by urgency (in-progress first, then not-started, then priority weight). */
function pendingChaptersForSubject(
  subjectId: SubjectId,
  chapterPriorities: StudyPreferences["chapterPriorities"]
): SyllabusChapter[] {
  const subject = NEET_SYLLABUS.find((s) => s.id === subjectId);
  if (!subject) return [];

  const scored = subject.chapters
    .filter((chapter) => chapter.topics.some((t) => t.status !== "completed"))
    .map((chapter) => {
      const hasInProgress = chapter.topics.some((t) => t.status === "in-progress");
      const priority = chapterPriorities.find((cp) => cp.subjectId === subjectId && cp.chapterId === chapter.id);
      const weight = chapterPriorityWeight(priority?.level) + (hasInProgress ? 2 : 0);
      return { chapter, weight };
    });

  scored.sort((a, b) => b.weight - a.weight);
  return scored.map((s) => s.chapter);
}

let sessionCounter = 0;
function nextId(prefix: string) {
  sessionCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${sessionCounter}`;
}

interface GenerateOptions {
  daysToGenerate?: number;
}

/**
 * Deterministic (non-AI) mock scheduling: distributes remaining syllabus chapters
 * across the student's available days, proportional to subject priority allocation,
 * respecting the study/practice split and revision cadence chosen in the wizard.
 */
export function generateSessions(preferences: StudyPreferences, options: GenerateOptions = {}): StudySession[] {
  const daysToGenerate = options.daysToGenerate ?? 14;
  const sessions: StudySession[] = [];

  const subjectOrder: SubjectId[] = ["physics", "chemistry", "biology"];
  const pendingBySubject: Record<SubjectId, SyllabusChapter[]> = {
    physics: pendingChaptersForSubject("physics", preferences.chapterPriorities),
    chemistry: pendingChaptersForSubject("chemistry", preferences.chapterPriorities),
    biology: pendingChaptersForSubject("biology", preferences.chapterPriorities),
  };
  const chapterCursor: Record<SubjectId, number> = { physics: 0, chemistry: 0, biology: 0 };

  // Build a weighted round-robin queue of subjects sized by their priority allocation.
  const weightedSubjectQueue: SubjectId[] = [];
  const slotsPerSubject: Record<SubjectId, number> = { physics: 0, chemistry: 0, biology: 0 };
  subjectOrder.forEach((id) => {
    const pct = preferences.subjectPriorities.find((p) => p.subjectId === id)?.percentage ?? 33;
    slotsPerSubject[id] = Math.max(1, Math.round(pct / 5));
  });
  const maxSlots = Math.max(...Object.values(slotsPerSubject));
  for (let round = 0; round < maxSlots; round++) {
    subjectOrder.forEach((id) => {
      if (round < slotsPerSubject[id]) weightedSubjectQueue.push(id);
    });
  }

  let subjectPointer = 0;
  const nextSubjectWithPendingWork = (): SubjectId | null => {
    for (let attempts = 0; attempts < weightedSubjectQueue.length; attempts++) {
      const candidate = weightedSubjectQueue[subjectPointer % weightedSubjectQueue.length];
      subjectPointer++;
      if (chapterCursor[candidate] < pendingBySubject[candidate].length) return candidate;
    }
    return null;
  };

  let revisionCounter = 0;
  const revisionEveryNDays = preferences.revisionIntensity === "intensive" ? 1 : preferences.revisionIntensity === "standard" ? 3 : 6;
  const recentlyStudied: { subjectId: SubjectId; chapter: SyllabusChapter }[] = [];

  let cursorDate = preferences.planStartDate;
  let generatedDays = 0;
  let safety = 0;

  while (generatedDays < daysToGenerate && safety < daysToGenerate * 3) {
    safety++;
    const dayKey = weekdayKeyForDate(cursorDate);
    const dayConfig = preferences.availability.find((d) => d.day === dayKey);

    if (!dayConfig || !dayConfig.enabled || dayConfig.hours <= 0) {
      cursorDate = addDaysISO(cursorDate, 1);
      generatedDays++;
      continue;
    }

    const isBufferDay = preferences.includeBufferSessions && preferences.bufferDay === dayKey;
    let order = 0;
    let minutesBudget = dayConfig.hours * 60;

    if (isBufferDay) {
      // Buffer days get a single light revision/catch-up session, not a full new-topic load.
      const target = recentlyStudied[recentlyStudied.length - 1];
      if (target) {
        sessions.push({
          id: nextId("sess"),
          date: cursorDate,
          subjectId: target.subjectId,
          chapterId: target.chapter.id,
          chapterName: target.chapter.name,
          activityType: "revision",
          durationMinutes: Math.min(minutesBudget, 45),
          status: "pending",
          order: order++,
        });
      }
      cursorDate = addDaysISO(cursorDate, 1);
      generatedDays++;
      continue;
    }

    const studyMinutesTarget = Math.round((minutesBudget * preferences.studyPracticeRatio.study) / 100);
    let studyMinutesUsed = 0;

    while (studyMinutesUsed < studyMinutesTarget && minutesBudget > 0) {
      const subjectId = nextSubjectWithPendingWork();
      if (!subjectId) break;

      const chapter = pendingBySubject[subjectId][chapterCursor[subjectId]];
      const topic = chapter.topics.find((t) => t.status !== "completed");
      const duration = Math.min(preferences.sessionDurationMinutes, minutesBudget);
      if (duration < 20) break;

      sessions.push({
        id: nextId("sess"),
        date: cursorDate,
        subjectId,
        chapterId: chapter.id,
        chapterName: chapter.name,
        topicId: topic?.id,
        topicName: topic?.name,
        activityType: "study",
        durationMinutes: duration,
        status: "pending",
        order: order++,
      });

      recentlyStudied.push({ subjectId, chapter });
      if (recentlyStudied.length > 6) recentlyStudied.shift();

      studyMinutesUsed += duration;
      minutesBudget -= duration;
      chapterCursor[subjectId] += 1;

      // Immediately follow a study block with a matching practice block when budget allows.
      if (minutesBudget > 0) {
        const practiceMinutes = Math.min(30, minutesBudget);
        sessions.push({
          id: nextId("sess"),
          date: cursorDate,
          subjectId,
          chapterId: chapter.id,
          chapterName: chapter.name,
          topicId: topic?.id,
          topicName: topic?.name,
          activityType: "practice",
          questionCount: preferences.questionsPerSession,
          status: "pending",
          order: order++,
        });
        minutesBudget -= practiceMinutes;
      }
    }

    // Scheduled revision cadence, independent of the study/practice loop above.
    revisionCounter++;
    if (preferences.autoRevisionScheduling && revisionCounter % revisionEveryNDays === 0 && minutesBudget > 0) {
      const target = recentlyStudied[Math.max(0, recentlyStudied.length - 3)];
      if (target) {
        sessions.push({
          id: nextId("sess"),
          date: cursorDate,
          subjectId: target.subjectId,
          chapterId: target.chapter.id,
          chapterName: target.chapter.name,
          activityType: "revision",
          durationMinutes: Math.min(minutesBudget, 45),
          status: "pending",
          order: order++,
        });
      }
    }

    cursorDate = addDaysISO(cursorDate, 1);
    generatedDays++;
  }

  return sessions;
}

export function calculateProgress(plan: StudyPlan): PlanProgressSummary {
  const { sessions } = plan;

  const sessionCounts = {
    completed: sessions.filter((s) => s.status === "completed").length,
    pending: sessions.filter((s) => s.status === "pending").length,
    moved: sessions.filter((s) => s.status === "moved").length,
    skipped: sessions.filter((s) => s.status === "skipped").length,
  };

  const bySubject: PlanProgressSummary["bySubject"] = {
    physics: { percent: 0, completed: 0, total: 0 },
    chemistry: { percent: 0, completed: 0, total: 0 },
    biology: { percent: 0, completed: 0, total: 0 },
  };

  (["physics", "chemistry", "biology"] as SubjectId[]).forEach((subjectId) => {
    const subjectSessions = sessions.filter((s) => s.subjectId === subjectId && s.status !== "skipped");
    const completed = subjectSessions.filter((s) => s.status === "completed").length;
    const total = subjectSessions.length;
    bySubject[subjectId] = {
      completed,
      total,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });

  const totalActionable = sessions.filter((s) => s.status !== "skipped").length;
  const overallPercent = totalActionable > 0 ? Math.round((sessionCounts.completed / totalActionable) * 100) : 0;

  let completedChapters = 0;
  let inProgressChapters = 0;
  let remainingChapters = 0;
  NEET_SYLLABUS.forEach((subject) => {
    subject.chapters.forEach((chapter) => {
      const statuses = chapter.topics.map((t) => t.status);
      if (statuses.every((s) => s === "completed")) completedChapters++;
      else if (statuses.some((s) => s === "in-progress" || s === "completed")) inProgressChapters++;
      else remainingChapters++;
    });
  });

  return {
    overallPercent,
    bySubject,
    sessionCounts,
    syllabus: { completedChapters, inProgressChapters, remainingChapters },
  };
}

export function summarizeDay(sessions: StudySession[]) {
  const plannedMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);
  const plannedQuestions = sessions.reduce((sum, s) => sum + (s.questionCount ?? 0), 0);
  const completed = sessions.filter((s) => s.status === "completed").length;
  const remaining = sessions.filter((s) => s.status === "pending").length;
  return { plannedMinutes, plannedQuestions, completed, remaining, total: sessions.length };
}

export function formatMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0m";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
