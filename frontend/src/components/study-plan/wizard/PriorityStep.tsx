import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ChapterPriorityLevel, PriorityPreset, StudyPreferences, SubjectPriority } from "../../../types/studyPlan";
import type { SubjectId } from "../../../types/syllabus";
import { NEET_SYLLABUS } from "../../../data/neetSyllabus";
import { SUBJECT_META } from "../../../utils/subjectMeta";

interface Props {
  preferences: StudyPreferences;
  onChange: (patch: Partial<StudyPreferences>) => void;
}

const PRESETS: { id: PriorityPreset; label: string; allocation?: SubjectPriority[] }[] = [
  {
    id: "balanced",
    label: "Balanced",
    allocation: [
      { subjectId: "physics", percentage: 33 },
      { subjectId: "chemistry", percentage: 33 },
      { subjectId: "biology", percentage: 34 },
    ],
  },
  {
    id: "physics-focus",
    label: "Physics Focus",
    allocation: [
      { subjectId: "physics", percentage: 50 },
      { subjectId: "chemistry", percentage: 25 },
      { subjectId: "biology", percentage: 25 },
    ],
  },
  {
    id: "chemistry-focus",
    label: "Chemistry Focus",
    allocation: [
      { subjectId: "physics", percentage: 25 },
      { subjectId: "chemistry", percentage: 50 },
      { subjectId: "biology", percentage: 25 },
    ],
  },
  {
    id: "biology-focus",
    label: "Biology Focus",
    allocation: [
      { subjectId: "physics", percentage: 25 },
      { subjectId: "chemistry", percentage: 25 },
      { subjectId: "biology", percentage: 50 },
    ],
  },
  { id: "custom", label: "Custom" },
];

const PRIORITY_LEVELS: ChapterPriorityLevel[] = ["low", "normal", "high"];

export function PriorityStep({ preferences, onChange }: Props) {
  const [expandedSubject, setExpandedSubject] = useState<SubjectId | null>(null);

  const total = preferences.subjectPriorities.reduce((sum, p) => sum + p.percentage, 0);
  const isValidTotal = total === 100;

  const applyPreset = (preset: PriorityPreset) => {
    const found = PRESETS.find((p) => p.id === preset);
    if (found?.allocation) {
      onChange({ priorityPreset: preset, subjectPriorities: found.allocation });
    } else {
      onChange({ priorityPreset: preset });
    }
  };

  const updateCustomPercentage = (subjectId: SubjectId, value: number) => {
    onChange({
      priorityPreset: "custom",
      subjectPriorities: preferences.subjectPriorities.map((p) =>
        p.subjectId === subjectId ? { ...p, percentage: value } : p
      ),
    });
  };

  const setChapterPriority = (subjectId: SubjectId, chapterId: string, level: ChapterPriorityLevel) => {
    const others = preferences.chapterPriorities.filter(
      (cp) => !(cp.subjectId === subjectId && cp.chapterId === chapterId)
    );
    // "normal" is the default — no need to store it explicitly.
    const next = level === "normal" ? others : [...others, { subjectId, chapterId, level }];
    onChange({ chapterPriorities: next });
  };

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-navy-text">What do you want to prioritize?</p>
      <div className="mb-5 flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => applyPreset(preset.id)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 ${
              preferences.priorityPreset === preset.id
                ? "border-teal bg-teal text-white"
                : "border-border-soft bg-white text-navy-text hover:border-teal"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="card space-y-4 p-4">
        {preferences.subjectPriorities.map((p) => {
          const meta = SUBJECT_META[p.subjectId];
          return (
            <div key={p.subjectId}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-semibold" style={{ color: meta.color }}>
                  {meta.label}
                </span>
                <span className="font-bold text-navy-text">{p.percentage}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={p.percentage}
                onChange={(e) => updateCustomPercentage(p.subjectId, Number(e.target.value))}
                className="w-full accent-teal"
                aria-label={`${meta.label} allocation percentage`}
              />
            </div>
          );
        })}
        <p className={`text-sm font-semibold ${isValidTotal ? "text-progress-complete" : "text-orange"}`}>
          Total: {total}% {isValidTotal ? "✓" : "— must equal 100%"}
        </p>
      </div>

      <p className="mb-3 mt-6 text-sm font-semibold text-navy-text">
        Chapter priority <span className="font-normal text-muted">(optional)</span>
      </p>
      <div className="space-y-2">
        {NEET_SYLLABUS.map((subject) => {
          const meta = SUBJECT_META[subject.id];
          const expanded = expandedSubject === subject.id;
          return (
            <div key={subject.id} className="card overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedSubject(expanded ? null : subject.id)}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-bold"
                style={{ color: meta.color }}
                aria-expanded={expanded}
              >
                {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                {meta.label}
              </button>
              {expanded && (
                <div className="max-h-72 space-y-3 overflow-y-auto border-t border-border-soft bg-ivory/40 px-4 py-3">
                  {subject.modules.map((module) => (
                    <div key={module.id}>
                      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">{module.name}</p>
                      <div className="space-y-1.5">
                        {module.chapters.map((chapter) => {
                          const current =
                            preferences.chapterPriorities.find(
                              (cp) => cp.subjectId === subject.id && cp.chapterId === chapter.id
                            )?.level ?? "normal";
                          return (
                            <div key={chapter.id} className="flex items-center justify-between gap-3">
                              <span className="text-sm text-navy-text">{chapter.name}</span>
                              <div className="flex shrink-0 gap-1">
                                {PRIORITY_LEVELS.map((level) => (
                                  <button
                                    key={level}
                                    type="button"
                                    onClick={() => setChapterPriority(subject.id, chapter.id, level)}
                                    className={`rounded px-2 py-0.5 text-xs font-semibold capitalize transition-colors ${
                                      current === level
                                        ? level === "high"
                                          ? "bg-gold text-navy"
                                          : "bg-teal text-white"
                                        : "bg-white text-muted border border-border-soft"
                                    }`}
                                  >
                                    {level}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
