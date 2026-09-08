import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FocusMode from "./FocusMode";

// LA-UX-REFRESH-001 F9. The parts worth pinning down are the ones with
// consequences outside the component: that a real study stretch is logged
// through the pomodoro API (so it counts toward the streak), that a mis-click
// is NOT logged, and that Esc gets you out — the exit LeetCode's focus mode
// trains people to reach for.

const createPomodoroSession = vi.fn();

vi.mock("../../../services/pomodoroApi", () => ({
  createPomodoroSession: (...args: unknown[]) => createPomodoroSession(...args),
}));

beforeEach(() => {
  createPomodoroSession.mockReset();
  createPomodoroSession.mockResolvedValue({});
  // requestFullscreen doesn't exist in jsdom; the component treats a
  // rejection as non-fatal, and so should the test environment.
  (HTMLElement.prototype as unknown as { requestFullscreen: () => Promise<void> }).requestFullscreen = () =>
    Promise.resolve();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("FocusMode (LA-UX-REFRESH-001 F9)", () => {
  it("renders nothing until it is opened", () => {
    const { container } = render(<FocusMode open={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("preselects the length closest to the student's own daily target", () => {
    render(<FocusMode open onClose={() => {}} defaultMinutes={50} />);
    // 50 is nearest 45 of the offered 25/30/45/60/90.
    expect(screen.getByText("45:00")).toBeInTheDocument();
  });

  it("falls back to 25 minutes when no target is saved", () => {
    render(<FocusMode open onClose={() => {}} defaultMinutes={null} />);
    expect(screen.getByText("25:00")).toBeInTheDocument();
  });

  it("counts down once started and hides the setup controls", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<FocusMode open onClose={() => {}} defaultMinutes={25} />);

    await user.click(screen.getByRole("button", { name: /^Start$/i }));
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByText("24:57")).toBeInTheDocument();
    // The duration chips and the "what are you working on" box are gone —
    // that removal is the entire point of focus mode.
    expect(screen.queryByPlaceholderText("What are you working on?")).not.toBeInTheDocument();
  });

  it("logs a session that ran long enough, and tells the streak listeners about it", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSessionSaved = vi.fn();
    window.addEventListener("lumen_session_saved", onSessionSaved);
    const onClose = vi.fn();

    render(<FocusMode open onClose={onClose} defaultMinutes={25} />);
    await user.click(screen.getByRole("button", { name: /^Start$/i }));

    // Real elapsed time is measured off the wall clock, not the tick count.
    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /End session/i }));
    });

    expect(createPomodoroSession).toHaveBeenCalledTimes(1);
    const payload = createPomodoroSession.mock.calls[0][0];
    expect(payload.session_type).toBe("focus");
    expect(payload.duration_seconds).toBeGreaterThanOrEqual(299);
    expect(payload.task_title).toBe("Focus session");
    expect(onSessionSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();

    window.removeEventListener("lumen_session_saved", onSessionSaved);
  });

  it("does not log a stretch shorter than a minute", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onClose = vi.fn();

    render(<FocusMode open onClose={onClose} defaultMinutes={25} />);
    await user.click(screen.getByRole("button", { name: /^Start$/i }));
    act(() => {
      vi.advanceTimersByTime(20 * 1000);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /End session/i }));
    });

    expect(createPomodoroSession).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("exits on Escape without ever having started", async () => {
    const onClose = vi.fn();
    render(<FocusMode open onClose={onClose} />);

    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(createPomodoroSession).not.toHaveBeenCalled();
  });
});
