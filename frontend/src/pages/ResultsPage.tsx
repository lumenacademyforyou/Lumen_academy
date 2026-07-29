import { BarChart3 } from "lucide-react";
import { PageContainer } from "../components/layout/PageContainer";

export function ResultsPage() {
  return (
    <PageContainer>
      <h1 className="text-2xl font-extrabold text-navy">Results</h1>
      <p className="mb-6 text-sm text-muted">Evaluated results from your attempted tests.</p>
      <div className="card animate-fade-in-up flex flex-col items-center gap-2 px-6 py-16 text-center">
        <span className="animate-pop-in flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F0F8F8]">
          <BarChart3 size={24} className="text-aqua" />
        </span>
        <p className="text-sm font-semibold text-navy-text">No results yet</p>
        <p className="max-w-sm text-sm text-muted">
          Build and attempt a test from the Test Builder to see your evaluated results here.
        </p>
      </div>
    </PageContainer>
  );
}
