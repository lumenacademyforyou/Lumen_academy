// import React from 'react';
// import StatCard from '../../../components/ui/StatCard';
// import { DollarSign, GraduationCap, Building2, CreditCard, Cpu } from 'lucide-react';

// export const KpiGrid: React.FC = () => {
//   const stats = [
//     {
//       title: 'Total Monthly Revenue',
//       value: '₹48,50,000',
//       change: 14.2,
//       description: '+₹6.1L from previous month across all schools',
//       icon: DollarSign,
//       accentColor: '#22C55E',
//     },
//     {
//       title: 'Active Students',
//       value: '1,42,850',
//       change: 8.7,
//       description: 'NEET: 65K | JEE: 52K | Foundation: 25.8K',
//       icon: GraduationCap,
//       accentColor: '#125F76',
//     },
//     {
//       title: 'Affiliated Schools',
//       value: '384',
//       change: 5.4,
//       description: '12 new partner schools onboarded this month',
//       icon: Building2,
//       accentColor: '#00263D',
//     },
//     {
//       title: 'Active Subscriptions',
//       value: '412',
//       change: 3.1,
//       description: 'Annual enterprise LMS renewals active',
//       icon: CreditCard,
//       accentColor: '#FDB824',
//     },
//     {
//       title: 'AI Query Tokens Used',
//       value: '42.8M',
//       change: 22.9,
//       description: 'Lumen AI Tutor & Automated Question Generation',
//       icon: Cpu,
//       accentColor: '#3B82F6',
//     },
//   ];

//   return (
//     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
//       {stats.map((stat, idx) => (
//         <StatCard
//           key={idx}
//           title={stat.title}
//           value={stat.value}
//           change={stat.change}
//           description={stat.description}
//           icon={stat.icon}
//           accentColor={stat.accentColor}
//         />
//       ))}
//     </div>
//   );
// };

// export default KpiGrid;


import React, { useEffect, useState } from 'react';
import StatCard from '../../../components/ui/StatCard';
import { DollarSign, GraduationCap, Building2, CreditCard, Cpu } from 'lucide-react';
import { getSchools } from '../../../api/schools';

export const KpiGrid: React.FC = () => {
  const [schoolCount, setSchoolCount] = useState<number | null>(null);
  const [schoolCountLoading, setSchoolCountLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchSchoolCount();
  }, []);

  const fetchSchoolCount = async () => {
    try {
      setSchoolCountLoading(true);
      const res = await getSchools();

      // Prefer an explicit total from pagination metadata if the API sends one
      // (common shapes: { data: { total } }, { data: { data: { total } } }, { meta: { total } }).
      const total =
        res.data?.data?.total ??
        res.data?.total ??
        res.data?.meta?.total ??
        null;

      if (typeof total === 'number') {
        setSchoolCount(total);
      } else {
        // Fall back to counting the returned array itself.
        const rawData = res.data?.data?.items ?? res.data?.data ?? res.data ?? [];
        setSchoolCount(Array.isArray(rawData) ? rawData.length : 0);
      }
    } catch (err) {
      console.error('Failed to fetch school count for KPI grid', err);
      setSchoolCount(null); // shows as "—" rather than a fake number
    } finally {
      setSchoolCountLoading(false);
    }
  };

  const stats = [
    {
      title: 'Total Monthly Revenue',
      value: '₹48,50,000',
      change: 14.2,
      description: '+₹6.1L from previous month across all schools',
      icon: DollarSign,
      accentColor: '#22C55E',
    },
    {
      title: 'Active Students',
      value: '1,42,850',
      change: 8.7,
      description: 'NEET: 65K | JEE: 52K | Foundation: 25.8K',
      icon: GraduationCap,
      accentColor: '#125F76',
    },
    {
      title: 'Affiliated Schools',
      value: schoolCountLoading ? '…' : schoolCount !== null ? schoolCount.toLocaleString('en-IN') : '—',
      change: 5.4,
      description: schoolCountLoading
        ? 'Loading from database...'
        : schoolCount !== null
        ? 'Live count from schools database'
        : 'Failed to load — check API connection',
      icon: Building2,
      accentColor: '#00263D',
    },
    {
      title: 'Active Subscriptions',
      value: '412',
      change: 3.1,
      description: 'Annual enterprise LMS renewals active',
      icon: CreditCard,
      accentColor: '#FDB824',
    },
    {
      title: 'AI Query Tokens Used',
      value: '42.8M',
      change: 22.9,
      description: 'Lumen AI Tutor & Automated Question Generation',
      icon: Cpu,
      accentColor: '#3B82F6',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
      {stats.map((stat, idx) => (
        <StatCard
          key={idx}
          title={stat.title}
          value={stat.value}
          change={stat.change}
          description={stat.description}
          icon={stat.icon}
          accentColor={stat.accentColor}
        />
      ))}
    </div>
  );
};

export default KpiGrid;