import { useContext } from "react";
import { StudyPlanContext, type StudyPlanContextValue } from "../context/StudyPlanContext";

export function useStudyPlan(): StudyPlanContextValue {
  const ctx = useContext(StudyPlanContext);
  if (!ctx) {
    throw new Error("useStudyPlan must be used within a StudyPlanProvider");
  }
  return ctx;
}
