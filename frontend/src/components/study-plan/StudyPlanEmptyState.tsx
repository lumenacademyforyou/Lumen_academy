import { CalendarRange, ClipboardCheck, ListTree, Sparkles, TrendingUp } from "lucide-react";

const BENEFITS = [
  { icon: ListTree, text: "Organize your syllabus" },
  { icon: CalendarRange, text: "Plan daily study sessions" },
  { icon: ClipboardCheck, text: "Schedule practice" },
  { icon: TrendingUp, text: "Track progress" },
  { icon: Sparkles, text: "Build tests directly from your plan" },
];

interface Props {
  onCreatePlan: () => void;
  onExplorePlanner: () => void;
}

export function StudyPlanEmptyState({ onCreatePlan, onExplorePlanner }: Props) {
  return (
    <div className="card animate-fade-in-up mx-auto max-w-2xl px-6 py-12 text-center sm:px-12">
      <div className="animate-pop-in mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F0F8F8]">
        <CalendarRange size={26} className="text-teal" />
      </div>
      <h1 className="text-2xl font-extrabold text-navy">Build your NEET study plan</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Create a personalized study plan based on your target date, available study time, syllabus progress and
        priorities.
      </p>

      <ul className="stagger-children mx-auto mt-6 grid max-w-md grid-cols-1 gap-2.5 text-left sm:grid-cols-2">
        {BENEFITS.map((b, i) => (
          <li
            key={b.text}
            className="flex items-center gap-2 text-sm text-navy-text"
            style={{ "--stagger-i": i } as React.CSSProperties}
          >
            <b.icon size={16} className="shrink-0 text-teal" />
            {b.text}
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button type="button" onClick={onCreatePlan} className="btn btn-primary w-full sm:w-auto">
          Create Study Plan
        </button>
        <button type="button" onClick={onExplorePlanner} className="btn btn-secondary w-full sm:w-auto">
          Explore Planner
        </button>
      </div>
    </div>
  );
}
