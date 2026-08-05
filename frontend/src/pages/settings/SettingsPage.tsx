import React, { useState } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Sliders, Shield, Save } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [siteName, setSiteName] = useState('Lumen Academy');
  const [supportEmail, setSupportEmail] = useState('superadmin@lumenacademy.edu');
  const [enableMfa, setEnableMfa] = useState(true);

  return (
    <DashboardLayout pageTitle="Super Admin Platform Settings">
      <div className="max-w-4xl space-y-6">
        <div className="bg-white p-6 rounded-[20px] border border-[#E7EAEE] shadow-sm space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-[#E7EAEE]">
            <div className="w-10 h-10 rounded-[14px] bg-[#00263D] text-[#FDB824] flex items-center justify-center font-bold">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">Global Platform Configuration</h2>
              <p className="text-xs text-[#64748B]">Manage system-wide branding, security enforcement & notifications</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">Platform Brand Name</label>
              <input
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="w-full max-w-md p-3 bg-[#F8F7F3] border border-[#E7EAEE] rounded-[14px] text-xs font-semibold text-[#0F172A]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">Super Admin Escalation Email</label>
              <input
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                className="w-full max-w-md p-3 bg-[#F8F7F3] border border-[#E7EAEE] rounded-[14px] text-xs font-semibold text-[#0F172A]"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-[#E7EAEE]">
            <h3 className="text-sm font-bold text-[#0F172A] mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#125F76]" /> Security & Access Controls
            </h3>
            <div className="flex items-center justify-between p-4 bg-[#F8F7F3] rounded-[16px] border border-[#E7EAEE] max-w-md">
              <div>
                <span className="text-xs font-bold text-[#0F172A] block">Enforce Multi-Factor Authentication (MFA)</span>
                <span className="text-[10px] text-[#64748B]">Mandatory for all Super Admins & School Admins</span>
              </div>
              <input
                type="checkbox"
                checked={enableMfa}
                onChange={(e) => setEnableMfa(e.target.checked)}
                className="w-4 h-4 accent-[#125F76]"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-[#E7EAEE] flex justify-end">
            <button className="flex items-center gap-2 px-5 py-2.5 bg-[#125F76] text-white rounded-[14px] text-xs font-bold hover:bg-[#00263D] transition-colors shadow-md">
              <Save className="w-4 h-4" /> Save Configuration
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
