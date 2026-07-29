import type { SubjectId } from "../types/syllabus";
import { Atom, FlaskConical, Leaf } from "lucide-react";

export const SUBJECT_META: Record<SubjectId, { label: string; color: string; icon: typeof Atom }> = {
  physics: { label: "Physics", color: "#086B7E", icon: Atom },
  chemistry: { label: "Chemistry", color: "#E9A817", icon: FlaskConical },
  biology: { label: "Biology", color: "#42AFAF", icon: Leaf },
};

export const ACTIVITY_LABEL: Record<string, string> = {
  study: "Study",
  practice: "Practice",
  revision: "Revision",
};
