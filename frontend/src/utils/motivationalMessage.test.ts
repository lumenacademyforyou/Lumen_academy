import { describe, it, expect } from "vitest";
import { getMotivationalMessage, type MotivationalContext } from "./motivationalMessage";

// P1-15 (docs/assessment-tool-fix-prompt.md): the dashboard hero used to be
// a hardcoded "Great work, {name}!" regardless of score. These lock in the
// hard rule ("no negative wording at any score") and the scenario priority
// order (first attempt / improvement / streak / band).

const NEGATIVE_WORDS = ["poor", "weak", "bad", "fail", "low score"];

function base(overrides: Partial<MotivationalContext> = {}): MotivationalContext {
  return {
    studentName: "Asha",
    accuracyPercent: 40,
    attemptsCount: 5,
    previousAccuracyPercent: 40,
    studyStreakDays: 0,
    weakestUnitTitle: "Genetics & Molecular Inheritance",
    variationSeed: 0,
    ...overrides,
  };
}

describe("getMotivationalMessage", () => {
  it("never uses discouraging wording, at any accuracy from 0 to 100", () => {
    for (let accuracy = 0; accuracy <= 100; accuracy += 5) {
      const msg = getMotivationalMessage(base({ accuracyPercent: accuracy, previousAccuracyPercent: accuracy }));
      const lower = msg.headline.toLowerCase();
      for (const bad of NEGATIVE_WORDS) {
        expect(lower).not.toContain(bad);
      }
    }
  });

  it("always pairs the headline with a concrete next step", () => {
    const msg = getMotivationalMessage(base());
    expect(msg.nextStep.length).toBeGreaterThan(0);
    expect(msg.nextStep).toContain("Genetics & Molecular Inheritance");
  });

  it("falls back to a generic next step when there's no weakest-unit data yet", () => {
    const msg = getMotivationalMessage(base({ weakestUnitTitle: null }));
    expect(msg.nextStep.length).toBeGreaterThan(0);
  });

  it("greets a first attempt distinctly from a repeat one", () => {
    const first = getMotivationalMessage(base({ attemptsCount: 1, previousAccuracyPercent: null }));
    expect(first.headline).toMatch(/getting started/i);
  });

  it("calls out real improvement over the previous attempt before falling back to a flat band", () => {
    const improved = getMotivationalMessage(base({ accuracyPercent: 55, previousAccuracyPercent: 40, studyStreakDays: 0 }));
    expect(improved.headline).toMatch(/improving/i);
    expect(improved.headline).toContain("15%");
  });

  it("does not claim improvement when accuracy stayed flat or dropped", () => {
    const flat = getMotivationalMessage(base({ accuracyPercent: 40, previousAccuracyPercent: 40 }));
    expect(flat.headline).not.toMatch(/improving/i);
    const dropped = getMotivationalMessage(base({ accuracyPercent: 30, previousAccuracyPercent: 40 }));
    expect(dropped.headline).not.toMatch(/improving/i);
  });

  it("rotates the phrase within a band across different variation seeds", () => {
    const headlines = new Set(
      [0, 1, 2].map((seed) => getMotivationalMessage(base({ accuracyPercent: 90, previousAccuracyPercent: 90, variationSeed: seed })).headline)
    );
    expect(headlines.size).toBeGreaterThan(1);
  });
});
