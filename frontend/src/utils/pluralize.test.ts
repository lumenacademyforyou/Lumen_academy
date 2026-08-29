import { describe, it, expect } from "vitest";
import { pluralize, countLabel } from "./pluralize";

// Regression coverage for P2-14 (docs/assessment-tool-fix-prompt.md): "1
// units" grammar and missing number/label spacing. DashboardView.tsx's study
// streak counter, Header.tsx's streak tooltip, and TestListView.tsx's custom
// test title all now route through this shared helper instead of each
// hand-rolling their own (previously inconsistent) pluralization.
describe("pluralize / countLabel", () => {
  it("uses the singular form at exactly 1", () => {
    expect(pluralize(1, "Day", "Days")).toBe("Day");
    expect(countLabel(1, "unit")).toBe("1 unit");
  });

  it("uses the plural form at 0 and at >1", () => {
    expect(pluralize(0, "Day", "Days")).toBe("Days");
    expect(pluralize(2, "Day", "Days")).toBe("Days");
    expect(countLabel(0, "unit")).toBe("0 units");
    expect(countLabel(3, "unit")).toBe("3 units");
  });

  it("defaults the plural to singular + 's' when not given", () => {
    expect(countLabel(1, "question")).toBe("1 question");
    expect(countLabel(5, "question")).toBe("5 questions");
  });

  it("always separates the count from the label with a space", () => {
    expect(countLabel(1, "unit")).toMatch(/^1 unit$/);
    expect(countLabel(12, "attempt")).toMatch(/^12 attempts$/);
  });
});
