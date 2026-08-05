import React from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { BarChart3, Download, FileText } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  return (
    <DashboardLayout pageTitle="National Academic & Platform Audit Reports">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-5 rounded-[20px] border border-[#E7EAEE]">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A]">Super Admin Reports & Export Center</h2>
            <p className="text-xs text-[#64748B]">Download aggregated performance metrics, NTA NEET/JEE mock scores & compliance audits</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-white border border-[#E7EAEE] rounded-[20px] shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-[14px] bg-[#125F76]/10 text-[#125F76] flex items-center justify-center mb-4">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0F172A]">NEET 2026 Preparedness Report</h3>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                National level analysis of 65,000+ NEET aspirants across all partner schools.
              </p>
            </div>
            <button className="mt-6 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#125F76] text-white rounded-[14px] text-xs font-bold hover:bg-[#00263D] transition-colors">
              <Download className="w-4 h-4" /> Download PDF Report
            </button>
          </div>

          <div className="p-6 bg-white border border-[#E7EAEE] rounded-[20px] shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-[14px] bg-[#FDB824]/20 text-[#00263D] flex items-center justify-center mb-4">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0F172A]">JEE Rank Analytics Audit</h3>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                Deep dive into Physics, Chemistry & Math percentile distributions.
              </p>
            </div>
            <button className="mt-6 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#00263D] text-white rounded-[14px] text-xs font-bold hover:bg-[#125F76] transition-colors">
              <Download className="w-4 h-4" /> Export CSV Data
            </button>
          </div>

          <div className="p-6 bg-white border border-[#E7EAEE] rounded-[20px] shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-[14px] bg-[#22C55E]/10 text-[#22C55E] flex items-center justify-center mb-4">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0F172A]">Platform Financial Audit Q1</h3>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                Super admin breakdown of school subscription revenues & AI operational expenses.
              </p>
            </div>
            <button className="mt-6 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-[#E7EAEE] text-[#0F172A] rounded-[14px] text-xs font-bold hover:bg-[#F8F7F3] transition-colors">
              <Download className="w-4 h-4" /> Download Audit
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ReportsPage;
