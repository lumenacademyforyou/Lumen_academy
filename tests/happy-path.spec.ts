import { test, expect } from "@playwright/test";

test.describe("Lumen Academy E2E & Backend API Test Suite", () => {
  
  test("Backend Health Check Endpoint", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.service).toContain("Lumen Academy Backend");
  });

  test("Backend Questions API Endpoint", async ({ request }) => {
    const response = await request.get("/api/questions?subject=biology");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("success");
    expect(Array.isArray(body.questions)).toBeTruthy();
    expect(body.questions.length).toBeGreaterThan(0);
  });

  test("Backend AI Study Plan Endpoint", async ({ request }) => {
    const response = await request.post("/api/ai/study-plan", {
      data: {
        studentName: "Prince A",
        targetExam: "NEET",
        weakSubjects: ["Physics", "Botany"],
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("success");
    expect(body.plan).toBeDefined();
    expect(body.plan.weeklyRoadmap.length).toBeGreaterThan(0);
  });

  test("Backend Submit Attempt Endpoint", async ({ request }) => {
    const response = await request.post("/api/submit-attempt", {
      data: {
        attemptId: "mock_test_e2e",
        userAnswers: { 1: 0, 2: 1 },
        durationSeconds: 120,
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("success");
    expect(body.score).toBeDefined();
  });

  test("Frontend Core Student Journey - Landing to Demo Login and Dashboard", async ({ page }) => {
    await page.goto("/");

    // Splash screen or home page button
    const getStartedButton = page.getByRole("button", { name: /Get Started|Start Learning|Explore Platform/i });
    if (await getStartedButton.isVisible()) {
      await getStartedButton.click();
    }

    // Quick demo login
    const demoButton = page.getByRole("button", { name: /Demo Account|Quick Demo|Try Demo/i }).first();
    if (await demoButton.isVisible()) {
      await demoButton.click();
    }

    // Verify main app dashboard header or title is visible
    await expect(page.getByText(/LUMEN ACADEMY|Dashboard|Welcome/i).first()).toBeVisible();
  });

});
