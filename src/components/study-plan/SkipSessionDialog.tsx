import type { StudySession } from "../../types/studyPlan";
import { Modal } from "../layout/Modal";

interface Props {
  session: StudySession;
  onCancel: () => void;
  onConfirm: () => void;
}

export function SkipSessionDialog({ session, onCancel, onConfirm }: Props) {
  return (
    <Modal
      title="Skip this study session?"
      onClose={onCancel}
      maxWidthClass="max-w-sm"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-warn" onClick={onConfirm}>
            Skip Session
          </button>
        </>
      }
    >
      <p className="text-sm text-navy-text">
        <span className="font-semibold">{session.chapterName}</span>
        {session.topicName ? ` · ${session.topicName}` : ""}
      </p>
      <p className="mt-2 text-sm text-muted">This session will remain visible in your plan history as skipped.</p>
    </Modal>
  );
}
