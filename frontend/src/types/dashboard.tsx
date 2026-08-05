export interface KpiItem {
  id: string;
  title: string;
  value: string | number;
  change: number;
  trend: 'up' | 'down' | 'neutral';
  description: string;
  iconName: string;
}

export interface RevenueDataPoint {
  month: string;
  revenue: number;
  subscriptions: number;
  aiUsageCost: number;
}

export interface RecentActivityItem {
  id: string;
  type: 'school_onboarded' | 'admin_added' | 'payment_received' | 'ai_alert';
  title: string;
  description: string;
  timestamp: string;
  status: 'success' | 'warning' | 'info' | 'error';
}
