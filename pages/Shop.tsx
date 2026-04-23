import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc, increment, getDoc, arrayUnion, writeBatch, runTransaction } from '../realtimeFirestoreCompat';
import { toast } from 'react-hot-toast';
import { ShoppingBag, Coins, KeyRound, Check, Star } from 'lucide-react';
import { SHOP_ITEMS, ShopItem } from '../src/shopItems';
import { getNameIconOption } from '../src/nameIcons';
import { motion } from 'motion/react';
import clsx from 'clsx';
import { Navigate } from 'react-router-dom';
import { Modal } from '../components/DashboardUI';

export const Shop: React.FC = () => {
    const { userProfile } = useAuth();
    const [redeemCode, setRedeemCode] = useState('');
    const [redeeming, setRedeeming] = useState(false);
    const [confirmItem, setConfirmItem] = useState<ShopItem | null>(null);
    const [activeTab, setActiveTab] = useState<'banner' | 'ring' | 'nameIcon'>('banner');
    const DEFAULT_CHANCE_COOLDOWN_MINUTES = 10;

    if (!userProfile) return <Navigate to="/" />;

    const handleRedeem = async (e: React.FormEvent) => {
        e.preventDefault();
        const code = redeemCode.trim().toUpperCase();
        if (!code) return;

        setRedeeming(true);
        try {
            const codeRef = doc(db, 'redeemCodes', code);
            const userRef = doc(db, 'users', userProfile.uid);
            const roll = Math.random() * 100;

            let awardedCredits = 0;
            let isChanceCode = false;
            let didWin = false;

            await runTransaction(db, async (transaction) => {
                const [codeSnap, userSnap] = await Promise.all([
                    transaction.get(codeRef),
                    transaction.get(userRef),
                ]);

                if (!codeSnap.exists()) {
                    throw new Error('invalid_code');
                }
                if (!userSnap.exists()) {
                    throw new Error('user_not_found');
                }

                const codeData = codeSnap.data() as any;
                const userData = userSnap.data() as any;
                const credits = Math.max(0, Number(codeData?.credits) || 0);
                const usesLeft = Number(codeData?.usesLeft) || 0;
                const redeemedCodes = Array.isArray(userData?.redeemedCodes) ? userData.redeemedCodes : [];

                if (redeemedCodes.includes(code)) {
                    throw new Error('already_redeemed');
                }

                isChanceCode = Boolean(codeData?.isChanceCode);
                if (!isChanceCode) {
                    if (usesLeft <= 0) {
                        throw new Error('no_uses_left');
                    }
                    transaction.update(codeRef, { usesLeft: increment(-1) });
                    transaction.update(userRef, {
                        credits: increment(credits),
                        redeemedCodes: arrayUnion(code),
                    });
                    awardedCredits = credits;
                    didWin = true;
                    return;
                }

                const chanceAttempts = Array.isArray(userData?.chanceCodeAttempts) ? userData.chanceCodeAttempts : [];
                if (chanceAttempts.includes(code)) {
                    throw new Error('already_attempted');
                }

                const cooldownMinutes = Math.max(
                    0,
                    Number.isFinite(Number(codeData?.attemptCooldownMinutes))
                        ? Number(codeData.attemptCooldownMinutes)
                        : DEFAULT_CHANCE_COOLDOWN_MINUTES
                );
                const nowMs = Date.now();
                const lastAttemptAtMs = Number(userData?.chanceCodeLastAttemptAtMs) || 0;
                const cooldownMs = cooldownMinutes * 60 * 1000;
                if (cooldownMs > 0 && lastAttemptAtMs > 0 && nowMs - lastAttemptAtMs < cooldownMs) {
                    const remainingMinutes = Math.max(1, Math.ceil((cooldownMs - (nowMs - lastAttemptAtMs)) / (60 * 1000)));
                    const error = new Error('cooldown_active') as Error & { remainingMinutes?: number };
                    error.remainingMinutes = remainingMinutes;
                    throw error;
                }

                transaction.update(userRef, {
                    chanceCodeAttempts: arrayUnion(code),
                    chanceCodeLastAttemptAtMs: nowMs,
                });

                const winProbability = Math.min(100, Math.max(1, Number(codeData?.winProbability) || 1));
                didWin = roll < winProbability;
                if (!didWin) return;

                if (usesLeft <= 0) {
                    throw new Error('no_uses_left');
                }

                transaction.update(codeRef, { usesLeft: increment(-1) });
                transaction.update(userRef, {
                    credits: increment(credits),
                    redeemedCodes: arrayUnion(code),
                });
                awardedCredits = credits;
            });

            if (isChanceCode) {
                if (didWin) {
                    toast.success(`Winner! You earned ${awardedCredits} credits.`);
                } else {
                    toast.error('Not a winner this time. You have used your attempt for this code.');
                }
            } else {
                toast.success(`Successfully redeemed ${awardedCredits} credits!`);
            }
            setRedeemCode('');
        } catch (error) {
            const redeemError = error as Error & { remainingMinutes?: number };
            if (redeemError.message === 'already_redeemed') {
                toast.error('You have already redeemed this code.');
                return;
            }
            if (redeemError.message === 'already_attempted') {
                toast.error('You already attempted this giveaway code.');
                return;
            }
            if (redeemError.message === 'cooldown_active') {
                toast.error(`Please wait ${redeemError.remainingMinutes || 1} minute(s) before trying another giveaway code.`);
                return;
            }
            if (redeemError.message === 'invalid_code') {
                toast.error('Invalid or expired code.');
                return;
            }
            if (redeemError.message === 'no_uses_left') {
                toast.error('This code has run out of uses.');
                return;
            }
            if (redeemError.message === 'user_not_found') {
                toast.error('Could not load your profile. Please re-login and try again.');
                return;
            }
            handleFirestoreError(error, OperationType.UPDATE, 'redeemCodes');
        } finally {
            setRedeeming(false);
        }
    };

    const handlePurchase = (item: ShopItem) => {
        if (!userProfile) return;
        if (userProfile.purchasedItems?.includes(item.id)) return;
        
        const currentCredits = userProfile.credits || 0;
        if (currentCredits < item.price) {
            toast.error("Not enough GOODWOOD CREDITS.");
            return;
        }

        setConfirmItem(item);
    };

    const handlePurchaseConfirm = async () => {
        if (!userProfile || !confirmItem) return;
        const item = confirmItem;

        try {
            await updateDoc(doc(db, 'users', userProfile.uid), {
                credits: increment(-item.price),
                purchasedItems: arrayUnion(item.id)
            });
            toast.success(`Purchased ${item.name}!`);
        } catch (error) {
            toast.error("Purchase failed. Please try again.");
            console.error(error);
        } finally {
            setConfirmItem(null);
        }
    };

    const handleEquip = async (item: ShopItem) => {
        if (!userProfile) return;
        try {
            let updateField = '';
            if (item.type === 'banner') updateField = 'bannerGradient';
            if (item.type === 'ring') updateField = 'activeRing';
            if (item.type === 'nameIcon') updateField = 'activeNameIcon';

            await updateDoc(doc(db, 'users', userProfile.uid), {
                [updateField]: item.value
            });
            toast.success(`Equipped ${item.name}!`);
        } catch (error) {
            toast.error("Failed to equip item.");
            console.error(error);
        }
    };

    const handleUnequip = async (type: string) => {
        if (!userProfile) return;
        try {
            let updateField = '';
            if (type === 'banner') updateField = 'bannerGradient';
            if (type === 'ring') updateField = 'activeRing';
            if (type === 'nameIcon') updateField = 'activeNameIcon';

            await updateDoc(doc(db, 'users', userProfile.uid), {
                [updateField]: null
            });
            toast.success(`Unequipped item.`);
        } catch (error) {
            toast.error("Failed to unequip item.");
            console.error(error);
        }
    };

    const filteredItems = SHOP_ITEMS.filter(item => item.type === activeTab);
    const tabs = [
        { id: 'banner', label: 'Banners' },
        { id: 'ring', label: 'Profile Rings' },
        { id: 'nameIcon', label: 'User Icons' },
    ] as const;

    // Determine currently equipped value based on activeTab
    const getEquippedValue = (type: string) => {
        if (type === 'banner') return userProfile.bannerGradient;
        if (type === 'ring') return userProfile.activeRing;
        if (type === 'nameIcon') return userProfile.activeNameIcon;
        return null;
    };

    const equippedValue = getEquippedValue(activeTab);
    const renderNameIconPreview = useCallback((iconId: string) => {
        const iconOption = getNameIconOption(iconId);
        if (!iconOption) return null;
        const Icon = iconOption.icon;

        return (
            <div className="flex items-center gap-2">
                <Icon size={24} className={iconOption.colorClass} />
                <span className="text-white font-black text-xl uppercase tracking-tighter">{userProfile.username || 'Username'}</span>
            </div>
        );
    }, [userProfile.username]);

    return (
        <div className="w-full max-w-6xl mx-auto px-4 py-8 sm:py-12">
            <div className="flex items-center gap-3 mb-8">
                <ShoppingBag className="text-emerald-500" size={32} />
                <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Goodwood Shop</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Col: Balance & Redeem */}
                <div className="space-y-6">
                    <div className="bg-goodwood-card border border-goodwood-border rounded-xl p-6 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Coins size={14} /> My Balance
                        </h2>
                        <div className="text-4xl font-black text-yellow-400">
                            {userProfile.credits || 0} <span className="text-base text-gray-500 font-medium tracking-normal">Credits</span>
                        </div>
                    </div>

                    <form onSubmit={handleRedeem} className="bg-goodwood-card border border-goodwood-border rounded-xl p-6 shadow-2xl relative overflow-hidden group focus-within:border-emerald-500/50 transition-colors">
                         <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <KeyRound size={14} /> Redeem Code
                        </h2>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <input
                                type="text"
                                placeholder="Enter code..."
                                value={redeemCode}
                                onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                                className="w-full bg-goodwood-dark border border-goodwood-border rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors uppercase font-mono"
                                disabled={redeeming}
                            />
                            <button
                                type="submit"
                                disabled={redeeming || !redeemCode.trim()}
                                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-3 sm:py-2 rounded-lg font-bold text-sm tracking-wide transition-colors whitespace-nowrap"
                            >
                                {redeeming ? '...' : 'REDEEM'}
                            </button>
                        </div>
                    </form>

                    <div className="bg-[#12141a] border border-goodwood-border rounded-xl p-6 text-sm text-gray-400 leading-relaxed shadow-inner">
                        <h3 className="font-bold text-white mb-2 flex items-center gap-2"><Star size={14} className="text-yellow-500" /> How to get credits?</h3>
                        <p>Credits are a fun way to customize your GoodwoodFM profile. You can earn credits by participating in community events, winning giveaways on the radio, or finding hidden codes across the website!</p>
                    </div>
                </div>

                {/* Right Col: Shop Inventory */}
                <div className="md:col-span-2">
                    <div className="bg-goodwood-card border border-goodwood-border rounded-xl shadow-2xl overflow-hidden">
                        {/* Tabs */}
                        <div className="flex overflow-x-auto border-b border-goodwood-border hide-scrollbar">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={clsx(
                                        "px-6 py-4 text-sm font-bold uppercase tracking-wide whitespace-nowrap transition-colors border-b-2",
                                        activeTab === tab.id ? "text-emerald-400 border-emerald-500 bg-emerald-900/10" : "text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/5"
                                    )}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Items */}
                        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {filteredItems.map(item => {
                                const isOwned = userProfile.purchasedItems?.includes(item.id);
                                const isEquipped = equippedValue === item.value;

                                return (
                                    <motion.div 
                                        key={item.id}
                                        layout
                                        className={clsx(
                                            "border rounded-xl p-4 flex flex-col gap-4 relative overflow-hidden transition-all",
                                            isEquipped ? "border-emerald-500 bg-emerald-900/10" : "border-goodwood-border bg-goodwood-dark hover:border-gray-500"
                                        )}
                                    >
                                        {item.type === 'banner' && (
                                            <div className={clsx("w-full h-20 rounded-lg shadow-inner", "bg-gradient-to-r", item.value)} />
                                        )}
                                        {item.type === 'ring' && (
                                            <div className="w-full h-20 rounded-lg shadow-inner bg-[#0f1014] flex items-center justify-center">
                                                <div className={clsx("relative w-10 h-10 rounded-full shrink-0 transition-shadow duration-300", item.value, "ring-2")}>
                                                    <div className="w-full h-full rounded-full border-[3px] border-[#0f1014] overflow-hidden bg-goodwood-dark">
                                                        {userProfile.avatar ? (
                                                            <img src={userProfile.avatar} alt="Preview" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-white/50 text-[10px] font-bold">PFP</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {item.type === 'nameIcon' && (
                                            <div className="w-full h-20 rounded-lg shadow-inner bg-[#0f1014] flex items-center justify-center">
                                                {renderNameIconPreview(item.value)}
                                            </div>
                                        )}

                                        <div className="flex-1">
                                            <h3 className="text-white font-bold text-sm tracking-wide">{item.name}</h3>
                                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                                        </div>

                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-auto pt-4 border-t border-white/5">
                                            <div className="text-yellow-500 font-bold text-sm flex items-center gap-1">
                                                <Coins size={14} /> {item.price}
                                            </div>

                                            {isOwned ? (
                                                isEquipped ? (
                                                    <button 
                                                        onClick={() => handleUnequip(item.type)}
                                                        className="flex items-center gap-1 text-xs font-bold bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded transition-colors"
                                                    >
                                                        UNEQUIP
                                                    </button>
                                                ) : (
                                                    <button 
                                                        onClick={() => handleEquip(item)}
                                                        className="flex items-center gap-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded transition-colors"
                                                    >
                                                        EQUIP
                                                    </button>
                                                )
                                            ) : (
                                                <button 
                                                    onClick={() => handlePurchase(item)}
                                                    className="flex items-center gap-1 text-xs font-bold bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white px-3 py-1.5 rounded border border-emerald-600/50 transition-colors"
                                                >
                                                    BUY
                                                </button>
                                            )}
                                        </div>
                                        {isOwned && !isEquipped && (
                                            <div className="absolute top-2 right-2 bg-black/50 text-[10px] uppercase font-bold text-gray-300 px-2 py-0.5 rounded backdrop-blur-sm">
                                                Owned
                                            </div>
                                        )}
                                        {isEquipped && (
                                            <div className="absolute top-2 right-2 bg-emerald-500 text-[10px] uppercase font-bold text-black px-2 py-0.5 rounded shadow-lg flex items-center gap-1">
                                                <Check size={10} /> Equipped
                                            </div>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <Modal
                isOpen={!!confirmItem}
                onClose={() => setConfirmItem(null)}
                title="Confirm Purchase"
                maxWidth="max-w-sm"
            >
                {confirmItem && (
                    <div className="space-y-6">
                        <div className="text-center text-gray-300">
                            Are you sure you want to purchase the <span className="font-bold text-white">{confirmItem.name}</span> for <span className="font-bold text-yellow-500">{confirmItem.price}</span> GOODWOOD CREDITS?
                        </div>
                        <div className="flex bg-goodwood-dark border border-goodwood-border p-4 rounded-xl items-center justify-center">
                             {confirmItem.type === 'banner' && (
                                 <div className={clsx("w-full h-20 rounded-lg shadow-inner", "bg-gradient-to-r", confirmItem.value)} />
                             )}
                             {confirmItem.type === 'ring' && (
                                  <div className="w-full h-20 rounded-lg shadow-inner bg-[#0f1014] flex items-center justify-center">
                                      <div className={clsx("relative w-10 h-10 rounded-full shrink-0 transition-shadow duration-300", confirmItem.value, "ring-2")}>
                                          <div className="w-full h-full rounded-full border-[3px] border-[#0f1014] overflow-hidden bg-goodwood-dark">
                                              {userProfile.avatar ? (
                                                 <img src={userProfile.avatar} alt="Preview" className="w-full h-full object-cover" />
                                             ) : (
                                                 <div className="w-full h-full flex items-center justify-center text-white/50 text-[10px] font-bold">PFP</div>
                                             )}
                                          </div>
                                      </div>
                                  </div>
                              )}
                              {confirmItem.type === 'nameIcon' && (
                                  <div className="w-full h-20 rounded-lg shadow-inner bg-[#0f1014] flex items-center justify-center">
                                      {renderNameIconPreview(confirmItem.value)}
                                  </div>
                              )}
                         </div>
                        <div className="flex gap-4 pt-4">
                            <button onClick={() => setConfirmItem(null)} className="flex-1 bg-goodwood-dark hover:bg-white/5 border border-goodwood-border text-white px-4 py-3 rounded-xl font-bold transition-colors">
                                Cancel
                            </button>
                            <button onClick={handlePurchaseConfirm} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 rounded-xl font-black shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2">
                                <ShoppingBag size={18} /> Buy Now
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
