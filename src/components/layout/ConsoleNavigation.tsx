import { LayoutGrid, CalendarClock, BookOpenText, ClipboardList, BarChart3, History } from "lucide-react";
import { SlidingTabs, type SlidingTabItem } from "./SlidingTabs";

const NAV_ITEMS: SlidingTabItem[] = [
  { to: "/overview", label: "Overview", icon: LayoutGrid, end: true },
  { to: "/study-plan", label: "Study Plan", icon: CalendarClock },
  { to: "/syllabus", label: "Syllabus", icon: BookOpenText },
  { to: "/build-test", label: "Build Test", icon: ClipboardList, end: true },
  { to: "/results", label: "Results", icon: BarChart3, end: true },
  { to: "/test-history", label: "Test History", icon: History, end: true },
];

export function ConsoleNavigation() {
  return (
    <div className="overflow-x-auto pb-3">
      <SlidingTabs items={NAV_ITEMS} variant="pill" className="w-max" ariaLabel="Primary" />
    </div>
  );
}
