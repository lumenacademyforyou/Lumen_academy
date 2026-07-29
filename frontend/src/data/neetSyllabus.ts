import rawSyllabus from "./syllabus.json";
import type {
  ClassYear,
  NeetSyllabus,
  SubjectId,
  SyllabusChapter,
  SyllabusModule,
  SyllabusTopic,
} from "../types/syllabus";

interface RawUnit {
  number: number;
  label: string;
  name: string;
}
interface RawChapter {
  id: string;
  name: string;
  subjectId: string;
  moduleId: string;
  unit: RawUnit;
  classYear: string;
  streams: string[];
  topicIds: string[];
}
interface RawModule {
  id: string;
  name: string;
  subjectId: string;
  chapterIds: string[];
}
interface RawSubject {
  id: string;
  name: string;
  tagPrefix: string;
  moduleIds: string[];
}
interface RawTopic {
  id: string;
  name: string;
  chapterId: string;
}
interface RawSyllabus {
  subjects: RawSubject[];
  modules: Record<string, RawModule>;
  chapters: Record<string, RawChapter>;
  topics: Record<string, RawTopic>;
}

const raw = rawSyllabus as unknown as RawSyllabus;

const SUBJECT_COLORS: Record<SubjectId, string> = {
  physics: "#086B7E",
  chemistry: "#E9A817",
  biology: "#42AFAF",
};

/**
 * Deterministic seed so the demo always shows a realistic "partway through
 * the syllabus" learner: the first two chapters of every module list are
 * fully studied, the third is in progress, everything after is untouched.
 * Real progress replaces this the moment a student edits it in the app.
 */
function seedStatus(chapterIndex: number, topicIndex: number): SyllabusTopic["status"] {
  if (chapterIndex < 2) return "completed";
  if (chapterIndex === 2) return topicIndex === 0 ? "in-progress" : "not-started";
  return "not-started";
}

function buildSyllabus(): NeetSyllabus {
  return raw.subjects.map((subject) => {
    let chapterIndex = 0;
    const modules: SyllabusModule[] = subject.moduleIds.map((moduleId) => {
      const rawModule = raw.modules[moduleId];
      const chapters: SyllabusChapter[] = rawModule.chapterIds.map((chapterId) => {
        const rawChapter = raw.chapters[chapterId];
        const topics: SyllabusTopic[] = rawChapter.topicIds.map((topicId, topicIndex) => {
          const rawTopic = raw.topics[topicId];
          return { id: rawTopic.id, name: rawTopic.name, status: seedStatus(chapterIndex, topicIndex) };
        });
        const chapter: SyllabusChapter = {
          id: rawChapter.id,
          name: rawChapter.name,
          topics,
          moduleId: rawModule.id,
          moduleName: rawModule.name,
          unitLabel: rawChapter.unit.label,
          unitName: rawChapter.unit.name,
          unitNumber: rawChapter.unit.number,
          classYear: rawChapter.classYear as ClassYear,
          streams: rawChapter.streams,
        };
        chapterIndex += 1;
        return chapter;
      });
      return { id: rawModule.id, name: rawModule.name, chapters };
    });

    return {
      id: subject.id as SubjectId,
      name: subject.name,
      color: SUBJECT_COLORS[subject.id as SubjectId],
      modules,
      chapters: modules.flatMap((m) => m.chapters),
    };
  });
}

export const NEET_SYLLABUS: NeetSyllabus = buildSyllabus();

export function findSubject(subjectId: string) {
  return NEET_SYLLABUS.find((s) => s.id === subjectId);
}

export function findChapter(subjectId: string, chapterId: string) {
  const subject = findSubject(subjectId);
  const chapter = subject?.chapters.find((c) => c.id === chapterId);
  return { subject, chapter };
}

export function findTopic(subjectId: string, chapterId: string, topicId?: string) {
  const { chapter } = findChapter(subjectId, chapterId);
  if (!topicId) return undefined;
  return chapter?.topics.find((t) => t.id === topicId);
}

export interface SyllabusStats {
  totalTopics: number;
  completedTopics: number;
  inProgressTopics: number;
  percent: number;
}

export function subjectStats(subject: NeetSyllabus[number]): SyllabusStats {
  const allTopics = subject.chapters.flatMap((c) => c.topics);
  const completedTopics = allTopics.filter((t) => t.status === "completed").length;
  const inProgressTopics = allTopics.filter((t) => t.status === "in-progress").length;
  return {
    totalTopics: allTopics.length,
    completedTopics,
    inProgressTopics,
    percent: allTopics.length > 0 ? Math.round((completedTopics / allTopics.length) * 100) : 0,
  };
}

export function moduleStats(module: SyllabusModule): SyllabusStats {
  const allTopics = module.chapters.flatMap((c) => c.topics);
  const completedTopics = allTopics.filter((t) => t.status === "completed").length;
  const inProgressTopics = allTopics.filter((t) => t.status === "in-progress").length;
  return {
    totalTopics: allTopics.length,
    completedTopics,
    inProgressTopics,
    percent: allTopics.length > 0 ? Math.round((completedTopics / allTopics.length) * 100) : 0,
  };
}

export function chapterStats(chapter: SyllabusChapter): SyllabusStats {
  const completedTopics = chapter.topics.filter((t) => t.status === "completed").length;
  const inProgressTopics = chapter.topics.filter((t) => t.status === "in-progress").length;
  return {
    totalTopics: chapter.topics.length,
    completedTopics,
    inProgressTopics,
    percent: chapter.topics.length > 0 ? Math.round((completedTopics / chapter.topics.length) * 100) : 0,
  };
}

/**
 * NEET_SYLLABUS is intentionally the SINGLE shared syllabus data source for both
 * Study Plan and Test Builder (see architectural rule). Since this is a frontend-only
 * demo with no backend, "current syllabus progress" is modeled as a mutation of this
 * shared module plus a minimal pub/sub so any component reading it via
 * useSyllabusVersion() re-renders when it changes.
 */
const subscribers = new Set<() => void>();

export function subscribeSyllabus(callback: () => void): () => void {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

function notifySyllabus() {
  subscribers.forEach((cb) => cb());
}

export function setTopicStatus(subjectId: string, chapterId: string, topicId: string, status: SyllabusTopic["status"]) {
  const { chapter } = findChapter(subjectId, chapterId);
  const t = chapter?.topics.find((topic) => topic.id === topicId);
  if (t) {
    t.status = status;
    notifySyllabus();
  }
}

export function setAllTopicsForChapter(subjectId: string, chapterId: string, status: SyllabusTopic["status"]) {
  const { chapter } = findChapter(subjectId, chapterId);
  chapter?.topics.forEach((t) => (t.status = status));
  notifySyllabus();
}

export function setAllTopicsForSubject(subjectId: string, status: SyllabusTopic["status"]) {
  const subject = findSubject(subjectId);
  subject?.chapters.forEach((chapter) => chapter.topics.forEach((t) => (t.status = status)));
  notifySyllabus();
}
