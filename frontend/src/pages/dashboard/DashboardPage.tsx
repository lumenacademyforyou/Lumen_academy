import React from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import KpiGrid from '../../features/dashboard/components/KpiGrid';
import RevenueChart from '../../features/dashboard/components/RevenueChart';
import RecentActivity from '../../features/dashboard/components/RecentActivity';
import QuickActions from '../../features/dashboard/components/QuickActions';

export const DashboardPage: React.FC = () => {
  return (
    <DashboardLayout pageTitle="Super Admin Overview">
      <div className="space-y-6">
        {/* Top KPI Grid */}
        <KpiGrid />

        {/* Quick Actions Bar */}
        {/* <QuickActions /> */}

        {/* Charts & Activity Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RevenueChart />
          </div>
          <div className="lg:col-span-1">
            <RecentActivity />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;
