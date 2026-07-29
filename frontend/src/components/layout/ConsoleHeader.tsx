import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { ConsoleNavigation } from "./ConsoleNavigation";

export function ConsoleHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border-soft bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 pt-4 sm:px-6">
        <Link to="/overview" className="group flex items-center gap-2.5 pb-4 transition-transform duration-200 hover:-translate-y-px">
  <img src="\logo2.png" alt="Lumen Academy" className="h-8 w-auto transition-transform duration-200 group-hover:scale-105" />
  <span className="text-[15px] font-extrabold tracking-wide text-navy">
    LUMEN <span className="font-semibold text-teal">ACADEMY</span>
  </span>
</Link>

        <button
          type="button"
          className="mb-4 flex items-center gap-2 rounded-full border border-border-soft bg-white py-1 pl-1 pr-3 text-sm font-medium text-navy-text transition-all duration-200 hover:border-teal hover:shadow-sm"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal text-xs font-bold text-white">
            SK
          </span>
          <span className="hidden sm:inline">Santhoshkumar</span>
          <ChevronDown size={14} className="text-muted" />
        </button>
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <ConsoleNavigation />
      </div>
    </header>
  );
}
