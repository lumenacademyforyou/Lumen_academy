import React from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import { HelpCircle, Sparkles, CheckCircle2 } from 'lucide-react';

interface QuestionRow {
  id: string;
  topic: string;
  subject: string;
  targetExam: 'NEET' | 'JEE' | 'Foundation';
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Olympiad';
  generatedBy: 'Lumen AI' | 'Faculty Master';
  verified: boolean;
}

const mockQuestions: QuestionRow[] = [
  {
    id: 'Q-98401',
    topic: 'Rotational Dynamics & Torque Vector Analysis',
    subject: 'Physics',
    targetExam: 'JEE',
    difficulty: 'Hard',
    generatedBy: 'Lumen AI',
    verified: true,
  },
  {
    id: 'Q-98402',
    topic: 'Human Physiology - Cardiac Cycle',
    subject: 'Biology',
    targetExam: 'NEET',
    difficulty: 'Medium',
    generatedBy: 'Lumen AI',
    verified: true,
  },
  {
    id: 'Q-98403',
    topic: 'Chemical Equilibrium & Le Chatelier Principle',
    subject: 'Chemistry',
    targetExam: 'NEET',
    difficulty: 'Medium',
    generatedBy: 'Faculty Master',
    verified: true,
  },
];

export const QuestionBankPage: React.FC = () => {
  const columns: Column<QuestionRow>[] = [
    {
      header: 'Question Topic',
      accessorKey: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#00263D] text-white flex items-center justify-center font-bold text-xs">
            <HelpCircle className="w-4 h-4 text-[#FDB824]" />
          </div>
          <div>
            <div className="font-bold text-[#0F172A]">{row.topic}</div>
            <div className="text-[10px] text-[#64748B]">ID: {row.id}</div>
          </div>
        </div>
      ),
      sortable: true,
    },
    { header: 'Subject', accessorKey: 'subject', sortable: true },
    { header: 'Target Exam', accessorKey: 'targetExam', sortable: true },
    {
      header: 'Difficulty',
      accessorKey: (row) => (
        <Badge variant={row.difficulty === 'Hard' ? 'error' : row.difficulty === 'Medium' ? 'warning' : 'info'}>
          {row.difficulty}
        </Badge>
      ),
      sortable: true,
    },
    {
      header: 'Authoring Source',
      accessorKey: (row) => (
        <div className="flex items-center gap-1 text-xs font-semibold text-[#0F172A]">
          {row.generatedBy === 'Lumen AI' && <Sparkles className="w-3.5 h-3.5 text-[#125F76]" />}
          <span>{row.generatedBy}</span>
        </div>
      ),
      sortable: true,
    },
    {
      header: 'Peer Verified',
      accessorKey: () => (
        <div className="flex items-center gap-1 text-xs font-bold text-[#22C55E]">
          <CheckCircle2 className="w-4 h-4" /> Verified
        </div>
      ),
      sortable: false,
    },
  ];

  return (
    <DashboardLayout pageTitle="National Question Bank & AI Generator">
      <div className="space-y-6">
        <div className="flex items-center justify-between bg-white p-5 rounded-[20px] border border-[#E7EAEE]">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A]">1.2M+ NEET / JEE Question Bank</h2>
            <p className="text-xs text-[#64748B]">Automated AI distractor generation & NTA style question paper synthesizer</p>
          </div>
        </div>

        <DataTable data={mockQuestions} columns={columns} searchPlaceholder="Search question bank..." />
      </div>
    </DashboardLayout>
  );
};

export default QuestionBankPage;
