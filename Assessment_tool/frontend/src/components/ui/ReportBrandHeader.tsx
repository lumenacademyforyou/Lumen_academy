import React from "react";
import LumenLogo from "./LumenLogo";

interface ReportBrandHeaderProps {
  reportTitle: string;
  subtitle?: string;
}

// P1-12 (docs/assessment-tool-fix-prompt.md) — every generated report (PDF
// export via services/pdfExport.ts's html2canvas DOM capture, or just
// viewed on screen) must carry the same LUMEN ACADEMY branding as the
// existing question-paper documents: logo, "LUMEN ACADEMY" heading, the
// app's actual tagline (matches Header.tsx/App.tsx's footer verbatim —
// "Empowering Future through Learning", not a paraphrase), teal/navy with
// gold accents. One shared header so every report (analytics, attempt
// review, and any future one) stays visually consistent instead of each
// screen re-deciding its own masthead.
export default function ReportBrandHeader({ reportTitle, subtitle }: ReportBrandHeaderProps) {
  return (
    <div className="flex items-center gap-4 pb-5 mb-6 border-b-2 border-[var(--teal)] dark:border-[#FCB824]">
      <LumenLogo className="w-14 h-14 shrink-0" />
      <div className="min-w-0 flex-1">
        <span className="font-black text-xl text-[var(--navy)] dark:text-white tracking-tight block leading-none">LUMEN ACADEMY</span>
        <span className="text-[10px] font-bold text-[var(--teal)] dark:text-[#FCB824] tracking-wider mt-1 block uppercase">Empowering Future through Learning</span>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-[#00243B] dark:text-white">{reportTitle}</p>
        {subtitle && <p className="text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
    </div>
  );
}
