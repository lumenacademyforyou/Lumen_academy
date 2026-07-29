import { Settings2 } from "lucide-react";
import { PlanSummary } from "./PlanSummary";
import { summarizeDay } from "../../utils/planHelpers";
import type { StudySession } from "../../types/studyPlan";

interface Props {
  todaySessions: StudySession[];
  onEditPlan: () => void;
}

export function StudyPlanHero({ todaySessions, onEditPlan }: Props) {
  const summary = summarizeDay(todaySessions);

  return (
    <div className="mb-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-navy">Your Study Plan</h1>
          <p className="text-sm text-muted">Stay focused on today's priorities.</p>
        </div>
        <button type="button" onClick={onEditPlan} className="btn btn-secondary">
          <Settings2 size={15} /> Edit Plan
        </button>
      </div>

      <PlanSummary
        plannedMinutes={summary.plannedMinutes}
        completed={summary.completed}
        total={summary.total}
        plannedQuestions={summary.plannedQuestions}
        remaining={summary.remaining}
      />
    </div>
  );
}
