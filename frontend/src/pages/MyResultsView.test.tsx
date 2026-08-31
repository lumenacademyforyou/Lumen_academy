import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { LanguageProvider } from "../contexts/LanguageContext";
import type { AttemptEnvelope, AttemptSummary } from "../types";

// docs/test-engine-fix-prompt.md Defect 3, the last open item of that pass:
// "View Results on an attempt in PAUSED state routes to that paused attempt,
// not to a completed-results screen. Show the partial state (attempted /
// unattempted / marked counts) with Resume as the primary CTA and Submit now
// as secondary. Full scoring UI is only reachable from SUBMITTED."
//
// Before this, a paused row's only action was a View button disabled with the
// tooltip "Available once scored" — a visible dead end.

const { listMyAttempts, resumeSessionById, getEnvelope, submitAttempt, resumeAttempt } = vi.hoisted(() => ({
  listMyAttempts: vi.fn(),
  resumeSessionById: vi.fn(),
  getEnvelope: vi.fn(),
  submitAttempt: vi.fn(),
  resumeAttempt: vi.fn(),
}));

vi.mock("../services/sessionApi", () => ({ listMyAttempts, resumeSessionById, getEnvelope, submitAttempt, resumeAttempt }));
vi.mock("../services/pdfExport", () => ({ exportAnalyticsPdf: vi.fn() }));

import MyResultsView from "./MyResultsView";

function attempt(overrides: Partial<AttemptSummary> = {}): AttemptSummary {
  return {
    attemptId: "att-paused",
    testId: "test-1",
    testCode: "LMN-PHY-SUBJ-1",
    testTitle: "Physics Practice",
    mode: "subject-wise",
    durationMinutes: 20,
    attemptNo: 1,
    attemptState: "paused",
    startedAt: "2026-08-31T10:00:00.000Z",
    submittedAt: null,
    obtainedMarks: null,
    totalMarks: null,
    ...overrides,
  };
}

const ENVELOPE = {
  attemptId: "att-paused",
  attemptNo: 1,
  status: "paused",
  serverNow: "2026-08-31T10:05:00.000Z",
  remainingSeconds: 930,
  allowPause: true,
  test: { testId: "test-1", title: "Physics Practice", durationMinutes: 20 },
  testCode: "LMN-PHY-SUBJ-1",
  mode: "subject-wise",
  sections: [],
  questions: [{ questionId: "q1" }, { questionId: "q2" }, { questionId: "q3" }, { questionId: "q4" }],
  responses: [
    { questionId: "q1", selectedOptionId: "o1", numericAnswer: null, isMarkedForReview: false, hasAnswered: true, timeSpentSeconds: 30 },
    { questionId: "q2", selectedOptionId: null, numericAnswer: "42", isMarkedForReview: true, hasAnswered: true, timeSpentSeconds: 20 },
    { questionId: "q3", selectedOptionId: null, numericAnswer: null, isMarkedForReview: true, hasAnswered: false, timeSpentSeconds: 5 },
  ],
  hasRecycledItems: false,
  recycledItemCount: 0,
} as unknown as AttemptEnvelope;

const renderView = (onResumeAttempt = vi.fn()) => {
  render(
    <LanguageProvider>
      <MyResultsView onResumeAttempt={onResumeAttempt} />
    </LanguageProvider>
  );
  return onResumeAttempt;
};

beforeEach(() => {
  vi.clearAllMocks();
  listMyAttempts.mockResolvedValue([attempt()]);
  getEnvelope.mockResolvedValue(ENVELOPE);
  resumeSessionById.mockResolvedValue({ ...ENVELOPE, status: "in_progress", testId: "test-1" });
  submitAttempt.mockResolvedValue({});
});

describe("MyResultsView — paused attempts (Defect 3)", () => {
  it("offers a Resume button on a paused row", async () => {
    renderView();
    expect(await screen.findByRole("button", { name: /Resume/ })).toBeInTheDocument();
  });

  it("resumes straight from the row and hands the live session up to the router", async () => {
    const onResume = renderView();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /Resume/ }));

    await waitFor(() => expect(resumeSessionById).toHaveBeenCalledWith("att-paused"));
    await waitFor(() => expect(onResume).toHaveBeenCalledWith(expect.objectContaining({ attemptId: "att-paused", status: "in_progress" })));
  });

  it("shows no Resume button on a scored attempt", async () => {
    listMyAttempts.mockResolvedValue([attempt({ attemptState: "scored", obtainedMarks: "12", totalMarks: "20", submittedAt: "2026-08-31T10:20:00.000Z" })]);
    renderView();
    await screen.findByRole("button", { name: "View" });
    expect(screen.queryByRole("button", { name: /Resume/ })).not.toBeInTheDocument();
  });

  it("View on a paused attempt opens the partial-state screen, not the scored report", async () => {
    renderView();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "View" }));

    // Partial state, with the server's own counts: 2 answered of 4, 2 marked.
    expect(await screen.findByText("Answered")).toBeInTheDocument();
    expect(screen.getByText("Unanswered")).toBeInTheDocument();
    expect(screen.getByText("Marked for review")).toBeInTheDocument();
    expect(screen.getByText("2 / 4")).toBeInTheDocument();

    // Resume primary, Submit now secondary — and no score anywhere.
    expect(screen.getByRole("button", { name: /Resume Test/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit now" })).toBeInTheDocument();
  });

  it("opening the partial-state screen never resumes the attempt or restarts its clock", async () => {
    renderView();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "View" }));
    await screen.findByText("Answered");

    // Reading your own progress must cost none of your remaining time: the
    // envelope is fetched, but nothing transitions the attempt out of paused.
    expect(getEnvelope).toHaveBeenCalledWith("att-paused");
    expect(resumeAttempt).not.toHaveBeenCalled();
    expect(resumeSessionById).not.toHaveBeenCalled();
  });

  it("asks before submitting from the partial-state screen, and says what will be skipped", async () => {
    renderView();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "View" }));
    await user.click(await screen.findByRole("button", { name: "Submit now" }));

    // Not submitted yet — the confirmation stands between the two.
    expect(submitAttempt).not.toHaveBeenCalled();
    expect(screen.getByText("Submit this test now?")).toBeInTheDocument();
    expect(screen.getByText(/2 questions are still unanswered/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Yes, submit" }));
    await waitFor(() => expect(submitAttempt).toHaveBeenCalledWith("att-paused"));
  });

  it("refetches the list after submitting, so the row stops claiming to be paused", async () => {
    renderView();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "View" }));
    await user.click(await screen.findByRole("button", { name: "Submit now" }));

    listMyAttempts.mockResolvedValue([attempt({ attemptState: "scored", obtainedMarks: "8", totalMarks: "16" })]);
    await user.click(screen.getByRole("button", { name: "Yes, submit" }));

    await waitFor(() => expect(listMyAttempts).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Resume/ })).not.toBeInTheDocument());
  });

  it("surfaces a failed resume instead of silently doing nothing", async () => {
    resumeSessionById.mockRejectedValue(new Error("This test has already expired."));
    const onResume = renderView();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /Resume/ }));

    expect(await screen.findByText("This test has already expired.")).toBeInTheDocument();
    expect(onResume).not.toHaveBeenCalled();
  });
});
