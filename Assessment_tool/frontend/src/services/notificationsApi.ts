import { apiFetch } from "./api.js";

// Mirrors db/learn/notification/notification.model.ts. The table has no
// created_at — sent_at is its only timestamp, and it's nullable (see that
// model file's comment); the backend already orders by it, most-recent
// first, with unsent rows trailing.
export interface Notification {
  notification_id: string;
  user_id: string;
  channel: string | null;
  template_key: string | null;
  payload: { title?: string; body?: string } | null;
  sent_at: string | null;
  read_at: string | null;
}

export async function fetchNotifications(): Promise<Notification[]> {
  const { data } = await apiFetch<{ data: Notification[] }>("/learn/notifications");
  return data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiFetch<void>("/learn/notifications/read-all", { method: "PATCH" });
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await apiFetch<void>(`/learn/notifications/${notificationId}`, {
    method: "PATCH",
    body: JSON.stringify({ read_at: new Date().toISOString() }),
  });
}

// P0-5: single-item "Clear" — a real delete (backend/lib/dbCrudRouter.ts's
// makeOwnedCrudRouter already exposes DELETE /:id for every owned entity,
// notifications included; this was just never called from the frontend).
export async function clearNotification(notificationId: string): Promise<void> {
  await apiFetch<void>(`/learn/notifications/${notificationId}`, { method: "DELETE" });
}

// "Clear all" — backend/src/routes/learn.routes.ts's bare DELETE /notifications.
export async function clearAllNotifications(): Promise<void> {
  await apiFetch<void>("/learn/notifications", { method: "DELETE" });
}
