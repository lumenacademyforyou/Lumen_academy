import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import { UserCheck } from 'lucide-react';
import { getSchoolAdmins } from '../../api/schoolAdmins';

interface SchoolAdminRow {
  _id: string;
  name: string;
  email: string;
  phone: string;
  schoolName: string;
  role: string;
  status: 'active' | 'suspended';
  lastLogin?: string;
}

export const SchoolAdminsPage: React.FC = () => {
  const [admins, setAdmins] = useState<SchoolAdminRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSchoolAdmins();
  }, []);

  const fetchSchoolAdmins = async () => {
    try {
      const response = await getSchoolAdmins();
      setAdmins(response.data);
    } catch (error) {
      console.error('Failed to fetch school admins', error);
    } finally {
      setLoading(false);
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
  ];

  return (
    <DashboardLayout pageTitle="School Administrators Management">
      <div className="space-y-6">

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-5 rounded-[20px] border border-[#E7EAEE]">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A']">
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
          <div className="bg-white rounded-xl p-10 text-center">
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