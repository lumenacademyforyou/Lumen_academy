import React, { useState } from "react";

interface QuestionImageProps {
  url: string;
  altText?: string | null;
  className?: string;
  /** Caps the reserved skeleton/fallback box height — the real image can render shorter once loaded. */
  maxHeightPx?: number;
}

// P0-4 (docs/assessment-tool-fix-prompt.md): a shared image slot used
// everywhere a question/option image renders (test-taking, review, and
// whatever DOM a downloaded report captures) so all three stay in sync.
// Reserves space up front (no stem/option text reflow once the image
// resolves), shows a skeleton while loading, and swaps to a fallback state
// instead of the browser's broken-image icon if the URL 404s or errors.
// Renders nothing at all when there's no url — callers already only mount
// this when an image exists, so the "no gap for a question with no image"
// requirement falls out of that, not out of this component.
export default function QuestionImage({ url, altText, className = "", maxHeightPx = 320 }: QuestionImageProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  // BUG-10 (docs/assessment-tool-debug-plan.md): the plan's own image spec
  // asks for click-to-zoom on dense diagrams — this component had no way to
  // see an image any larger than its reserved slot (maxHeightPx, as small as
  // 160px for an option image) before this fix. A plain fixed-overlay
  // lightbox, not a new dependency: the images here are already served over
  // HTTPS from this app's own asset host, nothing more elaborate needed.
  const [zoomed, setZoomed] = useState(false);

  return (
    <div
      className={`relative w-full rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800/60 flex items-center justify-center ${className}`}
      style={{ minHeight: status === "loaded" ? undefined : Math.min(160, maxHeightPx) }}
    >
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center animate-pulse">
          <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600">image</span>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-slate-400 dark:text-slate-500">
          <span className="material-symbols-outlined text-3xl">broken_image</span>
          <span className="text-xs font-semibold">Image unavailable</span>
        </div>
      )}

      {/* Kept mounted (not removed) while loading/erroring so onLoad/onError
          still fire for a URL that eventually resolves; just visually hidden
          until it does.
          No loading="lazy" here — a real, confirmed live bug (found via a
          browser diagnostic, not guessed): this element is display:none
          (via the "hidden" class below) until `status` flips to "loaded",
          and a display:none element has no layout box, so the browser's
          native lazy-loading can never observe it as "near the viewport" to
          start fetching it in the first place. The two mechanisms deadlock
          — the image needs to load to become visible, but needs geometry
          (i.e. to already be visible) for lazy-loading to ever fetch it —
          and confirmed live that the network request for the image was
          never even made. Fetching eagerly is also simply correct here:
          every caller of this component (TestTakingView, AttemptReviewView)
          only ever shows the one image belonging to the currently-relevant
          question, never an off-screen list item worth deferring. */}
      <img
        src={url}
        alt={altText ?? ""}
        decoding="async"
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
        onClick={() => status === "loaded" && setZoomed(true)}
        className={`max-w-full w-auto rounded-xl ${status === "loaded" ? "block cursor-zoom-in" : "hidden"}`}
        style={{ maxHeight: maxHeightPx }}
      />

      {status === "loaded" && (
        <button
          type="button"
          onClick={() => setZoomed(true)}
          aria-label="Zoom image"
          className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">zoom_in</span>
        </button>
      )}

      {zoomed && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-6 cursor-zoom-out"
          onClick={() => setZoomed(false)}
        >
          <img src={url} alt={altText ?? ""} className="max-w-full max-h-full object-contain rounded-lg" />
          <button
            type="button"
            onClick={() => setZoomed(false)}
            aria-label="Close zoomed image"
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
      )}
    </div>
  );
}
