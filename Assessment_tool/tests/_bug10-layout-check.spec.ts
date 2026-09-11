import { test, expect, type Page } from "@playwright/test";

// Regression coverage for BUG-10 (docs/assessment-tool-debug-plan.md) — the
// plan's own Layout Checklist (13.3) requires this at 1920/1366/390px, so
// kept as a permanent automated check rather than a one-off. Confirms the
// test-taking console's fixed-viewport layout: header/footer controls stay
// visible and the browser window itself never scrolls at any of the three
// required widths, and (390px specifically) that the mobile palette drawer
// doesn't hide Submit behind a toggle.
async function loginAsDemo(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Sign In" }).first().click();
  await page.getByRole("button", { name: "Demo Account" }).click();
  await expect(page.getByRole("heading", { name: /Start your journey|Great work|Nice work getting started/i })).toBeVisible({ timeout: 40000 });
}

const WIDTHS = [1920, 1366, 390];

// Serial: all three tests log into the SAME shared demo account (there's
// only one), and the app's BUG-03/BUG-08 guard correctly rejects a second
// concurrent attempt for one user — running these in parallel workers (the
// project default) makes two of the three collide on that guard, which is
// the app behaving correctly, not a layout defect. Confirmed live: the
// guard rejection is exactly what produced the "Proceed to Instructions
// never appears" failures before this was made serial.
test.describe.configure({ mode: "serial" });

for (const width of WIDTHS) {
  test(`BUG-10 layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await loginAsDemo(page);

    await page.getByRole("button", { name: "Tests" }).first().click();
    await expect(page.getByRole("heading", { name: "NEET Mock Test Series" })).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Configure Practice" }).click();
    await page.getByRole("button", { name: "PHY", exact: true }).click();
    await page.getByRole("button", { name: "Start Practice" }).click();

    await expect(page.getByRole("button", { name: "Proceed to Instructions" })).toBeEnabled({ timeout: 30000 });
    await page.getByRole("button", { name: "Proceed to Instructions" }).click();
    await page.getByText("I have read and understand all the instructions provided above.").click();
    await page.getByRole("button", { name: "I Understand, Start Test" }).click();

    // LobbyView then runs its own ~30s countdown before auto-navigating into
    // TestTakingView (no manual skip) — wait for a TestTakingView-only
    // element, not just <main> (every screen, including the lobby, has one).
    await expect(page.getByText(/TIME REMAINING/i)).toBeVisible({ timeout: 45000 });

    // The core assertion: no window-level vertical scrollbar, regardless of
    // question content length (documentElement.scrollHeight should not
    // exceed the viewport height by more than a rounding pixel or two).
    const { scrollHeight, clientHeight } = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }));
    console.log(`[${width}px] documentElement scrollHeight=${scrollHeight} clientHeight=${clientHeight}`);
    expect(scrollHeight - clientHeight).toBeLessThanOrEqual(2);

    // Header (timer) and the Previous/Save & Next footer controls must both
    // be visible without any scrolling.
    await expect(page.getByText(/TIME REMAINING/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Save & Next" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit Test?" }).first()).toBeVisible();

    await page.screenshot({ path: `test-results/_bug10-${width}.png`, fullPage: false });
  });
}
