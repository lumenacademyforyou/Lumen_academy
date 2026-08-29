import React, { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { listMyAttempts } from "../services/sessionApi";
import { exportAnalyticsPdf } from "../services/pdfExport";
import type { AttemptSummary } from "../types";
import { pluralize } from "../utils/pluralize";

// P2-13: same code-splitting reasoning as DashboardView.tsx — recharts +
// jsPDF/html2canvas only load once a report is actually opened.
const AttemptReviewView = lazy(() => import("./AttemptReviewView"));

type ModeFilter = "all" | "subject-wise" | "full-mock" | "custom";
type SortKey = "date" | "score" | "testTitle";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 10;

const MODE_LABEL: Record<AttemptSummary["mode"], string> = {
  "subject-wise": "Practice",
  "full-mock": "Full Mock",
  custom: "Custom",
};

const STATE_LABEL: Record<string, string> = {
  in_progress: "In Progress",
  paused: "Paused",
  submitted: "Submitted",
  scored: "Scored",
  abandoned: "Abandoned",
};

const STATE_BADGE_CLASS: Record<string, string> = {
  in_progress: "bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400",
  paused: "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400",
  submitted: "bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400",
  scored: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400",
  abandoned: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
};

// P1-11 (docs/assessment-tool-fix-prompt.md) — "View results": every test
// the user has ever attempted, any state, sortable/filterable/paginated,
// each row opening the detailed report (AttemptReviewView, which item 7's
// IRT section and item 10's fuller report both already live in) with a
// Download report action.
export default function MyResultsView() {
  const { t } = useLanguage();
  const [attempts, setAttempts] = useState<AttemptSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  const [selectedAttempt, setSelectedAttempt] = useState<AttemptSummary | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMyAttempts()
      .then((data) => {
        if (!cancelled) setAttempts(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load your results.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!attempts) return [];
    return attempts.filter((a) => {
      if (modeFilter !== "all" && a.mode !== modeFilter) return false;
      const dateStr = a.submittedAt ?? a.startedAt;
      if (dateFrom && (!dateStr || dateStr < dateFrom)) return false;
      if (dateTo && (!dateStr || dateStr > `${dateTo}T23:59:59`)) return false;
      return true;
    });
  }, [attempts, modeFilter, dateFrom, dateTo]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      if (sortKey === "testTitle") return a.testTitle.localeCompare(b.testTitle) * dir;
      if (sortKey === "score") {
        const av = a.obtainedMarks !== null ? Number(a.obtainedMarks) : -Infinity;
        const bv = b.obtainedMarks !== null ? Number(b.obtainedMarks) : -Infinity;
        return (av - bv) * dir;
      }
      const ad = a.submittedAt ?? a.startedAt ?? "";
      const bd = b.submittedAt ?? b.startedAt ?? "";
      return ad.localeCompare(bd) * dir;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageSlice = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [modeFilter, dateFrom, dateTo, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "testTitle" ? "asc" : "desc");
    }
  };

  const handleDownload = async (attempt: AttemptSummary) => {
    if (attempt.attemptState !== "scored") return;
    setDownloadingId(attempt.attemptId);
    setSelectedAttempt(attempt);
    // The report needs to actually be on screen for the PDF capture to have
    // something to render — mount it, wait a beat for its own data fetch +
    // paint, then capture. exportAnalyticsPdf itself throws a clear error
    // if the element never appears.
    setTimeout(async () => {
      try {
        await exportAnalyticsPdf("attempt-report-content", `Lumen_Academy_${attempt.testTitle.replace(/\s+/g, "_")}.pdf`);
      } catch (err) {
        console.error("Failed to download report PDF:", err);
      } finally {
        setDownloadingId(null);
      }
    }, 800);
  };

  if (selectedAttempt) {
    // AttemptReviewView owns its own id="attempt-report-content" + Download
    // PDF button now (P1-12) — nothing extra to wrap here.
    return (
      <Suspense fallback={<div className="p-10 text-center text-sm text-slate-400 font-semibold">{t("Loading...")}</div>}>
        <AttemptReviewView attemptId={selectedAttempt.attemptId} testTitle={selectedAttempt.testTitle} onBack={() => setSelectedAttempt(null)} />
      </Suspense>
    );
  }

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto animate-in fade-in duration-300 pb-12">
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-[#00243B] dark:text-white">{t("View Results")}</h2>
        <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">{t("Every test you've attempted, in one place")}</p>
      </div>

      <div className="flex flex-wrap items-end gap-4 p-4 bg-white dark:bg-[var(--navy)] rounded-2xl border border-slate-200 dark:border-slate-700">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("Type")}</label>
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value as ModeFilter)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-[#00243B] dark:text-white outline-none"
          >
            <option value="all">{t("All Types")}</option>
            <option value="subject-wise">{t("Practice")}</option>
            <option value="full-mock">{t("Full Mock")}</option>
            <option value="custom">{t("Custom")}</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("From")}</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-[#00243B] dark:text-white outline-none" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("To")}</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-[#00243B] dark:text-white outline-none" />
        </div>
        {(modeFilter !== "all" || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setModeFilter("all");
              setDateFrom("");
              setDateTo("");
            }}
            className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-[var(--teal)] dark:hover:text-[#FCB824] cursor-pointer"
          >
            {t("Clear filters")}
          </button>
        )}
      </div>

      {error && (
        <div className="p-6 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-800 text-sm text-rose-700 dark:text-rose-300">{error}</div>
      )}

      {!error && !attempts && <div className="p-10 text-center text-sm text-slate-400 font-semibold">{t("Loading...")}</div>}

      {!error && attempts && (
        <div className="bg-white dark:bg-[var(--navy)] rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="p-3.5 cursor-pointer select-none" onClick={() => toggleSort("testTitle")}>
                    {t("Test")} {sortKey === "testTitle" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="p-3.5">{t("Type")}</th>
                  <th className="p-3.5 cursor-pointer select-none" onClick={() => toggleSort("date")}>
                    {t("Date")} {sortKey === "date" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="p-3.5 cursor-pointer select-none" onClick={() => toggleSort("score")}>
                    {t("Score")} {sortKey === "score" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="p-3.5">{t("Duration")}</th>
                  <th className="p-3.5">{t("Status")}</th>
                  <th className="p-3.5">{t("Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {pageSlice.map((a) => {
                  const dateStr = a.submittedAt ?? a.startedAt;
                  const elapsedMinutes = a.startedAt && a.submittedAt ? Math.round((new Date(a.submittedAt).getTime() - new Date(a.startedAt).getTime()) / 60000) : null;
                  const canOpen = a.attemptState === "scored";
                  return (
                    <tr key={a.attemptId} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-900/30">
                      <td className="p-3.5 font-semibold text-[#00243B] dark:text-white max-w-[220px] truncate">{a.testTitle}</td>
                      <td className="p-3.5">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{t(MODE_LABEL[a.mode])}</span>
                      </td>
                      <td className="p-3.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">{dateStr ? new Date(dateStr).toLocaleDateString() : "—"}</td>
                      <td className="p-3.5 font-semibold text-[#00243B] dark:text-white whitespace-nowrap">
                        {a.obtainedMarks !== null && a.totalMarks !== null ? `${a.obtainedMarks}/${a.totalMarks}` : "—"}
                      </td>
                      <td className="p-3.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {elapsedMinutes !== null ? `${elapsedMinutes}${t("m")}` : a.durationMinutes ? `${a.durationMinutes}${t("m")} (${t("allotted")})` : "—"}
                      </td>
                      <td className="p-3.5">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${STATE_BADGE_CLASS[a.attemptState] ?? "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
                          {t(STATE_LABEL[a.attemptState] ?? a.attemptState)}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedAttempt(a)}
                            disabled={!canOpen}
                            title={canOpen ? undefined : t("Available once scored")}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-[#00243B] dark:bg-[#FCB824] text-white dark:text-[#00243B] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            {t("View")}
                          </button>
                          <button
                            onClick={() => handleDownload(a)}
                            disabled={!canOpen || downloadingId === a.attemptId}
                            title={canOpen ? undefined : t("Available once scored")}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-[var(--teal)] dark:hover:text-[#FCB824] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-base">{downloadingId === a.attemptId ? "hourglass_empty" : "download"}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {pageSlice.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-400 text-sm font-semibold">
                      {attempts.length === 0 ? t("You haven't attempted any tests yet.") : t("No results match these filters.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {sorted.length > 0 && (
            <div className="flex items-center justify-between p-4 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span>
                {sorted.length} {pluralize(sorted.length, "result", "results")}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {t("Previous")}
                </button>
                <span>
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {t("Next")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
