import type { SubjectId } from "../../types/syllabus";
import { SUBJECT_META } from "../../utils/subjectMeta";

interface Props {
  subjectId: SubjectId;
  percent: number;
  completed: number;
  total: number;
}

export function SubjectProgress({ subjectId, percent, completed, total }: Props) {
  const meta = SUBJECT_META[subjectId];
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="font-semibold text-navy-text">{meta.label}</span>
        <span className="text-xs text-muted">
          {completed} / {total} sessions
        </span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-track"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${meta.label} progress`}
      >
        <div className="progress-fill h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: meta.color }} />
      </div>
      <p className="mt-1 text-xs font-medium text-muted">{percent}% complete</p>
    </div>
  );
}
