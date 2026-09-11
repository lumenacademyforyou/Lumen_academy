import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * LA-UX-REFRESH-002 G1 — regression coverage for the bug behind BOTH the
 * broken "Share Scorecard" button and every broken "Download PDF" button.
 *
 * This project is on Tailwind CSS v4, which emits its palette as `oklch()`.
 * html2canvas@1.4.1 cannot parse that color function and throws
 * "Attempting to parse an unsupported color function" on the first styled
 * node it walks, so every capture in the app failed. html2canvas-pro is the
 * maintained fork that supports it.
 *
 * The test renders a fragment styled the way the real app is styled — oklch
 * colors, plus the color-mix() Tailwind uses for opacity modifiers — and
 * asserts the new library produces a real, non-blank raster from it. It runs
 * against the actual browser build of the library from node_modules, so it
 * fails if a future dependency change reintroduces the old behaviour.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRO_BUNDLE = path.resolve(__dirname, "../node_modules/html2canvas-pro/dist/html2canvas-pro.js");

const PAGE_HTML = `
<!doctype html>
<html><head><meta charset="utf-8"><style>
  body { margin: 0; background: oklch(0.98 0.01 250); }
  #card {
    width: 420px; height: 220px; padding: 24px;
    background: oklch(0.22 0.05 245);
    color: oklch(0.98 0.01 250);
    border: 2px solid oklch(0.83 0.16 84);
    border-radius: 24px;
    font-family: system-ui, sans-serif;
  }
  #card .pill {
    display: inline-block; padding: 6px 14px; border-radius: 999px;
    /* Tailwind v4 compiles opacity modifiers (bg-white/10) to color-mix() */
    background: color-mix(in oklab, oklch(1 0 0) 15%, transparent);
    color: oklch(0.83 0.16 84);
  }
  #card h1 { font-size: 34px; margin: 12px 0 4px; }
</style></head>
<body>
  <div id="card">
    <span class="pill">LATEST SCORECARD</span>
    <h1>360 / 720</h1>
    <p>Correct 90 (+360) &nbsp; Incorrect 0 &nbsp; Skipped 90</p>
  </div>
</body></html>`;

test("html2canvas-pro rasterises Tailwind v4 oklch/color-mix styling without throwing", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  await page.setContent(PAGE_HTML);
  await page.addScriptTag({ path: PRO_BUNDLE });

  const result = await page.evaluate(async () => {
    const target = document.getElementById("card")!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html2canvas = (window as any).html2canvas;
    try {
      const canvas: HTMLCanvasElement = await html2canvas(target, {
        backgroundColor: "#00243B",
        scale: 2,
        logging: false,
      });
      const ctx = canvas.getContext("2d")!;
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // A capture that "succeeded" but painted nothing is still a failure, so
      // count how many distinct colors actually landed on the canvas.
      const seen = new Set<string>();
      for (let i = 0; i < data.length; i += 4 * 97) {
        seen.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
      }
      return { ok: true, width: canvas.width, height: canvas.height, distinctColors: seen.size, error: null as string | null };
    } catch (err) {
      return { ok: false, width: 0, height: 0, distinctColors: 0, error: err instanceof Error ? err.message : String(err) };
    }
  });

  expect(result.error).toBeNull();
  expect(result.ok).toBe(true);
  expect(result.width).toBeGreaterThan(0);
  expect(result.height).toBeGreaterThan(0);
  // The card has a dark ground, a gold border, a translucent pill and white
  // text — a blank or single-colour raster would mean the colors were dropped
  // rather than parsed.
  expect(result.distinctColors).toBeGreaterThan(3);
  expect(pageErrors).toEqual([]);
});
