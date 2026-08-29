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

  return (
    <div
      className={`relative w-full rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800/60 ${className}`}
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
          until it does. */}
      <img
        src={url}
        alt={altText ?? ""}
        loading="lazy"
        decoding="async"
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
        className={`max-w-full w-auto rounded-xl ${status === "loaded" ? "block" : "hidden"}`}
        style={{ maxHeight: maxHeightPx }}
      />
    </div>
  );
}
