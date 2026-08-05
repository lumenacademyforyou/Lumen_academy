import React from 'react';
import { Building2, UserPlus, CreditCard, Sparkles } from 'lucide-react';
import Badge from '../../../components/ui/Badge';

export const RecentActivity: React.FC = () => {
  const activities = [
    {
      id: '1',
      icon: Building2,
      title: 'Delhi Public School (R.K. Puram)',
      desc: 'Onboarded 1,200 NEET aspirants & 4 School Admins.',
      time: '15m ago',
      badge: { label: 'New School', variant: 'success' as const },
    },
    {
      id: '2',
      icon: Sparkles,
      title: 'AI Question Engine Surge',
      desc: 'JEE Advanced mock test batch auto-generated 4,500 questions.',
      time: '45m ago',
      badge: { label: 'AI Core', variant: 'accent' as const },
    },
    {
      id: '3',
      icon: CreditCard,
      title: 'Subscription Renewal',
      desc: 'Apex Academy renewed annual Super Admin Enterprise tier (₹12,00,000).',
      time: '2h ago',
      badge: { label: 'Payment', variant: 'info' as const },
    },
    {
      id: '4',
      icon: UserPlus,
      title: 'New Admin Provisioned',
      desc: 'Dr. Savitha Nair assigned as Principal Admin for Allen Hub.',
      time: '4h ago',
      badge: { label: 'User Admin', variant: 'warning' as const },
    },
  ];

  return (
    <div className="p-6 bg-white border border-[#E7EAEE] rounded-[20px] shadow-sm hover:shadow-md transition-all duration-200 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-[#0F172A] tracking-tight">Recent Platform Activity</h3>
        <button className="text-xs font-semibold text-[#125F76] hover:underline">View All Log</button>
      </div>

      <div className="divide-y divide-[#E7EAEE] flex-1">
        {activities.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.id} className="py-3.5 flex items-start gap-3.5 group">
              <div className="w-9 h-9 rounded-[12px] bg-[#F8F7F3] border border-[#E7EAEE] flex items-center justify-center text-[#125F76] shrink-0 group-hover:bg-[#125F76] group-hover:text-white transition-colors">
                <Icon className="w-4 h-4" />
              </div>

              <div className="flex-1 overflow-hidden">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-[#0F172A] truncate">{item.title}</h4>
                  <Badge variant={item.badge.variant}>{item.badge.label}</Badge>
                </div>
                <p className="text-[11px] text-[#64748B] mt-0.5 leading-relaxed">{item.desc}</p>
                <span className="text-[10px] text-[#64748B]/80 mt-1 block">{item.time}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecentActivity;
