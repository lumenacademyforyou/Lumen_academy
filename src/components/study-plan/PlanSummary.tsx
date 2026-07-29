import { formatMinutes } from "../../utils/planHelpers";

interface Props {
  plannedMinutes: number;
  completed: number;
  total: number;
  plannedQuestions: number;
  remaining: number;
}

export function PlanSummary({ plannedMinutes, completed, total, plannedQuestions, remaining }: Props) {
  const stats = [
    { label: "Planned", value: formatMinutes(plannedMinutes) },
    { label: "Completed", value: `${completed} / ${total || 0}` },
    { label: "Questions", value: `${plannedQuestions}` },
    { label: "Remaining", value: `${remaining}` },
  ];

  return (
    <div className="stagger-children grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className="card card-hover px-4 py-3"
          style={{ "--stagger-i": i } as React.CSSProperties}
        >
          <p className="text-xl font-extrabold text-navy">{stat.value}</p>
          <p className="text-xs font-medium text-muted">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
