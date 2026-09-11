import React, { useEffect } from "react";

interface ModalProps {
  /** Callers already conditionally render every modal in this codebase
   * (`{show && <Something/>}`) — Modal doesn't duplicate that with its own
   * `open` prop; mounting it IS "open". `onClose` still needs to exist for
   * Escape/backdrop-click to have something to call. */
  onClose: () => void;
  children: React.ReactNode;
  /** Tailwind background/blur classes for the backdrop. Every existing
   * hand-rolled modal used a slightly different one — kept as a prop rather
   * than forced to one value so each screen keeps its exact current look. */
  backdropClassName?: string;
  /** z-index utility class — existing modals ranged from z-50 to z-[110]
   * depending on what else could be on screen at the same time. */
  zIndexClassName?: string;
  /** Extra classes on the centering wrapper (e.g. items-start for a
   * top-anchored modal). Defaults to centered. */
  wrapperClassName?: string;
  /** Set false for a modal that must be dismissed only via its own explicit
   * action (e.g. a security-relevant session-expiry warning) — rare. */
  closeOnBackdropClick?: boolean;
  /** Same as above, for the Escape key specifically. */
  closeOnEscape?: boolean;
}

// LA-APP-COMPLETION-001 Phase H (D10) — the one real shared Modal component
// referenced by the completion directive's rule 5 but never built in any
// prior phase (confirmed absent by grep in Sessions 2, 3, and 4's own
// research before this). Every modal in this app before this component
// hand-rolled the same `fixed inset-0 z-50 ... backdrop-blur-md` overlay
// pattern independently — and none of them handled the Escape key or
// locked body scroll while open, a real, repeated UX gap this fixes once
// for every adopter instead of patching each screen separately.
//
// Deliberately does NOT impose a card style (rounded corners, padding,
// colors) — those varied legitimately across screens before this component
// existed (a small confirmation dialog looks different from a full profile
// editor), and forcing one shape would be a visual regression, not a
// cleanup. This owns exactly the repeated mechanics: backdrop, centering,
// fade-in, Escape-to-close, click-outside-to-close, and the body-scroll
// lock. The card itself is whatever the caller renders as `children`.
export default function Modal({
  onClose,
  children,
  backdropClassName = "bg-[#00243B]/60 backdrop-blur-md",
  zIndexClassName = "z-50",
  wrapperClassName = "items-center",
  closeOnBackdropClick = true,
  closeOnEscape = true,
}: ModalProps) {
  useEffect(() => {
    if (!closeOnEscape) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeOnEscape, onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 ${zIndexClassName} flex ${wrapperClassName} justify-center ${backdropClassName} p-4 animate-in fade-in duration-200 overflow-y-auto`}
      onClick={closeOnBackdropClick ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full flex justify-center my-auto">
        {children}
      </div>
    </div>
  );
}
