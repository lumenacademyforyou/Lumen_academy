import type { StudyPreferences } from "../../../types/studyPlan";

interface Props {
  preferences: StudyPreferences;
  onChange: (patch: Partial<StudyPreferences>) => void;
}

export function TargetStep({ preferences, onChange }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-navy-text" htmlFor="targetExam">
          Target Exam
        </label>
        <input
          id="targetExam"
          type="text"
          value={preferences.targetExam}
          onChange={(e) => onChange({ targetExam: e.target.value })}
          className="w-full rounded-md border border-border-soft px-3 py-2.5 text-sm text-navy-text"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-navy-text" htmlFor="planStartDate">
            Plan Start Date
          </label>
          <input
            id="planStartDate"
            type="date"
            value={preferences.planStartDate}
            onChange={(e) => onChange({ planStartDate: e.target.value })}
            className="w-full rounded-md border border-border-soft px-3 py-2.5 text-sm text-navy-text"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-navy-text" htmlFor="targetDate">
            Target Date <span className="text-orange">*</span>
          </label>
          <input
            id="targetDate"
            type="date"
            required
            value={preferences.targetDate}
            min={preferences.planStartDate}
            onChange={(e) => onChange({ targetDate: e.target.value })}
            className="w-full rounded-md border border-border-soft px-3 py-2.5 text-sm text-navy-text"
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-navy-text" htmlFor="targetScore">
          Target Score <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="targetScore"
          type="text"
          placeholder="e.g. 650+"
          value={preferences.targetScore ?? ""}
          onChange={(e) => onChange({ targetScore: e.target.value })}
          className="w-full rounded-md border border-border-soft px-3 py-2.5 text-sm text-navy-text placeholder:text-muted/60"
        />
      </div>
    </div>
  );
}
