import { useState } from "react";
import type { StudySession } from "../../types/studyPlan";
import type { MoveOption } from "../../services/studyPlanService";
import { Modal } from "../layout/Modal";
import { addDaysISO, formatLong, getUpcomingWeekend, todayISO } from "../../utils/dates";

interface Props {
  session: StudySession;
  onCancel: () => void;
  onConfirm: (option: MoveOption, customDate?: string) => void;
}

export function MoveSessionModal({ session, onCancel, onConfirm }: Props) {
  const [option, setOption] = useState<MoveOption>("tomorrow");
  const [customDate, setCustomDate] = useState(addDaysISO(session.date, 2));

  const handleConfirm = () => onConfirm(option, option === "custom" ? customDate : undefined);

  return (
    <Modal
      title="Move study session"
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleConfirm}>
            Move Session
          </button>
        </>
      }
    >
      <p className="mb-4 text-sm text-muted">
        {session.chapterName}
        {session.topicName ? ` · ${session.topicName}` : ""} is currently scheduled for {formatLong(session.date)}.
      </p>
      <div className="space-y-2">
        <OptionRow
          label="Tomorrow"
          description={formatLong(addDaysISO(session.date, 1))}
          selected={option === "tomorrow"}
          onSelect={() => setOption("tomorrow")}
        />
        <OptionRow
          label="This weekend"
          description={formatLong(getUpcomingWeekend(session.date))}
          selected={option === "weekend"}
          onSelect={() => setOption("weekend")}
        />
        <OptionRow
          label="Choose a date"
          description="Pick any upcoming date"
          selected={option === "custom"}
          onSelect={() => setOption("custom")}
        />
        {option === "custom" && (
          <input
            type="date"
            value={customDate}
            min={todayISO()}
            onChange={(e) => setCustomDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-border-soft px-3 py-2 text-sm text-navy-text"
            aria-label="Custom move-to date"
          />
        )}
      </div>
    </Modal>
  );
}

function OptionRow({
  label,
  description,
  selected,
  onSelect,
}: {
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${
        selected ? "border-teal bg-[#F0F8F8]" : "border-border-soft hover:border-teal/60"
      }`}
    >
      <span>
        <span className="block text-sm font-semibold text-navy-text">{label}</span>
        <span className="block text-xs text-muted">{description}</span>
      </span>
      <span
        className={`h-4 w-4 shrink-0 rounded-full border-2 ${selected ? "border-teal bg-teal" : "border-border-soft"}`}
      />
    </button>
  );
}
