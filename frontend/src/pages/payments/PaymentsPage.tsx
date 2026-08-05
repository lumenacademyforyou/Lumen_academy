import React from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import { DollarSign } from 'lucide-react';

interface PaymentRow {
  id: string;
  schoolName: string;
  amount: string;
  plan: string;
  paymentMethod: string;
  status: 'Completed' | 'Pending' | 'Failed';
  date: string;
}

const mockPayments: PaymentRow[] = [
  {
    id: 'TXN-90812',
    schoolName: 'Delhi Public School (R.K. Puram)',
    amount: '₹12,50,000',
    plan: 'Enterprise Annual Tier',
    paymentMethod: 'HDFC Corporate Banking',
    status: 'Completed',
    date: '2026-03-01',
  },
  {
    id: 'TXN-90813',
    schoolName: 'National Public School',
    amount: '₹8,00,000',
    plan: 'Pro Tier Annual',
    paymentMethod: 'Razorpay Enterprise',
    status: 'Completed',
    date: '2026-02-28',
  },
  {
    id: 'TXN-90814',
    schoolName: 'St. Xavier High School',
    amount: '₹15,00,000',
    plan: 'Enterprise Platinum + AI Tokens',
    paymentMethod: 'ICICI Bank Transfer',
    status: 'Completed',
    date: '2026-02-15',
  },
];

export const PaymentsPage: React.FC = () => {
  const columns: Column<PaymentRow>[] = [
    {
      header: 'Transaction ID',
      accessorKey: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#22C55E]/10 text-[#22C55E] flex items-center justify-center font-bold text-xs">
            <DollarSign className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-[#0F172A]">{row.id}</div>
            <div className="text-[10px] text-[#64748B]">{row.paymentMethod}</div>
          </div>
        </div>
      ),
      sortable: true,
    },
    { header: 'Affiliated School', accessorKey: 'schoolName', sortable: true },
    { header: 'Subscription Tier', accessorKey: 'plan', sortable: true },
    { header: 'Amount Paid', accessorKey: 'amount', sortable: true },
    {
      header: 'Payment Status',
      accessorKey: (row) => (
        <Badge variant={row.status === 'Completed' ? 'success' : row.status === 'Pending' ? 'warning' : 'error'}>
          {row.status.toUpperCase()}
        </Badge>
      ),
      sortable: true,
    },
    { header: 'Invoice Date', accessorKey: 'date', sortable: true },
  ];

  return (
    <DashboardLayout pageTitle="Financial Subscriptions & Payment Transactions">
      <div className="space-y-6">
        <div className="flex items-center justify-between bg-white p-5 rounded-[20px] border border-[#E7EAEE]">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A]">Enterprise Revenue Ledger</h2>
            <p className="text-xs text-[#64748B]">Super Admin view of school subscriptions, renewals & AI compute billing</p>
          </div>
        </div>

        <DataTable data={mockPayments} columns={columns} searchPlaceholder="Search transactions or schools..." />
      </div>
    </DashboardLayout>
  );
};

export default PaymentsPage;
