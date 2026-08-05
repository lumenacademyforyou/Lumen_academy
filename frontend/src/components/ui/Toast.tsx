import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  type: ToastType;
  title: string;
  message?: string;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ type, title, message, onClose }) => {
  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-[#22C55E]" />,
    error: <AlertCircle className="w-5 h-5 text-[#EF4444]" />,
    warning: <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />,
    info: <Info className="w-5 h-5 text-[#3B82F6]" />,
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="flex items-start gap-3 p-4 bg-white border border-[#E7EAEE] rounded-[18px] shadow-xl max-w-sm"
      >
        <div className="shrink-0 mt-0.5">{icons[type]}</div>
        <div className="flex-1">
          <h4 className="text-xs font-bold text-[#0F172A]">{title}</h4>
          {message && <p className="text-[11px] text-[#64748B] mt-0.5">{message}</p>}
        </div>
        <button onClick={onClose} className="p-1 text-[#64748B] hover:text-[#0F172A]">
          <X className="w-3.5 h-3.5" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

export default Toast;
