import React, { ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronDown } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    maxWidth?: string;
}

export const Modal = ({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl' }: ModalProps) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className={`relative w-full ${maxWidth} bg-goodwood-card border border-goodwood-border rounded-xl shadow-2xl overflow-hidden`}
                    >
                        <div className="flex items-center justify-between p-6 border-b border-goodwood-border">
                            <h2 className="text-xl font-black text-white italic tracking-tight uppercase tracking-widest">{title}</h2>
                            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
                            {children}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

interface DropdownProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
}

export const Dropdown = ({ label, value, onChange, options, placeholder = 'Select option' }: DropdownProps) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => opt.value === value);

    return (
        <div className="space-y-1.5" ref={dropdownRef}>
            {label && <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-500">{label}</label>}
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full bg-goodwood-dark border border-goodwood-border rounded-lg p-3 text-left text-white flex items-center justify-between hover:border-white/20 transition-colors"
                >
                    <span className={!selectedOption ? 'text-gray-500' : ''}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                    <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute z-10 w-full mt-2 bg-goodwood-card border border-goodwood-border rounded-lg shadow-xl overflow-hidden"
                        >
                            <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                {options.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => {
                                            onChange(option.value);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full p-3 text-left text-sm transition-colors ${
                                            value === option.value 
                                                ? 'bg-emerald-600 text-white' 
                                                : 'text-gray-300 hover:bg-black/40'
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export const Input = ({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) => {
    return (
        <div className="space-y-1.5">
            {label && <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-500">{label}</label>}
            <input
                {...props}
                className="w-full bg-goodwood-dark border border-goodwood-border rounded-lg p-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
            />
        </div>
    );
};

export const TextArea = ({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) => {
    return (
        <div className="space-y-1.5">
            {label && <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-500">{label}</label>}
            <textarea
                {...props}
                className="w-full bg-goodwood-dark border border-goodwood-border rounded-lg p-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500 transition-colors min-h-[100px]"
            />
        </div>
    );
};
