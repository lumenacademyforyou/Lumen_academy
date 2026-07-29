import { useStudyPlan } from "../../hooks/useStudyPlan";
import { SubjectProgress } from "./SubjectProgress";

export function PlanProgress() {
  const { progress } = useStudyPlan();
  if (!progress) return null;

  const { overallPercent, bySubject, sessionCounts, syllabus } = progress;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-navy">Overall Plan Progress</h2>
        <p className="mb-3 text-sm text-muted">How much of your scheduled plan you've completed so far.</p>
        <div className="card card-hover p-5">
          <div className="mb-2 flex items-end justify-between">
            <span className="text-3xl font-extrabold text-navy">{overallPercent}%</span>
            <span className="text-xs text-muted">
              {sessionCounts.completed} of {sessionCounts.completed + sessionCounts.pending + sessionCounts.moved} sessions
            </span>
          </div>
          <div
            className="h-3 w-full overflow-hidden rounded-full bg-track"
            role="progressbar"
            aria-valuenow={overallPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="progress-fill h-full rounded-full bg-teal" style={{ width: `${overallPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="card space-y-5 p-5">
        <h3 className="text-sm font-bold text-navy">Progress by Subject</h3>
        <SubjectProgress subjectId="physics" {...bySubject.physics} />
        <SubjectProgress subjectId="chemistry" {...bySubject.chemistry} />
        <SubjectProgress subjectId="biology" {...bySubject.biology} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card card-hover p-5">
          <h3 className="mb-3 text-sm font-bold text-navy">Study Sessions</h3>
          <dl className="space-y-2 text-sm">
            <Row label="Completed" value={sessionCounts.completed} color="var(--color-progress-complete)" />
            <Row label="Pending" value={sessionCounts.pending} color="var(--color-gold)" />
            <Row label="Moved" value={sessionCounts.moved} color="var(--color-muted)" />
            <Row label="Skipped" value={sessionCounts.skipped} color="var(--color-orange)" />
          </dl>
        </div>

        <div className="card card-hover p-5">
          <h3 className="mb-3 text-sm font-bold text-navy">Syllabus Coverage</h3>
          <dl className="space-y-2 text-sm">
            <Row label="Completed Chapters" value={syllabus.completedChapters} color="var(--color-progress-complete)" />
            <Row label="In Progress Chapters" value={syllabus.inProgressChapters} color="var(--color-teal)" />
            <Row label="Remaining Chapters" value={syllabus.remainingChapters} color="var(--color-muted)" />
          </dl>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </span>
      <span className="font-semibold text-navy-text">{value}</span>
    </div>
  );
}
