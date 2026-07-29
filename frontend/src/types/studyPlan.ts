import type { SubjectId } from "./syllabus";

export type ActivityType = "study" | "practice" | "revision";
export type SessionStatus = "pending" | "completed" | "moved" | "skipped";
export type ChapterPriorityLevel = "high" | "normal" | "low";
export type StudyPeriod = "morning" | "afternoon" | "evening" | "night" | "flexible";
export type RevisionIntensity = "light" | "standard" | "intensive";
export type PriorityPreset = "balanced" | "physics-focus" | "chemistry-focus" | "biology-focus" | "custom";
export type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface SubjectPriority {
  subjectId: SubjectId;
  percentage: number;
}

export interface ChapterPriority {
  subjectId: SubjectId;
  chapterId: string;
  level: ChapterPriorityLevel;
}

export interface DayAvailability {
  day: WeekdayKey;
  label: string;
  enabled: boolean;
  hours: number;
}

export interface StudyPreferences {
  targetExam: string;
  targetDate: string; // ISO date
  planStartDate: string; // ISO date
  targetScore?: string;
  availability: DayAvailability[];
  sessionDurationMinutes: number;
  preferredPeriods: StudyPeriod[];
  bufferDay?: WeekdayKey;
  priorityPreset: PriorityPreset;
  subjectPriorities: SubjectPriority[];
  chapterPriorities: ChapterPriority[];
  studyPracticeRatio: { study: number; practice: number };
  questionsPerSession: number;
  revisionIntensity: RevisionIntensity;
  autoRevisionScheduling: boolean;
  includeBufferSessions: boolean;
}

export interface StudySession {
  id: string;
  date: string; // ISO date (yyyy-MM-dd)
  subjectId: SubjectId;
  chapterId: string;
  chapterName: string;
  topicId?: string;
  topicName?: string;
  activityType: ActivityType;
  durationMinutes?: number;
  questionCount?: number;
  status: SessionStatus;
  order: number;
}

export interface StudyPlan {
  id: string;
  createdAt: string;
  preferences: StudyPreferences;
  sessions: StudySession[];
}

export interface PlanProgressSummary {
  overallPercent: number;
  bySubject: Record<SubjectId, { percent: number; completed: number; total: number }>;
  sessionCounts: { completed: number; pending: number; moved: number; skipped: number };
  syllabus: { completedChapters: number; inProgressChapters: number; remainingChapters: number };
}
