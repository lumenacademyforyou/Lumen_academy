import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useStudyPlan } from "../../hooks/useStudyPlan";
import { useToast } from "../../context/ToastContext";
import { formatLong, formatMonthYear, isDateToday, toISODate, todayISO } from "../../utils/dates";
import { formatMinutes, summarizeDay } from "../../utils/planHelpers";
import { SUBJECT_META } from "../../utils/subjectMeta";
import { StudySessionCard } from "./StudySessionCard";
import { MoveSessionModal } from "./MoveSessionModal";
import { SkipSessionDialog } from "./SkipSessionDialog";
import { EmptySessions } from "./EmptySessions";
import type { MoveOption } from "../../services/studyPlanService";
import type { StudySession } from "../../types/studyPlan";

export function CalendarPlan() {
  const { getSessionsForDate, markSessionComplete, moveSession, skipSession } = useStudyPlan();
  const { showToast } = useToast();

  const [monthAnchor, setMonthAnchor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [moving, setMoving] = useState<StudySession | null>(null);
  const [skipping, setSkipping] = useState<StudySession | null>(null);

  const gridDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthAnchor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(monthAnchor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [monthAnchor]);

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

  const selectedSessions = getSessionsForDate(selectedDate);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-navy">Calendar</h2>
          <p className="text-sm text-muted">A month-at-a-glance view of your workload.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setMonthAnchor((m) => subMonths(m, 1))}
            className="rounded-md border border-border-soft p-1.5 text-muted hover:border-teal hover:text-navy"
          >
            <ChevronLeft size={16} />
          </button>
          <p className="w-32 text-center text-sm font-semibold text-navy-text">{formatMonthYear(monthAnchor)}</p>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setMonthAnchor((m) => addMonths(m, 1))}
            className="rounded-md border border-border-soft p-1.5 text-muted hover:border-teal hover:text-navy"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border-soft bg-ivory text-center text-[11px] font-semibold uppercase text-muted">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {gridDays.map((day) => {
            const iso = toISODate(day);
            const sessions = getSessionsForDate(iso);
            const summary = summarizeDay(sessions);
            const inMonth = isSameMonth(day, monthAnchor);
            const isToday = isDateToday(iso);
            const isSelected = iso === selectedDate;
            const isHighWorkload = summary.plannedMinutes >= 240;
            const isCompletedDay = sessions.length > 0 && summary.completed === sessions.length;
            const subjectsPresent = Array.from(new Set(sessions.map((s) => s.subjectId)));

            return (
              <button
                type="button"
                key={iso}
                onClick={() => setSelectedDate(iso)}
                className={`flex min-h-[76px] flex-col items-start gap-1 border-b border-r border-border-soft p-1.5 text-left transition-colors duration-150 last:border-r-0 hover:bg-ivory/70 sm:min-h-[92px] sm:p-2 ${
                  inMonth ? "bg-white" : "bg-ivory/50"
                } ${isSelected ? "ring-2 ring-inset ring-teal" : ""}`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    isToday ? "bg-gold text-navy" : inMonth ? "text-navy-text" : "text-muted/50"
                  }`}
                >
                  {day.getDate()}
                </span>
                {sessions.length > 0 && (
                  <div className="flex flex-col gap-0.5">
                    <span
                      className={`rounded px-1 py-0.5 text-[10px] font-semibold ${
                        isCompletedDay ? "bg-[#E9F5F0] text-progress-complete" : isHighWorkload ? "bg-[#FDEFE7] text-orange" : "bg-cyan-light/40 text-teal"
                      }`}
                    >
                      {formatMinutes(summary.plannedMinutes)}
                    </span>
                    <span className="flex gap-0.5">
                      {subjectsPresent.map((id) => (
                        <span key={id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: SUBJECT_META[id].color }} />
                      ))}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        <h3 className="mb-3 text-sm font-bold text-navy">{formatLong(selectedDate)}</h3>
        {selectedSessions.length === 0 ? (
          <EmptySessions title="No sessions on this date" message="Pick another date, or edit your plan to add sessions here." />
        ) : (
          <div key={selectedDate} className="stagger-children animate-fade-in space-y-3">
            {selectedSessions.map((session, i) => (
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
      </div>

      {moving && <MoveSessionModal session={moving} onCancel={() => setMoving(null)} onConfirm={handleConfirmMove} />}
      {skipping && (
        <SkipSessionDialog session={skipping} onCancel={() => setSkipping(null)} onConfirm={handleConfirmSkip} />
      )}
    </div>
  );
}
