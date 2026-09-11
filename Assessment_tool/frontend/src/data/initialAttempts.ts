import { TestAttempt } from "../types";

// A brand-new user's dashboard needs a non-null TestAttempt to render before
// they've completed a real one — this is that placeholder, not a real
// result (date: "Available", every score 0). DashboardView's own
// `hasRealAttempt` check hides all score/AI-recommendation UI while this is
// the active attempt. Real completed attempts are prepended to this list at
// runtime by App.tsx (see buildHonestAttemptFromScorecard) once a user
// actually finishes a test.
export const INITIAL_ATTEMPTS: TestAttempt[] = [
  {
    id: "placeholder",
    title: "No tests taken yet",
    date: "Available",
    totalScore: 0,
    accuracy: 0,
    percentile: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    skippedAnswers: 0,
    timeTakenMinutes: 0,
    averageTimePerQuestionSeconds: 0,
    questionTimeData: [],
    subjectBreakdown: {
      Physics: { score: 0, growth: 0, status: "Average" },
      Chemistry: { score: 0, growth: 0, status: "Average" },
      Biology: { score: 0, growth: 0, status: "Average" },
    },
    aiRecommendation: {
      topics: [],
      potentialGain: 0,
      focusAreas: [],
    },
    laggingTopics: [],
  },
];
