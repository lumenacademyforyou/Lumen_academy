// import React, { useState } from 'react';
// import DashboardLayout from '../../layouts/DashboardLayout';
// import DataTable, { type Column } from '../../components/ui/DataTable';
// import Badge from '../../components/ui/Badge';
// import { Building2, Plus, Download } from 'lucide-react';
// import Modal from '../../components/ui/Modal';

// interface SchoolData {
//   id: string;
//   name: string;
//   code: string;
//   city: string;
//   state: string;
//   targetPrograms: string;
//   totalStudents: number;
//   totalAdmins: number;
//   status: 'active' | 'inactive' | 'pending';
//   onboardedDate: string;
// }

// const mockSchools: SchoolData[] = [
//   {
//     id: 'SCH-001',
//     name: 'Delhi Public School (R.K. Puram)',
//     code: 'DPS-RKP',
//     city: 'New Delhi',
//     state: 'Delhi',
//     targetPrograms: 'NEET, JEE',
//     totalStudents: 1450,
//     totalAdmins: 6,
//     status: 'active',
//     onboardedDate: '2025-01-15',
//   },
//   {
//     id: 'SCH-002',
//     name: 'National Public School (Indiranagar)',
//     code: 'NPS-IND',
//     city: 'Bengaluru',
//     state: 'Karnataka',
//     targetPrograms: 'JEE, Foundation',
//     totalStudents: 980,
//     totalAdmins: 4,
//     status: 'active',
//     onboardedDate: '2025-02-10',
//   },
//   {
//     id: 'SCH-003',
//     name: 'St. Xavier High School',
//     code: 'SXH-MUM',
//     city: 'Mumbai',
//     state: 'Maharashtra',
//     targetPrograms: 'NEET, JEE, Foundation',
//     totalStudents: 2100,
//     totalAdmins: 8,
//     status: 'active',
//     onboardedDate: '2024-11-20',
//   },
//   {
//     id: 'SCH-004',
//     name: 'Dav Public School (Bhubaneswar)',
//     code: 'DAV-BHU',
//     city: 'Bhubaneswar',
//     state: 'Odisha',
//     targetPrograms: 'NEET',
//     totalStudents: 640,
//     totalAdmins: 3,
//     status: 'pending',
//     onboardedDate: '2026-03-01',
//   },
// ];

// export const SchoolsPage: React.FC = () => {
//   const [isModalOpen, setIsModalOpen] = useState(false);

//   const columns: Column<SchoolData>[] = [
//     {
//       header: 'School Details',
//       accessorKey: (row) => (
//         <div className="flex items-center gap-3">
//           <div className="w-10 h-10 rounded-[12px] bg-[#125F76]/10 text-[#125F76] font-bold flex items-center justify-center border border-[#125F76]/20">
//             <Building2 className="w-5 h-5" />
//           </div>
//           <div>
//             <div className="font-bold text-[#0F172A]">{row.name}</div>
//             <div className="text-[10px] text-[#64748B]">Code: {row.code}</div>
//           </div>
//         </div>
//       ),
//       sortable: true,
//     },
//     { header: 'Location', accessorKey: (row) => `${row.city}, ${row.state}`, sortable: true },
//     { header: 'Programs Offered', accessorKey: 'targetPrograms', sortable: false },
//     { header: 'Students', accessorKey: 'totalStudents', sortable: true },
//     { header: 'Admins', accessorKey: 'totalAdmins', sortable: true },
//     {
//       header: 'Status',
//       accessorKey: (row) => (
//         <Badge variant={row.status === 'active' ? 'success' : row.status === 'pending' ? 'warning' : 'error'}>
//           {row.status.toUpperCase()}
//         </Badge>
//       ),
//       sortable: true,
//     },
//     { header: 'Onboarded', accessorKey: 'onboardedDate', sortable: true },
//   ];

//   return (
//     <DashboardLayout pageTitle="Affiliated Schools Management">
//       <div className="space-y-6">
//         {/* Header Actions */}
//         <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-5 rounded-[20px] border border-[#E7EAEE]">
//           <div>
//             <h2 className="text-lg font-bold text-[#0F172A]">Registered Partner Schools</h2>
//             <p className="text-xs text-[#64748B]">Manage institution accounts, seat capacity & program access</p>
//           </div>
//           <div className="flex items-center gap-3 w-full sm:w-auto">
//             <button className="flex items-center gap-2 px-4 py-2.5 bg-[#F8F7F3] border border-[#E7EAEE] rounded-[14px] text-xs font-bold text-[#0F172A] hover:bg-[#E7EAEE]">
//               <Download className="w-4 h-4" /> Export CSV
//             </button>
//             <button
//               onClick={() => setIsModalOpen(true)}
//               className="flex items-center gap-2 px-4 py-2.5 bg-[#125F76] text-white rounded-[14px] text-xs font-bold hover:bg-[#00263D] transition-colors shadow-md"
//             >
//               <Plus className="w-4 h-4" /> Add New School
//             </button>
//           </div>
//         </div>

//         {/* Data Table */}
//         <DataTable data={mockSchools} columns={columns} searchPlaceholder="Search by school name or city..." />
//       </div>

//       {/* Add School Modal */}
//       <Modal
//         isOpen={isModalOpen}
//         onClose={() => setIsModalOpen(false)}
//         title="Onboard New Affiliated School"
//         footer={
//           <>
//             <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-[#64748B]">
//               Cancel
//             </button>
//             <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold bg-[#125F76] text-white">
//               Save School
//             </button>
//           </>
//         }
//       >
//         <div className="space-y-4">
//           <div>
//             <label className="block text-xs font-bold text-[#0F172A] mb-1">School Name</label>
//             <input type="text" placeholder="e.g. Modern School Barakhamba" className="w-full p-2.5 bg-[#F8F7F3] border border-[#E7EAEE] rounded-xl text-xs" />
//           </div>
//           <div className="grid grid-cols-2 gap-4">
//             <div>
//               <label className="block text-xs font-bold text-[#0F172A] mb-1">City</label>
//               <input type="text" placeholder="e.g. New Delhi" className="w-full p-2.5 bg-[#F8F7F3] border border-[#E7EAEE] rounded-xl text-xs" />
//             </div>
//             <div>
//               <label className="block text-xs font-bold text-[#0F172A] mb-1">State</label>
//               <input type="text" placeholder="e.g. Delhi" className="w-full p-2.5 bg-[#F8F7F3] border border-[#E7EAEE] rounded-xl text-xs" />
//             </div>
//           </div>
//         </div>
//       </Modal>
//     </DashboardLayout>
//   );
// };

// export default SchoolsPage;


import React, { useState } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import { Building2, Plus, Download } from 'lucide-react';
import AddSchoolPage, { type NewSchoolFormData } from './AddSchoolPage';

interface SchoolData {
  id: string;
  name: string;
  code: string;
  city: string;
  state: string;
  targetPrograms: string;
  totalStudents: number;
  totalAdmins: number;
  status: 'active' | 'inactive' | 'pending';
  onboardedDate: string;
}

const mockSchools: SchoolData[] = [
  {
    id: 'SCH-001',
    name: 'Delhi Public School (R.K. Puram)',
    code: 'DPS-RKP',
    city: 'New Delhi',
    state: 'Delhi',
    targetPrograms: 'NEET, JEE',
    totalStudents: 1450,
    totalAdmins: 6,
    status: 'active',
    onboardedDate: '2025-01-15',
  },
  {
    id: 'SCH-002',
    name: 'National Public School (Indiranagar)',
    code: 'NPS-IND',
    city: 'Bengaluru',
    state: 'Karnataka',
    targetPrograms: 'JEE, Foundation',
    totalStudents: 980,
    totalAdmins: 4,
    status: 'active',
    onboardedDate: '2025-02-10',
  },
  {
    id: 'SCH-003',
    name: 'St. Xavier High School',
    code: 'SXH-MUM',
    city: 'Mumbai',
    state: 'Maharashtra',
    targetPrograms: 'NEET, JEE, Foundation',
    totalStudents: 2100,
    totalAdmins: 8,
    status: 'active',
    onboardedDate: '2024-11-20',
  },
  {
    id: 'SCH-004',
    name: 'Dav Public School (Bhubaneswar)',
    code: 'DAV-BHU',
    city: 'Bhubaneswar',
    state: 'Odisha',
    targetPrograms: 'NEET',
    totalStudents: 640,
    totalAdmins: 3,
    status: 'pending',
    onboardedDate: '2026-03-01',
  },
];

type View = 'list' | 'add';

export const SchoolsPage: React.FC = () => {
  const [view, setView] = useState<View>('list');

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
        <Badge variant={row.status === 'active' ? 'success' : row.status === 'pending' ? 'warning' : 'error'}>
          {row.status.toUpperCase()}
        </Badge>
      ),
      sortable: true,
    },
    { header: 'Onboarded', accessorKey: 'onboardedDate', sortable: true },
  ];

  const handleSaveDraft = (data: NewSchoolFormData) => {
    // TODO: wire to your API — persist as draft (status untouched, isDraft: true)
    console.log('Saved as draft', data);
    setView('list');
  };

  const handleCreate = (data: NewSchoolFormData) => {
    // TODO: wire to your API — POST to create the school
    console.log('Creating school', data);
    setView('list');
  };

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
            <button className="flex items-center gap-2 px-4 py-2.5 bg-[#F8F7F3] border border-[#E7EAEE] rounded-[14px] text-xs font-bold text-[#0F172A] hover:bg-[#E7EAEE]">
              <Download className="w-4 h-4" /> Export CSV
            </button>
      
          </div>
        </div>

        {/* Data Table */}
        <DataTable data={mockSchools} columns={columns} searchPlaceholder="Search by school name or city..." />
      </div>
    </DashboardLayout>
  );
};

export default SchoolsPage;