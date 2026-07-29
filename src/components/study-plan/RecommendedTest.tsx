import { Sparkles } from "lucide-react";
import type { TestConfig } from "../../types/test";
import { SUBJECT_META } from "../../utils/subjectMeta";

interface Props {
  config: TestConfig;
  onBuild: () => void;
}

export function RecommendedTest({ config, onBuild }: Props) {
  const meta = config.subjectId ? SUBJECT_META[config.subjectId] : undefined;

  return (
    <div
      className="card card-hover animate-fade-in-up overflow-hidden border-l-4 p-5"
      style={{ borderLeftColor: meta?.color ?? "var(--color-gold)" }}
    >
      <div className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gold">
        <Sparkles size={14} className="animate-pop-in" />
        Recommended from your Study Plan
      </div>
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: meta?.color }}>
        {config.subjectName}
      </p>
      <p className="mt-0.5 text-base font-bold text-navy-text">{config.chapterName}</p>
      {config.topicName && <p className="text-sm text-muted">{config.topicName}</p>}
      <p className="mt-2 text-sm font-medium text-muted">{config.questionCount} Questions</p>
      <button type="button" onClick={onBuild} className="btn btn-gold mt-4 w-full sm:w-auto">
        Build Recommended Test
      </button>
    </div>
  );
}
