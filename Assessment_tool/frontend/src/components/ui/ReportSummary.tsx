import React, { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from "recharts";
import { useLanguage } from "../../contexts/LanguageContext";
import { getAttemptScorecardDetail, getAttemptCohortComparison } from "../../services/sessionApi";
import { useDashboardAnalytics } from "../../hooks/useDashboardAnalytics";
import type { DetailedScorecardResponse, CohortComparison } from "../../types";
import { pluralize } from "../../utils/pluralize";

interface ReportSummaryProps {
  attemptId: string;
  attemptedCount: number;
  unattemptedCount: number;
}

function sectionStrength(accuracyPercent: number): { label: string; className: string } {
  if (accuracyPercent >= 75) return { label: "Strength", className: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400" };
  if (accuracyPercent < 50) return { label: "Needs Improvement", className: "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400" };
  return { label: "Developing", className: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300" };
}

// P1-10 (docs/assessment-tool-fix-prompt.md) — "a proper report": overall
// score/accuracy/attempted-vs-unattempted/time-taken-vs-allotted,
// section-wise breakdown with strengths/areas to improve, and comparison
// across attempts + against the cohort average. Question-level review lives
// in AttemptReviewView itself (already existed); the IRT section is
// IrtSection. This is the summary piece that was missing entirely.
export default function ReportSummary({ attemptId, attemptedCount, unattemptedCount }: ReportSummaryProps) {
  const { t } = useLanguage();
  const [detail, setDetail] = useState<DetailedScorecardResponse | null>(null);
  const [cohort, setCohort] = useState<CohortComparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { analytics: trendAnalytics } = useDashboardAnalytics();

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setError(null);
    getAttemptScorecardDetail(attemptId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load the scorecard.");
      });
    getAttemptCohortComparison(attemptId)
      .then((data) => {
        if (!cancelled) setCohort(data);
      })
      .catch(() => {
        // Cohort comparison is a nice-to-have addition, not core to the
        // report — a failed fetch just means that one card doesn't render.
      });
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  if (error) {
    return <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-sm text-rose-700 dark:text-rose-300">{error}</div>;
  }
  if (!detail) {
    return <div className="p-10 text-center text-sm text-slate-400 font-semibold">{t("Loading...")}</div>;
  }

  const { scorecard, sectionScores, timing } = detail;
  const accuracy = scorecard.accuracy_percent !== null ? Number(scorecard.accuracy_percent) : null;
  const elapsedMinutes = timing?.started_at && timing?.submitted_at ? Math.round((new Date(timing.submitted_at).getTime() - new Date(timing.started_at).getTime()) / 60000) : null;

  const trendData = (trendAnalytics?.scoreTrend ?? []).map((p) => ({
    date: new Date(p.submittedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    accuracy: Number(p.accuracyPercent),
    isCurrent: p.attemptId === attemptId,
  }));
  const currentPoint = trendData.find((p) => p.isCurrent);

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 text-center">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Overall Score")}</span>
          <span className="text-xl font-black text-[#00243B] dark:text-white">
            {scorecard.obtained_marks ?? "—"}/{scorecard.total_marks ?? "—"}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 text-center">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Accuracy")}</span>
          <span className="text-xl font-black text-[#00243B] dark:text-white">{accuracy !== null ? `${accuracy}%` : "—"}</span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 text-center">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Attempted")}</span>
          <span className="text-xl font-black text-[#00243B] dark:text-white">
            {attemptedCount} / {attemptedCount + unattemptedCount}
          </span>
          <span className="block text-[10px] text-slate-400 mt-0.5">
            {unattemptedCount} {t(pluralize(unattemptedCount, "skipped", "skipped"))}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 text-center">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Time Taken")}</span>
          <span className="text-xl font-black text-[#00243B] dark:text-white">
            {elapsedMinutes !== null ? `${elapsedMinutes}${t("m")}` : "—"}
          </span>
          {timing?.allotted_minutes && (
            <span className="block text-[10px] text-slate-400 mt-0.5">
              {t("of")} {timing.allotted_minutes}
              {t("m")} {t("allotted")}
            </span>
          )}
        </div>
      </div>

      {/* Section-wise breakdown */}
      {sectionScores.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">{t("Section-wise Breakdown")}</h4>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/40 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="p-3">{t("Section")}</th>
                  <th className="p-3">{t("Correct")}</th>
                  <th className="p-3">{t("Attempted")}</th>
                  <th className="p-3">{t("Accuracy")}</th>
                  <th className="p-3">{t("Avg Time")}</th>
                  <th className="p-3">{t("Assessment")}</th>
                </tr>
              </thead>
              <tbody>
                {sectionScores.map((s) => {
                  const secAccuracy = s.attempted_count && s.attempted_count > 0 ? Math.round(((s.correct_count ?? 0) / s.attempted_count) * 10000) / 100 : 0;
                  const strength = sectionStrength(secAccuracy);
                  return (
                    <tr key={s.section_score_id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="p-3 font-semibold text-[#00243B] dark:text-white">{s.section_name}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">{s.correct_count ?? 0}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">
                        {s.attempted_count ?? 0}
                        {s.question_count ? ` / ${s.question_count}` : ""}
                      </td>
                      <td className="p-3 font-bold text-[#00243B] dark:text-white">{secAccuracy}%</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">{s.average_time_seconds ? `${Math.round(s.average_time_seconds)}s` : "—"}</td>
                      <td className="p-3">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${strength.className}`}>{t(strength.label)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Comparison: cohort average + progress over time */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cohort && accuracy !== null && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">{t("Vs. Cohort Average")}</h4>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 space-y-3">
              <div>
                <div className="flex justify-between text-[11px] font-semibold mb-1">
                  <span>{t("You")}</span>
                  <span>{accuracy}%</span>
                </div>
                <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--teal)] dark:bg-[#FCB824] rounded-full" style={{ width: `${Math.min(100, accuracy)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] font-semibold mb-1">
                  <span>
                    {t("Cohort Average")} ({cohort.cohortSize} {t(pluralize(cohort.cohortSize, "attempt", "attempts"))})
                  </span>
                  <span>{cohort.cohortAverageAccuracy}%</span>
                </div>
                <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-400 dark:bg-slate-500 rounded-full" style={{ width: `${Math.min(100, cohort.cohortAverageAccuracy)}%` }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {trendData.length > 1 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">{t("Progress Over Time")}</h4>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="accuracy" stroke="#115D75" strokeWidth={2} dot={{ r: 3 }} name={t("Accuracy %")} />
                  {currentPoint && <ReferenceDot x={currentPoint.date} y={currentPoint.accuracy} r={6} fill="#FCB824" stroke="#00243B" />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
