import { describe, it, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import React, { createRef } from "react";
import QuestionAvailabilityBanner from "./QuestionAvailabilityBanner";
import InsufficientQuestionsDialog from "./InsufficientQuestionsDialog";
import { LanguageProvider } from "../../contexts/LanguageContext";
import type { AvailabilityResult } from "../../types";

// docs/test-engine-fix-prompt.md Defect 6 (the notification) and Defect 4
// (diagnostics scoped to the config they were measured against).

const SHORT: AvailabilityResult = {
  configHash: "cfg-a",
  requested: 90,
  available: 74,
  shortfall: 16,
  byUnit: [
    { unitId: "phy_u02", unitName: "Electrostatic Potential and Capacitance", requested: 15, available: 6, reason: "POOL_TOO_SMALL" },
    { unitId: "phy_u07", unitName: "Ray Optics", requested: 10, available: 0, reason: "NO_VALID_IMAGE" },
  ],
};

const wrap = (ui: React.ReactElement) => render(<LanguageProvider>{ui}</LanguageProvider>);

describe("QuestionAvailabilityBanner", () => {
  it("shows the shortfall summary with the exact requested/available numbers", () => {
    wrap(<QuestionAvailabilityBanner availability={SHORT} currentConfigHash="cfg-a" />);
    expect(screen.getByText("Not enough questions for this test")).toBeInTheDocument();
    expect(screen.getByText(/You asked for\s*90\s*questions\.\s*Only\s*74\s*are available with these settings\./)).toBeInTheDocument();
  });

  it("announces politely without stealing focus", () => {
    wrap(<QuestionAvailabilityBanner availability={SHORT} currentConfigHash="cfg-a" />);
    const banner = screen.getByRole("status");
    expect(banner).toHaveAttribute("aria-live", "polite");
  });

  it("is collapsed to one line by default and expands to the per-unit breakdown", () => {
    wrap(<QuestionAvailabilityBanner availability={SHORT} currentConfigHash="cfg-a" />);
    expect(screen.queryByText(/Electrostatic Potential and Capacitance/)).not.toBeInTheDocument();

    act(() => {
      screen.getByRole("button", { name: "Show details" }).click();
    });

    expect(screen.getByText(/Electrostatic Potential and Capacitance — 6 of 15 available/)).toBeInTheDocument();
    // The reason text is appended only where the "n of m" line does not
    // already say it — POOL_TOO_SMALL adds nothing, NO_VALID_IMAGE does.
    expect(screen.getByText(/Ray Optics — 0 of 10 available \(no questions with a usable image\)/)).toBeInTheDocument();
  });

  it("renders nothing when the config on screen is not the one that was measured (Defect 4)", () => {
    // The exact stale-badge scenario: diagnostics from test A, config B on
    // screen. Nothing may be painted — not a softened warning, nothing.
    const { container } = wrap(<QuestionAvailabilityBanner availability={SHORT} currentConfigHash="cfg-b" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there is no shortfall", () => {
    const fine: AvailabilityResult = { configHash: "cfg-a", requested: 20, available: 20, shortfall: 0, byUnit: [] };
    const { container } = wrap(<QuestionAvailabilityBanner availability={fine} currentConfigHash="cfg-a" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("InsufficientQuestionsDialog", () => {
  const noop = () => {};

  it("is an alertdialog offering Build with N, Change settings and Cancel", () => {
    wrap(
      <InsufficientQuestionsDialog
        availability={SHORT}
        allowReducedBuild
        onBuildWithAvailable={noop}
        onChangeSettings={noop}
        onCancel={noop}
        returnFocusTo={createRef<HTMLElement>()}
      />
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Build with 74" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("drops the build action and explains why when nothing is available", () => {
    const none: AvailabilityResult = { ...SHORT, available: 0, shortfall: 90, byUnit: [] };
    wrap(
      <InsufficientQuestionsDialog
        availability={none}
        allowReducedBuild
        onBuildWithAvailable={noop}
        onChangeSettings={noop}
        onCancel={noop}
        returnFocusTo={createRef<HTMLElement>()}
      />
    );
    expect(screen.queryByRole("button", { name: /^Build with/ })).not.toBeInTheDocument();
    expect(screen.getByText("No questions match these settings. Try removing a filter or selecting more units.")).toBeInTheDocument();
  });

  it("never offers to shorten a full mock — its blueprint is the test", () => {
    wrap(
      <InsufficientQuestionsDialog
        availability={SHORT}
        allowReducedBuild={false}
        onBuildWithAvailable={noop}
        onChangeSettings={noop}
        onCancel={noop}
        returnFocusTo={createRef<HTMLElement>()}
      />
    );
    expect(screen.queryByRole("button", { name: /^Build with/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change settings" })).toBeInTheDocument();
  });

  it("focuses its primary action on open and returns focus to the Start button on close", () => {
    const start = document.createElement("button");
    start.textContent = "Start";
    document.body.appendChild(start);
    const ref = { current: start as HTMLElement | null };

    const onBuild = vi.fn();
    const { unmount } = wrap(
      <InsufficientQuestionsDialog
        availability={SHORT}
        allowReducedBuild
        onBuildWithAvailable={onBuild}
        onChangeSettings={noop}
        onCancel={noop}
        returnFocusTo={ref}
      />
    );

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Build with 74" }));
    unmount();
    expect(document.activeElement).toBe(start);
    start.remove();
  });

  it("treats Escape as Cancel rather than as a silent dismissal", () => {
    const onCancel = vi.fn();
    wrap(
      <InsufficientQuestionsDialog
        availability={SHORT}
        allowReducedBuild
        onBuildWithAvailable={noop}
        onChangeSettings={noop}
        onCancel={onCancel}
        returnFocusTo={createRef<HTMLElement>()}
      />
    );
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
