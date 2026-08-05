export interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
  schoolName: string;
  batchName: string;
  targetExam: 'NEET' | 'JEE' | 'Foundation';
  performanceScore: number;
  status: 'active' | 'inactive';
  enrolledDate: string;
}
