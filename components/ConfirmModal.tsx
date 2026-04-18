import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }: ConfirmModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-goodwood-dark border border-goodwood-border rounded-xl p-6 w-full max-w-sm relative z-10 shadow-2xl"
          >
            <div className="flex items-center gap-3 mb-4 text-red-500">
              <AlertCircle size={24} />
              <h3 className="font-bold text-lg uppercase tracking-wider">{title}</h3>
            </div>
            <p className="text-gray-400 mb-6 text-sm">{message}</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={onCancel}
                className="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider text-gray-400 hover:bg-white/5 transition-colors"
               >
                Cancel
              </button>
              <button 
                onClick={() => {
                    onConfirm();
                    onCancel();
                }}
                className="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 transition-colors"
               >
                Confirm
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
