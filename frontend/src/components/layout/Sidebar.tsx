import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from '../ui/Logo';
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
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  onLogout?: () => void;
}

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  badge?: string;
}

const navItems: NavItem[] = [
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

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle, onLogout }) => {
  const location = useLocation();

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs lg:hidden z-40"
            onClick={onToggle}
            aria-label="Close sidebar overlay"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{
          width: isCollapsed ? 80 : 280,
          x: 0,
        }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed lg:static inset-y-0 left-0 flex flex-col h-screen bg-[#00263D] text-white border-r border-[#125F76]/30 shadow-2xl z-50 select-none overflow-hidden transition-transform duration-300 ${
          isCollapsed ? '-translate-x-full lg:translate-x-0' : 'translate-x-0'
        }`}
      >
        {/* Header / Brand Logo */}
        <div className="flex items-center justify-between h-16 sm:h-20 px-4 border-b border-[#125F76]/40">
          <NavLink to="/dashboard" onClick={() => window.innerWidth < 1024 && onToggle()} className="flex items-center gap-2 overflow-hidden">
            <Logo showText={!isCollapsed} size="md" />
          </NavLink>

          <button
            onClick={onToggle}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 rounded-xl bg-[#125F76]/30 hover:bg-[#125F76] text-slate-300 hover:text-white transition-all duration-200 border border-white/10 shrink-0"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Target Badges */}
        {!isCollapsed && (
          <div className="px-4 sm:px-5 pt-4 pb-2">
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#125F76]/20 border border-[#125F76]/40 rounded-xl text-[11px] font-semibold text-slate-300">
              <span className="text-[#FDB824]">TARGET:</span>
              <div className="flex gap-1.5 sm:gap-2">
                <span className="px-1.5 py-0.5 rounded bg-[#00263D] text-white border border-white/10">NEET</span>
                <span className="px-1.5 py-0.5 rounded bg-[#00263D] text-white border border-white/10">JEE</span>
                <span className="px-1.5 py-0.5 rounded bg-[#00263D] text-white border border-white/10">FOUNDATION</span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 scrollbar-thin scrollbar-thumb-[#125F76]/50">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => window.innerWidth < 1024 && onToggle()}
                className={`relative flex items-center gap-3.5 px-3.5 py-3 rounded-[16px] text-sm font-semibold transition-all duration-200 group ${
                  isActive
                    ? 'bg-gradient-to-r from-[#125F76] to-[#125F76]/70 text-white shadow-md shadow-[#125F76]/30 border border-[#FDB824]/30'
                    : 'text-slate-300 hover:bg-[#125F76]/20 hover:text-white'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 w-1.5 h-6 bg-[#FDB824] rounded-r-full"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                <Icon
                  className={`w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                    isActive ? 'text-[#FDB824]' : 'text-slate-400 group-hover:text-white'
                  }`}
                />
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.15 }}
                      className="whitespace-nowrap flex-1 tracking-wide"
                    >
                      {item.name}
                    </motion.span>
                  )}
                </AnimatePresence>

                {!isCollapsed && item.badge && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#FDB824] text-[#00263D] uppercase tracking-wider shadow-sm">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* User Info & Logout Footer */}
        <div className="p-3 border-t border-[#125F76]/40 bg-[#001D30]/60">
          <div className="flex items-center justify-between gap-3 p-2 rounded-[16px] bg-[#125F76]/10 border border-[#125F76]/30">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-[#125F76] border-2 border-[#FDB824] flex items-center justify-center font-bold text-white text-xs shrink-0 shadow">
                A
              </div>
              {!isCollapsed && (
                <div className="flex flex-col overflow-hidden">
                  <span className="text-xs font-bold text-white truncate flex items-center gap-1">
                    Admin <ShieldAlert className="w-3 h-3 text-[#FDB824] inline" />
                  </span>
                  <span className="text-[10px] text-slate-400 truncate">admin@lumenacademy.edu</span>
                </div>
              )}
            </div>

            <button
              onClick={onLogout}
              aria-label="Logout"
              className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.aside>
    </>
  );
};

export default Sidebar;
