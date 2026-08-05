import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, UserPlus, Sparkles, FileText, Download } from 'lucide-react';

export const QuickActions: React.FC = () => {
  const navigate = useNavigate();

  const actions = [
    { title: 'Onboard New School', icon: Plus, bg: 'bg-[#125F76]', text: 'text-white', path: '/schools' },
    // { title: 'Tune AI Model Weights', icon: Sparkles, bg: 'bg-[#FDB824]', text: 'text-[#00263D]' },
    { title: 'Generate NEET Audit', icon: FileText, bg: 'bg-white', text: 'text-[#0F172A]', border: true },
    { title: 'Export Financial Report', icon: Download, bg: 'bg-white', text: 'text-[#0F172A]', border: true },
  ];

  return (
    <div className="p-6 bg-white border border-[#E7EAEE] rounded-[20px] shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
      <h3 className="text-base font-bold text-[#0F172A] tracking-tight mb-4">Super Admin Actions</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {actions.map((act, idx) => {
          const Icon = act.icon;
          return (
            <button
              key={idx}
              onClick={() => act.path && navigate(act.path)}
              disabled={!act.path}
              className={`flex items-center gap-3 p-3.5 rounded-[16px] font-bold text-xs shadow-2xs transition-all duration-200 ${
                act.path ? 'hover:shadow-md cursor-pointer' : 'cursor-default opacity-90'
              } ${act.bg} ${act.text} ${
                act.border
                  ? 'border border-[#E7EAEE] hover:bg-[#F8F7F3] hover:border-[#125F76]/30'
                  : ''
              }`}
            >
              <div className="p-1.5 rounded-lg bg-black/10">
                <Icon className="w-4 h-4" />
              </div>
              <span className="truncate">{act.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default QuickActions;