import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  NEET_SYLLABUS,
  chapterStats,
  moduleStats,
  setAllTopicsForSubject,
  setTopicStatus,
  subjectStats,
} from "../../data/neetSyllabus";
import { useSyllabusVersion } from "../../hooks/useSyllabus";
import type { SubjectId, TopicStatus } from "../../types/syllabus";
import { SUBJECT_META } from "../../utils/subjectMeta";

const STATUS_CYCLE: TopicStatus[] = ["not-started", "in-progress", "completed"];

function StatusIcon({ status }: { status: TopicStatus }) {
  if (status === "completed") {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-progress-complete text-[10px] font-bold text-white">
        ✓
      </span>
    );
  }
  if (status === "in-progress") {
    return <span className="h-4 w-4 shrink-0 rounded-full border-2 border-gold bg-[#FFF4DA]" />;
  }
  return <span className="h-4 w-4 shrink-0 rounded-full border-2 border-border-soft" />;
}

interface Props {
  subjectId: SubjectId;
  query?: string;
}

export function SubjectSyllabusTree({ subjectId, query = "" }: Props) {
  useSyllabusVersion();
  const subject = NEET_SYLLABUS.find((s) => s.id === subjectId);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  const normalizedQuery = query.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;

  const filteredModules = useMemo(() => {
    if (!subject) return [];
    if (!normalizedQuery) return subject.modules;
    return subject.modules
      .map((module) => ({
        ...module,
        chapters: module.chapters.filter(
          (chapter) =>
            chapter.name.toLowerCase().includes(normalizedQuery) ||
            chapter.topics.some((t) => t.name.toLowerCase().includes(normalizedQuery))
        ),
      }))
      .filter((module) => module.chapters.length > 0);
  }, [subject, normalizedQuery]);

  if (!subject) return null;
  const meta = SUBJECT_META[subjectId];
  const stats = subjectStats(subject);

  const toggleModule = (id: string) =>
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleChapter = (id: string) =>
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const cycleTopic = (chapterId: string, topicId: string, current: TopicStatus) => {
    const idx = STATUS_CYCLE.indexOf(current);
    setTopicStatus(subjectId, chapterId, topicId, STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]);
  };

  return (
    <div className="animate-fade-in-up">
      <div className="card mb-4 p-5">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: meta.color }}>
              {meta.label} Syllabus
            </p>
            <p className="text-2xl font-extrabold text-navy">{stats.percent}% complete</p>
          </div>
          <div className="text-right text-xs text-muted">
            <p>
              {stats.completedTopics} / {stats.totalTopics} topics
            </p>
            {stats.inProgressTopics > 0 && <p>{stats.inProgressTopics} in progress</p>}
          </div>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-track">
          <div
            className="progress-fill h-full rounded-full"
            style={{ width: `${stats.percent}%`, backgroundColor: meta.color }}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setAllTopicsForSubject(subjectId, "completed")}
            className="btn btn-secondary !px-2.5 !py-1 text-xs"
          >
            Mark all complete
          </button>
          <button
            type="button"
            onClick={() => setAllTopicsForSubject(subjectId, "not-started")}
            className="btn btn-ghost !px-2.5 !py-1 text-xs"
          >
            Clear all
          </button>
        </div>
      </div>

      {filteredModules.length === 0 ? (
        <div className="card px-6 py-10 text-center text-sm text-muted">
          No chapters or topics match &ldquo;{query}&rdquo;.
        </div>
      ) : (
        <div className="stagger-children space-y-2.5">
          {filteredModules.map((module, moduleIndex) => {
            const mStats = moduleStats(module);
            const expanded = isSearching || expandedModules.has(module.id);
            return (
              <div
                key={module.id}
                className="card card-hover overflow-hidden"
                style={{ "--stagger-i": moduleIndex } as React.CSSProperties}
              >
                <button
                  type="button"
                  onClick={() => toggleModule(module.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  aria-expanded={expanded}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {expanded ? (
                      <ChevronDown size={16} className="shrink-0 text-muted transition-transform" />
                    ) : (
                      <ChevronRight size={16} className="shrink-0 text-muted transition-transform" />
                    )}
                    <span className="truncate text-sm font-bold text-navy-text">{module.name}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="hidden text-xs font-medium text-muted sm:inline">
                      {mStats.completedTopics}/{mStats.totalTopics} topics
                    </span>
                    <span className="h-1.5 w-14 overflow-hidden rounded-full bg-track">
                      <span
                        className="progress-fill block h-full rounded-full"
                        style={{ width: `${mStats.percent}%`, backgroundColor: meta.color }}
                      />
                    </span>
                  </div>
                </button>

                {expanded && (
                  <div className="animate-fade-in space-y-1.5 border-t border-border-soft bg-ivory/40 p-2.5">
                    {module.chapters.map((chapter) => {
                      const cStats = chapterStats(chapter);
                      const chapterExpanded = isSearching || expandedChapters.has(chapter.id);
                      const isDone = cStats.percent === 100;
                      return (
                        <div key={chapter.id} className="overflow-hidden rounded-lg bg-white ring-1 ring-border-soft/70">
                          <button
                            type="button"
                            onClick={() => toggleChapter(chapter.id)}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                            aria-expanded={chapterExpanded}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              {chapterExpanded ? (
                                <ChevronDown size={14} className="shrink-0 text-muted" />
                              ) : (
                                <ChevronRight size={14} className="shrink-0 text-muted" />
                              )}
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-navy-text">{chapter.name}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                  <span className="rounded bg-ivory px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                                    {chapter.unitLabel}
                                  </span>
                                  <span className="rounded bg-ivory px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                                    Class {chapter.classYear}
                                  </span>
                                  {chapter.streams.map((stream) => (
                                    <span
                                      key={stream}
                                      className="rounded bg-cyan-light/40 px-1.5 py-0.5 text-[10px] font-semibold text-teal"
                                    >
                                      {stream}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <span
                              className={`shrink-0 text-xs font-semibold ${isDone ? "text-progress-complete" : "text-muted"}`}
                            >
                              {cStats.completedTopics}/{cStats.totalTopics}
                            </span>
                          </button>
                          {chapterExpanded && (
                            <ul className="animate-fade-in space-y-0.5 px-3 pb-2.5">
                              {chapter.topics.map((topic) => (
                                <li key={topic.id}>
                                  <button
                                    type="button"
                                    onClick={() => cycleTopic(chapter.id, topic.id, topic.status)}
                                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-navy-text transition-colors hover:bg-ivory"
                                  >
                                    <StatusIcon status={topic.status} />
                                    <span className={topic.status === "completed" ? "text-muted line-through" : ""}>
                                      {topic.name}
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
