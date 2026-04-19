import { Crown, Flame, Gem, Sparkles, Star, type LucideIcon } from 'lucide-react';

export interface NameIconOption {
    id: string;
    label: string;
    icon: LucideIcon;
    colorClass: string;
}

const glowClass = (baseColorClass: string, rgb: string) =>
    `${baseColorClass} drop-shadow-[0_0_12px_rgba(${rgb},0.8)]`;

export const NAME_ICON_OPTIONS: NameIconOption[] = [
    { id: 'star', label: 'Star', icon: Star, colorClass: glowClass('text-white', '255,255,255') },
    { id: 'crown', label: 'Crown', icon: Crown, colorClass: glowClass('text-yellow-300', '253,224,71') },
    { id: 'gem', label: 'Gem', icon: Gem, colorClass: glowClass('text-cyan-300', '103,232,249') },
    { id: 'sparkles', label: 'Sparkles', icon: Sparkles, colorClass: glowClass('text-fuchsia-300', '240,171,252') },
    { id: 'flame', label: 'Flame', icon: Flame, colorClass: glowClass('text-orange-300', '253,186,116') },
];

export const getNameIconOption = (id?: string | null) =>
    NAME_ICON_OPTIONS.find((icon) => icon.id === id) ?? null;
