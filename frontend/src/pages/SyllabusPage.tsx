import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Search } from "lucide-react";
import { PageContainer } from "../components/layout/PageContainer";
import { SlidingTabs, type SlidingTabItem } from "../components/layout/SlidingTabs";
import { SubjectSyllabusTree } from "../components/study-plan/SubjectSyllabusTree";

const TABS: SlidingTabItem[] = [
  { to: "/syllabus/physics", label: "Physics", end: true },
  { to: "/syllabus/chemistry", label: "Chemistry", end: true },
  { to: "/syllabus/biology", label: "Biology", end: true },
];

export function SyllabusPage() {
  const [query, setQuery] = useState("");

  return (
    <PageContainer>
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-border-soft bg-white p-5 sm:p-6">
        <div className="bg-aurora" />
        <div className="relative z-10">
          <h1 className="text-2xl font-extrabold text-navy">Syllabus</h1>
          <p className="mb-5 text-sm text-muted">
            Browse the full NEET/JEE syllabus by subject and track what you've already covered.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <SlidingTabs items={TABS} variant="pill" ariaLabel="Syllabus subjects" />
            <div className="relative w-full sm:w-72">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search chapters or topics…"
                className="w-full rounded-full border border-border-soft bg-ivory/60 py-2 pl-9 pr-3 text-sm text-navy-text outline-none transition-colors placeholder:text-muted/70 focus:border-teal focus:bg-white"
              />
            </div>
          </div>
        </div>
      </div>

      <Routes>
        <Route index element={<Navigate to="physics" replace />} />
        <Route path="physics" element={<SubjectSyllabusTree subjectId="physics" query={query} />} />
        <Route path="chemistry" element={<SubjectSyllabusTree subjectId="chemistry" query={query} />} />
        <Route path="biology" element={<SubjectSyllabusTree subjectId="biology" query={query} />} />
        <Route path="*" element={<Navigate to="physics" replace />} />
      </Routes>
    </PageContainer>
  );
}
