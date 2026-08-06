
import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import { Building2, Plus, Download, Trash2, RefreshCw } from 'lucide-react';
import AddSchoolPage, { type NewSchoolFormData } from './AddSchoolPage';
import { getSchools, createSchool, deleteSchool, type School } from '../../api/schools';

interface SchoolData {
  id: string;
  name: string;
  code: string;
  city: string;
  state: string;
  targetPrograms: string;
  totalStudents: number;
  totalAdmins: number;
  status: 'active' | 'inactive' | 'pending' | 'trial';
  onboardedDate: string;
}

type View = 'list' | 'add';

// Maps a raw API School object -> the shape the table needs.
// Centralized here so if the backend field names change, you only fix it in one place.
const mapSchoolToRow = (s: School): SchoolData => ({
  id: s.id,
  name: s.name,
  code: s.code,
  city: s.district || '—',
  state: s.state || '—',
  targetPrograms: s.board || '—',
  totalStudents: s.maxStudents || 0,
  totalAdmins: (s as any).totalAdmins ?? (s as any).adminCount ?? 0,
  status: (s.status?.toLowerCase() as SchoolData['status']) || 'active',
  onboardedDate: s.createdAt
    ? new Date(s.createdAt).toISOString().split('T')[0]
    : '—',
});

export const SchoolsPage: React.FC = () => {
  const [view, setView] = useState<View>('list');
  const [schools, setSchools] = useState<SchoolData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSchools();
  }, []);

  const fetchSchools = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await getSchools();

      // Normalize whatever shape the backend wraps the array in.
      const rawData: School[] =
        res.data?.data?.items ?? res.data?.data ?? res.data ?? [];

      if (!Array.isArray(rawData)) {
        throw new Error('Unexpected response shape from /schools API');
      }

      setSchools(rawData.map(mapSchoolToRow));
    } catch (err: any) {
      console.error('Failed to fetch schools from backend API', err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to load schools. Please try again.'
      );
      setSchools([]); // no mock fallback — show the empty/error state instead
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const prev = schools;
    // optimistic update
    setSchools((cur) => cur.filter((s) => s.id !== id));
    try {
      await deleteSchool(id);
    } catch (err) {
      console.error('Failed to delete school', err);
      setSchools(prev); // roll back on failure instead of pretending it worked
      setError('Failed to delete school. Please try again.');
    }
  };

  const handleSaveDraft = (data: NewSchoolFormData) => {
    setView('list');
  };

  const handleCreate = async (data: NewSchoolFormData) => {
    try {
      await createSchool({
        name: data.schoolName,
        code: data.schoolCode,
        board: data.board,
        schoolType: data.schoolType,
        medium: data.medium,
        address: data.address,
        district: data.district,
        state: data.state,
        pincode: data.pincode,
        plan: data.plan,
        maxStudents: data.maxStudents ? parseInt(data.maxStudents, 10) : undefined,
        status: data.status.toUpperCase() as any,
      });
      await fetchSchools(); // pulls the freshly created record from the backend
    } catch (err) {
      console.error('Failed to create school via API', err);
      setError('Failed to create school. Please try again.');
    } finally {
      setView('list');
    }
  };

  const columns: Column<SchoolData>[] = [
    {
      header: 'School Details',
      accessorKey: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[12px] bg-[#125F76]/10 text-[#125F76] font-bold flex items-center justify-center border border-[#125F76]/20">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-[#0F172A]">{row.name}</div>
            <div className="text-[10px] text-[#64748B]">Code: {row.code}</div>
          </div>
        </div>
      ),
      sortable: true,
    },
    { header: 'Location', accessorKey: (row) => `${row.city}, ${row.state}`, sortable: true },
    { header: 'Programs Offered', accessorKey: 'targetPrograms', sortable: false },
    { header: 'Students', accessorKey: 'totalStudents', sortable: true },
    { header: 'Admins', accessorKey: 'totalAdmins', sortable: true },
    {
      header: 'Status',
      accessorKey: (row) => (
        <Badge variant={row.status === 'active' ? 'success' : row.status === 'pending' || row.status === 'trial' ? 'warning' : 'error'}>
          {row.status.toUpperCase()}
        </Badge>
      ),
      sortable: true,
    },
    { header: 'Onboarded', accessorKey: 'onboardedDate', sortable: true },
    {
      header: 'Actions',
      accessorKey: (row) => (
        <button
          onClick={() => handleDelete(row.id)}
          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          title="Delete School"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  if (view === 'add') {
    return (
      <DashboardLayout pageTitle="Add School">
        <AddSchoolPage onBack={() => setView('list')} onSaveDraft={handleSaveDraft} onCreate={handleCreate} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout pageTitle="Affiliated Schools Management">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-5 rounded-[20px] border border-[#E7EAEE]">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A]">Registered Partner Schools</h2>
            <p className="text-xs text-[#64748B]">Manage institution accounts, seat capacity & program access</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={fetchSchools}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#F8F7F3] border border-[#E7EAEE] rounded-[14px] text-xs font-bold text-[#0F172A] hover:bg-[#E7EAEE]"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-[#F8F7F3] border border-[#E7EAEE] rounded-[14px] text-xs font-bold text-[#0F172A] hover:bg-[#E7EAEE]">
              <Download className="w-4 h-4" /> Export CSV
            </button>
           
          </div>
        </div>

        {/* Error banner */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-[14px] p-4 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={fetchSchools} className="underline font-bold">
              Retry
            </button>
          </div>
        )}

        {/* Data Table */}
        {loading ? (
          <div className="bg-white rounded-xl p-10 text-center text-sm font-medium text-[#64748B]">
            Loading Schools...
          </div>
        ) : schools.length === 0 && !error ? (
          <div className="bg-white rounded-xl p-10 text-center text-sm font-medium text-[#64748B]">
            No schools found yet. Click "Add New School" to onboard your first one.
          </div>
        ) : (
          <DataTable data={schools} columns={columns} searchPlaceholder="Search by school name or city..." />
        )}
      </div>
    </DashboardLayout>
  );
};

export default SchoolsPage;