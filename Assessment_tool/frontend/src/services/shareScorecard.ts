/**
 * LA-UX-REFRESH-001 F6 — "add a sharing feature in the dashboard score card
 * as a pic of the score card."
 *
 * Rasterises a DOM node with html2canvas (already a dependency, used by the
 * PDF export) and hands the PNG to the platform: the Web Share sheet where
 * the browser supports sharing files — which is what makes this useful on the
 * phone students actually screenshot from — and a download everywhere else.
 *
 * The renderer is html2canvas-pro, not html2canvas: Tailwind v4 emits its
 * palette as oklch(), which html2canvas@1.4.1 cannot parse — it throws on the
 * first styled node, which is exactly the "couldn't create the scorecard
 * image" failure this replaced (LA-UX-REFRESH-002 G1).
 *
 * It is imported dynamically so the library is fetched the first time
 * somebody shares, not in the dashboard chunk every user loads.
 */

export type ShareResult = "shared" | "downloaded" | "cancelled" | "failed";

// G1 — the previous version collapsed every failure into "failed", so the
// user saw "Couldn't create the scorecard image" with no way to tell a
// missing-node bug from an unsupported-CSS one. The reason is kept here for
// the caller to show; the console still gets the full error object.
let lastFailureReason: string | null = null;

export function getLastShareFailureReason(): string | null {
  return lastFailureReason;
}

interface ShareOptions {
  /** File name for the download fallback (no extension). */
  fileName?: string;
  /** Text accompanying the image in the share sheet. */
  shareText?: string;
  /** Painted behind the card — html2canvas renders transparent pixels as black otherwise. */
  backgroundColor?: string;
}

export async function shareElementAsImage(element: HTMLElement, options: ShareOptions = {}): Promise<ShareResult> {
  const { fileName = "lumen-scorecard", shareText = "My Lumen Academy scorecard", backgroundColor = "#00243B" } = options;

  lastFailureReason = null;
  try {
    const { default: html2canvas } = await import("html2canvas-pro");
    const canvas = await html2canvas(element, {
      backgroundColor,
      // 2x so the image is legible when a messaging app scales it down and
      // the recipient zooms back in.
      scale: Math.min(2, window.devicePixelRatio || 1) * 2,
      useCORS: true,
      logging: false,
    });

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) {
      lastFailureReason = "The browser could not turn the rendered card into an image.";
      return "failed";
    }

    const file = new File([blob], `${fileName}.png`, { type: "image/png" });

    // canShare({files}) is the only reliable test: several browsers expose
    // navigator.share but reject file payloads, and calling share() blind
    // would throw after the image has already been rendered.
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Lumen Academy Scorecard", text: shareText });
        return "shared";
      } catch (err) {
        // The user dismissing the share sheet is a normal outcome, not an
        // error to report — but a real failure should still fall back to the
        // download rather than leaving them with nothing.
        if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      }
    }

    downloadBlob(blob, `${fileName}.png`);
    return "downloaded";
  } catch (err) {
    console.error("Failed to share scorecard image:", err);
    lastFailureReason = err instanceof Error ? err.message : String(err);
    return "failed";
  }
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoked on the next tick — revoking synchronously can cancel the download
  // in some browsers before it has read the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
