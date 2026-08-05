import React from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import { Layers } from 'lucide-react';

interface BatchRow {
  id: string;
  name: string;
  targetProgram: 'NEET' | 'JEE' | 'Foundation';
  schoolName: string;
  studentCount: number;
  startDate: string;
  status: 'Active' | 'Completed' | 'Upcoming';
}

const mockBatches: BatchRow[] = [
  {
    id: 'BAT-2026-01',
    name: 'NEET Super 30 - Intensive 2026',
    targetProgram: 'NEET',
    schoolName: 'Delhi Public School',
    studentCount: 120,
    startDate: '2025-06-01',
    status: 'Active',
  },
  {
    id: 'BAT-2026-02',
    name: 'JEE Advanced Rankers Sprint',
    targetProgram: 'JEE',
    schoolName: 'National Public School',
    studentCount: 95,
    startDate: '2025-07-15',
    status: 'Active',
  },
  {
    id: 'BAT-2026-03',
    name: 'Foundation Science & Math Builders',
    targetProgram: 'Foundation',
    schoolName: 'St. Xavier High School',
    studentCount: 150,
    startDate: '2025-08-01',
    status: 'Active',
  },
];

export const BatchesPage: React.FC = () => {
  const columns: Column<BatchRow>[] = [
    {
      header: 'Batch Title',
      accessorKey: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#00263D] text-[#FDB824] flex items-center justify-center font-bold text-xs">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-[#0F172A]">{row.name}</div>
            <div className="text-[10px] text-[#64748B]">ID: {row.id}</div>
          </div>
        </div>
      ),
      sortable: true,
    },
    { header: 'Target Exam', accessorKey: 'targetProgram', sortable: true },
    { header: 'Associated School', accessorKey: 'schoolName', sortable: true },
    { header: 'Enrolled Aspirants', accessorKey: 'studentCount', sortable: true },
    { header: 'Start Date', accessorKey: 'startDate', sortable: true },
    {
      header: 'Status',
      accessorKey: (row) => (
        <Badge variant={row.status === 'Active' ? 'success' : 'neutral'}>{row.status}</Badge>
      ),
      sortable: true,
    },
  ];

  return (
    <DashboardLayout pageTitle="Academic Batches & Target Streams">
      <div className="space-y-6">
        <div className="flex items-center justify-between bg-white p-5 rounded-[20px] border border-[#E7EAEE]">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A]">Batch Allocation Console</h2>
            <p className="text-xs text-[#64748B]">Organize students into target NEET, JEE, and Foundation cohorts</p>
          </div>
        </div>

        <DataTable data={mockBatches} columns={columns} searchPlaceholder="Search batches..." />
      </div>
    </DashboardLayout>
  );
};

export default BatchesPage;
