import {
  LayoutDashboard,
  Building2,
  UserCheck,
  GraduationCap,
  Layers,
  BookOpen,
  HelpCircle,
  Sparkles,
  CreditCard,
  BarChart3,
  Settings,
} from 'lucide-react';
import type { NavItem } from '../types/navigation';

export const NAVIGATION_ITEMS: NavItem[] = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Schools', path: '/schools', icon: Building2 },
  { name: 'School Admins', path: '/school-admins', icon: UserCheck },
  { name: 'Students', path: '/students', icon: GraduationCap },
  { name: 'Batches', path: '/batches', icon: Layers },
  { name: 'Courses', path: '/courses', icon: BookOpen },
  { name: 'Question Bank', path: '/question-bank', icon: HelpCircle },
  { name: 'AI Management', path: '/ai-management', icon: Sparkles, badge: 'Live' },
  { name: 'Payments', path: '/payments', icon: CreditCard },
  { name: 'Reports', path: '/reports', icon: BarChart3 },
  { name: 'Settings', path: '/settings', icon: Settings },
];
