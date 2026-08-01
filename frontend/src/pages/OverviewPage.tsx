import { Link } from "react-router-dom";
import { ArrowRight, CalendarRange, Clock } from "lucide-react";
import { PageContainer } from "../components/layout/PageContainer";
import { useStudyPlan } from "../hooks/useStudyPlan";
import { SUBJECT_META, ACTIVITY_LABEL } from "../utils/subjectMeta";
import { formatMinutes, summarizeDay } from "../utils/planHelpers";

export function OverviewPage() {
  const { hasPlan, loading, getTodaySessions } = useStudyPlan();
  const todaySessions = getTodaySessions();
  const nextSession = todaySessions.find((s) => s.status === "pending");
  const summary = summarizeDay(todaySessions);

  return (
    <PageContainer>
      <h1 className="text-2xl font-extrabold text-navy">Good day, Deepan B</h1>
      <p className="mb-6 text-sm text-muted">Here's what's happening in your NEET preparation console.</p>

      <div className="stagger-children grid gap-4 lg:grid-cols-3">
        <div className="card card-hover p-5 lg:col-span-2" style={{ "--stagger-i": 0 } as React.CSSProperties}>
          {loading ? (
            <p className="text-sm text-muted">Loading your plan…</p>
          ) : !hasPlan ? (
            <div className="flex flex-col items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F0F8F8]">
                <CalendarRange size={20} className="text-teal" />
              </div>
              <div>
                <p className="text-base font-bold text-navy-text">You don't have a study plan yet</p>
                <p className="text-sm text-muted">
                  Build a personalized plan to see today's focus right here on your Overview.
                </p>
              </div>
              <Link to="/study-plan" className="btn btn-primary">
                Create Study Plan <ArrowRight size={15} />
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gold">Today's Focus</p>
              {nextSession ? (
                <>
                  <p className="mt-1 text-xl font-extrabold text-navy">{nextSession.chapterName}</p>
                  {nextSession.topicName && <p className="text-sm text-muted">{nextSession.topicName}</p>}
                  <div className="mt-2 flex items-center gap-2 text-sm font-medium text-muted">
                    <span style={{ color: SUBJECT_META[nextSession.subjectId].color }} className="font-semibold">
                      {SUBJECT_META[nextSession.subjectId].label}
                    </span>
                    <span>·</span>
                    <span>{ACTIVITY_LABEL[nextSession.activityType]}</span>
                    {nextSession.durationMinutes && (
                      <span className="flex items-center gap-1">
                        <Clock size={13} /> {formatMinutes(nextSession.durationMinutes)}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Link to="/study-plan/today" className="btn btn-primary">
                      Continue Plan <ArrowRight size={15} />
                    </Link>
                    <p className="text-sm text-muted">{summary.remaining} sessions remaining today</p>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-1 text-lg font-bold text-navy-text">
                    {summary.total === 0 ? "No sessions scheduled today" : "You're all caught up for today"}
                  </p>
                  <Link to="/study-plan/week" className="btn btn-secondary mt-4">
                    View Week <ArrowRight size={15} />
                  </Link>
                </>
              )}
            </div>
          )}
        </div>

        <div className="card card-hover p-5" style={{ "--stagger-i": 1 } as React.CSSProperties}>
          <p className="mb-2 text-sm font-bold text-navy">Quick Links</p>
          <div className="space-y-2">
            <Link to="/syllabus" className="group flex items-center justify-between rounded-md border border-border-soft px-3 py-2.5 text-sm font-medium text-navy-text transition-colors hover:border-teal">
              Browse the syllabus <ArrowRight size={14} className="text-muted transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link to="/build-test" className="group flex items-center justify-between rounded-md border border-border-soft px-3 py-2.5 text-sm font-medium text-navy-text transition-colors hover:border-teal">
              Build a custom test <ArrowRight size={14} className="text-muted transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link to="/results" className="group flex items-center justify-between rounded-md border border-border-soft px-3 py-2.5 text-sm font-medium text-navy-text transition-colors hover:border-teal">
              View recent results <ArrowRight size={14} className="text-muted transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link to="/test-history" className="group flex items-center justify-between rounded-md border border-border-soft px-3 py-2.5 text-sm font-medium text-navy-text transition-colors hover:border-teal">
              Browse test history <ArrowRight size={14} className="text-muted transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
