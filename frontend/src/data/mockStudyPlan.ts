import type { StudyPlan, StudyPreferences, StudySession } from "../types/studyPlan";
import { addDaysISO, toISODate } from "../utils/dates";
import { DEFAULT_AVAILABILITY, generateSessions } from "../utils/planHelpers";

const today = toISODate(new Date());

export const DEMO_PREFERENCES: StudyPreferences = {
  targetExam: "NEET",
  targetDate: addDaysISO(today, 280),
  planStartDate: today,
  targetScore: "650+",
  availability: DEFAULT_AVAILABILITY.map((d) => ({ ...d })),
  sessionDurationMinutes: 60,
  preferredPeriods: ["morning", "evening"],
  bufferDay: "sun",
  priorityPreset: "custom",
  subjectPriorities: [
    { subjectId: "physics", percentage: 40 },
    { subjectId: "chemistry", percentage: 30 },
    { subjectId: "biology", percentage: 30 },
  ],
  chapterPriorities: [
    { subjectId: "physics", chapterId: "PHY-XII-UII-01", level: "high" },
    { subjectId: "physics", chapterId: "PHY-XI-UI-01", level: "low" },
  ],
  studyPracticeRatio: { study: 60, practice: 40 },
  questionsPerSession: 40,
  revisionIntensity: "standard",
  autoRevisionScheduling: true,
  includeBufferSessions: true,
};

// Hand-authored to exactly match the product spec's "Mock Today Plan" so the
// empty state's "Explore Planner" path always shows a realistic mix of
// completed and pending sessions on first look.
const demoTodaySessions: StudySession[] = [
  {
    id: "demo-today-1",
    date: today,
    subjectId: "physics",
    chapterId: "PHY-XII-UII-01",
    chapterName: "Current Electricity",
    topicId: "PHY-XII-UII-01::t1",
    topicName: "Ohm's law and resistivity",
    activityType: "study",
    durationMinutes: 60,
    status: "completed",
    order: 0,
  },
  {
    id: "demo-today-2",
    date: today,
    subjectId: "physics",
    chapterId: "PHY-XII-UII-01",
    chapterName: "Current Electricity",
    topicId: "PHY-XII-UII-01::t2",
    topicName: "combination of resistors",
    activityType: "practice",
    questionCount: 30,
    status: "pending",
    order: 1,
  },
  {
    id: "demo-today-3",
    date: today,
    subjectId: "biology",
    chapterId: "BIO-XII-UI-02",
    chapterName: "Human Reproduction",
    topicId: "BIO-XII-UI-02::t0",
    topicName: "male and female reproductive systems",
    activityType: "study",
    durationMinutes: 60,
    status: "completed",
    order: 2,
  },
  {
    id: "demo-today-4",
    date: today,
    subjectId: "biology",
    chapterId: "BIO-XII-UI-02",
    chapterName: "Human Reproduction",
    activityType: "practice",
    questionCount: 50,
    status: "pending",
    order: 3,
  },
  {
    id: "demo-today-5",
    date: today,
    subjectId: "chemistry",
    chapterId: "CHE-XI-U4-01",
    chapterName: "Chemical Bonding and Molecular Structure",
    activityType: "revision",
    durationMinutes: 45,
    status: "pending",
    order: 4,
  },
];

export function buildDemoPlan(): StudyPlan {
  // Generate a realistic surrounding week/fortnight so Week, Calendar and
  // Progress views have content beyond just today, then splice in the
  // curated "today" sessions above so their exact completed/pending mix
  // is preserved.
  const generated = generateSessions(DEMO_PREFERENCES, { daysToGenerate: 14 }).filter((s) => s.date !== today);

  return {
    id: "demo-plan",
    createdAt: new Date().toISOString(),
    preferences: DEMO_PREFERENCES,
    sessions: [...demoTodaySessions, ...generated],
  };
}
