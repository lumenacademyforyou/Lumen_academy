import React from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import { BookOpen, Sparkles } from 'lucide-react';

interface CourseRow {
  id: string;
  title: string;
  category: 'Physics' | 'Chemistry' | 'Biology' | 'Mathematics';
  targetExam: 'NEET' | 'JEE' | 'Foundation';
  modulesCount: number;
  aiAdaptive: boolean;
}

const mockCourses: CourseRow[] = [
  {
    id: 'CRS-NEET-PHY',
    title: 'Advanced Organic Chemistry for NEET 2026',
    category: 'Chemistry',
    targetExam: 'NEET',
    modulesCount: 24,
    aiAdaptive: true,
  },
  {
    id: 'CRS-JEE-MTH',
    title: 'Calculus & Algebra Mastery for JEE Advanced',
    category: 'Mathematics',
    targetExam: 'JEE',
    modulesCount: 36,
    aiAdaptive: true,
  },
  {
    id: 'CRS-FND-SCI',
    title: 'Physics Fundamentals & Olympiad Prep',
    category: 'Physics',
    targetExam: 'Foundation',
    modulesCount: 18,
    aiAdaptive: true,
  },
];

export const CoursesPage: React.FC = () => {
  const columns: Column<CourseRow>[] = [
    {
      header: 'Course Title',
      accessorKey: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#125F76] text-white flex items-center justify-center font-bold text-xs">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-[#0F172A]">{row.title}</div>
            <div className="text-[10px] text-[#64748B]">ID: {row.id}</div>
          </div>
        </div>
      ),
      sortable: true,
    },
    { header: 'Subject', accessorKey: 'category', sortable: true },
    { header: 'Target Exam', accessorKey: 'targetExam', sortable: true },
    { header: 'Modules', accessorKey: 'modulesCount', sortable: true },
    {
      header: 'Lumen AI Personalization',
      accessorKey: () => (
        <Badge variant="accent" className="flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-[#00263D]" /> Active Adaptive
        </Badge>
      ),
      sortable: false,
    },
  ];

  return (
    <DashboardLayout pageTitle="Curriculum & Course Repository">
      <div className="space-y-6">
        <div className="flex items-center justify-between bg-white p-5 rounded-[20px] border border-[#E7EAEE]">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A]">AI-Powered Course Modules</h2>
            <p className="text-xs text-[#64748B]">Central repository of accredited syllabus for NEET, JEE & Foundation</p>
          </div>
        </div>

        <DataTable data={mockCourses} columns={columns} searchPlaceholder="Search courses..." />
      </div>
    </DashboardLayout>
  );
};

export default CoursesPage;
