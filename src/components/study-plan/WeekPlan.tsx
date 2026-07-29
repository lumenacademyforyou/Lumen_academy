import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useStudyPlan } from "../../hooks/useStudyPlan";
import { useToast } from "../../context/ToastContext";
import { getWeekDates, isDateToday, formatShort, todayISO } from "../../utils/dates";
import { formatMinutes, summarizeDay } from "../../utils/planHelpers";
import { SUBJECT_META } from "../../utils/subjectMeta";
import { StudySessionCard } from "./StudySessionCard";
import { MoveSessionModal } from "./MoveSessionModal";
import { SkipSessionDialog } from "./SkipSessionDialog";
import { EmptySessions } from "./EmptySessions";
import type { MoveOption } from "../../services/studyPlanService";
import type { StudySession } from "../../types/studyPlan";

export function WeekPlan() {
  const { getSessionsForDate, markSessionComplete, moveSession, skipSession } = useStudyPlan();
  const { showToast } = useToast();
  const weekDates = getWeekDates(todayISO());
  const [expandedDate, setExpandedDate] = useState<string | null>(todayISO());

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

  const hasAnySessions = weekDates.some((d) => getSessionsForDate(d).length > 0);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold text-navy">This Week</h2>
        <p className="text-sm text-muted">Plan for the seven days ahead — click a day to see its full schedule.</p>
      </div>

      {!hasAnySessions ? (
        <EmptySessions title="No sessions this week" message="Create or edit your plan to schedule this week's study sessions." />
      ) : (
        <div className="stagger-children space-y-3">
          {weekDates.map((date, dateIndex) => {
            const sessions = getSessionsForDate(date);
            const summary = summarizeDay(sessions);
            const isToday = isDateToday(date);
            const expanded = expandedDate === date;
            const subjectsPresent = Array.from(new Set(sessions.map((s) => s.subjectId)));

            return (
              <div
                key={date}
                className={`card card-hover overflow-hidden ${isToday ? "ring-1 ring-teal" : ""}`}
                style={{ "--stagger-i": dateIndex } as React.CSSProperties}
              >
                <button
                  type="button"
                  onClick={() => setExpandedDate(expanded ? null : date)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
                  aria-expanded={expanded}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg ${isToday ? "bg-teal text-white" : "bg-ivory text-navy-text"}`}>
                      <span className="text-[10px] font-semibold uppercase leading-none">{formatShort(date).split(" ")[0]}</span>
                      <span className="text-sm font-extrabold leading-tight">{formatShort(date).split(" ")[1]}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-navy-text">
                        {isToday ? "Today" : formatShort(date)}
                        {sessions.length === 0 && <span className="ml-2 font-normal text-muted">No sessions</span>}
                      </p>
                      {sessions.length > 0 && (
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                          <span>{formatMinutes(summary.plannedMinutes)} planned</span>
                          <span>·</span>
                          <span>{sessions.length} session{sessions.length !== 1 ? "s" : ""}</span>
                          <span>·</span>
                          <span>{summary.completed} / {summary.total} completed</span>
                          <span className="flex items-center gap-1">
                            {subjectsPresent.map((id) => (
                              <span
                                key={id}
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: SUBJECT_META[id].color }}
                                title={SUBJECT_META[id].label}
                              />
                            ))}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronDown size={18} className={`shrink-0 text-muted transition-transform ${expanded ? "rotate-180" : ""}`} />
                </button>

                {expanded && sessions.length > 0 && (
                  <div className="animate-fade-in-up space-y-3 border-t border-border-soft bg-ivory/40 p-4">
                    {sessions.map((session) => (
                      <StudySessionCard
                        key={session.id}
                        session={session}
                        onComplete={markSessionComplete}
                        onMove={setMoving}
                        onSkip={setSkipping}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {moving && <MoveSessionModal session={moving} onCancel={() => setMoving(null)} onConfirm={handleConfirmMove} />}
      {skipping && (
        <SkipSessionDialog session={skipping} onCancel={() => setSkipping(null)} onConfirm={handleConfirmSkip} />
      )}
    </div>
  );
}
