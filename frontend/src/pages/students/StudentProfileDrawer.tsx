import React from 'react';
import {
  X,
  KeyRound,
  UserX,
  UserCheck,
  RefreshCcw,
  ArrowRightLeft,
  Activity,
  BellRing,
  ShieldAlert,
  Mail,
  Phone,
  TrendingUp,
  BrainCircuit,
  FileCheck2,
  Flame,
} from 'lucide-react';
import type { StudentRow } from './StudentsPage';

interface Props {
  student: StudentRow | null;
  onClose: () => void;
}

const statBox = (label: string, value: string | number, icon: React.ReactNode) => (
  <div className="bg-[#F8F7F3] border border-[#E7EAEE] rounded-[14px] p-3">
    <div className="flex items-center gap-1.5 text-[#64748B] text-[10px] font-bold mb-1">
      {icon}
      {label}
    </div>
    <div className="text-sm font-bold text-[#0F172A]">{value}</div>
  </div>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wide mb-3">{children}</h4>
);

const actionButtons = [
  { label: 'Reset Password', icon: KeyRound },
  { label: 'Deactivate', icon: UserX },
  { label: 'Change Subscription', icon: RefreshCcw },
  { label: 'Transfer School', icon: ArrowRightLeft },
  { label: 'View Activity', icon: Activity },
  { label: 'Suspend', icon: ShieldAlert },
  { label: 'Send Notification', icon: BellRing },
];

export const StudentProfileDrawer: React.FC<Props> = ({ student, onClose }) => {
  if (!student) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[#E7EAEE] p-5 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#125F76] text-white flex items-center justify-center text-sm font-bold">
              {student.name[0]}
            </div>
            <div>
              <div className="font-bold text-[#0F172A] text-sm">{student.name}</div>
              <div className="text-[10px] text-[#64748B]">{student.id}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[#F8F7F3] text-[#64748B]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Personal Details */}
          <div>
            <SectionTitle>Personal Details</SectionTitle>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#F1F1EF]">
                <span className="text-[#64748B]">School</span>
                <span className="font-bold text-[#0F172A]">{student.schoolName}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F1F1EF]">
                <span className="text-[#64748B]">Batch</span>
                <span className="font-bold text-[#0F172A]">{student.batchName}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F1F1EF]">
                <span className="text-[#64748B]">Subscription</span>
                <span className="font-bold text-[#0F172A]">{student.plan}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F1F1EF]">
                <span className="text-[#64748B]">Parent Contact</span>
                <span className="font-bold text-[#0F172A]">{student.parentContact}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-[#F1F1EF]">
                <span className="text-[#64748B] flex items-center gap-1"><Mail className="w-3 h-3" /> Email</span>
                <span className="font-bold text-[#0F172A]">{student.email}</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-[#64748B] flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</span>
                <span className="font-bold text-[#0F172A]">{student.phone}</span>
              </div>
            </div>
          </div>

          {/* Learning Progress */}
          <div>
            <SectionTitle>Learning Progress</SectionTitle>
            <div className="grid grid-cols-2 gap-3 mb-3">
              {statBox('Overall Progress', `${student.progress}%`, <TrendingUp className="w-3 h-3" />)}
              {statBox('AI Score', student.aiScore, <BrainCircuit className="w-3 h-3" />)}
              {statBox('Mock Tests', student.mockTests, <FileCheck2 className="w-3 h-3" />)}
              {statBox('Study Streak', `${student.streak} days`, <Flame className="w-3 h-3" />)}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-1">
              <span className="text-[10px] font-bold text-[#64748B] w-full">Weak Subjects</span>
              {student.weakSubjects.map((s) => (
                <span key={s} className="text-[10px] font-bold px-2 py-1 rounded-full bg-[#FEE2E2] text-[#B91C1C]">
                  {s}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] font-bold text-[#64748B] w-full">Strong Subjects</span>
              {student.strongSubjects.map((s) => (
                <span key={s} className="text-[10px] font-bold px-2 py-1 rounded-full bg-[#DCFCE7] text-[#15803D]">
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Subscription */}
          <div>
            <SectionTitle>Subscription</SectionTitle>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#F1F1EF]">
                <span className="text-[#64748B]">Plan</span>
                <span className="font-bold text-[#0F172A]">{student.plan}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F1F1EF]">
                <span className="text-[#64748B]">Renewal</span>
                <span className="font-bold text-[#0F172A]">{student.renewalDate}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[#64748B]">Payments</span>
                <span className="font-bold text-[#0F172A]">{student.paymentsCount} completed</span>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <SectionTitle>Recent Activity</SectionTitle>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#F1F1EF]">
                <span className="text-[#64748B]">Last Login</span>
                <span className="font-bold text-[#0F172A]">{student.lastLogin}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F1F1EF]">
                <span className="text-[#64748B]">Tests Taken (7d)</span>
                <span className="font-bold text-[#0F172A]">{student.recentTests}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F1F1EF]">
                <span className="text-[#64748B]">Videos Watched (7d)</span>
                <span className="font-bold text-[#0F172A]">{student.recentVideos}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[#64748B]">AI Doubts Asked (7d)</span>
                <span className="font-bold text-[#0F172A]">{student.recentDoubts}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div>
            <SectionTitle>Actions</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              {actionButtons.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  className="flex items-center gap-2 p-2.5 rounded-[12px] border border-[#E7EAEE] text-[11px] font-bold text-[#0F172A] hover:bg-[#F8F7F3] hover:border-[#125F76]/30 transition-colors"
                >
                  <Icon className="w-3.5 h-3.5 text-[#125F76]" />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentProfileDrawer;