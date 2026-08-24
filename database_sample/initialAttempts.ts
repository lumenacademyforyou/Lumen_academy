import { TestAttempt } from "../types";

// Every entry here is an available, not-yet-attempted test template
// (date: "Available", totalScore: 0) — the fixed catalog TestListView.tsx
// currently offers, not a real result. A previously fabricated "already
// completed" mock_04 entry with fake scores/percentile/AI analysis used to
// sit first in this array; that was demo data misrepresenting a brand-new
// user's history (drove the false "Predicted AIR #142" stat and a
// "you haven't attempted a test" reminder that could fire even though the
// user had, per this fake row, supposedly already taken one) and has been
// removed. A user's actual completed attempts are appended to this list at
// runtime by App.tsx once they really take a test.
export const INITIAL_ATTEMPTS: TestAttempt[] = [
  {
    id: "mock_05",
    title: "NEET Full Syllabus Mock 05 (720 Marks)",
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
      Biology: { score: 0, growth: 0, status: "Average" }
    },
    aiRecommendation: {
      topics: ["Complete Syllabus"],
      potentialGain: 85,
      focusAreas: [
        { topic: "Time Management", level: "Critical" },
        { topic: "Physics Problem Solving Speed", level: "Improvement" }
      ]
    },
    laggingTopics: []
  },
  {
    id: "mock_08",
    title: "NEET Chemistry Mini-Mock #08",
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
      Biology: { score: 0, growth: 0, status: "Average" }
    },
    aiRecommendation: {
      topics: ["p-Block Elements", "Periodic Trends"],
      potentialGain: 15,
      focusAreas: [
        { topic: "p-Block Exceptions", level: "Critical" }
      ]
    },
    laggingTopics: []
  },
  {
    id: "mock_12",
    title: "NEET Biology Mini-Mock #12",
    date: "Available",
    totalScore: 0,
    accuracy: 0,
    percentile: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    skippedAnswers: 0,
    timeTakenMinutes: 0,
    subjectBreakdown: {
      Physics: { score: 0, growth: 0, status: "Average" },
      Chemistry: { score: 0, growth: 0, status: "Average" },
      Biology: { score: 0, growth: 0, status: "Average" }
    },
    aiRecommendation: {
      topics: ["Genetics", "Evolution", "Ecology"],
      potentialGain: 20,
      focusAreas: [
        { topic: "Genetic Translation", level: "Critical" },
        { topic: "DNA Replication Fork", level: "Improvement" },
        { topic: "Hardy-Weinberg Principle", level: "Critical" }
      ]
    },
    laggingTopics: [
      {
        topic: "Hardy-Weinberg Heterozygote Frequency (2pq)",
        unit: "Genetics & Evolution",
        subject: "Biology",
        accuracy: 40,
        negativeMarksLost: 4,
        conceptGap: "Confused p² (homozygous dominant) with 2pq (heterozygous carrier frequency).",
        improvementSteps: [
          "Remember the binomial expansion equation: p² + 2pq + q² = 1.",
          "Practice calculating carrier frequencies when recessive phenotype frequency q² is given."
        ],
        ncertReference: {
          book: "NCERT Class 12 Biology",
          chapter: "Chapter 7: Evolution",
          pages: "Pages 136 - 137 (Hardy-Weinberg Equilibrium)",
          keyLines: "Frequency of allele p and q in a population remains constant; 2pq represents frequency of heterozygous individuals."
        }
      }
    ]
  }
];
