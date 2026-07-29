import type { SubjectId } from "./syllabus";

export interface TestConfig {
  source: "study-plan" | "manual";
  subjectId?: SubjectId;
  subjectName?: string;
  chapterId?: string;
  chapterName?: string;
  topicId?: string;
  topicName?: string;
  questionCount: number;
  difficulty?: "easy" | "medium" | "hard" | "mixed";
}
