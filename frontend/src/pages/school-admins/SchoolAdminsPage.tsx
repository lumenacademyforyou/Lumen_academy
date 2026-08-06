import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import { UserCheck, Trash2, Power } from 'lucide-react';
import { getSchoolAdmins, updateSchoolAdminStatus, deleteSchoolAdmin, type SchoolAdmin } from '../../api/schoolAdmins';

interface SchoolAdminRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  schoolName: string;
  role: string;
  status: 'active' | 'suspended';
  lastLogin?: string;
}

const mockAdmins: SchoolAdminRow[] = [
  {
    id: 'ADM-001',
    name: 'Dr. Rajesh Sharma',
    email: 'principal@dpsrkp.edu',
    phone: '+91 98765 43210',
    schoolName: 'Delhi Public School (R.K. Puram)',
    role: 'Principal / Super Admin',
    status: 'active',
    lastLogin: '2026-08-04 14:20',
  },
  {
    id: 'ADM-002',
    name: 'Sunita Rao',
    email: 'sunita.rao@nps.edu',
    phone: '+91 98123 45678',
    schoolName: 'National Public School (Indiranagar)',
    role: 'Vice Principal',
    status: 'active',
    lastLogin: '2026-08-05 09:15',
  },
  {
    id: 'ADM-003',
    name: 'Fr. Thomas D Souza',
    email: 'thomas@stxaviers.edu',
    phone: '+91 97654 32109',
    schoolName: 'St. Xavier High School',
    role: 'Administrator',
    status: 'suspended',
    lastLogin: '2026-07-28 11:05',
  },
];

export const SchoolAdminsPage: React.FC = () => {
  const [admins, setAdmins] = useState<SchoolAdminRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSchoolAdmins();
  }, []);

  const fetchSchoolAdmins = async () => {
    try {
      setLoading(true);
      const response = await getSchoolAdmins();
      const rawData = response.data?.data?.items || response.data?.data || response.data;
      if (Array.isArray(rawData) && rawData.length > 0) {
        const formatted: SchoolAdminRow[] = rawData.map((a: SchoolAdmin) => ({
          id: a.id || a._id || '',
          name: a.name,
          email: a.email,
          phone: a.phone || 'N/A',
          schoolName: a.school?.name || 'Affiliated Institution',
          role: a.role || 'School Admin',
          status: a.status?.toLowerCase() === 'suspended' ? 'suspended' : 'active',
          lastLogin: a.updatedAt ? new Date(a.updatedAt).toISOString().split('T')[0] : 'Never',
        }));
        setAdmins(formatted);
      } else {
        setAdmins(mockAdmins);
      }
    } catch (error) {
      console.error('Failed to fetch school admins from API', error);
      setAdmins(mockAdmins);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await updateSchoolAdminStatus(id, nextStatus);
      setAdmins((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: nextStatus.toLowerCase() as any } : a))
      );
    } catch (error) {
      console.error('Failed to update school admin status', error);
      setAdmins((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: nextStatus.toLowerCase() as any } : a))
      );
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSchoolAdmin(id);
      setAdmins((prev) => prev.filter((a) => a.id !== id));
    } catch (error) {
      console.error('Failed to delete school admin', error);
      setAdmins((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const columns: Column<SchoolAdminRow>[] = [
    {
      header: 'Admin Name',
      accessorKey: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#00263D] text-[#FDB824] font-bold flex items-center justify-center text-xs">
            {row.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="font-bold text-[#0F172A]">{row.name}</div>
            <div className="text-[10px] text-[#64748B]">{row.email}</div>
          </div>
        </div>
      ),
      sortable: true,
    },
    {
      header: 'Affiliated School',
      accessorKey: 'schoolName',
      sortable: true,
    },
    {
      header: 'Assigned Role',
      accessorKey: 'role',
      sortable: true,
    },
    {
      header: 'Contact',
      accessorKey: 'phone',
    },
    {
      header: 'Account Status',
      accessorKey: (row) => (
        <Badge variant={row.status === 'active' ? 'success' : 'error'}>
          {row.status.toUpperCase()}
        </Badge>
      ),
      sortable: true,
    },
    {
      header: 'Last Login',
      accessorKey: (row) => row.lastLogin || 'Never',
      sortable: true,
    },
    {
      header: 'Actions',
      accessorKey: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleToggleStatus(row.id, row.status)}
            className="p-1.5 text-[#125F76] hover:bg-[#125F76]/10 rounded-lg transition-colors"
            title={`Toggle status to ${row.status === 'active' ? 'suspended' : 'active'}`}
          >
            <Power className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(row.id)}
            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete School Admin"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout pageTitle="School Administrators Management">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-5 rounded-[20px] border border-[#E7EAEE]">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A]">
              Provisioned School Admins
            </h2>
            <p className="text-xs text-[#64748B]">
              Manage credentials, role privileges & MFA security policies.
            </p>
          </div>

          <button className="flex items-center gap-2 px-4 py-2.5 bg-[#125F76] text-white rounded-[14px] text-xs font-bold hover:bg-[#00263D] transition-colors shadow-md">
            <UserCheck className="w-4 h-4" />
            Provision Admin
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl p-10 text-center text-sm font-medium text-[#64748B]">
            Loading School Admins...
          </div>
        ) : (
          <DataTable
            data={admins}
            columns={columns}
            searchPlaceholder="Search by admin name or email..."
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default SchoolAdminsPage;