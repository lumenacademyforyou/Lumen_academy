import { useNavigate } from "react-router-dom";
import { CheckCircle2, Clock, ListChecks, MoveRight, XCircle } from "lucide-react";
import type { StudySession } from "../../types/studyPlan";
import type { TestConfig } from "../../types/test";
import { ACTIVITY_LABEL, SUBJECT_META } from "../../utils/subjectMeta";
import { formatMinutes } from "../../utils/planHelpers";
import { useToast } from "../../context/ToastContext";

interface Props {
  session: StudySession;
  onComplete: (id: string) => void;
  onMove: (session: StudySession) => void;
  onSkip: (session: StudySession) => void;
  showDate?: boolean;
}

export function StudySessionCard({ session, onComplete, onMove, onSkip, showDate }: Props) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const meta = SUBJECT_META[session.subjectId];
  const Icon = meta.icon;

  const isCompleted = session.status === "completed";
  const isSkipped = session.status === "skipped";
  const isMoved = session.status === "moved";
  const isDone = isCompleted || isSkipped || isMoved;

  const handleBuildTest = () => {
    const config: TestConfig = {
      source: "study-plan",
      subjectId: session.subjectId,
      subjectName: meta.label,
      chapterId: session.chapterId,
      chapterName: session.chapterName,
      topicId: session.topicId,
      topicName: session.topicName,
      questionCount: session.questionCount ?? 30,
    };
    navigate("/build-test", { state: config });
  };

  const handleComplete = () => {
    onComplete(session.id);
    showToast("Session marked complete");
  };

  return (
    <div
      className={`card card-hover flex flex-col gap-3 border-l-4 p-4 transition-opacity ${isDone ? "opacity-60" : ""}`}
      style={{ borderLeftColor: meta.color }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: meta.color }}>
            <Icon size={13} />
            {meta.label}
            {showDate && <span className="font-normal normal-case text-muted">· {session.date}</span>}
          </div>
          <p className="text-sm font-semibold text-navy-text">{session.chapterName}</p>
          {session.topicName && <p className="text-sm text-muted">{session.topicName}</p>}
          <div className="mt-1.5 flex items-center gap-3 text-xs font-medium text-muted">
            <span className="rounded bg-ivory px-1.5 py-0.5 text-[11px] font-semibold text-navy-text">
              {ACTIVITY_LABEL[session.activityType]}
            </span>
            {session.durationMinutes !== undefined && (
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {formatMinutes(session.durationMinutes)}
              </span>
            )}
            {session.questionCount !== undefined && (
              <span className="flex items-center gap-1">
                <ListChecks size={12} />
                {session.questionCount} Questions
              </span>
            )}
          </div>
        </div>

        <StatusPill session={session} />
      </div>

      {!isDone && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-soft pt-3">
          <div className="flex gap-2">
            {session.activityType !== "practice" && (
              <button type="button" onClick={handleComplete} className="btn btn-secondary !py-1.5 !px-2.5 text-xs">
                <CheckCircle2 size={14} /> Complete
              </button>
            )}
            <button type="button" onClick={() => onMove(session)} className="btn btn-ghost !py-1.5 !px-2.5 text-xs">
              <MoveRight size={14} /> Move
            </button>
            <button type="button" onClick={() => onSkip(session)} className="btn btn-ghost !py-1.5 !px-2.5 text-xs">
              <XCircle size={14} /> Skip
            </button>
          </div>

          {session.activityType === "practice" && (
            <button type="button" onClick={handleBuildTest} className="btn btn-gold !py-1.5 !px-3 text-xs">
              Build Practice Test
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function StatusPill({ session }: { session: StudySession }) {
  if (session.status === "completed") {
    return (
      <span className="animate-pop-in flex shrink-0 items-center gap-1 rounded-full bg-[#E9F5F0] px-2.5 py-1 text-xs font-semibold text-progress-complete">
        <CheckCircle2 size={13} /> Completed
      </span>
    );
  }
  if (session.status === "skipped") {
    return (
      <span className="shrink-0 rounded-full bg-[#FDEFE7] px-2.5 py-1 text-xs font-semibold text-orange">Skipped</span>
    );
  }
  if (session.status === "moved") {
    return (
      <span className="shrink-0 rounded-full bg-[#EFF3F4] px-2.5 py-1 text-xs font-semibold text-muted">Moved</span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-[#FFF4DA] px-2.5 py-1 text-xs font-semibold text-[#9a7208]">Pending</span>
  );
}
