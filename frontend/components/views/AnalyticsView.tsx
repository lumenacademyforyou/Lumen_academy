import React, { useMemo } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
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
import AnimatedCounter from "../common/AnimatedCounter";
import { TestAttempt } from "../../../types";

// Extracted from App.tsx (LA-BE-CORE-002 CL-P1) so recharts — the single
// largest dependency in the bundle — ships as its own chunk, fetched only
// when the Analytics tab is opened, instead of sitting in the initial load.

interface AnalyticsViewProps {
  attempts: TestAttempt[];
  shareText: string;
  isExportingPdf: boolean;
  onShareReport: () => void;
  onDownloadPdf: () => void;
  onGenerateRevisionSheet: () => void;
}

export default function AnalyticsView({
  attempts,
  shareText,
  isExportingPdf,
  onShareReport,
  onDownloadPdf,
  onGenerateRevisionSheet,
}: AnalyticsViewProps) {
  const { t } = useLanguage();

  const timeSpentData = useMemo(() => {
    if (attempts.length === 0 || !attempts[0].questionTimeData) return [];
    const subjectAgg: Record<string, { totalTime: number; count: number }> = {};
    attempts[0].questionTimeData.forEach(item => {
      if (!subjectAgg[item.subject]) {
        subjectAgg[item.subject] = { totalTime: 0, count: 0 };
      }
      subjectAgg[item.subject].totalTime += item.timeSpentSeconds;
      subjectAgg[item.subject].count += 1;
    });
    return Object.keys(subjectAgg).map(subject => ({
      subject,
      avgTime: Math.round(subjectAgg[subject].totalTime / subjectAgg[subject].count)
    }));
  }, [attempts]);

  const radarData = useMemo(() => {
    if (attempts.length === 0 || !attempts[0].subjectBreakdown) return [];
    const bd = attempts[0].subjectBreakdown;
    return [
      { subject: "Physics", score: bd.Physics?.score || 0, fullMark: 100 },
      { subject: "Chemistry", score: bd.Chemistry?.score || 0, fullMark: 100 },
      { subject: "Biology", score: bd.Biology?.score || 0, fullMark: 100 },
    ];
  }, [attempts]);

  return (
                  <div id="analytics-report-container" className="space-y-8 animate-in fade-in duration-500 bg-white dark:bg-slate-900 p-4 rounded-3xl">
                    <div className="px-2 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-2xl md:text-3xl font-sans font-bold text-slate-900 dark:text-white tracking-tight mb-1">{t("Deep Diagnostics & Analytics")}</h2>
                        <p className="text-slate-600 dark:text-slate-300 text-sm">{t("Granular performance tracking and trends over your last completed mock sessions.")}</p>
                      </div>
                      <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
                        <button
                          onClick={onShareReport}
                          className="print:hidden flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[#00243B] dark:text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm">
                            {shareText === "Copied!" ? 'check' : 'share'}
                          </span>
                          {shareText === "Share Report" ? t("Share Report") : t(shareText)}
                        </button>
                        <button
                          onClick={onDownloadPdf}
                          disabled={isExportingPdf}
                          className="print:hidden flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[var(--navy)] dark:text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border border-slate-200 dark:border-slate-700 shadow-sm disabled:opacity-50 cursor-pointer"
                        >
                          <span className={`material-symbols-outlined text-sm ${isExportingPdf ? 'animate-spin' : ''}`}>
                            {isExportingPdf ? 'refresh' : 'download'}
                          </span>
                          {isExportingPdf ? t("Generating PDF...") : t("Download PDF")}
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                      {/* Left graph container card */}
                      <div className="lg:col-span-8 bg-white dark:bg-[var(--navy)] text-[var(--navy)] dark:text-white rounded-[32px] border border-slate-200 dark:border-slate-700 p-6 md:p-8 shadow-sm overflow-hidden min-w-0">
                        <h3 className="font-bold text-lg text-[var(--navy)] dark:text-white mb-2">{t("Trend Evaluation Overview")}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">{t("Overall percentile and total correct score distribution")}</p>
                        
                        {/* Interactive spline area chart for score trends */}
                        <motion.div 
                          className="h-72 pt-4 border-b border-slate-200 dark:border-slate-700 pb-2 w-full"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: 0.1 }}
                        >
                          {attempts.length > 0 ? (() => {
                            const getPeakTopic = (attempt: TestAttempt) => {
                              if (attempt.aiRecommendation?.focusAreas?.length) {
                                const doneTopic = attempt.aiRecommendation.focusAreas.find(f => f.level === "Done" || f.level === "Improvement");
                                if (doneTopic) return doneTopic.topic;
                              }
                              if (attempt.aiRecommendation?.topics?.length) {
                                return attempt.aiRecommendation.topics[0];
                              }
                              if (attempt.subjectBreakdown) {
                                const sorted = Object.entries(attempt.subjectBreakdown).sort((a, b) => b[1].score - a[1].score);
                                if (sorted.length) return `${sorted[0][0]} (${sorted[0][1].score}%)`;
                              }
                              return "General Mastery";
                            };

                            const getTroughTopic = (attempt: TestAttempt) => {
                              if (attempt.laggingTopics?.length) {
                                return attempt.laggingTopics[0].topic;
                              }
                              if (attempt.aiRecommendation?.focusAreas?.length) {
                                const critical = attempt.aiRecommendation.focusAreas.find(f => f.level === "Critical");
                                if (critical) return critical.topic;
                              }
                              if (attempt.subjectBreakdown) {
                                const sorted = Object.entries(attempt.subjectBreakdown).sort((a, b) => a[1].score - b[1].score);
                                if (sorted.length) return `${sorted[0][0]} (${sorted[0][1].score}%)`;
                              }
                              return "Concept Gap";
                            };

                            const chronologicalAttempts = [...attempts].reverse();
                            const first90AttemptId = chronologicalAttempts.find(a => a.accuracy >= 90)?.id;
                            const firstFullSyllabusAttemptId = chronologicalAttempts.find(a => a.title.toLowerCase().includes("full syllabus"))?.id;

                            const rawData = chronologicalAttempts.slice(-5).map((attempt, index, arr) => {
                              const prevAttempt = index > 0 ? arr[index - 1] : null;
                              const currentPercentile = attempt.percentile || 0;
                              const prevPercentile = prevAttempt ? (prevAttempt.percentile || 0) : null;
                              const percentileShift = prevPercentile !== null ? Number((currentPercentile - prevPercentile).toFixed(1)) : 0;

                              return {
                                name: attempt.date ? (attempt.date.includes('T') ? attempt.date.split('T')[0] : attempt.date) : 'Recent',
                                score: attempt.accuracy,
                                percentile: currentPercentile,
                                percentileShift,
                                hasPrevious: prevPercentile !== null,
                                title: attempt.title,
                                peakTopic: getPeakTopic(attempt),
                                troughTopic: getTroughTopic(attempt),
                                isFirst90: attempt.id === first90AttemptId,
                                isFirstFullSyllabus: attempt.id === firstFullSyllabusAttemptId,
                                attempt
                              };
                            });

                            let peakIndex = -1;
                            let troughIndex = -1;
                            let maxScore = -1;
                            let minScore = 999;

                            rawData.forEach((item, idx) => {
                              if (item.score > maxScore) {
                                maxScore = item.score;
                                peakIndex = idx;
                              }
                              if (item.score < minScore) {
                                minScore = item.score;
                                troughIndex = idx;
                              }
                            });

                            if (troughIndex === peakIndex) {
                              troughIndex = -1;
                            }

                            const renderCustomTick = (props: any) => {
                              const { x, y, payload } = props;
                              const dataItem = rawData.find(d => d.name === payload.value);
                              const showStar = dataItem && (dataItem.isFirst90 || dataItem.isFirstFullSyllabus);

                              return (
                                <g transform={`translate(${x},${y})`}>
                                  <text x={0} y={0} dy={16} textAnchor="middle" fill="#64748b" fontSize={10}>
                                    {payload.value}
                                  </text>
                                  {showStar && (
                                    <text x={0} y={0} dy={30} textAnchor="middle" fontSize={12}>
                                      <title>{dataItem.isFirst90 ? "First 90%+ Accuracy!" : "First Full Syllabus!"}</title>
                                      ⭐
                                    </text>
                                  )}
                                </g>
                              );
                            };

                            const renderCustomDot = (props: any) => {
                              const { cx, cy, index, payload } = props;
                              if (cx === undefined || cy === undefined || !payload) return null;

                              const isPeak = index === peakIndex;
                              const isTrough = index === troughIndex;
                              const truncate = (s: string) => s.length > 18 ? s.slice(0, 16) + '…' : s;

                              if (isPeak) {
                                const isFirst = index === 0;
                                const isLast = index === rawData.length - 1;
                                const boxWidth = 140;
                                const boxHeight = 34;
                                
                                let rectX = -70;
                                let textX = 0;
                                if (isFirst) { rectX = -10; textX = 60; }
                                else if (isLast) { rectX = -130; textX = -60; }

                                return (
                                  <g key={`dot-peak-${index}`}>
                                    <circle cx={cx} cy={cy} r={9} fill="#10B981" fillOpacity={0.25} />
                                    <circle cx={cx} cy={cy} r={5} fill="#10B981" stroke="#00243B" strokeWidth={2} />
                                    
                                    <g transform={`translate(${cx}, ${cy - 8})`}>
                                      <polygon points="-5,-3 5,-3 0,2" fill="#10B981" />
                                      <rect
                                        x={rectX}
                                        y={-boxHeight - 3}
                                        width={boxWidth}
                                        height={boxHeight}
                                        rx={8}
                                        fill="#00243B"
                                        stroke="#10B981"
                                        strokeWidth={1.5}
                                        style={{ filter: "drop-shadow(0px 4px 10px rgba(16, 185, 129, 0.35))" }}
                                      />
                                      <text x={textX} y={-boxHeight + 11} textAnchor="middle" fill="#10B981" fontSize={9} fontWeight={800} letterSpacing="0.5">
                                        🏆 PEAK ({payload.score}%)
                                      </text>
                                      <text x={textX} y={-boxHeight + 23} textAnchor="middle" fill="#F8FAFC" fontSize={8.5} fontWeight={600}>
                                        {truncate(payload.peakTopic)}
                                      </text>
                                    </g>
                                  </g>
                                );
                              }

                              if (isTrough) {
                                const isFirst = index === 0;
                                const isLast = index === rawData.length - 1;
                                const boxWidth = 140;
                                const boxHeight = 34;
                                
                                let rectX = -70;
                                let textX = 0;
                                if (isFirst) { rectX = -10; textX = 60; }
                                else if (isLast) { rectX = -130; textX = -60; }

                                return (
                                  <g key={`dot-trough-${index}`}>
                                    <circle cx={cx} cy={cy} r={9} fill="#F43F5E" fillOpacity={0.25} />
                                    <circle cx={cx} cy={cy} r={5} fill="#F43F5E" stroke="#00243B" strokeWidth={2} />
                                    
                                    <g transform={`translate(${cx}, ${cy + 8})`}>
                                      <polygon points="-5,3 5,3 0,-2" fill="#F43F5E" />
                                      <rect
                                        x={rectX}
                                        y={3}
                                        width={boxWidth}
                                        height={boxHeight}
                                        rx={8}
                                        fill="#00243B"
                                        stroke="#F43F5E"
                                        strokeWidth={1.5}
                                        style={{ filter: "drop-shadow(0px 4px 10px rgba(244, 63, 94, 0.35))" }}
                                      />
                                      <text x={textX} y={17} textAnchor="middle" fill="#F43F5E" fontSize={9} fontWeight={800} letterSpacing="0.5">
                                        ⚠️ TROUGH ({payload.score}%)
                                      </text>
                                      <text x={textX} y={29} textAnchor="middle" fill="#F8FAFC" fontSize={8.5} fontWeight={600}>
                                        {truncate(payload.troughTopic)}
                                      </text>
                                    </g>
                                  </g>
                                );
                              }

                              return (
                                <circle key={`dot-${index}`} cx={cx} cy={cy} r={4} fill="#115D75" stroke="#ffffff" strokeWidth={1.5} />
                              );
                            };

                            return (
                              <motion.div
                                initial={{ clipPath: "inset(0% 100% 0% 0%)" }}
                                animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
                                transition={{ duration: 1.5, ease: "easeInOut", delay: 0.1 }}
                                style={{ width: '100%', height: '100%' }}
                              >
                                <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart
                                    data={rawData}
                                    margin={{ top: 45, right: 15, left: -20, bottom: 20 }}
                                  >
                                    <defs>
                                      <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#115D75" stopOpacity={0.4}/>
                                        <stop offset="95%" stopColor="#115D75" stopOpacity={0}/>
                                      </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
                                    <XAxis 
                                      dataKey="name" 
                                      axisLine={false} 
                                      tickLine={false} 
                                      tick={renderCustomTick} 
                                    />
                                    <YAxis 
                                      axisLine={false} 
                                      tickLine={false} 
                                      tick={{ fontSize: 10, fill: '#64748b' }}
                                    />
                                    <Tooltip 
                                      content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                          const data = payload[0].payload;
                                          const shift = data.percentileShift;
                                          const isPositive = shift > 0;
                                          const isNegative = shift < 0;
                                          const isPeak = data.score === maxScore;
                                          const isTrough = data.score === minScore && !isPeak;

                                          return (
                                            <div className="bg-[#00243B] text-white p-3.5 rounded-2xl border border-slate-700/80 shadow-2xl text-xs space-y-2.5 min-w-[220px] backdrop-blur-md">
                                              <div className="font-bold text-white border-b border-slate-700/80 pb-1.5 flex justify-between items-center gap-2">
                                                <span className="truncate max-w-[120px] font-semibold">{data.title}</span>
                                                {isPeak && (
                                                  <span className="px-2 py-0.5 text-[9px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full shrink-0">
                                                    🏆 Peak
                                                  </span>
                                                )}
                                                {isTrough && (
                                                  <span className="px-2 py-0.5 text-[9px] font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/40 rounded-full shrink-0">
                                                    ⚠️ Trough
                                                  </span>
                                                )}
                                                {!isPeak && !isTrough && (
                                                  <span className="text-[10px] text-slate-400 font-medium shrink-0">{data.name}</span>
                                                )}
                                              </div>

                                              <div className="grid grid-cols-2 gap-2 text-xs pt-0.5">
                                                <div>
                                                  <span className="text-slate-400 text-[10px] block font-medium">{t("Accuracy Score")}</span>
                                                  <span className="font-extrabold text-[#FCB824] text-sm"><AnimatedCounter value={data.score} suffix="%" /></span>
                                                </div>
                                                <div>
                                                  <span className="text-slate-400 text-[10px] block font-medium">{t("AIR Percentile")}</span>
                                                  <span className="font-extrabold text-teal-300 text-sm"><AnimatedCounter value={data.percentile} suffix="%ile" /></span>
                                                </div>
                                              </div>

                                              <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700/60 text-[11px] space-y-1">
                                                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium gap-2">
                                                  <span>{t("Peak Chapter/Topic")}:</span>
                                                  <span className="text-emerald-400 font-bold truncate max-w-[110px]">{data.peakTopic}</span>
                                                </div>
                                                {data.troughTopic && (
                                                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium border-t border-slate-700/50 pt-1 gap-2">
                                                    <span>{t("Key Focus Area")}:</span>
                                                    <span className="text-rose-400 font-bold truncate max-w-[110px]">{data.troughTopic}</span>
                                                  </div>
                                                )}
                                              </div>

                                              <div className="pt-2 border-t border-slate-700/80 flex items-center justify-between">
                                                <span className="text-slate-300 text-[11px] font-medium">{t("Percentile Shift")}:</span>
                                                {!data.hasPrevious ? (
                                                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-800 text-slate-400 rounded-full border border-slate-700">
                                                    {t("Baseline")}
                                                  </span>
                                                ) : (
                                                  <span className={`px-2 py-0.5 text-[11px] font-extrabold rounded-full flex items-center gap-1 border ${
                                                    isPositive 
                                                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                                                      : isNegative 
                                                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' 
                                                      : 'bg-slate-800 text-slate-300 border-slate-700'
                                                  }`}>
                                                    {isPositive ? `▲ +${shift}%` : isNegative ? `▼ ${shift}%` : '0%'}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        }
                                        return null;
                                      }}
                                    />
                                    <ReferenceLine 
                                      y={Math.round(attempts.reduce((sum, a) => sum + a.accuracy, 0) / (attempts.length || 1))} 
                                      stroke="#64748b" 
                                      strokeDasharray="3 3" 
                                      label={{ position: 'top', value: 'Avg', fill: '#64748b', fontSize: 10 }} 
                                    />
                                    <ReferenceLine 
                                      y={90} 
                                      stroke="#FCB824" 
                                      strokeDasharray="3 3" 
                                      label={{ position: 'top', value: 'Target 90%', fill: '#FCB824', fontSize: 10 }} 
                                    />
                                    <Area 
                                      type="monotone" 
                                      dataKey="score" 
                                      stroke="#115D75" 
                                      strokeWidth={3}
                                      fillOpacity={1} 
                                      fill="url(#colorScore)" 
                                      dot={renderCustomDot}
                                      activeDot={{ r: 7, fill: '#FCB824', stroke: '#00243B', strokeWidth: 2 }}
                                      isAnimationActive={false}
                                    />
                                  </AreaChart>
                                </ResponsiveContainer>
                              </motion.div>
                            );
                          })() : (
                            <div className="w-full h-full flex items-center justify-center text-sm text-slate-500">{t("No mock tests completed yet.")}</div>
                          )}
                        </motion.div>
                        <div className="flex flex-col sm:flex-row justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mt-4 gap-2">
                          <span>{t("* Trend reflects performance over the last completed sessions")}</span>
                          {attempts.length > 1 && (
                            <span className="text-[var(--teal)] dark:text-amber-300 font-bold flex-shrink-0">
                              {t("Trend: ")}{attempts[0].accuracy > attempts[attempts.length-1].accuracy ? '+' : ''}{attempts[0].accuracy - attempts[attempts.length-1].accuracy}{t("% Improvement")}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Right Diagnostic metrics card */}
                      <div className="lg:col-span-4 bg-white dark:bg-[var(--navy)] text-[var(--navy)] dark:text-white rounded-[32px] border border-slate-200 dark:border-slate-700 p-6 md:p-8 shadow-sm flex flex-col justify-between min-w-0 overflow-hidden">
                        <div>
                          <h3 className="font-bold text-lg text-[var(--navy)] dark:text-white mb-1">{t("Weakness Analysis")}</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">{t("Subject categories with high error densities")}</p>
                          
                          <motion.div 
                            className="space-y-4"
                            initial="hidden"
                            animate="visible"
                            variants={{
                              hidden: { opacity: 0 },
                              visible: {
                                opacity: 1,
                                transition: {
                                  staggerChildren: 0.12,
                                  delayChildren: 0.25
                                }
                              }
                            }}
                          >
                            {attempts.length > 0 && attempts[0].laggingTopics.slice(0, 3).map((topic, i) => (
                              <motion.div 
                                key={i} 
                                variants={{
                                  hidden: { opacity: 0, y: 16, scale: 0.97 },
                                  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 260, damping: 20 } }
                                }}
                                whileHover={{ scale: 1.02, y: -2 }}
                                className="p-3.5 bg-amber-50/80 dark:bg-[#f59e0b]/10 rounded-2xl border border-amber-200 dark:border-[#f59e0b]/20 flex justify-between items-center gap-2 min-w-0 transition-all shadow-sm hover:shadow-md hover:border-amber-400/50 cursor-pointer"
                              >
                                <div className="min-w-0 flex-1">
                                  <h4 className="text-xs font-bold text-[var(--navy)] dark:text-white truncate">{topic.topic}</h4>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{topic.conceptGap}</p>
                                </div>
                                <span className="text-[10px] font-bold text-amber-700 dark:text-[#f59e0b] bg-amber-100 dark:bg-[#f59e0b]/20 px-2 py-0.5 rounded-md flex-shrink-0">{t("Review")}</span>
                              </motion.div>
                            ))}
                            {attempts.length === 0 && (
                               <motion.div 
                                 variants={{
                                   hidden: { opacity: 0, y: 10 },
                                   visible: { opacity: 1, y: 0 }
                                 }}
                                 className="text-sm text-slate-500"
                               >
                                 {t("Take a mock test to see your weakness analysis.")}
                               </motion.div>
                            )}
                          </motion.div>
                        </div>

                        <button
                          onClick={onGenerateRevisionSheet}
                          className="print:hidden w-full mt-6 py-3.5 bg-[var(--teal)] hover:bg-[var(--teal-2)] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer text-center"
                        >{t("Generate AI Revision Sheets")}</button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                      {/* Time Spent per Question Chart */}
                      <div className="bg-white dark:bg-[var(--navy)] text-[var(--navy)] dark:text-white rounded-[32px] border border-slate-200 dark:border-slate-700 p-6 md:p-8 shadow-sm overflow-hidden min-w-0">
                        <h3 className="font-bold text-lg text-[var(--navy)] dark:text-white mb-2">{t("Pacing Diagnostics")}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">{t("Average time spent per question across subjects (seconds)")}</p>
                        
                        <motion.div 
                          className="h-64 pt-6 border-b border-slate-200 dark:border-slate-700 pb-2 w-full"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: 0.2 }}
                        >
                          {timeSpentData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={timeSpentData}
                                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                barSize={40}
                              >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
                                <XAxis 
                                  dataKey="subject" 
                                  axisLine={false}
                                  tickLine={false}
                                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }}
                                  dy={10}
                                />
                                <YAxis 
                                  axisLine={false}
                                  tickLine={false} 
                                  tick={{ fontSize: 10, fill: '#64748b' }}
                                />
                                <Tooltip 
                                  cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                                  contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', fontSize: '12px', backgroundColor: '#00243B', color: '#fff' }}
                                  itemStyle={{ color: '#FCB824', fontWeight: 'bold' }}
                                  formatter={(value: number) => [`${value}s`, 'Avg. Time']}
                                  labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                                />
                                <Bar dataKey="avgTime" radius={[6, 6, 0, 0]}>
                                  {timeSpentData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.subject === 'Physics' ? '#FCB824' : entry.subject === 'Chemistry' ? '#1A7A99' : '#115D75'} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-sm text-slate-500">{t("Not enough data to analyze pacing.")}</div>
                          )}
                        </motion.div>
                        <div className="flex flex-col sm:flex-row justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mt-4 gap-2">
                          <span>{t("* Ideal pacing is < 60s for Biology, < 90s for Chemistry, and < 120s for Physics")}</span>
                        </div>
                      </div>

                      {/* Subject Performance Radar */}
                      <div className="bg-white dark:bg-[var(--navy)] text-[var(--navy)] dark:text-white rounded-[32px] border border-slate-200 dark:border-slate-700 p-6 md:p-8 shadow-sm overflow-hidden min-w-0">
                        <h3 className="font-bold text-lg text-[var(--navy)] dark:text-white mb-2">{t("Subject Mastery Radar")}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">{t("Performance balance across core subjects")}</p>
                        
                        <motion.div 
                          className="h-64 pt-2 border-b border-slate-200 dark:border-slate-700 pb-2 w-full flex items-center justify-center"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: 0.3 }}
                        >
                          {radarData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                <PolarGrid stroke="rgba(148, 163, 184, 0.2)" />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} />
                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                <Radar name="Score" dataKey="score" stroke="#FCB824" fill="#FCB824" fillOpacity={0.6} />
                                <Tooltip
                                  contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', fontSize: '12px', backgroundColor: '#00243B', color: '#fff' }}
                                  itemStyle={{ color: '#FCB824', fontWeight: 'bold' }}
                                  labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                                  formatter={(value: number) => [`${value}%`, 'Score']}
                                />
                              </RadarChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-sm text-slate-500">{t("Not enough data to analyze subjects.")}</div>
                          )}
                        </motion.div>
                        <div className="flex flex-col sm:flex-row justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mt-4 gap-2">
                          <span>{t("* Maps relative strength (0-100 scale)")}</span>
                        </div>
                      </div>
                    </div>


                  </div>
  );
}
