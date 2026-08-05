import { useState, useEffect } from 'react';

export interface DashboardStatsState {
  totalRevenue: number;
  totalStudents: number;
  totalSchools: number;
  totalAdmins: number;
  aiUsageTokens: number;
  isLoading: boolean;
}

export const useDashboardStats = () => {
  const [stats, setStats] = useState<DashboardStatsState>({
    totalRevenue: 4850000,
    totalStudents: 142850,
    totalSchools: 384,
    totalAdmins: 1120,
    aiUsageTokens: 42800000,
    isLoading: false,
  });

  useEffect(() => {
    // Simulated fetching hook
    setStats((prev) => ({ ...prev, isLoading: false }));
  }, []);

  return stats;
};

export default useDashboardStats;
