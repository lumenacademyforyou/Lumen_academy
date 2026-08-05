import React, { useState } from 'react';
import { Filter, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Option {
  label: string;
  value: string;
}

interface FilterDropdownProps {
  label: string;
  options: Option[];
  selectedValues: string[];
  onChange: (selected: string[]) => void;
}

export const FilterDropdown: React.FC<FilterDropdownProps> = ({
  label,
  options,
  selectedValues,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOption = (val: string) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter((v) => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3.5 py-2 bg-white border border-[#E7EAEE] rounded-[14px] text-xs font-semibold text-[#0F172A] hover:bg-[#F8F7F3] transition-colors"
      >
        <Filter className="w-3.5 h-3.5 text-[#125F76]" />
        <span>{label}</span>
        {selectedValues.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-[#125F76] text-white text-[10px] font-bold">
            {selectedValues.length}
          </span>
        )}
        <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute left-0 mt-2 w-48 bg-white border border-[#E7EAEE] rounded-[16px] shadow-lg p-2 z-50"
          >
            {options.map((opt) => {
              const isSelected = selectedValues.includes(opt.value);
              return (
                <div
                  key={opt.value}
                  onClick={() => toggleOption(opt.value)}
                  className="flex items-center justify-between px-3 py-2 rounded-[10px] text-xs font-medium text-[#0F172A] hover:bg-[#F8F7F3] cursor-pointer transition-colors"
                >
                  <span>{opt.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#125F76]" />}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FilterDropdown;
