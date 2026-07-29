import { useState } from "react";
import { SubjectSyllabusTree } from "../SubjectSyllabusTree";
import { SUBJECT_META } from "../../../utils/subjectMeta";
import type { SubjectId } from "../../../types/syllabus";

const SUBJECTS: SubjectId[] = ["physics", "chemistry", "biology"];

export function SyllabusProgressStep() {
  const [activeSubject, setActiveSubject] = useState<SubjectId>("physics");

  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        Mark what you've already covered. This helps your plan focus on what's left.
      </p>

      <div className="mb-4 flex gap-2">
        {SUBJECTS.map((id) => {
          const meta = SUBJECT_META[id];
          const active = activeSubject === id;
          const Icon = meta.icon;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveSubject(id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition-all duration-200 ${
                active ? "border-transparent text-white" : "border-border-soft bg-white text-navy-text hover:border-teal/50"
              }`}
              style={active ? { backgroundColor: meta.color } : undefined}
            >
              <Icon size={14} />
              {meta.label}
            </button>
          );
        })}
      </div>

      <div className="max-h-[420px] overflow-y-auto pr-1">
        <SubjectSyllabusTree key={activeSubject} subjectId={activeSubject} />
      </div>
    </div>
  );
}
