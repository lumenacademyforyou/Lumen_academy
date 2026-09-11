import { chromium } from "@playwright/test";

// Live browser check for the user's second report: syllabus materials say
// "failed to fetch" and few/no material cards render per unit. Checks
// several units across subjects, not just one, since the report says
// "every unit with the links."

async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--disable-dev-shm-usage"] });
  try {
    // Header.tsx's desktop nav (which has the exact "Course" tab) is
    // `hidden xl:flex` — Tailwind's xl breakpoint (1280px) — and Playwright's
    // bare browser.newPage() default viewport sits right at that boundary,
    // so a first attempt at this timed out waiting for a nav button that
    // was actually just responsively hidden, not missing. Force a
    // comfortably-desktop viewport so this exercises the real desktop nav,
    // not a boundary case.
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(`[pageerror] ${err.message}`));
    const failedRequests: string[] = [];
    page.on("requestfailed", (req) => failedRequests.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`));

    await page.goto("http://localhost:4000/", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.getByRole("button", { name: "Sign In" }).first().click();
    await page.getByRole("button", { name: "Demo Account" }).click();
    await page.getByRole("heading", { name: /Start your journey, Prince A!/i }).waitFor({ timeout: 20000 });
    console.log("logged in");

    await page.getByRole("button", { name: "COURSE", exact: true }).first().click();
    await page.waitForTimeout(2000);
    console.log("on Course Area (hub) view");

    // "course" tab lands on CourseAreaView (a hub: Overview/Syllabus/Study
    // Plan), not directly on CoursesView (the actual unit browser with the
    // real materials fix) — confirmed live, not assumed, via a first pass
    // dumping visible headings/buttons at each step.
    await page.getByRole("button", { name: /Neet Syllabus|Explore Syllabus/i }).first().click();
    await page.waitForTimeout(3000);
    console.log("on CoursesView (unit browser)");

    const unitsToCheck = ["Mechanics & Rotational Dynamics", "Some Basic Concepts & States of Matter", "Genetics & Molecular Inheritance", "Animal Diversity & Structural Organisation"];
    for (const unitName of unitsToCheck) {
      const heading = page.getByRole("heading", { name: unitName, exact: true });
      if ((await heading.count()) === 0) {
        console.log(`\n${unitName}: heading not found on the Courses page`);
        continue;
      }
      // The unit name is a plain heading, not itself clickable — the real
      // interactive element is the "Explore Syllabus & Materials" button
      // inside the same card. Walk up from the heading to the nearest
      // ancestor that also contains that button, then click it there
      // (every card repeats the same button label, so scoping by ancestor
      // is the only way to hit the right one).
      const openButton = heading.locator(`xpath=./ancestor::div[.//button[contains(., "Explore Syllabus")]][1]//button[contains(., "Explore Syllabus")]`).first();
      if ((await openButton.count()) === 0) {
        console.log(`\n${unitName}: heading found but no "Explore Syllabus" button in an ancestor container`);
        continue;
      }
      await openButton.click();
      await page.waitForTimeout(2500); // let the materials fetch settle

      const errorBanner = page.getByText(/failed to fetch|could not load/i);
      const errorText = (await errorBanner.count()) > 0 ? await errorBanner.first().textContent() : null;
      const materialCards = await page.locator("text=/View/").count();
      const pdfBadge = await page.getByText(/\d+ PDFs?/).first().textContent().catch(() => null);
      console.log(`\n${unitName}: badge="${pdfBadge}" errorBanner=${errorText ? `"${errorText}"` : "none"} viewButtons=${materialCards}`);

      // back out to the unit list
      const backBtn = page.getByRole("button", { name: /back/i }).first();
      if ((await backBtn.count()) > 0) await backBtn.click();
      await page.waitForTimeout(500);
    }

    console.log("\n--- console errors ---");
    for (const e of consoleErrors) console.log(e);
    console.log("\n--- failed network requests ---");
    for (const f of failedRequests) console.log(f);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("diagnose-materials-rendering failed:", err);
  process.exitCode = 1;
});
