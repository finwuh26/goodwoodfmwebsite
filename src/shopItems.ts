export interface ShopItem {
    id: string;
    type: 'banner' | 'ring';
    name: string;
    price: number;
    value: string;
    description: string;
}

export const SHOP_ITEMS: ShopItem[] = [
    // BANNERS
    { id: 'banner_sunset', type: 'banner', name: 'Sunset Gradient', price: 100, value: 'from-orange-500 to-pink-500', description: 'A warm sunset gradient for your profile banner.' },
    { id: 'banner_ocean', type: 'banner', name: 'Deep Ocean', price: 100, value: 'from-cyan-900 to-blue-900', description: 'Deep oceanic vibes.' },
    { id: 'banner_neon', type: 'banner', name: 'Cyberpunk Neon', price: 200, value: 'from-fuchsia-600 to-cyan-500', description: 'Bright neon colors.' },
    { id: 'banner_gold', type: 'banner', name: 'Luxury Gold', price: 400, value: 'from-yellow-400 to-yellow-600', description: 'Show off your wealth.' },
    { id: 'banner_forest', type: 'banner', name: 'Mystic Forest', price: 150, value: 'from-emerald-800 to-teal-900', description: 'Dark, vibrant forest greens.' },
    
    // RINGS
    { id: 'ring_emerald', type: 'ring', name: 'Emerald Ring', price: 50, value: 'ring-emerald-500', description: 'Standard emerald profile ring.' },
    { id: 'ring_crimson', type: 'ring', name: 'Crimson Ring', price: 50, value: 'ring-red-500', description: 'Fierce red profile ring.' },
    { id: 'ring_gold', type: 'ring', name: 'Golden Aura', price: 300, value: 'ring-yellow-400 shadow-[0_0_25px_6px_rgba(250,204,21,0.6)]', description: 'A glowing golden aura.' },
    { id: 'ring_void', type: 'ring', name: 'The Void', price: 500, value: 'ring-purple-900 shadow-[0_0_30px_8px_rgba(88,28,135,0.8)] animate-pulse', description: 'A dark, pulsating void ring.' },
];
