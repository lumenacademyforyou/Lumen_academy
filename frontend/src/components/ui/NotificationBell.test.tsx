import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LanguageProvider } from "../../contexts/LanguageContext";
import type { MeProfile } from "../../services/meApi";
import type { Notification } from "../../services/notificationsApi";

// Regression coverage for P0-5 (docs/assessment-tool-fix-prompt.md):
// mark-as-read and clear/clear-all must update local state immediately and
// persist server-side, with rollback if the server call fails.

const { fetchNotifications, markAllNotificationsRead, markNotificationRead, clearNotification, clearAllNotifications } = vi.hoisted(() => ({
  fetchNotifications: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
  clearNotification: vi.fn(),
  clearAllNotifications: vi.fn(),
}));

vi.mock("../../services/notificationsApi", () => ({
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  clearNotification,
  clearAllNotifications,
}));

import NotificationBell from "./NotificationBell";

const COMPLETE_PROFILE: MeProfile = {
  appUserId: "u1",
  authUserId: "au1",
  memberCode: null,
  email: "student@example.com",
  mobileNumber: null,
  fullName: "Botany Student",
  preferredLanguage: "en",
  status: "active",
  primaryRole: "student",
  lastLoginAt: null,
  institution: null,
  roles: [],
  targetExam: "NEET",
  locale: "en",
  studentProfile: { targetYear: 2027, classLevel: "12", guardianContact: null, dailyStudyMinutes: null, onboardingState: "complete" },
};

function makeNotification(overrides: Partial<Notification>): Notification {
  return {
    notification_id: "n1",
    user_id: "u1",
    channel: "in_app",
    template_key: null,
    payload: { title: "Test reminder", body: "Your mock test starts soon." },
    sent_at: new Date().toISOString(),
    read_at: null,
    ...overrides,
  };
}

function renderBell() {
  return render(
    <MemoryRouter>
      <LanguageProvider>
        <NotificationBell profile={COMPLETE_PROFILE} />
      </LanguageProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NotificationBell — mark as read / clear (P0-5)", () => {
  it("marks a single notification read on click, updating the unread badge immediately", async () => {
    fetchNotifications.mockResolvedValue([makeNotification({ notification_id: "n1", read_at: null })]);
    markNotificationRead.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderBell();

    await user.click(screen.getByTitle("Notifications"));
    // Unread badge dot present before the click.
    expect(document.querySelector(".bg-rose-500")).toBeTruthy();

    await user.click(screen.getByText("Test reminder"));

    await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith("n1"));
    // Badge gone once the (now-read) notification is the only one.
    await waitFor(() => expect(document.querySelector(".bg-rose-500")).toBeFalsy());
  });

  it("rolls back the read-state update if the server call fails", async () => {
    fetchNotifications.mockResolvedValue([makeNotification({ notification_id: "n1", read_at: null })]);
    markNotificationRead.mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    renderBell();

    await user.click(screen.getByTitle("Notifications"));
    await user.click(screen.getByText("Test reminder"));

    await waitFor(() => expect(markNotificationRead).toHaveBeenCalled());
    // Rolled back — badge dot is back.
    await waitFor(() => expect(document.querySelector(".bg-rose-500")).toBeTruthy());
  });

  it("clears a single notification and removes it from the list", async () => {
    fetchNotifications.mockResolvedValue([makeNotification({ notification_id: "n1" })]);
    clearNotification.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderBell();

    await user.click(screen.getByTitle("Notifications"));
    await user.click(screen.getByLabelText("Clear"));

    await waitFor(() => expect(clearNotification).toHaveBeenCalledWith("n1"));
    expect(screen.queryByText("Test reminder")).not.toBeInTheDocument();
    expect(screen.getByText("You're all caught up")).toBeInTheDocument();
  });

  it("clears all notifications via the bulk action, persisted server-side", async () => {
    fetchNotifications.mockResolvedValue([makeNotification({ notification_id: "n1" }), makeNotification({ notification_id: "n2", payload: { title: "Second" } })]);
    clearAllNotifications.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderBell();

    await user.click(screen.getByTitle("Notifications"));
    await user.click(screen.getByText("Clear all"));

    await waitFor(() => expect(clearAllNotifications).toHaveBeenCalledTimes(1));
    expect(screen.getByText("You're all caught up")).toBeInTheDocument();
  });

  it('"Mark all read" is optimistic with rollback on failure', async () => {
    fetchNotifications.mockResolvedValue([makeNotification({ notification_id: "n1", read_at: null })]);
    markAllNotificationsRead.mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    renderBell();

    await user.click(screen.getByTitle("Notifications"));
    await user.click(screen.getByText("Mark all read"));

    await waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalledTimes(1));
    // Rolled back to unread.
    await waitFor(() => expect(document.querySelector(".bg-rose-500")).toBeTruthy());
  });
});
