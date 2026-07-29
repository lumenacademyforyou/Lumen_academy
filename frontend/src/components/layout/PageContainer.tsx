import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

export function PageContainer({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <main
      key={location.pathname}
      className="mx-auto max-w-7xl animate-fade-in-up px-4 py-6 sm:px-6 sm:py-8"
    >
      {children}
    </main>
  );
}
