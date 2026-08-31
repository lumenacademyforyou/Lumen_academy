import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '../contexts/LanguageContext';
import type { EnvelopeResponse, SessionResult } from '../types';

// Phase F2 (LA-APP-COMPLETION-001) — real behaviour for the test workspace's
// timer, palette/progress state, and autosave, not just "it renders". Mocks
// only the network boundary (sessionApi) so the component's own state
// machine (selection, navigation, flagging, dirty-tracking, countdown) runs
// for real.
vi.mock('../services/sessionApi', () => ({
  saveResponses: vi.fn().mockResolvedValue([]),
  submitAttempt: vi.fn(),
  pauseAttempt: vi.fn().mockResolvedValue(undefined),
  postAttemptEvent: vi.fn().mockResolvedValue(undefined),
}));

import TestTakingView from './TestTakingView';
import { saveResponses, postAttemptEvent, pauseAttempt } from '../services/sessionApi';

function buildSession(remainingSeconds = 600, responses: EnvelopeResponse[] = []): SessionResult {
  return {
    mode: 'subject-wise',
    testId: 'test-1',
    testCode: 'LMN-NEET-SUBJ-BOT-000001',
    attemptId: 'attempt-1',
    attemptNo: 1,
    status: 'in_progress',
    serverNow: new Date().toISOString(),
    remainingSeconds,
    allowPause: true,
    test: { testId: 'test-1', title: 'Botany Practice', durationMinutes: 10 },
    hasRecycledItems: false,
    recycledItemCount: 0,
    sections: [{ testSectionId: 'sec-1', sectionName: 'BOT', sequenceNo: 1, questionCount: 2 }],
    questions: [
      {
        questionId: 'q1',
        testSectionId: 'sec-1',
        sequenceNo: 1,
        format: 'MCQ_SINGLE',
        marks: '4',
        negativeMarks: '1',
        stemText: 'What is the powerhouse of the cell?',
        stemTextTa: null,
        stemFormat: 'text',
        options: [
          { optionId: 'q1-a', optionLabel: 'A', optionText: 'Mitochondria', optionTextTa: null },
          { optionId: 'q1-b', optionLabel: 'B', optionText: 'Nucleus', optionTextTa: null },
        ],
        images: [],
      },
      {
        questionId: 'q2',
        testSectionId: 'sec-1',
        sequenceNo: 2,
        format: 'MCQ_SINGLE',
        marks: '4',
        negativeMarks: '1',
        stemText: 'Which pigment absorbs light for photosynthesis?',
        stemTextTa: null,
        stemFormat: 'text',
        options: [
          { optionId: 'q2-a', optionLabel: 'A', optionText: 'Chlorophyll', optionTextTa: null },
          { optionId: 'q2-b', optionLabel: 'B', optionText: 'Melanin', optionTextTa: null },
        ],
        images: [],
      },
    ],
    responses,
  };
}

function renderView(session: SessionResult, overrides: { onCancel?: () => void; onCompleteTest?: () => void } = {}) {
  return render(
    <LanguageProvider>
      <TestTakingView session={session} studentName="Test Student" onCancel={overrides.onCancel ?? vi.fn()} onCompleteTest={overrides.onCompleteTest ?? vi.fn()} />
    </LanguageProvider>
  );
}

describe('TestTakingView', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // vi.restoreAllMocks() in afterEach below clears the resolved-value
    // configuration set at vi.mock() factory time (not just call history),
    // so it must be re-established before every test rather than only once
    // at module load — otherwise a later test's mocks silently return
    // undefined instead of a resolved promise, which crashes any component
    // code that chains .catch() directly on the call (found live while
    // adding the B4/B7 tests below, not anticipated going in).
    vi.mocked(saveResponses).mockResolvedValue([]);
    vi.mocked(postAttemptEvent).mockResolvedValue(undefined);
    vi.mocked(pauseAttempt).mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders the first question and counts the timer down each second', async () => {
    renderView(buildSession(600));
    expect(screen.getByText(/What is the powerhouse of the cell\?/)).toBeInTheDocument();
    expect(screen.getByText(/TIME REMAINING: 10:00/)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByText(/TIME REMAINING: 09:59/)).toBeInTheDocument();
  });

  it('selecting an option updates the answered-count progress and marks the response dirty for autosave', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderView(buildSession(600));

    expect(screen.getByText('0 / 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Mitochondria/ }));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    // Autosave interval is 12s — nothing sent before it fires.
    expect(saveResponses).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });
    expect(saveResponses).toHaveBeenCalledWith('attempt-1', [expect.objectContaining({ questionId: 'q1', optionId: 'q1-a' })]);
  });

  it('Save & Next moves to the next question, and Previous moves back', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderView(buildSession(600));

    await user.click(screen.getByRole('button', { name: /Save & Next/i }));
    // AnimatePresence's exit/enter transition runs on rAF, which fake timers
    // intercept — advance past its 0.2s duration so the new question mounts.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(screen.getByText(/Which pigment absorbs light for photosynthesis\?/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Previous$/i }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(screen.getByText(/What is the powerhouse of the cell\?/)).toBeInTheDocument();
  });

  it('Clear Response is disabled until an option is selected, then clears the selection', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderView(buildSession(600));

    const clearButton = screen.getByRole('button', { name: /Clear Response/i });
    expect(clearButton).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Mitochondria/ }));
    expect(clearButton).not.toBeDisabled();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    await user.click(clearButton);
    expect(screen.getByText('0 / 2')).toBeInTheDocument();
  });

  it('Flag for Review toggles to Flagged for Review', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderView(buildSession(600));

    const flagButton = screen.getByRole('button', { name: /Flag for Review/i });
    await user.click(flagButton);
    expect(screen.getByRole('button', { name: /Flagged for Review/i })).toBeInTheDocument();
  });

  it('resume/refresh restores a previously saved answer and flag, and lands on the first unanswered question (C4)', async () => {
    // Test-layer hardening C4: the server already persisted this data before
    // this fix — the bug was purely that the client never read it back on
    // mount, always showing question 1 as blank regardless of what the
    // envelope actually carried. q1 was answered+flagged in a prior session;
    // q2 is still unanswered, so resume should land directly on q2 (not
    // question 1) while the question palette still reflects q1's restored
    // answered+flagged state. Asserted via the palette (always rendered
    // alongside the current question, no AnimatePresence transition to wait
    // out) rather than navigating back to q1, to avoid coupling this test to
    // framer-motion's animation timing under fake timers.
    renderView(
      buildSession(600, [
        { questionId: 'q1', selectedOptionId: 'q1-a', numericAnswer: null, isMarkedForReview: true, hasAnswered: true, timeSpentSeconds: 42 },
      ])
    );

    expect(screen.getByText(/Which pigment absorbs light for photosynthesis\?/)).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    const q1PaletteButton = screen.getAllByRole('button').find((b) => b.textContent?.trim() === '1');
    expect(q1PaletteButton).toBeDefined();
    // isFlagged && isAnswered both true renders the violet "flagged" style
    // (see TestTakingView.tsx's palette bgClass logic) — proves both
    // selectedAnswers and flaggedQuestions were actually seeded from
    // session.responses, not just that the starting index happened to skip
    // past q1.
    expect(q1PaletteButton!.className).toMatch(/violet/);
  });

  it('resume with everything answered lands on question 1, not out of bounds', async () => {
    renderView(
      buildSession(600, [
        { questionId: 'q1', selectedOptionId: 'q1-a', numericAnswer: null, isMarkedForReview: false, hasAnswered: true, timeSpentSeconds: 10 },
        { questionId: 'q2', selectedOptionId: 'q2-a', numericAnswer: null, isMarkedForReview: false, hasAnswered: true, timeSpentSeconds: 15 },
      ])
    );
    expect(screen.getByText(/What is the powerhouse of the cell\?/)).toBeInTheDocument();
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('auto-submits once the countdown reaches zero', async () => {
    const { submitAttempt } = await import('../services/sessionApi');
    vi.mocked(submitAttempt).mockResolvedValue({
      attemptId: 'attempt-1',
      correctCount: 0,
      incorrectCount: 0,
      unattemptedCount: 2,
      obtainedMarks: '0',
      totalMarks: '8',
    } as never);

    renderView(buildSession(1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(submitAttempt).toHaveBeenCalledWith('attempt-1');
  });

  it('logs tab_hidden/tab_visible attempt events on visibility changes (B4)', async () => {
    renderView(buildSession(600));
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(postAttemptEvent).toHaveBeenCalledWith('attempt-1', 'tab_hidden');

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(postAttemptEvent).toHaveBeenCalledWith('attempt-1', 'tab_visible', expect.objectContaining({ hiddenForMs: expect.any(Number) }));
  });

  it('shows the native leave-site confirmation on beforeunload while the attempt is active (B7)', async () => {
    renderView(buildSession(600));
    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    const prevented = !window.dispatchEvent(event);
    expect(prevented).toBe(true);
  });

  it('does not show the beforeunload confirmation once the test has auto-submitted (B7)', async () => {
    const { submitAttempt } = await import('../services/sessionApi');
    vi.mocked(submitAttempt).mockResolvedValue({
      attemptId: 'attempt-1',
      correctCount: 0,
      incorrectCount: 0,
      unattemptedCount: 2,
      obtainedMarks: '0',
      totalMarks: '8',
    } as never);

    renderView(buildSession(1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(submitAttempt).toHaveBeenCalledWith('attempt-1');

    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    const prevented = !window.dispatchEvent(event);
    expect(prevented).toBe(false);
  });

  it('routes a browser Back press through the same confirm-and-pause flow as Exit & Pause, and re-pushes history to absorb it (B1/B2/B10)', async () => {
    const onCancel = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const pushStateSpy = vi.spyOn(window.history, 'pushState');
    renderView(buildSession(600), { onCancel });

    // Mount itself pushes one throwaway entry so Back always has something
    // in-document to land on.
    expect(pushStateSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(confirmSpy).toHaveBeenCalled();
    // The handler re-pushes to neutralize the navigation, then follows
    // handleExitAndPause's real flow (flush -> pause -> onCancel).
    expect(pushStateSpy).toHaveBeenCalledTimes(2);
    expect(pauseAttempt).toHaveBeenCalledWith('attempt-1');
    expect(onCancel).toHaveBeenCalled();
  });

  it('does not re-prompt on popstate once the attempt is already exiting (e.g. mid-submit) (B1)', async () => {
    const { submitAttempt } = await import('../services/sessionApi');
    vi.mocked(submitAttempt).mockResolvedValue({
      attemptId: 'attempt-1',
      correctCount: 0,
      incorrectCount: 0,
      unattemptedCount: 2,
      obtainedMarks: '0',
      totalMarks: '8',
    } as never);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderView(buildSession(1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(submitAttempt).toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('warns when a second tab announces itself for the same attempt over BroadcastChannel (B5)', async () => {
    renderView(buildSession(600));
    expect(screen.queryByText(/also open in another tab/i)).not.toBeInTheDocument();

    // Simulate a second tab's own channel replying with an "ack" for the
    // same attempt — real BroadcastChannel delivery is cross-instance, so
    // exercising the component's own onmessage handler directly is the
    // faithful way to trigger it under jsdom.
    const channel = new BroadcastChannel('lumen_attempt_attempt-1');
    await act(async () => {
      channel.postMessage({ type: 'announce', tabId: 'other-tab' });
    });
    expect(await screen.findByText(/also open in another tab/i)).toBeInTheDocument();
    channel.close();
  });

  it('shows a non-blocking fullscreen banner (never covers the exam) when supported but not active, and it clears once fullscreen is (re-)entered (B6)', async () => {
    // Revised after a live "can't resume the paused test" regression traced
    // to this originally being a hard-blocking overlay — see the docstring
    // on TestTakingView.tsx's fullscreenSupported effect for the full story.
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true });
    Object.defineProperty(document.documentElement, 'requestFullscreen', { value: requestFullscreen, configurable: true });
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true, writable: true });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderView(buildSession(600));

    // Mounting itself makes a best-effort request (may be silently rejected
    // by real browsers with no live gesture — harmless either way here).
    expect(requestFullscreen).toHaveBeenCalled();

    const banner = await screen.findByText(/best exam experience/i);
    expect(banner).toBeInTheDocument();
    // The real regression: the question itself must remain fully usable
    // while the banner is showing, not hidden behind a blocking overlay.
    await user.click(screen.getByRole('button', { name: /Mitochondria/ }));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    const bannerButton = screen.getByRole('button', { name: 'Enter Fullscreen' });
    await user.click(bannerButton);
    expect(requestFullscreen).toHaveBeenCalledTimes(2);

    // Simulate the browser granting fullscreen: fullscreenElement becomes
    // set and the API fires its own change event.
    Object.defineProperty(document, 'fullscreenElement', { value: document.documentElement, configurable: true, writable: true });
    await act(async () => {
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    expect(screen.queryByText(/best exam experience/i)).not.toBeInTheDocument();
  });

  it('never shows the fullscreen banner when the Fullscreen API is unsupported, e.g. iOS Safari (B6)', async () => {
    Object.defineProperty(document, 'fullscreenEnabled', { value: false, configurable: true });
    // Simulates a browser with no Fullscreen API at all (e.g. iOS Safari).
    Object.defineProperty(document.documentElement, 'requestFullscreen', { value: undefined, configurable: true });

    renderView(buildSession(600));
    expect(screen.queryByText(/best exam experience/i)).not.toBeInTheDocument();
  });
});
