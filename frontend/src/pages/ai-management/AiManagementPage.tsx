import React from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import StatCard from '../../components/ui/StatCard';
import ChartCard from '../../components/ui/ChartCard';
import Badge from '../../components/ui/Badge';
import { Cpu, Sparkles, Activity, ShieldCheck } from 'lucide-react';

export const AiManagementPage: React.FC = () => {
  return (
    <DashboardLayout pageTitle="Lumen AI Core Engine Management">
      <div className="space-y-6">
        {/* Top AI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            title="Lumen AI Tutor Queries"
            value="42,850,210"
            change={24.5}
            description="Active doubt solver queries processed this month"
            icon={Cpu}
            accentColor="#125F76"
          />
          <StatCard
            title="Auto Question Synthesizer"
            value="18,400"
            change={18.2}
            description="Fresh NEET/JEE questions created automatically"
            icon={Sparkles}
            accentColor="#FDB824"
          />
          <StatCard
            title="Latency & Response Speed"
            value="340 ms"
            change={-12.0}
            description="Average LLM inference turnaround time"
            icon={Activity}
            accentColor="#22C55E"
          />
          <StatCard
            title="Syllabus Accuracy Index"
            value="99.6%"
            change={0.4}
            description="NTA NEET/JEE curriculum alignment score"
            icon={ShieldCheck}
            accentColor="#3B82F6"
          />
        </div>

        {/* Core Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="AI Model Configuration & Weights">
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between p-4 bg-[#F8F7F3] rounded-[16px] border border-[#E7EAEE]">
                <div>
                  <h4 className="text-xs font-bold text-[#0F172A]">Lumen-NEET-Tutor-v4</h4>
                  <p className="text-[11px] text-[#64748B]">Specialized Fine-tuned Bio & Chem Model</p>
                </div>
                <Badge variant="success">ACTIVE</Badge>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#F8F7F3] rounded-[16px] border border-[#E7EAEE]">
                <div>
                  <h4 className="text-xs font-bold text-[#0F172A]">Lumen-JEE-Maths-v3</h4>
                  <p className="text-[11px] text-[#64748B]">LaTeX & Symbolic Math Solver Model</p>
                </div>
                <Badge variant="success">ACTIVE</Badge>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#F8F7F3] rounded-[16px] border border-[#E7EAEE]">
                <div>
                  <h4 className="text-xs font-bold text-[#0F172A]">Lumen-Olympiad-Gen-v2</h4>
                  <p className="text-[11px] text-[#64748B]">Foundation Level Conceptual Generator</p>
                </div>
                <Badge variant="accent">STAGING</Badge>
              </div>
            </div>
          </ChartCard>

          <ChartCard title="System Safety & Hallucination Guardrails">
            <div className="space-y-4 pt-2">
              <div className="p-4 bg-[#F8F7F3] rounded-[16px] border border-[#E7EAEE] space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-[#0F172A]">Strict Formula Verification Filter</span>
                  <span className="text-xs font-bold text-[#22C55E]">ENABLED</span>
                </div>
                <p className="text-[11px] text-[#64748B]">Cross-verifies generated physics equations against standard NCERT datasets.</p>
              </div>

              <div className="p-4 bg-[#F8F7F3] rounded-[16px] border border-[#E7EAEE] space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-[#0F172A]">Rate Limit per School Tier</span>
                  <span className="text-xs font-bold text-[#125F76]">100k Tokens / hr</span>
                </div>
                <p className="text-[11px] text-[#64748B]">Prevents runaway API usage charges across enterprise school accounts.</p>
              </div>
            </div>
          </ChartCard>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AiManagementPage;
