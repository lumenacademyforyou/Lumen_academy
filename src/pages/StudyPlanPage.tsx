import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useStudyPlan } from "../hooks/useStudyPlan";
import { useToast } from "../context/ToastContext";
import { PageContainer } from "../components/layout/PageContainer";
import { StudyPlanEmptyState } from "../components/study-plan/StudyPlanEmptyState";
import { StudyPlanWizard } from "../components/study-plan/StudyPlanWizard";
import { StudyPlanHero } from "../components/study-plan/StudyPlanHero";
import { StudyPlanTabs } from "../components/study-plan/StudyPlanTabs";
import { EditPlanModal } from "../components/study-plan/EditPlanModal";
import { TodayPlan } from "../components/study-plan/TodayPlan";
import { WeekPlan } from "../components/study-plan/WeekPlan";
import { CalendarPlan } from "../components/study-plan/CalendarPlan";
import { PlanProgress } from "../components/study-plan/PlanProgress";
import type { StudyPreferences } from "../types/studyPlan";

export function StudyPlanPage() {
  const { hasPlan, loading, error, plan, createPlan, loadDemoPlan, updatePlan, getTodaySessions } = useStudyPlan();
  const { showToast } = useToast();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  if (loading) {
    return (
      <PageContainer>
        <div className="card mx-auto max-w-2xl px-6 py-16 text-center text-sm text-muted">Loading your plan…</div>
      </PageContainer>
    );
  }

  if (error && !plan) {
    return (
      <PageContainer>
        <div className="card mx-auto max-w-2xl px-6 py-16 text-center">
          <p className="text-sm font-semibold text-navy-text">We hit a storage error</p>
          <p className="mt-1 text-sm text-muted">{error}</p>
        </div>
      </PageContainer>
    );
  }

  if (!hasPlan) {
    return (
      <PageContainer>
        {wizardOpen ? (
          <StudyPlanWizard
            onCancel={() => setWizardOpen(false)}
            onGenerate={async (preferences) => {
              await createPlan(preferences);
              showToast("Plan created");
            }}
          />
        ) : (
          <StudyPlanEmptyState
            onCreatePlan={() => setWizardOpen(true)}
            onExplorePlanner={async () => {
              await loadDemoPlan();
              showToast("Plan created");
            }}
          />
        )}
      </PageContainer>
    );
  }

  const handleSaveEdit = async (preferences: StudyPreferences) => {
    await updatePlan(preferences);
    setEditOpen(false);
    showToast("Plan updated");
  };

  return (
    <PageContainer>
      <StudyPlanHero todaySessions={getTodaySessions()} onEditPlan={() => setEditOpen(true)} />
      <StudyPlanTabs />

      <Routes>
        <Route index element={<Navigate to="today" replace />} />
        <Route path="today" element={<TodayPlan />} />
        <Route path="week" element={<WeekPlan />} />
        <Route path="calendar" element={<CalendarPlan />} />
        <Route path="progress" element={<PlanProgress />} />
        <Route path="*" element={<Navigate to="today" replace />} />
      </Routes>

      {editOpen && plan && (
        <EditPlanModal preferences={plan.preferences} onCancel={() => setEditOpen(false)} onSave={handleSaveEdit} />
      )}
    </PageContainer>
  );
}
