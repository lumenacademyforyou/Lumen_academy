export type SubjectId = "physics" | "chemistry" | "biology";

export type TopicStatus = "not-started" | "in-progress" | "completed";

export type ClassYear = "XI" | "XII";

export interface SyllabusTopic {
  id: string;
  name: string;
  status: TopicStatus;
}

export interface SyllabusChapter {
  id: string;
  name: string;
  topics: SyllabusTopic[];
  /** Module + unit metadata sourced from the syllabus tagging sheet. */
  moduleId: string;
  moduleName: string;
  unitLabel: string;
  unitName: string;
  unitNumber: number;
  classYear: ClassYear;
  /** Biology-only: which stream(s) this chapter belongs to (Botany/Zoology). Empty for Physics/Chemistry. */
  streams: string[];
}

export interface SyllabusModule {
  id: string;
  name: string;
  chapters: SyllabusChapter[];
}

export interface SyllabusSubject {
  id: SubjectId;
  name: string;
  color: string;
  modules: SyllabusModule[];
  /** Flattened view of every chapter across all modules, in syllabus order. */
  chapters: SyllabusChapter[];
}

export type NeetSyllabus = SyllabusSubject[];
