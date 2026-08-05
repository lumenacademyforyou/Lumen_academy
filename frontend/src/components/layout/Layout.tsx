import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { motion } from 'framer-motion';

interface LayoutProps {
  children?: React.ReactNode;
  pageTitle?: string;
  onLogout?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, pageTitle, onLogout }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024;
    }
    return false;
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  return (
    <div className="flex h-screen w-screen bg-[#F8F7F3] overflow-hidden font-sans text-[#0F172A]">
      {/* Collapsible Sidebar */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={toggleSidebar}
        onLogout={onLogout}
      />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 h-full overflow-x-hidden overflow-y-auto">
        {/* Sticky Topbar */}
        <Navbar onToggleSidebar={toggleSidebar} title={pageTitle} />

        {/* Dynamic Page View Container */}
        <main className="flex-1 p-3 sm:p-6 md:p-8 space-y-4 sm:space-y-6 scrollbar-thin scrollbar-thumb-[#125F76]/20">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="max-w-7xl mx-auto w-full"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
