import { Crown, Flame, Gem, Sparkles, Star, type LucideIcon } from 'lucide-react';

export interface NameIconOption {
    id: string;
    label: string;
    icon: LucideIcon;
    colorClass: string;
}

export const NAME_ICON_OPTIONS: NameIconOption[] = [
    { id: 'star', label: 'Star', icon: Star, colorClass: 'text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.8)]' },
    { id: 'crown', label: 'Crown', icon: Crown, colorClass: 'text-yellow-300 drop-shadow-[0_0_12px_rgba(253,224,71,0.8)]' },
    { id: 'gem', label: 'Gem', icon: Gem, colorClass: 'text-cyan-300 drop-shadow-[0_0_12px_rgba(103,232,249,0.8)]' },
    { id: 'sparkles', label: 'Sparkles', icon: Sparkles, colorClass: 'text-fuchsia-300 drop-shadow-[0_0_12px_rgba(240,171,252,0.8)]' },
    { id: 'flame', label: 'Flame', icon: Flame, colorClass: 'text-orange-300 drop-shadow-[0_0_12px_rgba(253,186,116,0.8)]' },
];

export const getNameIconOption = (id?: string | null) =>
    NAME_ICON_OPTIONS.find((icon) => icon.id === id) ?? null;
