import React, { useRef, useState } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';

interface ImageUploadProps {
    value: string;
    onChange: (base64: string) => void;
    label?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ value, onChange, label = "Upload Image" }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        const reader = new FileReader();
        reader.onloadend = () => {
            onChange(reader.result as string);
            setLoading(false);
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{label}</span>
            <div className="relative group">
                <input 
                    type="file" 
                    ref={inputRef} 
                    onChange={handleFileChange} 
                    accept="image/jpeg, image/png, image/webp" 
                    className="hidden" 
                />
                
                {value ? (
                    <div className="relative w-full h-32 rounded-lg border border-goodwood-border overflow-hidden bg-black/20 group">
                        <img src={value} alt="Uploaded" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm">
                            <button 
                                type="button" 
                                onClick={() => inputRef.current?.click()} 
                                className="bg-white/10 hover:bg-white/20 p-2 rounded-full text-white"
                            >
                                <Upload size={16} />
                            </button>
                            <button 
                                type="button" 
                                onClick={() => onChange('')} 
                                className="bg-red-500/20 hover:bg-red-500/40 p-2 rounded-full text-red-500"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <button 
                        type="button" 
                        onClick={() => inputRef.current?.click()}
                        className="w-full h-32 rounded-lg border-2 border-dashed border-goodwood-border hover:border-emerald-500/50 bg-black/20 hover:bg-emerald-500/5 transition-all flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-emerald-400"
                    >
                        {loading ? <Loader2 size={24} className="animate-spin text-emerald-500" /> : <Upload size={24} />}
                        <span className="text-xs font-bold uppercase tracking-wider">{loading ? 'Processing...' : 'Click to Upload'}</span>
                    </button>
                )}
            </div>
        </div>
    );
};
