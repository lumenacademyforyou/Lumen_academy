import React from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs font-semibold text-[#64748B] mb-4">
      <NavLink
        to="/dashboard"
        className="flex items-center gap-1 hover:text-[#00263D] transition-colors"
      >
        <Home className="w-3.5 h-3.5 text-[#125F76]" />
        <span>Dashboard</span>
      </NavLink>

      {items.map((item, index) => (
        <React.Fragment key={index}>
          <ChevronRight className="w-3 h-3 text-[#64748B]/60 shrink-0" />
          {item.path ? (
            <NavLink
              to={item.path}
              className="hover:text-[#00263D] transition-colors"
            >
              {item.label}
            </NavLink>
          ) : (
            <span className="text-[#0F172A] font-bold">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumb;
