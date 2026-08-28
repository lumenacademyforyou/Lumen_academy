import React from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { motion } from "motion/react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import AnimatedCounter from "../components/ui/AnimatedCounter";
import { useDashboardAnalytics } from "../hooks/useDashboardAnalytics";

// Extracted from App.tsx (LA-BE-CORE-002 CL-P1) so recharts — the single
// largest dependency in the bundle — ships as its own chunk, fetched only
// when the Analytics tab is opened, instead of sitting in the initial load.
//
// LA-APP-COMPLETION-001 Phase G rewrite: every chart here now reads
// GET /analytics/dashboard (useDashboardAnalytics — real, SQL-aggregated
// across every scored attempt) instead of the local TestAttempt[] prop.
// The prior version's trend/pacing/radar data was honestly *computed*, but
// over fields (subjectBreakdown, aiRecommendation, laggingTopics,
// questionTimeData) that no real code path ever populates on a genuine
// attempt — so it always rendered the "not enough data" empty state in
// practice. No local aggregation happens here; every number is already
// aggregated server-side.

interface AnalyticsViewProps {
  shareText: string;
  isExportingPdf: boolean;
  onShareReport: () => void;
  onDownloadPdf: () => void;
}

export default function AnalyticsView({ shareText, isExportingPdf, onShareReport, onDownloadPdf }: AnalyticsViewProps) {
  const { t } = useLanguage();
  const { analytics, loading, error } = useDashboardAnalytics();

  const trendData = (analytics?.scoreTrend ?? []).map((p) => ({
    name: new Date(p.submittedAt).toLocaleDateString(),
    score: Number(p.accuracyPercent),
    obtained: p.obtainedMarks,
    total: p.totalMarks,
  }));

  let peakIndex = -1;
  let troughIndex = -1;
  let maxScore = -1;
  let minScore = 999;
  trendData.forEach((item, idx) => {
    if (item.score > maxScore) {
      maxScore = item.score;
      peakIndex = idx;
    }
    if (item.score < minScore) {
      minScore = item.score;
      troughIndex = idx;
    }
  });
  if (troughIndex === peakIndex) troughIndex = -1;

  const renderCustomDot = (props: any) => {
    const { cx, cy, index } = props;
    if (cx === undefined || cy === undefined) return null;
    const isPeak = index === peakIndex;
    const isTrough = index === troughIndex;
    if (isPeak) {
      return (
        <g key={`dot-peak-${index}`}>
          <circle cx={cx} cy={cy} r={9} fill="#10B981" fillOpacity={0.25} />
          <circle cx={cx} cy={cy} r={5} fill="#10B981" stroke="#00243B" strokeWidth={2} />
        </g>
      );
    }
    if (isTrough) {
      return (
        <g key={`dot-trough-${index}`}>
          <circle cx={cx} cy={cy} r={9} fill="#F43F5E" fillOpacity={0.25} />
          <circle cx={cx} cy={cy} r={5} fill="#F43F5E" stroke="#00243B" strokeWidth={2} />
        </g>
      );
    }
    return <circle key={`dot-${index}`} cx={cx} cy={cy} r={4} fill="#115D75" stroke="#ffffff" strokeWidth={1.5} />;
  };

  const timeBars = (analytics?.timeDistribution ?? []).map((b) => ({ label: b.bucketLabel, count: b.questionCount, avg: b.averageSeconds }));
  const radarData = (analytics?.subjectAccuracy ?? []).map((s) => ({ subject: s.subjectName, score: s.accuracyPercent }));
  const BUCKET_COLORS = ["#10B981", "#FCB824", "#1A7A99", "#F97316", "#F43F5E"];

  return (
    <div id="analytics-report-container" className="space-y-8 animate-in fade-in duration-500 bg-white dark:bg-slate-900 p-4 rounded-3xl">
      <div className="px-2 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-sans font-bold text-slate-900 dark:text-white tracking-tight mb-1">{t("Deep Diagnostics & Analytics")}</h2>
          <p className="text-slate-600 dark:text-slate-300 text-sm">{t("Real, server-aggregated performance across every scored attempt.")}</p>
        </div>
        <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
          <button
            onClick={onShareReport}
            className="print:hidden flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[#00243B] dark:text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">{shareText === "Copied!" ? "check" : "share"}</span>
            {shareText === "Share Report" ? t("Share Report") : t(shareText)}
          </button>
          <button
            onClick={onDownloadPdf}
            disabled={isExportingPdf}
            className="print:hidden flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[var(--navy)] dark:text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border border-slate-200 dark:border-slate-700 shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <span className={`material-symbols-outlined text-sm ${isExportingPdf ? "animate-spin" : ""}`}>{isExportingPdf ? "refresh" : "download"}</span>
            {isExportingPdf ? t("Generating PDF...") : t("Download PDF")}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-6 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-800 text-sm text-rose-700 dark:text-rose-300">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Score trend */}
        <div className="lg:col-span-8 bg-white dark:bg-[var(--navy)] text-[var(--navy)] dark:text-white rounded-[32px] border border-slate-200 dark:border-slate-700 p-6 md:p-8 shadow-sm overflow-hidden min-w-0">
          <h3 className="font-bold text-lg text-[var(--navy)] dark:text-white mb-2">{t("Trend Evaluation Overview")}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">{t("Accuracy across your last 20 scored attempts")}</p>

          <motion.div className="h-72 pt-4 border-b border-slate-200 dark:border-slate-700 pb-2 w-full" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            {!loading && trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 30, right: 15, left: -20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#115D75" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#115D75" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} domain={[0, 100]} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-[#00243B] text-white p-3.5 rounded-2xl border border-slate-700/80 shadow-2xl text-xs space-y-2 min-w-[160px] backdrop-blur-md">
                            <div className="font-bold text-white border-b border-slate-700/80 pb-1.5">{data.name}</div>
                            <div>
                              <span className="text-slate-400 text-[10px] block font-medium">{t("Accuracy")}</span>
                              <span className="font-extrabold text-[#FCB824] text-sm"><AnimatedCounter value={data.score} suffix="%" /></span>
                            </div>
                            <div className="text-slate-300 text-[10px]">{data.obtained} / {data.total} {t("marks")}</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine y={90} stroke="#FCB824" strokeDasharray="3 3" label={{ position: "top", value: "Target 90%", fill: "#FCB824", fontSize: 10 }} />
                  <Area type="monotone" dataKey="score" stroke="#115D75" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" dot={renderCustomDot} activeDot={{ r: 7, fill: "#FCB824", stroke: "#00243B", strokeWidth: 2 }} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-slate-500">{loading ? t("Loading...") : t("No scored tests yet.")}</div>
            )}
          </motion.div>
          <div className="flex flex-col sm:flex-row justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mt-4 gap-2">
            <span>{t("* Chronological, oldest to most recent")}</span>
          </div>
        </div>

        {/* Weakest units — real, server-thresholded */}
        <div className="lg:col-span-4 bg-white dark:bg-[var(--navy)] text-[var(--navy)] dark:text-white rounded-[32px] border border-slate-200 dark:border-slate-700 p-6 md:p-8 shadow-sm flex flex-col justify-between min-w-0 overflow-hidden">
          <div>
            <h3 className="font-bold text-lg text-[var(--navy)] dark:text-white mb-1">{t("Weakness Analysis")}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">{t("Units with the lowest real accuracy across your attempts")}</p>

            <motion.div
              className="space-y-4"
              initial="hidden"
              animate="visible"
              variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.25 } } }}
            >
              {analytics && analytics.weakestUnits.length > 0 ? (
                analytics.weakestUnits.slice(0, 3).map((u) => (
                  <motion.div
                    key={u.nodeId}
                    variants={{ hidden: { opacity: 0, y: 16, scale: 0.97 }, visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 260, damping: 20 } } }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    className="p-3.5 bg-amber-50/80 dark:bg-[#f59e0b]/10 rounded-2xl border border-amber-200 dark:border-[#f59e0b]/20 flex justify-between items-center gap-2 min-w-0 transition-all shadow-sm hover:shadow-md hover:border-amber-400/50"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-[var(--navy)] dark:text-white truncate">{u.unitTitle}</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{u.subjectCode} • {u.correct}✓/{u.incorrect}✗</p>
                    </div>
                    <span className="text-[10px] font-bold text-amber-700 dark:text-[#f59e0b] bg-amber-100 dark:bg-[#f59e0b]/20 px-2 py-0.5 rounded-md flex-shrink-0">{u.accuracyPercent}%</span>
                  </motion.div>
                ))
              ) : (
                <div className="text-sm text-slate-500">{loading ? t("Loading...") : t("Take a few tests to see your weakness analysis.")}</div>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        {/* Time-per-question distribution */}
        <div className="bg-white dark:bg-[var(--navy)] text-[var(--navy)] dark:text-white rounded-[32px] border border-slate-200 dark:border-slate-700 p-6 md:p-8 shadow-sm overflow-hidden min-w-0">
          <h3 className="font-bold text-lg text-[var(--navy)] dark:text-white mb-2">{t("Pacing Diagnostics")}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">{t("How many questions fall into each time-per-question bucket")}</p>

          <motion.div className="h-64 pt-6 border-b border-slate-200 dark:border-slate-700 pb-2 w-full" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
            {timeBars.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeBars} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={40}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b", fontWeight: "bold" }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(148, 163, 184, 0.1)" }}
                    contentStyle={{ borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", fontSize: "12px", backgroundColor: "#00243B", color: "#fff" }}
                    itemStyle={{ color: "#FCB824", fontWeight: "bold" }}
                    formatter={(value: number) => [`${value} questions`, "Count"]}
                    labelStyle={{ color: "#94a3b8", marginBottom: "4px" }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {timeBars.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={BUCKET_COLORS[index % BUCKET_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-slate-500">{loading ? t("Loading...") : t("Not enough timed responses yet.")}</div>
            )}
          </motion.div>
        </div>

        {/* Subject mastery radar — real 4-subject accuracy */}
        <div className="bg-white dark:bg-[var(--navy)] text-[var(--navy)] dark:text-white rounded-[32px] border border-slate-200 dark:border-slate-700 p-6 md:p-8 shadow-sm overflow-hidden min-w-0">
          <h3 className="font-bold text-lg text-[var(--navy)] dark:text-white mb-2">{t("Subject Mastery Radar")}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">{t("Real accuracy balance across your tested subjects")}</p>

          <motion.div className="h-64 pt-2 border-b border-slate-200 dark:border-slate-700 pb-2 w-full flex items-center justify-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
            {radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke="rgba(148, 163, 184, 0.2)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "#64748b", fontSize: 12, fontWeight: "bold" }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Accuracy" dataKey="score" stroke="#FCB824" fill="#FCB824" fillOpacity={0.6} />
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", fontSize: "12px", backgroundColor: "#00243B", color: "#fff" }}
                    itemStyle={{ color: "#FCB824", fontWeight: "bold" }}
                    labelStyle={{ color: "#94a3b8", marginBottom: "4px" }}
                    formatter={(value: number) => [`${value}%`, "Accuracy"]}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-slate-500">{loading ? t("Loading...") : t("Not enough data to analyze subjects.")}</div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
