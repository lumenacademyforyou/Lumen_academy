import { useState } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import type { StudyPreferences } from "../../types/studyPlan";
import { defaultPreferences } from "../../utils/planHelpers";
import { WizardProgress } from "./WizardProgress";
import { TargetStep } from "./wizard/TargetStep";
import { SyllabusProgressStep } from "./wizard/SyllabusProgressStep";
import { PriorityStep } from "./wizard/PriorityStep";
import { AvailabilityStep } from "./wizard/AvailabilityStep";
import { PreferencesStep } from "./wizard/PreferencesStep";

interface Props {
  onCancel: () => void;
  onGenerate: (preferences: StudyPreferences) => Promise<void>;
}

const TOTAL_STEPS = 5;

export function StudyPlanWizard({ onCancel, onGenerate }: Props) {
  const [step, setStep] = useState(1);
  const [preferences, setPreferences] = useState<StudyPreferences>(defaultPreferences());
  const [generating, setGenerating] = useState(false);

  const patch = (p: Partial<StudyPreferences>) => setPreferences((prev) => ({ ...prev, ...p }));

  const isStepValid = (): boolean => {
    if (step === 1) {
      return preferences.targetExam.trim().length > 0 && !!preferences.targetDate && !!preferences.planStartDate && preferences.planStartDate <= preferences.targetDate;
    }
    if (step === 3) {
      const total = preferences.subjectPriorities.reduce((sum, p) => sum + p.percentage, 0);
      return total === 100;
    }
    if (step === 4) {
      return preferences.availability.some((d) => d.enabled && d.hours > 0);
    }
    if (step === 5) {
      return preferences.questionsPerSession > 0;
    }
    return true;
  };

  const handleContinue = async () => {
    if (!isStepValid()) return;
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
      return;
    }
    setGenerating(true);
    await onGenerate(preferences);
    setGenerating(false);
  };

  if (generating) {
    return (
      <div className="card animate-scale-in mx-auto flex max-w-2xl flex-col items-center gap-3 px-6 py-16 text-center">
        <Loader2 size={28} className="animate-spin text-teal" />
        <p className="text-sm font-semibold text-navy-text">Building your study plan…</p>
        <p className="max-w-xs text-sm text-muted">Organizing your syllabus into daily sessions based on your answers.</p>
      </div>
    );
  }

  return (
    <div className="card mx-auto max-w-2xl p-5 sm:p-7">
      <WizardProgress step={step} />

      <div key={step} className="animate-fade-in-up">
        {step === 1 && <TargetStep preferences={preferences} onChange={patch} />}
        {step === 2 && <SyllabusProgressStep />}
        {step === 3 && <PriorityStep preferences={preferences} onChange={patch} />}
        {step === 4 && <AvailabilityStep preferences={preferences} onChange={patch} />}
        {step === 5 && <PreferencesStep preferences={preferences} onChange={patch} />}
      </div>

      <div className="mt-7 flex items-center justify-between border-t border-border-soft pt-5">
        <button
          type="button"
          onClick={() => (step === 1 ? onCancel() : setStep((s) => s - 1))}
          className="btn btn-secondary"
        >
          <ArrowLeft size={15} /> Back
        </button>
        <button type="button" onClick={handleContinue} disabled={!isStepValid()} className="btn btn-primary">
          {step === TOTAL_STEPS ? "Generate My Study Plan" : "Continue"}
          {step < TOTAL_STEPS && <ArrowRight size={15} />}
        </button>
      </div>
    </div>
  );
}
