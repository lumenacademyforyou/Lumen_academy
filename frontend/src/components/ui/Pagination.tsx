import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-[#F8F7F3] border border-[#E7EAEE] rounded-[16px]">
      <span className="text-xs font-semibold text-[#64748B]">
        Page <span className="text-[#0F172A]">{currentPage}</span> of{' '}
        <span className="text-[#0F172A]">{totalPages}</span>
      </span>

      <div className="flex items-center gap-2">
        <button
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="p-1.5 rounded-lg border border-[#E7EAEE] bg-white text-[#0F172A] disabled:opacity-40 hover:bg-slate-50 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="p-1.5 rounded-lg border border-[#E7EAEE] bg-white text-[#0F172A] disabled:opacity-40 hover:bg-slate-50 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
