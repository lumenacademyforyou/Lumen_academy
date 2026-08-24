import React, { useEffect, useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { MeProfile, getMissingProfileFields } from "../../lib/meApi";
import { Notification, fetchNotifications, markAllNotificationsRead } from "../../lib/notificationsApi";

interface NotificationBellProps {
  profile: MeProfile | null;
}

// Used to just be a profile-completeness facade dressed up as a
// notification center — the bell always opened to one hardcoded nudge,
// regardless of whether the user had ever done anything, and nothing else
// could ever appear there. It now reads real rows from learn.notification
// (backend/routes/learn.routes.ts's /learn/notifications) and keeps the
// profile nudge as one *additional*, genuinely-computed item alongside them
// rather than the whole feature.
export default function NotificationBell({ profile }: NotificationBellProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const missingFields = getMissingProfileFields(profile);
  const hasIncompleteProfile = missingFields.length > 0;

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    setLoading(true);
    fetchNotifications()
      .then((rows) => {
        if (!cancelled) setNotifications(rows);
      })
      .catch((err) => console.error("Failed to load notifications:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;
  const hasAnything = hasIncompleteProfile || notifications.length > 0;

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    } catch (err) {
      console.error("Failed to mark notifications read:", err);
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors relative cursor-pointer flex items-center justify-center"
        title="Notifications"
      >
        <span className="material-symbols-outlined text-slate-700 dark:text-slate-200 text-[24px]">
          notifications
        </span>
        {(hasIncompleteProfile || unreadCount > 0) && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-[var(--navy)]"></span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200 max-h-[70vh] overflow-y-auto">
            <h4 className="font-bold text-sm text-[#00243B] dark:text-white mb-3 flex justify-between items-center">
              <span>{t("Notifications")}</span>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <span
                    className="text-xs text-[var(--teal)] dark:text-[#FCB824] font-semibold cursor-pointer hover:underline"
                    onClick={handleMarkAllRead}
                  >
                    {t("Mark all read")}
                  </span>
                )}
                <span
                  className="text-xs text-slate-400 font-semibold cursor-pointer hover:underline"
                  onClick={() => setIsOpen(false)}
                >
                  Close
                </span>
              </div>
            </h4>

            {hasAnything ? (
              <div className="space-y-1.5">
                {hasIncompleteProfile && (
                  <div
                    onClick={() => {
                      navigate("/profile");
                      setIsOpen(false);
                    }}
                    className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl text-xs transition-colors border-l-2 border-[#FCB824] cursor-pointer"
                  >
                    <p className="font-semibold text-[#00243B] dark:text-white">
                      {t("Complete Your Profile")}
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                      {t("Missing")}: {missingFields.join(", ")}
                    </p>
                  </div>
                )}

                {notifications.map((n) => (
                  <div
                    key={n.notification_id}
                    className={`p-2.5 rounded-xl text-xs transition-colors border-l-2 ${
                      n.read_at ? "border-slate-200 dark:border-slate-700" : "border-[var(--teal)] dark:border-[#FCB824]"
                    }`}
                  >
                    <p className="font-semibold text-[#00243B] dark:text-white">
                      {n.payload?.title || n.template_key || t("Notification")}
                    </p>
                    {n.payload?.body && (
                      <p className="text-slate-500 dark:text-slate-400 mt-0.5">{n.payload.body}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 flex flex-col items-center justify-center text-center">
                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-[28px] mb-1.5">
                  notifications_off
                </span>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {loading ? t("Loading...") : t("You're all caught up")}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
