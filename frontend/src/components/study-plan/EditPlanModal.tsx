import { useState } from "react";
import type { StudyPreferences } from "../../types/studyPlan";
import { Modal } from "../layout/Modal";
import { PriorityStep } from "./wizard/PriorityStep";
import { AvailabilityStep } from "./wizard/AvailabilityStep";
import { PreferencesStep } from "./wizard/PreferencesStep";

interface Props {
  preferences: StudyPreferences;
  onCancel: () => void;
  onSave: (preferences: StudyPreferences) => Promise<void>;
}

const SECTIONS = ["Target", "Priorities", "Availability", "Preferences"] as const;

export function EditPlanModal({ preferences: initial, onCancel, onSave }: Props) {
  const [draft, setDraft] = useState<StudyPreferences>(initial);
  const [section, setSection] = useState<(typeof SECTIONS)[number]>("Target");
  const [saving, setSaving] = useState(false);

  const patch = (p: Partial<StudyPreferences>) => setDraft((prev) => ({ ...prev, ...p }));

  const isValid =
    draft.subjectPriorities.reduce((sum, p) => sum + p.percentage, 0) === 100 &&
    draft.availability.some((d) => d.enabled && d.hours > 0);

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    await onSave(draft);
    setSaving(false);
  };

  return (
    <Modal
      title="Edit Plan"
      onClose={onCancel}
      maxWidthClass="max-w-2xl"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={!isValid || saving}>
            {saving ? "Saving…" : "Save & Recalculate"}
          </button>
        </>
      }
    >
      <div className="mb-4 rounded-md bg-[#FFF8E8] px-3 py-2.5 text-xs text-navy-text">
        Your remaining plan will be recalculated. Completed sessions will not be changed.
      </div>

      <div className="mb-4 flex gap-1.5 overflow-x-auto border-b border-border-soft">
        {SECTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSection(s)}
            className={`whitespace-nowrap px-2.5 pb-2 text-sm font-semibold transition-colors ${
              section === s ? "border-b-2 border-teal text-teal" : "text-muted hover:text-navy-text"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="max-h-[50vh] overflow-y-auto pr-1">
        {section === "Target" && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-navy-text" htmlFor="edit-target-date">
                  Target Date
                </label>
                <input
                  id="edit-target-date"
                  type="date"
                  value={draft.targetDate}
                  onChange={(e) => patch({ targetDate: e.target.value })}
                  className="w-full rounded-md border border-border-soft px-3 py-2.5 text-sm text-navy-text"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-navy-text" htmlFor="edit-target-score">
                  Target Score
                </label>
                <input
                  id="edit-target-score"
                  type="text"
                  value={draft.targetScore ?? ""}
                  onChange={(e) => patch({ targetScore: e.target.value })}
                  className="w-full rounded-md border border-border-soft px-3 py-2.5 text-sm text-navy-text"
                />
              </div>
            </div>
          </div>
        )}
        {section === "Priorities" && <PriorityStep preferences={draft} onChange={patch} />}
        {section === "Availability" && <AvailabilityStep preferences={draft} onChange={patch} />}
        {section === "Preferences" && <PreferencesStep preferences={draft} onChange={patch} />}
      </div>
    </Modal>
  );
}
