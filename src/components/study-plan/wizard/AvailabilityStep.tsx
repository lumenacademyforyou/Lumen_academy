import type { StudyPeriod, StudyPreferences, WeekdayKey } from "../../../types/studyPlan";
import { WEEKDAYS } from "../../../utils/planHelpers";

interface Props {
  preferences: StudyPreferences;
  onChange: (patch: Partial<StudyPreferences>) => void;
}

const DURATIONS = [30, 45, 60, 90];
const PERIODS: { id: StudyPeriod; label: string }[] = [
  { id: "morning", label: "Morning" },
  { id: "afternoon", label: "Afternoon" },
  { id: "evening", label: "Evening" },
  { id: "night", label: "Night" },
  { id: "flexible", label: "Flexible" },
];

export function AvailabilityStep({ preferences, onChange }: Props) {
  const updateDay = (day: WeekdayKey, patch: Partial<{ enabled: boolean; hours: number }>) => {
    onChange({
      availability: preferences.availability.map((d) => (d.day === day ? { ...d, ...patch } : d)),
    });
  };

  const togglePeriod = (period: StudyPeriod) => {
    const has = preferences.preferredPeriods.includes(period);
    const next = has
      ? preferences.preferredPeriods.filter((p) => p !== period)
      : [...preferences.preferredPeriods, period];
    onChange({ preferredPeriods: next.length > 0 ? next : [period] });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm font-semibold text-navy-text">Weekly availability</p>
        <div className="card divide-y divide-border-soft">
          {preferences.availability.map((day) => (
            <div key={day.day} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <label className="flex items-center gap-2.5 text-sm font-medium text-navy-text">
                <input
                  type="checkbox"
                  checked={day.enabled}
                  onChange={(e) => updateDay(day.day, { enabled: e.target.checked })}
                  className="h-4 w-4 rounded accent-teal"
                />
                {day.label}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={0.5}
                  value={day.hours}
                  disabled={!day.enabled}
                  onChange={(e) => updateDay(day.day, { hours: Number(e.target.value) })}
                  className="w-28 accent-teal disabled:opacity-40"
                  aria-label={`${day.label} hours`}
                />
                <span className="w-9 text-right text-sm font-semibold text-navy-text">{day.enabled ? `${day.hours}h` : "—"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-navy-text">Preferred session duration</p>
        <div className="flex flex-wrap gap-2">
          {DURATIONS.map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => onChange({ sessionDurationMinutes: mins })}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 ${
                preferences.sessionDurationMinutes === mins
                  ? "border-teal bg-teal text-white"
                  : "border-border-soft bg-white text-navy-text hover:border-teal"
              }`}
            >
              {mins} min
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-navy-text">Preferred study period</p>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((period) => (
            <button
              key={period.id}
              type="button"
              onClick={() => togglePeriod(period.id)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 ${
                preferences.preferredPeriods.includes(period.id)
                  ? "border-teal bg-teal text-white"
                  : "border-border-soft bg-white text-navy-text hover:border-teal"
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-navy-text">
          Buffer / backlog day <span className="font-normal text-muted">(optional)</span>
        </p>
        <select
          value={preferences.bufferDay ?? ""}
          onChange={(e) => onChange({ bufferDay: (e.target.value || undefined) as WeekdayKey | undefined })}
          className="w-full rounded-md border border-border-soft px-3 py-2.5 text-sm text-navy-text sm:w-56"
        >
          <option value="">No buffer day</option>
          {WEEKDAYS.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
