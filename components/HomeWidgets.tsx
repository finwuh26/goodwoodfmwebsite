import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Award, Users, ExternalLink, MessageSquare } from 'lucide-react';
import { motion } from 'motion/react';
import { collection, getDocs, query, limit, orderBy } from '../realtimeFirestoreCompat';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useRadio } from '../context/RadioContext';
import { normalizeAzuraIdentity } from '../utils/azuraIdentity';
import { readFirestoreWithGuard } from '../utils/firestoreReadGuards';
import { UserAvatar } from './UserAvatar';

const RECENT_ACTIVITY_QUERY_LIMIT = 25;
const ONLINE_WINDOW_MS = 7 * 60 * 1000;
const HOME_WIDGETS_READ_TTL_MS = 5 * 60 * 1000;

const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (value?.seconds) return new Date(value.seconds * 1000);
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const DiscordWidget = () => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.95 }}
    whileInView={{ opacity: 1, scale: 1 }}
    viewport={{ once: true }}
    className="bg-gradient-to-br from-[#1e2330] to-[#12141a] rounded-xl p-6 border border-goodwood-border text-center mb-6 shadow-2xl relative overflow-hidden group"
  >
    <div className="absolute top-0 left-0 w-full h-1 bg-[#5865F2]" />
    <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#5865F2]/10 blur-3xl rounded-full group-hover:bg-[#5865F2]/20 transition-all duration-500" />
    
    <h3 className="text-[#5865F2] font-black text-xl flex items-center justify-center gap-2 mb-3 tracking-tighter">
      <MessageSquare size={20} className="fill-current" /> DISCORD
    </h3>
    <p className="text-gray-400 text-xs mb-6 leading-relaxed font-medium">
      Ready to get chatting?<br/>Join the <span className="text-white">Goodwood FM Community</span> today.
    </p>
    <a 
      href="https://discord.gg/goodwood" 
      target="_blank" 
      rel="noreferrer"
      className="block w-full bg-[#5865F2] hover:bg-[#4752c4] text-white py-2.5 rounded-lg transition-all duration-300 font-bold text-xs uppercase tracking-widest shadow-lg shadow-[#5865F2]/20 active:scale-95"
    >
      Join Server
    </a>
  </motion.div>
);

export const StaffOfTheMonth = () => {
    const [staffMember, setStaffMember] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const STAFF_ROLES = ['staff', 'dj', 'journalist', 'manager', 'admin', 'owner'];
        // Fetch the top 50 users by reputationScore; filter client-side for staff roles
        // (Firestore requires a composite index for a where+orderBy, so we filter after fetch)
        const q = query(collection(db, 'users'), orderBy('reputationScore', 'desc'), limit(50));
        readFirestoreWithGuard(
            'homeWidgets:staffOfTheMonth',
            () => getDocs(q),
            { ttlMs: HOME_WIDGETS_READ_TTL_MS }
        ).then((snapshot) => {
            if (!isMounted) return;
            const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
            const topStaff = users.find((u: any) => STAFF_ROLES.includes(u.role)) || null;
            setStaffMember(topStaff);
            setLoading(false);
        }).catch((err) => {
            if (!isMounted) return;
            setLoading(false);
            handleFirestoreError(err, OperationType.GET, 'users');
        });
        return () => { isMounted = false; };
    }, []);

    if (loading) return (
        <div className="bg-goodwood-card border border-goodwood-border rounded-xl p-8 flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white/20"></div>
        </div>
    );

    if (!staffMember) return (
        <div className="bg-goodwood-card border border-goodwood-border rounded-xl p-8 flex items-center justify-center h-48">
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">No staff found</p>
        </div>
    );

    return (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-6"
        >
            <h3 className="flex items-center gap-2 text-gray-500 font-bold text-[10px] tracking-[0.3em] uppercase mb-4">
                <Award size={14} className="text-yellow-500" /> Staff Member
            </h3>
            <div className="bg-gradient-to-b from-[#1c1f2a] to-[#12141a] border border-goodwood-border rounded-xl p-8 flex flex-col items-center justify-center relative overflow-hidden group shadow-xl">
                 {/* Glow effect behind avatar */}
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-emerald-600/10 blur-3xl rounded-full group-hover:bg-emerald-600/20 transition-all duration-700" />
                 
                 <div className="relative z-10 mb-4">
                    {staffMember.avatar ? (
                        <motion.img 
                          whileHover={{ scale: 1.1, rotate: 5 }}
                          src={staffMember.avatar || undefined} 
                          alt="Staff of Month" 
                          className="w-24 h-24 rounded-full border-4 border-goodwood-border shadow-2xl relative z-10 object-cover" 
                        />
                    ) : (
                        <div className="w-24 h-24 rounded-full border-4 border-goodwood-border shadow-2xl relative z-10 bg-emerald-900 flex items-center justify-center">
                            <span className="text-white font-black text-3xl">{staffMember.username?.charAt(0) || '?'}</span>
                        </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center border-4 border-[#1c1f2a] z-20">
                        <Award size={14} className="text-black fill-current" />
                    </div>
                 </div>
                 
                 <h4 className="text-2xl font-black text-white tracking-tighter uppercase italic">
                     {staffMember.username}
                 </h4>
                 <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">Staff of the Month</p>
                 {staffMember.role && (
                     <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest mt-1">{staffMember.role}</p>
                 )}
                 <div className="mt-3 flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-full px-3 py-1">
                     <Award size={10} className="text-yellow-400 fill-current" />
                     <span className="text-yellow-400 text-[10px] font-black uppercase tracking-widest">{(staffMember.reputationScore ?? 0).toLocaleString()} rep</span>
                 </div>
            </div>
        </motion.div>
    );
}

export const PartnersWidget = () => {
    const [partners, setPartners] = useState<any[]>([]);

    useEffect(() => {
        let isMounted = true;
        const q = query(collection(db, 'partners'));
        readFirestoreWithGuard(
            'homeWidgets:partners',
            () => getDocs(q),
            { ttlMs: HOME_WIDGETS_READ_TTL_MS }
        ).then((snapshot) => {
            if (!isMounted) return;
            setPartners(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }).catch((err) => {
            if (!isMounted) return;
            handleFirestoreError(err, OperationType.GET, 'partners');
        });
        return () => { isMounted = false; };
    }, []);

    const colors = [
        'hover:border-blue-500/50 hover:bg-blue-500/5',
        'hover:border-orange-500/50 hover:bg-orange-500/5',
        'hover:border-green-500/50 hover:bg-green-500/5',
        'hover:border-emerald-500/50 hover:bg-emerald-500/5',
    ];

    if (partners.length === 0) return null;

    return (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-6"
        >
            <h3 className="flex items-center gap-2 text-gray-500 font-bold text-[10px] tracking-[0.3em] uppercase mb-4">
                <Users size={14} /> Partners
            </h3>
            <div className="space-y-3">
                {partners.map((partner, idx) => (
                  <motion.div 
                    key={partner.id}
                    whileHover={{ x: 5 }}
                    className={`bg-goodwood-card border border-goodwood-border p-5 rounded-xl transition-all cursor-pointer group flex items-center justify-between gap-4 ${colors[idx % colors.length]}`}
                    onClick={() => window.open(partner.website, '_blank')}
                  >
                      <div>
                          <h4 className="text-white font-black tracking-tighter text-sm group-hover:text-white transition-colors uppercase italic">{partner.name}</h4>
                          <p className="text-gray-500 text-[10px] font-bold mt-1 flex items-center gap-1 group-hover:text-gray-300 transition-colors uppercase tracking-widest">
                              {partner.website.replace(/^https?:\/\//, '')} <ExternalLink size={10} />
                          </p>
                      </div>
                      {partner.logo && (
                          <div className="w-10 h-10 rounded overflow-hidden opacity-50 group-hover:opacity-100 transition-opacity">
                              <img src={partner.logo} alt={partner.name} className="w-full h-full object-cover" />
                          </div>
                      )}
                  </motion.div>
                ))}
            </div>
        </motion.div>
    );
}

export const RecentlyActiveWidget = () => {
    const [activeStaff, setActiveStaff] = useState<any[]>([]);
    const { radioData } = useRadio();
    const normalizedAzuraStreamerName = normalizeAzuraIdentity(radioData?.live?.streamer_name || '');
    const isLive = Boolean(radioData?.live?.is_live);

    useEffect(() => {
        let isMounted = true;
        const q = query(collection(db, 'users'), limit(RECENT_ACTIVITY_QUERY_LIMIT));
        readFirestoreWithGuard(
            'homeWidgets:recentlyActive',
            () => getDocs(q),
            { ttlMs: HOME_WIDGETS_READ_TTL_MS }
        ).then((snapshot) => {
            if (!isMounted) return;
            const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as any);
            // Filter distinct users by username to prevent showing multiple of the same person
            const uniqueUsers = Array.from(new Map(usersList.map((u: any) => [u.username || u.id, u])).values()) as any[];
            const sortedUsers = uniqueUsers.sort((a: any, b: any) => {
                const aTs = a?.lastActive?.seconds || a?.createdAt?.seconds || 0;
                const bTs = b?.lastActive?.seconds || b?.createdAt?.seconds || 0;
                return bTs - aTs;
            });
            setActiveStaff(sortedUsers.slice(0, 15));
        }).catch((err) => {
            if (!isMounted) return;
            handleFirestoreError(err, OperationType.GET, 'users');
        });
        return () => { isMounted = false; };
    }, []);

    if (activeStaff.length === 0) return (
        <div className="bg-goodwood-card border border-goodwood-border rounded-xl p-6 text-center text-gray-500 text-[10px] font-bold uppercase tracking-widest italic">
            No active staff found
        </div>
    );

    return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
            <h3 className="flex items-center gap-2 text-gray-500 font-bold text-[10px] tracking-[0.3em] uppercase mb-4">
                <span className="text-lg">🕒</span> Recently Active
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {activeStaff.map((staff, i) => {
                        const lastActiveDate = toDate(staff.lastActive);
                        const isOnline = Boolean(lastActiveDate && Date.now() - lastActiveDate.getTime() <= ONLINE_WINDOW_MS);
                        const normalizedAzuraNameCandidates = [
                            staff?.username,
                            staff?.azuracastName,
                            staff?.encoderName,
                            ...(Array.isArray(staff?.azuracastNames) ? staff.azuracastNames : []),
                        ]
                            .filter((name): name is string => typeof name === 'string')
                            .map((name) => normalizeAzuraIdentity(name))
                            .filter((name) => name.length > 0);
                        const isOnAirProfile = Boolean(
                            isLive &&
                            normalizedAzuraStreamerName &&
                            normalizedAzuraNameCandidates.includes(normalizedAzuraStreamerName)
                        );

                        return (
                    <motion.div 
                      key={staff.id} 
                      initial={{ opacity: 0, scale: 0.8 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      viewport={{ once: true }}
                      whileHover={{ scale: 1.1, zIndex: 10 }}
                      className="aspect-square relative group cursor-pointer"
                    >
                        <Link to={`/profile/${staff.id}`} className="block w-full h-full relative">
                            {isOnAirProfile && (
                                <div aria-hidden="true" className="absolute -inset-1 rounded-lg border-2 border-red-500 animate-pulse pointer-events-none z-10" />
                            )}
                            <UserAvatar 
                                userId={staff.id}
                                fallbackAvatar={staff.avatar}
                                fallbackName={staff.username}
                                className="w-full h-full rounded-lg object-cover border border-goodwood-border group-hover:border-white/50 transition-colors shadow-lg relative z-0" 
                            />
                            {isOnline && (
                                <span role="status" aria-label="Online" className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-goodwood-dark rounded-full shadow-lg z-10"></span>
                            )}
                            
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-white text-black text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                <span>{staff.username}</span>
                                {isOnline && <span className="ml-1">Online</span>}
                            </div>
                        </Link>
                    </motion.div>
                        );
                })}
            </div>
        </motion.div>
    );
}
