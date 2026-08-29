import React, { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ScatterChart, Scatter, ZAxis } from "recharts";
import { useLanguage } from "../../contexts/LanguageContext";
import Modal from "../layout/Modal";
import { getAttemptIrtReport } from "../../services/sessionApi";
import type { IrtReport } from "../../types";

interface IrtSectionProps {
  attemptId: string;
}

// P1-7 (docs/assessment-tool-fix-prompt.md) — real IRT (Rasch) analysis
// section for the detailed report. Entirely server-computed
// (db/assess/analytics/irt.ts) from actual response data; this component
// only renders whatever GET /assess/attempts/:id/irt returns, including its
// own "not enough data yet" state — never fabricates a number when the
// server says the estimate isn't reliable.
export default function IrtSection({ attemptId }: IrtSectionProps) {
  const { t } = useLanguage();
  const [report, setReport] = useState<IrtReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReport(null);
    setError(null);
    getAttemptIrtReport(attemptId)
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load the IRT analysis.");
      });
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  const header = (
    <div className="flex items-center gap-2.5 mb-1">
      <h3 className="text-xl md:text-2xl font-bold text-[#00243B] dark:text-white">{t("Item Response Theory (IRT) Analysis")}</h3>
      <button
        type="button"
        onClick={() => setShowInfo(true)}
        className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer shrink-0"
        title={t("What is IRT?")}
        aria-label={t("What is IRT?")}
      >
        <span className="material-symbols-outlined text-base">info</span>
      </button>
    </div>
  );

  const infoModal = showInfo && (
    <Modal onClose={() => setShowInfo(false)}>
      <div className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-3xl p-6 sm:p-8 max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{t("What is IRT?")}</h3>
          <button onClick={() => setShowInfo(false)} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          <p>
            A raw percentage score treats every question the same — a hard question and an easy one are each worth the same one mark. Item Response
            Theory (IRT) doesn't: it looks at exactly <em>which</em> questions you got right and how difficult each of those questions has proven to
            be for everyone else who's answered it, and uses that to estimate your underlying ability — called <strong>θ (theta)</strong>.
          </p>
          <p>
            Getting a hard question right that most people get wrong raises your θ more than getting an easy question right that almost everyone gets
            right — the same way beating a strong opponent says more about your skill than beating a weak one.
          </p>
          <p>
            θ is centered on 0: a positive θ means above-average ability against the questions you were tested on, negative means below average. It
            comes with a <strong>standard error</strong> — how precise the estimate is. The more questions you've answered (and the more other
            students have answered the same ones), the smaller that error gets.
          </p>
          <p>
            When there isn't yet enough shared response data to place your ability reliably, this section says so plainly instead of showing a number
            that would just be a guess.
          </p>
        </div>
      </div>
    </Modal>
  );

  if (error) {
    return (
      <div className="p-6 md:p-10 rounded-[32px] md:rounded-[40px] bg-white dark:bg-[var(--navy)] border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
        {header}
        <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
        {infoModal}
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-6 md:p-10 rounded-[32px] md:rounded-[40px] bg-white dark:bg-[var(--navy)] border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
        {header}
        <p className="text-sm text-slate-400 dark:text-slate-500 font-semibold">{t("Loading...")}</p>
        {infoModal}
      </div>
    );
  }

  if (report.available === false) {
    return (
      <div className="p-6 md:p-10 rounded-[32px] md:rounded-[40px] bg-white dark:bg-[var(--navy)] border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
        {header}
        <div className="flex flex-col items-center justify-center text-center py-8 gap-2">
          <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600">insights</span>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 max-w-md">{t("Not enough data yet")}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-md">{report.reason}</p>
        </div>
        {infoModal}
      </div>
    );
  }

  const bandColor: Record<typeof report.band, string> = {
    "well above average": "text-emerald-600 dark:text-emerald-400",
    "above average": "text-teal-600 dark:text-teal-400",
    average: "text-slate-600 dark:text-slate-300",
    "below average": "text-amber-600 dark:text-amber-400",
    "well below average": "text-amber-700 dark:text-amber-500",
  };

  const trendData = report.abilityTrend.map((p) => ({
    date: new Date(p.submittedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    theta: Number(p.theta.toFixed(2)),
  }));

  const scatterData = report.itemCharacteristics.map((ic) => ({
    difficulty: Number(ic.difficulty.toFixed(2)),
    outcome: ic.correct ? 1 : 0,
  }));

  return (
    <div className="p-6 md:p-10 rounded-[32px] md:rounded-[40px] bg-white dark:bg-[var(--navy)] border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
      {header}
      <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 -mt-2">
        {t("Calibrated from")} {report.calibration.personCount} {t("attempts across")} {report.calibration.itemCount} {t("questions platform-wide")}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 text-center">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Ability (θ)")}</span>
          <span className="text-2xl font-black text-[#00243B] dark:text-white">{report.theta.toFixed(2)}</span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 text-center">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Standard Error")}</span>
          <span className="text-2xl font-black text-[#00243B] dark:text-white">±{report.standardError.toFixed(2)}</span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 text-center">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Percentile Band")}</span>
          <span className={`text-lg font-black capitalize ${bandColor[report.band]}`}>{t(report.band)}</span>
        </div>
      </div>

      {trendData.length > 1 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">{t("Ability Trend Across Attempts")}</h4>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                <Tooltip />
                <Line type="monotone" dataKey="theta" stroke="var(--teal, #006972)" strokeWidth={2.5} dot={{ r: 4 }} name={t("Ability (θ)")} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {scatterData.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">{t("Ability vs. Item Difficulty")}</h4>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-2">
            {t("Each dot is one question from this attempt — further right is harder, green means you got it right.")}
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" dataKey="difficulty" name={t("Item Difficulty")} tick={{ fontSize: 11 }} />
                <YAxis type="number" dataKey="outcome" name={t("Outcome")} domain={[-0.2, 1.2]} ticks={[0, 1]} tickFormatter={(v) => (v === 1 ? t("Correct") : t("Incorrect"))} tick={{ fontSize: 11 }} />
                <ZAxis range={[60, 60]} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(value: number, name: string) => (name === t("Outcome") ? (value === 1 ? t("Correct") : t("Incorrect")) : value)} />
                <Scatter data={scatterData.filter((d) => d.outcome === 1)} fill="#10b981" />
                <Scatter data={scatterData.filter((d) => d.outcome === 0)} fill="#f43f5e" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {infoModal}
    </div>
  );
}
