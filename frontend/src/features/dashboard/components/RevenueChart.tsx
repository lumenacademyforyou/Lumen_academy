import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import ChartCard from '../../../components/ui/ChartCard';

const data = [
  { month: 'Jan', revenue: 3200000, aiTokens: 1800000 },
  { month: 'Feb', revenue: 3500000, aiTokens: 2100000 },
  { month: 'Mar', revenue: 3900000, aiTokens: 2600000 },
  { month: 'Apr', revenue: 4100000, aiTokens: 3100000 },
  { month: 'May', revenue: 4400000, aiTokens: 3700000 },
  { month: 'Jun', revenue: 4850000, aiTokens: 4280000 },
];

export const RevenueChart: React.FC = () => {
  return (
    <ChartCard
      title="Revenue Growth & AI Utilization"
      subtitle="Monthly revenue in INR vs AI Compute Consumption"
      action={
        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#125F76]" />
            <span className="text-[#0F172A]">Revenue (₹)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#FDB824]" />
            <span className="text-[#0F172A]">AI Tokens</span>
          </div>
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#125F76" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#125F76" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="colorAi" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#FDB824" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#FDB824" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E7EAEE" vertical={false} />
          <XAxis dataKey="month" stroke="#64748B" fontSize={12} tickLine={false} />
          <YAxis stroke="#64748B" fontSize={12} tickLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#00263D',
              borderColor: '#125F76',
              borderRadius: '14px',
              color: '#FFFFFF',
              fontSize: '12px',
            }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#125F76"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorRevenue)"
          />
          <Area
            type="monotone"
            dataKey="aiTokens"
            stroke="#FDB824"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorAi)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

export default RevenueChart;
