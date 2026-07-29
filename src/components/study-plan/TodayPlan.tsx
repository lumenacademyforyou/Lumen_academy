import { useState } from "react";
import type { MoveOption } from "../../services/studyPlanService";
import type { StudySession } from "../../types/studyPlan";
import { StudySessionCard } from "./StudySessionCard";
import { MoveSessionModal } from "./MoveSessionModal";
import { SkipSessionDialog } from "./SkipSessionDialog";
import { EmptySessions } from "./EmptySessions";
import { useStudyPlan } from "../../hooks/useStudyPlan";
import { useToast } from "../../context/ToastContext";
import { formatLong, todayISO } from "../../utils/dates";

export function TodayPlan() {
  const { getTodaySessions, markSessionComplete, moveSession, skipSession } = useStudyPlan();
  const { showToast } = useToast();
  const sessions = getTodaySessions();

  const [moving, setMoving] = useState<StudySession | null>(null);
  const [skipping, setSkipping] = useState<StudySession | null>(null);

  const handleConfirmMove = async (option: MoveOption, customDate?: string) => {
    if (!moving) return;
    await moveSession(moving.id, option, customDate);
    setMoving(null);
    showToast("Session moved");
  };

  const handleConfirmSkip = async () => {
    if (!skipping) return;
    await skipSession(skipping.id);
    setSkipping(null);
    showToast("Session skipped");
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold text-navy">Today's Study Plan</h2>
        <p className="text-sm text-muted">{formatLong(todayISO())}</p>
      </div>

      {sessions.length === 0 ? (
        <EmptySessions
          title="No sessions scheduled today"
          message="Enjoy the break, or check your Week view to get ahead on tomorrow's plan."
        />
      ) : (
        <div className="stagger-children space-y-3">
          {sessions.map((session, i) => (
            <div key={session.id} style={{ "--stagger-i": i } as React.CSSProperties}>
              <StudySessionCard
                session={session}
                onComplete={markSessionComplete}
                onMove={setMoving}
                onSkip={setSkipping}
              />
            </div>
          ))}
        </div>
      )}

      {moving && <MoveSessionModal session={moving} onCancel={() => setMoving(null)} onConfirm={handleConfirmMove} />}
      {skipping && (
        <SkipSessionDialog session={skipping} onCancel={() => setSkipping(null)} onConfirm={handleConfirmSkip} />
      )}
    </div>
  );
}
