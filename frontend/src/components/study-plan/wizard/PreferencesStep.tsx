import type { RevisionIntensity, StudyPreferences } from "../../../types/studyPlan";

interface Props {
  preferences: StudyPreferences;
  onChange: (patch: Partial<StudyPreferences>) => void;
}

const QUESTION_COUNTS = [20, 30, 50];
const INTENSITIES: { id: RevisionIntensity; label: string; description: string }[] = [
  { id: "light", label: "Light", description: "Occasional revision sessions" },
  { id: "standard", label: "Standard", description: "Balanced revision cadence" },
  { id: "intensive", label: "Intensive", description: "Frequent, close-spaced revision" },
];

export function PreferencesStep({ preferences, onChange }: Props) {
  const studyPct = preferences.studyPracticeRatio.study;
  const isCustomQuestionCount = !QUESTION_COUNTS.includes(preferences.questionsPerSession);

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1.5 flex items-center justify-between text-sm font-semibold text-navy-text">
          <span>Study vs Practice balance</span>
          <span>
            {studyPct}% Study · {100 - studyPct}% Practice
          </span>
        </div>
        <input
          type="range"
          min={20}
          max={80}
          step={5}
          value={studyPct}
          onChange={(e) => {
            const study = Number(e.target.value);
            onChange({ studyPracticeRatio: { study, practice: 100 - study } });
          }}
          className="w-full accent-teal"
          aria-label="Study vs practice balance"
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-navy-text">Questions per practice session</p>
        <div className="flex flex-wrap items-center gap-2">
          {QUESTION_COUNTS.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => onChange({ questionsPerSession: count })}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 ${
                preferences.questionsPerSession === count
                  ? "border-teal bg-teal text-white"
                  : "border-border-soft bg-white text-navy-text hover:border-teal"
              }`}
            >
              {count}
            </button>
          ))}
          <input
            type="number"
            min={5}
            max={100}
            placeholder="Custom"
            value={isCustomQuestionCount ? preferences.questionsPerSession : ""}
            onChange={(e) => onChange({ questionsPerSession: Number(e.target.value) || 0 })}
            className="w-24 rounded-full border border-border-soft px-3 py-1.5 text-sm text-navy-text placeholder:text-muted/60"
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-navy-text">Revision intensity</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {INTENSITIES.map((intensity) => (
            <button
              key={intensity.id}
              type="button"
              onClick={() => onChange({ revisionIntensity: intensity.id })}
              className={`rounded-lg border px-3 py-2.5 text-left transition-all duration-150 hover:-translate-y-0.5 ${
                preferences.revisionIntensity === intensity.id
                  ? "border-teal bg-[#F0F8F8]"
                  : "border-border-soft bg-white hover:border-teal/60"
              }`}
            >
              <span className="block text-sm font-semibold text-navy-text">{intensity.label}</span>
              <span className="block text-xs text-muted">{intensity.description}</span>
            </button>
          ))}
        </div>
      </div>

      <ToggleRow
        label="Automatic revision scheduling"
        description="Let the planner insert revision sessions on a regular cadence"
        checked={preferences.autoRevisionScheduling}
        onChange={(checked) => onChange({ autoRevisionScheduling: checked })}
      />

      <ToggleRow
        label="Include buffer sessions"
        description="Use your buffer day for light catch-up instead of new topics"
        checked={preferences.includeBufferSessions}
        onChange={(checked) => onChange({ includeBufferSessions: checked })}
      />
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="card flex items-center justify-between gap-4 px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-navy-text">{label}</p>
        <p className="text-xs text-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-teal" : "bg-track"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
