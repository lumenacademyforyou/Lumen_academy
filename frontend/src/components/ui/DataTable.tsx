import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Search,
  SlidersHorizontal,
} from 'lucide-react';

export interface Column<T> {
  header: string;
  accessorKey: keyof T | ((row: T) => React.ReactNode);
  sortable?: boolean;
}

export type { Column as DataTableColumn };

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  searchPlaceholder = 'Search records...',
  pageSize = 8,
  onRowClick,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Filter
  const filteredData = data.filter((row) =>
    Object.values(row).some((val) =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = filteredData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleSort = (index: number) => {
    if (sortColumn === index) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(index);
      setSortDirection('asc');
    }
  };

  return (
    <div className="bg-white border border-[#E7EAEE] rounded-[20px] shadow-sm overflow-hidden flex flex-col">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between p-5 border-b border-[#E7EAEE] gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={searchPlaceholder}
            className="w-full pl-10 pr-4 py-2 bg-[#F8F7F3] border border-[#E7EAEE] rounded-[14px] text-xs font-medium text-[#0F172A] placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#125F76]/20 focus:border-[#125F76]"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button className="flex items-center gap-2 px-3.5 py-2 bg-[#F8F7F3] border border-[#E7EAEE] rounded-[14px] text-xs font-semibold text-[#64748B] hover:text-[#00263D] hover:bg-[#E7EAEE] transition-all">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filter
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#F8F7F3] border-b border-[#E7EAEE] text-[11px] font-extrabold uppercase tracking-wider text-[#64748B]">
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  onClick={() => col.sortable && handleSort(idx)}
                  className={`py-3.5 px-5 font-semibold ${
                    col.sortable ? 'cursor-pointer select-none hover:text-[#00263D]' : ''
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {col.header}
                    {col.sortable && <ArrowUpDown className="w-3 h-3 text-[#64748B]" />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-[#E7EAEE] text-xs font-medium text-[#0F172A]">
            {paginatedData.length > 0 ? (
              paginatedData.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`hover:bg-[#F8F7F3]/80 transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                >
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className="py-4 px-5 align-middle">
                      {typeof col.accessorKey === 'function'
                        ? col.accessorKey(row)
                        : (row[col.accessorKey] as React.ReactNode)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-8 text-center text-xs text-[#64748B]"
                >
                  No matching records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between p-4 border-t border-[#E7EAEE] bg-[#F8F7F3]">
        <span className="text-xs text-[#64748B]">
          Showing Page <span className="font-bold text-[#0F172A]">{currentPage}</span> of{' '}
          <span className="font-bold text-[#0F172A]">{totalPages}</span>
        </span>

        <div className="flex items-center gap-2">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            className="p-1.5 rounded-lg border border-[#E7EAEE] bg-white text-[#0F172A] disabled:opacity-40 hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            className="p-1.5 rounded-lg border border-[#E7EAEE] bg-white text-[#0F172A] disabled:opacity-40 hover:bg-slate-50 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default DataTable;
