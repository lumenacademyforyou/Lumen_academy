import React, { useState } from 'react';
import {
  ArrowLeft,
  Building2,
  MapPin,
  User,
  CreditCard,
  CircleDot,
} from 'lucide-react';

export interface NewSchoolFormData {
  // Basic Information
  schoolName: string;
  schoolCode: string;
  board: string;
  schoolType: string;
  medium: string;
  // Location
  address: string;
  district: string;
  state: string;
  pincode: string;
  // Contact
  principal: string;
  phone: string;
  email: string;
  // Subscription
  plan: string;
  maxStudents: string;
  startDate: string;
  endDate: string;
  // Status
  status: 'active' | 'inactive' | 'trial';
}

const emptyForm: NewSchoolFormData = {
  schoolName: '',
  schoolCode: '',
  board: '',
  schoolType: '',
  medium: '',
  address: '',
  district: '',
  state: '',
  pincode: '',
  principal: '',
  phone: '',
  email: '',
  plan: '',
  maxStudents: '',
  startDate: '',
  endDate: '',
  status: 'trial',
};

interface Props {
  onBack: () => void;
  onSaveDraft: (data: NewSchoolFormData) => void;
  onCreate: (data: NewSchoolFormData) => void;
}

/* ---------- Reusable field primitives ---------- */

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-xs font-bold text-[#0F172A] mb-1.5">{label}</label>
    {children}
  </div>
);

const inputClass =
  'w-full p-2.5 bg-[#F8F7F3] border border-[#E7EAEE] rounded-xl text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#125F76]/30 focus:border-[#125F76] transition-colors';

const TextInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}> = ({ value, onChange, placeholder, type = 'text' }) => (
  <input
    type={type}
    value={value}
    placeholder={placeholder}
    onChange={(e) => onChange(e.target.value)}
    className={inputClass}
  />
);

const Select: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}> = ({ value, onChange, options, placeholder }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
    <option value="">{placeholder}</option>
    {options.map((opt) => (
      <option key={opt} value={opt}>
        {opt}
      </option>
    ))}
  </select>
);

const SectionCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ icon, title, subtitle, children }) => (
  <div className="bg-white p-5 rounded-[20px] border border-[#E7EAEE] space-y-4">
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-[12px] bg-[#125F76]/10 text-[#125F76] flex items-center justify-center border border-[#125F76]/20">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-bold text-[#0F172A]">{title}</h3>
        {subtitle && <p className="text-[10px] text-[#64748B]">{subtitle}</p>}
      </div>
    </div>
    {children}
  </div>
);

/* ---------- Main page ---------- */

export const AddSchoolPage: React.FC<Props> = ({ onBack, onSaveDraft, onCreate }) => {
  const [form, setForm] = useState<NewSchoolFormData>(emptyForm);

  const set = <K extends keyof NewSchoolFormData>(key: K, value: NewSchoolFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const statusOptions: { value: NewSchoolFormData['status']; label: string }[] = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'trial', label: 'Trial' },
  ];

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-xs font-bold text-[#64748B] hover:bg-[#F8F7F3] hover:text-[#0F172A] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="h-5 w-px bg-[#E7EAEE]" />
        <h1 className="text-lg font-bold text-[#0F172A]">Add School</h1>
      </div>

      {/* Basic Information */}
      <SectionCard icon={<Building2 className="w-4 h-4" />} title="Basic Information" subtitle="Core identity of the institution">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="School Name">
            <TextInput value={form.schoolName} onChange={(v) => set('schoolName', v)} placeholder="e.g. Modern School Barakhamba" />
          </Field>
          <Field label="School Code">
            <TextInput value={form.schoolCode} onChange={(v) => set('schoolCode', v)} placeholder="e.g. MSB-DEL" />
          </Field>
          <Field label="Board">
            <Select
              value={form.board}
              onChange={(v) => set('board', v)}
              options={['CBSE', 'ICSE', 'State Board', 'IB', 'IGCSE']}
              placeholder="Select board"
            />
          </Field>
          <Field label="School Type">
            <Select
              value={form.schoolType}
              onChange={(v) => set('schoolType', v)}
              options={['Co-ed', 'Boys', 'Girls', 'Residential']}
              placeholder="Select type"
            />
          </Field>
          <Field label="Medium">
            <Select
              value={form.medium}
              onChange={(v) => set('medium', v)}
              options={['English', 'Hindi', 'Regional Language']}
              placeholder="Select medium"
            />
          </Field>
        </div>
      </SectionCard>

      {/* Location */}
      <SectionCard icon={<MapPin className="w-4 h-4" />} title="Location" subtitle="Where the campus is based">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Field label="Address">
              <TextInput value={form.address} onChange={(v) => set('address', v)} placeholder="Street, area, landmark" />
            </Field>
          </div>
          <Field label="District">
            <TextInput value={form.district} onChange={(v) => set('district', v)} placeholder="e.g. South Delhi" />
          </Field>
          <Field label="State">
            <TextInput value={form.state} onChange={(v) => set('state', v)} placeholder="e.g. Delhi" />
          </Field>
          <Field label="Pincode">
            <TextInput value={form.pincode} onChange={(v) => set('pincode', v)} placeholder="e.g. 110001" />
          </Field>
        </div>
      </SectionCard>

      {/* Contact */}
      <SectionCard icon={<User className="w-4 h-4" />} title="Contact" subtitle="Primary point of contact">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Principal">
            <TextInput value={form.principal} onChange={(v) => set('principal', v)} placeholder="Full name" />
          </Field>
          <Field label="Phone">
            <TextInput value={form.phone} onChange={(v) => set('phone', v)} placeholder="10-digit number" type="tel" />
          </Field>
          <Field label="Email">
            <TextInput value={form.email} onChange={(v) => set('email', v)} placeholder="name@school.edu" type="email" />
          </Field>
        </div>
      </SectionCard>

      {/* Subscription */}
      <SectionCard icon={<CreditCard className="w-4 h-4" />} title="Subscription" subtitle="Plan and billing window">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Plan">
            <Select
              value={form.plan}
              onChange={(v) => set('plan', v)}
              options={['Basic', 'Standard', 'Premium', 'Enterprise']}
              placeholder="Select plan"
            />
          </Field>
          <Field label="Max Students">
            <TextInput value={form.maxStudents} onChange={(v) => set('maxStudents', v)} placeholder="e.g. 1500" type="number" />
          </Field>
          <Field label="Start Date">
            <TextInput value={form.startDate} onChange={(v) => set('startDate', v)} type="date" />
          </Field>
          <Field label="End Date">
            <TextInput value={form.endDate} onChange={(v) => set('endDate', v)} type="date" />
          </Field>
        </div>
      </SectionCard>

      {/* Status */}
      <SectionCard icon={<CircleDot className="w-4 h-4" />} title="Status" subtitle="Current account state">
        <div className="flex flex-wrap gap-3">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set('status', opt.value)}
              className={`px-4 py-2 rounded-[12px] text-xs font-bold border transition-colors ${
                form.status === opt.value
                  ? 'bg-[#125F76] text-white border-[#125F76]'
                  : 'bg-[#F8F7F3] text-[#64748B] border-[#E7EAEE] hover:bg-[#E7EAEE]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </SectionCard>

      {/* Sticky footer actions */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white border-t border-[#E7EAEE] px-6 py-4 flex items-center justify-end gap-3">
        <button
          onClick={onBack}
          className="px-4 py-2.5 rounded-[14px] text-xs font-bold text-[#64748B] hover:bg-[#F8F7F3] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onSaveDraft(form)}
          className="px-4 py-2.5 bg-[#F8F7F3] border border-[#E7EAEE] rounded-[14px] text-xs font-bold text-[#0F172A] hover:bg-[#E7EAEE] transition-colors"
        >
          Save Draft
        </button>
        <button
          onClick={() => onCreate(form)}
          className="px-5 py-2.5 bg-[#125F76] text-white rounded-[14px] text-xs font-bold hover:bg-[#00263D] transition-colors shadow-md"
        >
          Create School
        </button>
      </div>
    </div>
  );
};

export default AddSchoolPage;