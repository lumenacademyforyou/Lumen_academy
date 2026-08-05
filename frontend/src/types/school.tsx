export interface School {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  targetPrograms: ('NEET' | 'JEE' | 'Foundation')[];
  totalStudents: number;
  totalAdmins: number;
  status: 'active' | 'inactive' | 'pending';
  onboardedDate: string;
}

export interface SchoolAdmin {
  id: string;
  name: string;
  email: string;
  phone: string;
  schoolId: string;
  schoolName: string;
  role: 'Principal' | 'IT Admin' | 'Academic Head';
  status: 'active' | 'suspended';
  lastLogin: string;
}
