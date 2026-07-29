import { CalendarDays, CalendarRange, ListTodo, TrendingUp } from "lucide-react";
import { SlidingTabs, type SlidingTabItem } from "../layout/SlidingTabs";

const TABS: SlidingTabItem[] = [
  { to: "/study-plan/today", label: "Today", icon: ListTodo, end: true },
  { to: "/study-plan/week", label: "Week", icon: CalendarDays, end: true },
  { to: "/study-plan/calendar", label: "Calendar", icon: CalendarRange, end: true },
  { to: "/study-plan/progress", label: "Progress", icon: TrendingUp, end: true },
];

export function StudyPlanTabs() {
  return <SlidingTabs items={TABS} variant="underline" className="mb-5" ariaLabel="Study plan views" />;
}
