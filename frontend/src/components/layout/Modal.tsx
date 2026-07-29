import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClass?: string;
}

export function Modal({ title, onClose, children, footer, maxWidthClass = "max-w-md" }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 animate-fade-in bg-navy/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`card animate-scale-in relative w-full ${maxWidthClass} p-5 shadow-xl`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="modal-title" className="text-base font-bold text-navy">
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md p-1 text-muted hover:bg-ivory hover:text-navy"
          >
            <X size={18} />
          </button>
        </div>
        <div>{children}</div>
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
