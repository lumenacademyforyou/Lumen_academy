import type { LucideIcon } from "lucide-react";
import { CalendarCheck } from "lucide-react";

export function EmptySessions({
  title,
  message,
  icon: Icon = CalendarCheck,
}: {
  title: string;
  message: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="card animate-fade-in-up flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="animate-pop-in flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F0F8F8]">
        <Icon size={24} className="text-aqua" />
      </span>
      <p className="text-sm font-semibold text-navy-text">{title}</p>
      <p className="max-w-sm text-sm text-muted">{message}</p>
    </div>
  );
}
