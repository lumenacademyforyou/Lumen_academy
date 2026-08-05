import React, { useMemo, useState } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import StudentProfileDrawer from './StudentProfileDrawer';
import {
  Users,
  UserCheck,
  Crown,
  UserX,
  Upload,
  Download,
  Eye,
  ChevronDown,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';

export type StudentStatus = 'active' | 'pending' | 'suspended' | 'inactive';

export interface StudentRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  schoolName: string;
  batchName: string;
  board: string;
  district: string;
  targetExam: 'NEET' | 'JEE' | 'Foundation';
  plan: 'Premium' | 'Standard' | 'Free';
  progress: number;
  status: StudentStatus;
  parentContact: string;
  aiScore: number;
  mockTests: number;
  streak: number;
  weakSubjects: string[];
  strongSubjects: string[];
  renewalDate: string;
  paymentsCount: number;
  lastLogin: string;
  recentTests: number;
  recentVideos: number;
  recentDoubts: number;
}

const mockStudents: StudentRow[] = [
  {
    id: 'STU-1001',
    name: 'Aarav Sharma',
    email: 'aarav.s@gmail.com',
    phone: '+91 98765 43210',
    schoolName: 'Delhi Public School (R.K. Puram)',
    batchName: 'NEET Super 30 - 2026',
    board: 'CBSE',
    district: 'South Delhi',
    targetExam: 'NEET',
    plan: 'Premium',
    progress: 82,
    status: 'active',
    parentContact: '+91 98110 22334',
    aiScore: 88,
    mockTests: 24,
    streak: 14,
    weakSubjects: ['Organic Chemistry', 'Genetics'],
    strongSubjects: ['Physics', 'Botany'],
    renewalDate: '2026-11-15',
    paymentsCount: 3,
    lastLogin: '2 hours ago',
    recentTests: 4,
    recentVideos: 11,
    recentDoubts: 6,
  },
  {
    id: 'STU-1002',
    name: 'Priya Sundaram',
    email: 'priya.s@gmail.com',
    phone: '+91 98450 11223',
    schoolName: 'National Public School',
    batchName: 'Foundation Olympiad Batch A',
    board: 'ICSE',
    district: 'Bengaluru Urban',
    targetExam: 'Foundation',
    plan: 'Free',
    progress: 41,
    status: 'active',
    parentContact: '+91 99000 44556',
    aiScore: 62,
    mockTests: 9,
    streak: 3,
    weakSubjects: ['Algebra'],
    strongSubjects: ['English', 'Science'],
    renewalDate: '—',
    paymentsCount: 0,
    lastLogin: '1 day ago',
    recentTests: 1,
    recentVideos: 4,
    recentDoubts: 2,
  },
  {
    id: 'STU-1003',
    name: 'Karan Mehta',
    email: 'karan.m@gmail.com',
    phone: '+91 97120 88991',
    schoolName: 'St. Xavier High School',
    batchName: 'JEE Advanced Warriors',
    board: 'CBSE',
    district: 'Mumbai Suburban',
    targetExam: 'JEE',
    plan: 'Premium',
    progress: 91,
    status: 'inactive',
    parentContact: '+91 90040 77112',
    aiScore: 94,
    mockTests: 31,
    streak: 0,
    weakSubjects: ['Thermodynamics'],
    strongSubjects: ['Calculus', 'Mechanics'],
    renewalDate: '2026-09-02',
    paymentsCount: 5,
    lastLogin: '19 days ago',
    recentTests: 0,
    recentVideos: 0,
    recentDoubts: 0,
  },
];

/* ---------- Small building blocks ---------- */

const KPICard: React.FC<{ label: string; value: string; icon: React.ReactNode; tint: string }> = ({
  label,
  value,
  icon,
  tint,
}) => (
  <div className="bg-white p-5 rounded-[20px] border border-[#E7EAEE] flex items-center gap-4">
    <div className={`w-11 h-11 rounded-[14px] flex items-center justify-center ${tint}`}>{icon}</div>
    <div>
      <div className="text-[11px] font-bold text-[#64748B]">{label}</div>
      <div className="text-xl font-bold text-[#0F172A]">{value}</div>
    </div>
  </div>
);

const FilterSelect: React.FC<{ label: string; options: string[] }> = ({ label, options }) => (
  <div className="relative">
    <select className="appearance-none pl-3 pr-8 py-2 bg-[#F8F7F3] border border-[#E7EAEE] rounded-[12px] text-xs font-bold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#125F76]/30 cursor-pointer">
      <option>{label}</option>
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
    <ChevronDown className="w-3.5 h-3.5 text-[#64748B] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
  </div>
);

const statusBadge = (status: StudentStatus) => {
  const map: Record<StudentStatus, { variant: 'success' | 'warning' | 'error' | 'default'; dot: string; label: string }> = {
    active: { variant: 'success', dot: '🟢', label: 'Active' },
    pending: { variant: 'warning', dot: '🟡', label: 'Pending Verification' },
    suspended: { variant: 'error', dot: '🔴', label: 'Suspended' },
    inactive: { variant: 'default', dot: '⚪', label: 'Inactive' },
  };
  const s = map[status];
  return (
    <Badge variant={s.variant}>
      <span className="mr-1">{s.dot}</span>
      {s.label}
    </Badge>
  );
};

const COLORS = ['#125F76', '#FDB824', '#22C55E', '#94A3B8', '#EF4444'];

/* ---------- Analytics ---------- */

const AnalyticsSection: React.FC<{ students: StudentRow[] }> = ({ students }) => {
  const bySchool = useMemo(() => {
    const counts: Record<string, number> = {};
    students.forEach((s) => (counts[s.schoolName] = (counts[s.schoolName] || 0) + 1));
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [students]);

  const bySubscription = useMemo(() => {
    const counts: Record<string, number> = {};
    students.forEach((s) => (counts[s.plan] = (counts[s.plan] || 0) + 1));
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [students]);

  const activeVsInactive = useMemo(() => {
    const active = students.filter((s) => s.status === 'active').length;
    const inactive = students.length - active;
    return [
      { name: 'Active', value: active },
      { name: 'Inactive/Other', value: inactive },
    ];
  }, [students]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="bg-white p-5 rounded-[20px] border border-[#E7EAEE] lg:col-span-2">
        <h3 className="text-sm font-bold text-[#0F172A] mb-4">Students by School</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={bySchool} margin={{ left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F1EF" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748B' }} interval={0} angle={-15} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
            <Tooltip />
            <Bar dataKey="count" fill="#125F76" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white p-5 rounded-[20px] border border-[#E7EAEE]">
        <h3 className="text-sm font-bold text-[#0F172A] mb-4">Students by Subscription</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={bySubscription} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
              {bySubscription.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white p-5 rounded-[20px] border border-[#E7EAEE] lg:col-span-3">
        <h3 className="text-sm font-bold text-[#0F172A] mb-4">Active vs Inactive</h3>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={activeVsInactive} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={3}>
              {activeVsInactive.map((_, i) => (
                <Cell key={i} fill={i === 0 ? '#22C55E' : '#E7EAEE'} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

/* ---------- Main page ---------- */

export const StudentsPage: React.FC = () => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeStudent, setActiveStudent] = useState<StudentRow | null>(null);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => (prev.size === mockStudents.length ? new Set() : new Set(mockStudents.map((s) => s.id))));
  };

  const kpis = useMemo(() => {
    const total = mockStudents.length;
    const active = mockStudents.filter((s) => s.status === 'active').length;
    const premium = mockStudents.filter((s) => s.plan === 'Premium').length;
    const inactive = mockStudents.filter((s) => s.status === 'inactive').length;
    return { total, active, premium, inactive };
  }, []);

  const columns: Column<StudentRow>[] = [
    {
      header: (
        <input
          type="checkbox"
          checked={selectedIds.size === mockStudents.length}
          onChange={toggleSelectAll}
          className="w-3.5 h-3.5 accent-[#125F76]"
        />
      ) as unknown as string,
      accessorKey: (row) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row.id)}
          onChange={() => toggleSelect(row.id)}
          onClick={(e) => e.stopPropagation()}
          className="w-3.5 h-3.5 accent-[#125F76]"
        />
      ),
      sortable: false,
    },
    {
      header: 'Student',
      accessorKey: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#125F76] text-white flex items-center justify-center text-xs font-bold">
            {row.name[0]}
          </div>
          <div>
            <div className="font-bold text-[#0F172A]">{row.name}</div>
            <div className="text-[10px] text-[#64748B]">{row.email}</div>
          </div>
        </div>
      ),
      sortable: true,
    },
    { header: 'School', accessorKey: 'schoolName', sortable: true },
    { header: 'Batch', accessorKey: 'batchName', sortable: true },
    {
      header: 'Plan',
      accessorKey: (row) => (
        <Badge variant={row.plan === 'Premium' ? 'accent' : row.plan === 'Standard' ? 'info' : 'default'}>{row.plan}</Badge>
      ),
      sortable: true,
    },
    {
      header: 'Progress',
      accessorKey: (row) => (
        <div className="flex items-center gap-2 w-24">
          <div className="flex-1 h-1.5 bg-[#F1F1EF] rounded-full overflow-hidden">
            <div className="h-full bg-[#125F76] rounded-full" style={{ width: `${row.progress}%` }} />
          </div>
          <span className="text-[10px] font-bold text-[#0F172A]">{row.progress}%</span>
        </div>
      ),
      sortable: true,
    },
    {
      header: 'Status',
      accessorKey: (row) => statusBadge(row.status),
      sortable: true,
    },
    {
      header: 'Actions',
      accessorKey: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setActiveStudent(row);
          }}
          className="w-8 h-8 rounded-[10px] flex items-center justify-center text-[#125F76] hover:bg-[#125F76]/10 transition-colors"
          title="View student"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
      sortable: false,
    },
  ];

  return (
    <DashboardLayout pageTitle="Students">
      <div className="space-y-6">
        {/* Top Section */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-5 rounded-[20px] border border-[#E7EAEE]">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A]">Students</h2>
            <p className="text-xs text-[#64748B]">Manage students across all affiliated schools</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-[#125F76] text-white rounded-[14px] text-xs font-bold hover:bg-[#00263D] transition-colors shadow-md">
              <Upload className="w-4 h-4" /> Import Students
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-[#F8F7F3] border border-[#E7EAEE] rounded-[14px] text-xs font-bold text-[#0F172A] hover:bg-[#E7EAEE]">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard label="Total Students" value={kpis.total.toLocaleString()} icon={<Users className="w-5 h-5 text-white" />} tint="bg-[#125F76]" />
          <KPICard label="Active Students" value={kpis.active.toLocaleString()} icon={<UserCheck className="w-5 h-5 text-white" />} tint="bg-[#22C55E]" />
          <KPICard label="Premium Students" value={kpis.premium.toLocaleString()} icon={<Crown className="w-5 h-5 text-[#00263D]" />} tint="bg-[#FDB824]" />
          <KPICard label="Inactive" value={kpis.inactive.toLocaleString()} icon={<UserX className="w-5 h-5 text-[#64748B]" />} tint="bg-[#F1F1EF]" />
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-[20px] border border-[#E7EAEE] flex flex-wrap items-center gap-2.5">
          <FilterSelect label="School" options={['DPS RK Puram', 'National Public School', 'St. Xavier']} />
          <FilterSelect label="Subscription" options={['Premium', 'Standard', 'Free']} />
          <FilterSelect label="Board" options={['CBSE', 'ICSE', 'State Board']} />
          <FilterSelect label="Status" options={['Active', 'Pending Verification', 'Suspended', 'Inactive']} />
          <FilterSelect label="Batch" options={['NEET Super 30 - 2026', 'JEE Advanced Warriors', 'Foundation Olympiad Batch A']} />
          <FilterSelect label="District" options={['South Delhi', 'Bengaluru Urban', 'Mumbai Suburban']} />
        </div>

        {/* Bulk Actions Bar — shows when selection is active */}
        {selectedIds.size > 0 && (
          <div className="bg-[#00263D] text-white p-4 rounded-[16px] flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold">{selectedIds.size} student{selectedIds.size > 1 ? 's' : ''} selected</span>
            <div className="flex flex-wrap items-center gap-2">
              {['Export', 'Send Notification', 'Assign Plan', 'Deactivate', 'Activate'].map((action) => (
                <button
                  key={action}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-[10px] text-[11px] font-bold transition-colors"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Data Table */}
        <DataTable
          data={mockStudents}
          columns={columns}
          searchPlaceholder="Search by name, email, phone, school or student ID..."
        />

        {/* Analytics */}
        <AnalyticsSection students={mockStudents} />
      </div>

      {/* Student Profile Drawer */}
      <StudentProfileDrawer student={activeStudent} onClose={() => setActiveStudent(null)} />
    </DashboardLayout>
  );
};

export default StudentsPage;