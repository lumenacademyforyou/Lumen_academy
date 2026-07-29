import { History } from "lucide-react";
import { PageContainer } from "../components/layout/PageContainer";

export function TestHistoryPage() {
  return (
    <PageContainer>
      <h1 className="text-2xl font-extrabold text-navy">Test History</h1>
      <p className="mb-6 text-sm text-muted">A record of every test you've built and attempted.</p>
      <div className="card animate-fade-in-up flex flex-col items-center gap-2 px-6 py-16 text-center">
        <span className="animate-pop-in flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F0F8F8]">
          <History size={24} className="text-aqua" />
        </span>
        <p className="text-sm font-semibold text-navy-text">No tests yet</p>
        <p className="max-w-sm text-sm text-muted">Tests you build — from your Study Plan or manually — will appear here.</p>
      </div>
    </PageContainer>
  );
}
