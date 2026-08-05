import type { School } from '../types/school';

export const schoolService = {
  getSchools: async (): Promise<School[]> => {
    return [
      {
        id: 'SCH-001',
        name: 'Delhi Public School (R.K. Puram)',
        code: 'DPS-RKP',
        address: 'Kaifi Azmi Marg, Sector 12',
        city: 'New Delhi',
        state: 'Delhi',
        targetPrograms: ['NEET', 'JEE'],
        totalStudents: 1450,
        totalAdmins: 6,
        status: 'active',
        onboardedDate: '2025-01-15',
      },
    ];
  },
};
