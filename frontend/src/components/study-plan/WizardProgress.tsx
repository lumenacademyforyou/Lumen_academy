const STEP_LABELS = ["Target", "Syllabus Progress", "Priorities", "Availability", "Plan Preferences"];

export function WizardProgress({ step }: { step: number }) {
  return (
    <div className="mb-6">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        Step {step} of {STEP_LABELS.length} · {STEP_LABELS[step - 1]}
      </p>
      <div className="flex gap-1.5">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="h-1.5 flex-1 overflow-hidden rounded-full bg-track">
            <div
              className="progress-fill h-full rounded-full bg-teal"
              style={{ width: i + 1 <= step ? "100%" : "0%" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
