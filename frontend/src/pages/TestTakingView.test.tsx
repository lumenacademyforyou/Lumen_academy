import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '../contexts/LanguageContext';
import type { SessionResult } from '../types';

// Phase F2 (LA-APP-COMPLETION-001) — real behaviour for the test workspace's
// timer, palette/progress state, and autosave, not just "it renders". Mocks
// only the network boundary (sessionApi) so the component's own state
// machine (selection, navigation, flagging, dirty-tracking, countdown) runs
// for real.
vi.mock('../services/sessionApi', () => ({
  saveResponses: vi.fn().mockResolvedValue([]),
  submitAttempt: vi.fn(),
}));

import TestTakingView from './TestTakingView';
import { saveResponses } from '../services/sessionApi';

function buildSession(remainingSeconds = 600): SessionResult {
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
    responses: [],
  };
}

function renderView(session: SessionResult) {
  return render(
    <LanguageProvider>
      <TestTakingView session={session} studentName="Test Student" onCancel={vi.fn()} onCompleteTest={vi.fn()} />
    </LanguageProvider>
  );
}

describe('TestTakingView', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
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
});
