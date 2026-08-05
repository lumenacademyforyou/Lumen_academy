import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Bell,
  Calendar,
  ChevronDown,
  User,
  Shield,
  LogOut,
  Sliders,
  Menu,
} from 'lucide-react';

interface NavbarProps {
  onToggleSidebar?: () => void;
  title?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, title = 'Super Admin Console' }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const sampleNotifications = [
    { id: '1', title: 'New School Onboarded', time: '10m ago', unread: true },
    { id: '2', title: 'AI Token Threshold Reached', time: '1h ago', unread: true },
    { id: '3', title: 'NEET Test Series Published', time: '3h ago', unread: false },
  ];

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 sm:h-20 px-3 sm:px-6 bg-[#FFFFFF] border-b border-[#E7EAEE] shadow-sm transition-colors duration-200">
      {/* Left Section: Mobile Toggle & Page Title/Breadcrumb */}
      <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            aria-label="Toggle Navigation Sidebar"
            className="p-1.5 sm:p-2 rounded-xl text-[#64748B] hover:text-[#00263D] hover:bg-[#F8F7F3] lg:hidden transition-colors shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex flex-col min-w-0">
          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-[#64748B]">
            <span>Lumen Academy</span>
            <span>/</span>
            <span className="text-[#125F76] font-bold">Super Admin</span>
          </div>
          <h1 className="text-base sm:text-xl font-bold text-[#0F172A] tracking-tight truncate">{title}</h1>
        </div>
      </div>

      {/* Middle Section: Global Search (Desktop) */}
      <div className="hidden md:flex items-center flex-1 max-w-md mx-4 lg:mx-8">
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search schools, admins, courses, students..."
            className="w-full pl-10 pr-12 py-2 bg-[#F8F7F3] border border-[#E7EAEE] rounded-[16px] text-sm text-[#0F172A] placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#125F76]/20 focus:border-[#125F76] transition-all"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 text-[10px] font-semibold text-[#64748B] bg-white border border-[#E7EAEE] rounded-md shadow-xs pointer-events-none">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Mobile Search Popup */}
      <AnimatePresence>
        {showMobileSearch && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute inset-x-0 top-0 h-16 bg-white px-4 flex items-center gap-2 border-b border-[#E7EAEE] z-40 md:hidden shadow-md"
          >
            <Search className="w-4 h-4 text-[#64748B] shrink-0" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="flex-1 py-1.5 px-2 text-sm bg-transparent border-none focus:outline-none text-[#0F172A]"
            />
            <button
              onClick={() => setShowMobileSearch(false)}
              className="text-xs font-bold text-[#125F76] px-2 py-1"
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right Section: Actions, Notifications, Profile */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Mobile Search Button */}
        <button
          onClick={() => setShowMobileSearch(true)}
          aria-label="Open Search"
          className="p-2 sm:hidden rounded-[14px] text-[#64748B] hover:text-[#00263D] bg-[#F8F7F3] border border-[#E7EAEE]"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Date Display */}
        <div className="hidden xl:flex items-center gap-2 px-3.5 py-1.5 bg-[#F8F7F3] border border-[#E7EAEE] rounded-xl text-xs font-semibold text-[#64748B] shadow-2xs">
          <Calendar className="w-3.5 h-3.5 text-[#125F76]" />
          <span>{currentDate}</span>
        </div>

        {/* Notification Menu */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            aria-label="View Notifications"
            className="relative p-2 sm:p-2.5 rounded-[14px] text-[#64748B] hover:text-[#00263D] bg-[#F8F7F3] hover:bg-[#E7EAEE] border border-[#E7EAEE] transition-all duration-200"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-2 h-2 rounded-full bg-[#EF4444] ring-2 ring-white" />
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute right-0 mt-2 w-72 sm:w-80 bg-white border border-[#E7EAEE] rounded-[20px] shadow-xl overflow-hidden z-50 max-w-[calc(100vw-32px)]"
              >
                <div className="flex items-center justify-between px-4 py-3 bg-[#F8F7F3] border-b border-[#E7EAEE]">
                  <span className="text-xs font-bold text-[#0F172A] tracking-wider uppercase">Notifications</span>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-[#125F76] text-white rounded-full">
                    2 New
                  </span>
                </div>
                <div className="divide-y divide-[#E7EAEE]">
                  {sampleNotifications.map((item) => (
                    <div key={item.id} className="p-3.5 hover:bg-[#F8F7F3] transition-colors cursor-pointer">
                      <div className="flex justify-between items-start">
                        <p className="text-xs font-semibold text-[#0F172A]">{item.title}</p>
                        {item.unread && <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />}
                      </div>
                      <span className="text-[10px] text-[#64748B] mt-1 block">{item.time}</span>
                    </div>
                  ))}
                </div>
                <div className="p-2.5 text-center border-t border-[#E7EAEE] bg-[#F8F7F3]">
                  <button className="text-xs font-semibold text-[#125F76] hover:underline">
                    Mark all as read
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Divider */}
        <div className="h-5 sm:h-6 w-[1px] bg-[#E7EAEE] mx-0.5 sm:mx-1" />

        {/* User Profile Button */}
        <div className="relative">
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
            }}
            aria-label="User Menu"
            className="flex items-center gap-2 sm:gap-3 p-1 sm:p-1.5 pr-2 sm:pr-3 rounded-[16px] bg-[#F8F7F3] hover:bg-[#E7EAEE] border border-[#E7EAEE] transition-all duration-200"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-[12px] bg-[#00263D] text-[#FDB824] flex items-center justify-center font-extrabold text-xs shadow-xs">
              A
            </div>
            <div className="hidden lg:flex flex-col text-left">
              <span className="text-xs font-bold text-[#0F172A]">Admin</span>
              <span className="text-[10px] font-medium text-[#64748B]">Super Administrator</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
          </button>

          <AnimatePresence>
            {showProfileMenu && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute right-0 mt-2 w-52 sm:w-56 bg-white border border-[#E7EAEE] rounded-[20px] shadow-xl overflow-hidden z-50 p-1.5 max-w-[calc(100vw-32px)]"
              >
                <div className="px-3 py-2 border-b border-[#E7EAEE] mb-1">
                  <p className="text-xs font-bold text-[#0F172A]">Admin</p>
                  <p className="text-[10px] text-[#64748B] truncate">admin@lumenacademy.edu</p>
                </div>
                <button className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#0F172A] hover:bg-[#F8F7F3] rounded-[12px] transition-colors">
                  <User className="w-4 h-4 text-[#125F76]" /> Profile Details
                </button>
                <button className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#0F172A] hover:bg-[#F8F7F3] rounded-[12px] transition-colors">
                  <Shield className="w-4 h-4 text-[#125F76]" /> Security & Access
                </button>
                <button className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#0F172A] hover:bg-[#F8F7F3] rounded-[12px] transition-colors">
                  <Sliders className="w-4 h-4 text-[#125F76]" /> Preferences
                </button>
                <div className="h-[1px] bg-[#E7EAEE] my-1" />
                <button className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#EF4444] hover:bg-[#EF4444]/10 rounded-[12px] transition-colors">
                  <LogOut className="w-4 h-4 text-[#EF4444]" /> Log Out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
