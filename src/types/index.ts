export interface ChapterGoal {
  id: string;
  subject: "Physics" | "Chemistry" | "Biology" | "Botany" | "Zoology";
  chapter: string;
  highYieldTag: string;
  hoursNeeded: number;
  completed: boolean;
}

export interface Question {
  id: number;
  text: string;
  textTa?: string;
  options: string[];
  optionsTa?: string[];
  correctAnswerIndex: number;
  subject: "Physics" | "Chemistry" | "Biology" | "Botany" | "Zoology";
  unit?: string;
  ncertReference?: string;
  explanation?: string;
}

export interface LaggingTopic {
  topic: string;
  unit: string;
  subject: "Physics" | "Chemistry" | "Biology" | "Botany" | "Zoology";
  accuracy: number;
  negativeMarksLost: number;
  conceptGap: string;
  improvementSteps: string[];
  ncertReference: {
    book: string;
    chapter: string;
    pages: string;
    keyLines: string;
  };
}

export interface TestAttempt {
  id: string;
  title: string;
  date: string;
  totalScore: number; // percentage
  accuracy: number; // percentage
  percentile: number;
  correctAnswers: number;
  incorrectAnswers: number;
  skippedAnswers: number;
  timeTakenMinutes: number;
  subjectBreakdown: {
    Physics: { score: number; growth: number; status: "Strong" | "Average" | "Expert" };
    Chemistry: { score: number; growth: number; status: "Strong" | "Average" | "Expert" };
    Biology: { score: number; growth: number; status: "Strong" | "Average" | "Expert" };
  };
  aiRecommendation: {
    topics: string[];
    potentialGain: number;
    focusAreas: { topic: string; level: "Critical" | "Improvement" | "Done" }[];
  };
  laggingTopics?: LaggingTopic[];
  questionTimeData?: { questionId: number; subject: "Physics" | "Chemistry" | "Biology" | "Botany" | "Zoology"; timeSpentSeconds: number }[];
  averageTimePerQuestionSeconds?: number;
}
