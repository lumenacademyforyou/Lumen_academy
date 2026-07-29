import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

export interface SlidingTabItem {
  to: string;
  label: string;
  icon?: LucideIcon;
  end?: boolean;
}

interface Props {
  items: SlidingTabItem[];
  variant?: "underline" | "pill";
  className?: string;
  ariaLabel?: string;
}

/**
 * NavLink tab bar with an indicator that glides between tabs instead of
 * popping. Position/width are measured from the DOM so it stays correct
 * regardless of label length, icons, or container resizes.
 */
export function SlidingTabs({ items, variant = "underline", className = "", ariaLabel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number; ready: boolean }>({
    left: 0,
    width: 0,
    ready: false,
  });
  const location = useLocation();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const activeEl = container.querySelector<HTMLElement>('[data-tab-active="true"]');
      if (activeEl) {
        setIndicator({ left: activeEl.offsetLeft, width: activeEl.offsetWidth, ready: true });
      }
    };

    measure();
    window.addEventListener("resize", measure);

    // Web fonts (Inter/Manrope, loaded with font-display: swap) can shift label
    // widths after the first paint — re-measure once they're actually in place,
    // otherwise the indicator can end up sized for the fallback font metrics.
    document.fonts?.ready.then(measure).catch(() => {});

    const observer = new ResizeObserver(measure);
    observer.observe(container);

    return () => {
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [location.pathname, items.length]);

  const isPill = variant === "pill";

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center gap-1 ${isPill ? "" : "gap-5 border-b border-border-soft"} ${className}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const active =
          location.pathname === item.to ||
          (!item.end && location.pathname.startsWith(`${item.to}/`));
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            data-tab-active={active ? "true" : undefined}
            className={() =>
              isPill
                ? `relative z-10 flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors duration-200 ${
                    active ? "text-white" : "text-muted hover:bg-ivory hover:text-navy-text"
                  }`
                : `relative z-10 flex items-center gap-1.5 whitespace-nowrap pb-2.5 text-sm font-semibold transition-colors duration-200 ${
                    active ? "text-teal" : "text-muted hover:text-navy-text"
                  }`
            }
          >
            {Icon && <Icon size={14} />}
            {item.label}
          </NavLink>
        );
      })}

      {indicator.ready && isPill && (
        <span
          className="tab-indicator absolute top-0 h-full rounded-full bg-teal shadow-sm"
          style={{ left: indicator.left, width: indicator.width }}
          aria-hidden
        />
      )}
      {indicator.ready && !isPill && (
        <span
          className="tab-indicator absolute -bottom-px h-[2px] rounded-full bg-teal"
          style={{ left: indicator.left, width: indicator.width }}
          aria-hidden
        />
      )}
    </div>
  );
}
