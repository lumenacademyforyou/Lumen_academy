import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  // Above Playwright's 30s default to give the browser fixture (launch +
  // context + page) headroom on slower CI runners — the app itself loads
  // and paints in well under a second once the page is actually reached.
  // Bumped further for Phase F6's session-launch journeys: traced live
  // (db/scripts/manual/verify-phase-e-session.ts's sibling investigation)
  // that POST /api/assess/sessions could take ~14-18s against the real
  // remote Supabase Postgres. Phase H batched startAttempt's per-question
  // inserts into one unnest()-based insert (previously one sequential
  // awaited round trip per served question — see
  // docs/APP_COMPLETION_PLAN.md's Phase H notes), which fixed that specific
  // defect, but re-measuring afterward found raw per-round-trip latency to
  // this remote database is itself ~250-300ms in this environment,
  // regardless of query count — so the generous timeout stays, now for a
  // different, more fundamental reason than the one originally documented
  // here.
  timeout: 120000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:4000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: {
    // Not `npm run start` (which relies on cross-env's shell-based
    // NODE_ENV=production prefix) — found live while writing the Phase F6
    // journey specs that Playwright's own child-process spawn does not
    // reliably carry that through on this platform: `GET /` came back as
    // server.ts's non-production JSON health stub instead of index.html, so
    // every frontend journey failed at the very first "Sign In" lookup,
    // regardless of selector correctness. Setting NODE_ENV directly via
    // `env` bypasses cross-env/shell resolution entirely and is guaranteed
    // to reach the child process the same way on every platform.
    command: "node dist/server.mjs",
    env: { NODE_ENV: "production" },
    url: "http://localhost:4000",
    reuseExistingServer: true,
  },
});
