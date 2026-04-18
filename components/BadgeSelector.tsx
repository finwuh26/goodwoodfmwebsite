import React from 'react';
import { Shield, Star, Award, Zap, Radio, CheckCircle, Headphones, Music } from 'lucide-react';

export const AVAILABLE_BADGES = [
    { id: 'verified', label: 'Verified', icon: CheckCircle, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { id: 'vip', label: 'VIP', icon: Star, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { id: 'og', label: 'OG Member', icon: Award, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { id: 'staff', label: 'Staff', icon: Shield, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { id: 'dj', label: 'Resident DJ', icon: Headphones, color: 'text-pink-400', bg: 'bg-pink-500/10' },
    { id: 'artist', label: 'Artist', icon: Music, color: 'text-green-400', bg: 'bg-green-500/10' },
    { id: 'owner', label: 'Owner', icon: Zap, color: 'text-red-400', bg: 'bg-red-500/10' },
];

interface BadgeSelectorProps {
    selectedBadges: string[];
    onChange: (badges: string[]) => void;
}

export const BadgeSelector: React.FC<BadgeSelectorProps> = ({ selectedBadges, onChange }) => {
    
    const toggleBadge = (badgeId: string) => {
        if (selectedBadges.includes(badgeId)) {
            onChange(selectedBadges.filter(id => id !== badgeId));
        } else {
            onChange([...selectedBadges, badgeId]);
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Select Badges</span>
            <div className="flex flex-wrap gap-2">
                {AVAILABLE_BADGES.map(badge => {
                    const isSelected = selectedBadges.includes(badge.id);
                    const Icon = badge.icon;
                    return (
                        <button
                            key={badge.id}
                            type="button"
                            onClick={() => toggleBadge(badge.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all text-xs font-bold uppercase tracking-wider ${
                                isSelected 
                                ? `${badge.bg} border-${badge.color.split('-')[1]}-500/50 ${badge.color}` 
                                : 'bg-transparent border-white/10 text-gray-500 hover:border-white/30 hover:text-gray-300'
                            }`}
                        >
                            <Icon size={12} className={isSelected ? '' : 'opacity-50'} />
                            {badge.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
