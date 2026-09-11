import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "../contexts/LanguageContext";
import LobbyView from "./LobbyView";

// Regression coverage for P0-2 (docs/assessment-tool-fix-prompt.md): the
// consent checkbox must gate the countdown (not just a button at the end),
// and reaching zero must navigate in with no extra click, exactly once.

function renderLobby(onStartTest: () => void, testCode = "LMN-NEET-SUBJ-BOT-000001") {
  return render(
    <LanguageProvider>
      <LobbyView onStartTest={onStartTest} testTitle="Botany Practice" testCode={testCode} mode="standard" />
    </LanguageProvider>
  );
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("LobbyView — countdown + consent (P0-2)", () => {
  it("blocks entry with an inline message and never starts the countdown when unticked", async () => {
    const user = userEvent.setup();
    const onStartTest = vi.fn();
    renderLobby(onStartTest);

    await user.click(screen.getByRole("button", { name: /I Understand, Start Test/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("Please tick the checkbox to enter the test.");
    expect(onStartTest).not.toHaveBeenCalled();
    // Countdown never began — the ring still shows the full duration, not ticking.
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("runs the countdown after ticking the box, then navigates automatically at zero with no extra click", () => {
    vi.useFakeTimers();
    const onStartTest = vi.fn();
    renderLobby(onStartTest);

    act(() => {
      fireEvent.click(screen.getByRole("checkbox"));
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /I Understand, Start Test/i }));
    });

    // Countdown phase — the "Start Test" button is gone, no click available.
    expect(screen.queryByRole("button", { name: /I Understand, Start Test/i })).not.toBeInTheDocument();
    expect(onStartTest).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(onStartTest).toHaveBeenCalledTimes(1);
  });

  it("guards against double-navigation if the zero-timeLeft effect could fire more than once", () => {
    vi.useFakeTimers();
    const onStartTest = vi.fn();
    renderLobby(onStartTest);

    act(() => {
      fireEvent.click(screen.getByRole("checkbox"));
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /I Understand, Start Test/i }));
    });

    act(() => {
      vi.advanceTimersByTime(30_000);
      // Extra ticks past zero must not cause extra navigations.
      vi.advanceTimersByTime(5_000);
    });

    expect(onStartTest).toHaveBeenCalledTimes(1);
  });

  it("skips the consent screen and countdown entirely on remount after the countdown was already consumed", () => {
    const testCode = "LMN-NEET-SUBJ-BOT-000002";
    sessionStorage.setItem(`lumen_lobby_countdown_consumed_${testCode}`, "1");

    const onStartTest = vi.fn();
    renderLobby(onStartTest, testCode);

    expect(onStartTest).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
