/**
 * Compact header logo mark. Expresses the "path toward a goal" idea
 * abstractly (an ascending path with a milestone point) rather than
 * reproducing the full mountain/sun/graduation-cap illustration from
 * the primary Lumen Academy logo.
 */
export function LumenMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--color-navy)" />
      <path
        d="M7 22 L13 14 L18 18 L25 8"
        stroke="var(--color-gold)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="25" cy="8" r="2.4" fill="var(--color-gold)" />
    </svg>
  );
}
