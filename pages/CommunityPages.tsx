import React, { useState, useEffect } from 'react';
import { STAFF } from '../constants';
import { Heart, Trophy, Medal, Crown, Shield, Star, User, Search } from 'lucide-react';
import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, limit, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

export const Leaderboard = () => {
  const [tracks, setTracks] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);

  useEffect(() => {
    const tracksQuery = query(collection(db, 'tracks'), orderBy('likes', 'desc'), limit(5));
    const unsubscribeTracks = onSnapshot(tracksQuery, (snapshot) => {
      setTracks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'tracks'));

    const staffQuery = query(collection(db, 'staff'), where('department', '==', 'Radio'), limit(3));
    const unsubscribeStaff = onSnapshot(staffQuery, (snapshot) => {
      setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'staff'));

    return () => {
      unsubscribeTracks();
      unsubscribeStaff();
    };
  }, []);

  const topDJs = staff.length > 0 ? staff : STAFF.filter(s => s.department === 'Radio').slice(0, 3);

  return (
    <div className="container mx-auto max-w-6xl">
       <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white flex items-center justify-center gap-3 mb-2">
              <Trophy className="text-yellow-500" /> LEADERBOARDS
          </h2>
          <p className="text-gray-400">See who's rocking the charts this week on Goodwood FM.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Tracks */}
        <div className="bg-[#16191f] border border-[#2a2f3a] rounded-xl overflow-hidden">
           <div className="p-6 border-b border-[#2a2f3a] bg-[#1c2029]">
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                 <Heart className="text-pink-500 fill-pink-500" size={18} /> Most Liked Tracks
              </h3>
           </div>
           <div className="p-2">
              {tracks.length > 0 ? tracks.map((track, idx) => (
                <div key={track.id} className="flex items-center gap-4 p-4 hover:bg-[#1c2029] rounded-lg transition-colors group">
                   <div className={clsx(
                     "w-8 h-8 flex items-center justify-center font-black text-lg",
                     idx === 0 ? "text-yellow-500" : idx === 1 ? "text-gray-400" : idx === 2 ? "text-orange-600" : "text-gray-600"
                   )}>
                     #{idx + 1}
                   </div>
                   <div className="flex-1">
                      <h4 className="text-white font-bold group-hover:text-blue-400 transition-colors">{track.title}</h4>
                      <p className="text-gray-500 text-xs">{track.artist}</p>
                   </div>
                   <div className="text-right">
                      <div className="text-white font-mono font-bold text-sm">{track.likes} <span className="text-pink-500">♥</span></div>
                      <div className="text-gray-600 text-xs">{track.plays} plays</div>
                   </div>
                </div>
              )) : (
                <div className="p-8 text-center text-gray-500 text-xs uppercase tracking-widest">No tracks found</div>
              )}
           </div>
        </div>

        {/* Top DJs */}
        <div className="bg-[#16191f] border border-[#2a2f3a] rounded-xl overflow-hidden">
           <div className="p-6 border-b border-[#2a2f3a] bg-[#1c2029]">
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                 <Medal className="text-yellow-500" size={18} /> Top Presenters
              </h3>
           </div>
           <div className="p-4 space-y-4">
              {topDJs.map((dj, idx) => (
                 <div key={dj.id} className="bg-[#0f1014] p-4 rounded-lg border border-[#2a2f3a] flex items-center gap-4 relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-4 opacity-10">
                       <Crown size={64} />
                    </div>
                    {dj.avatar ? (
                        <img src={dj.avatar} className="w-16 h-16 rounded-full border-2 border-[#2a2f3a] object-cover" alt={dj.username} />
                    ) : (
                        <div className="w-16 h-16 rounded-full border-2 border-[#2a2f3a] bg-emerald-900 flex items-center justify-center">
                            <span className="text-white font-black text-2xl">{dj.username?.charAt(0) || '?'}</span>
                        </div>
                    )}
                    <div>
                       <div className="flex items-center gap-2">
                          <h4 className="text-white font-bold text-lg">{dj.username}</h4>
                          {idx === 0 && <Crown size={14} className="text-yellow-500 fill-yellow-500" />}
                       </div>
                       <p className="text-gray-400 text-xs">Active this week</p>
                       <div className="mt-2 w-full bg-gray-800 h-1 rounded-full overflow-hidden">
                          <div className="bg-blue-500 h-full" style={{ width: `${100 - (idx * 20)}%` }} />
                       </div>
                    </div>
                 </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
};

export const MembersList = ({ type }: { type: 'verified' | 'all' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    let q = query(collection(db, 'users'), orderBy('username', 'asc'));
    
    if (type === 'verified') {
      q = query(collection(db, 'users'), where('role', 'in', ['admin', 'owner', 'manager', 'dj', 'journalist', 'staff', 'vip']), orderBy('username', 'asc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'users'));

    return () => unsubscribe();
  }, [type]);

  const filteredMembers = members.filter(m => 
    m.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto max-w-6xl">
       <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white flex items-center justify-center gap-3 mb-2 uppercase">
              {type === 'verified' && <Shield className="text-blue-500" />}
              {type === 'all' && <User className="text-gray-500" />}
              {type} Members
          </h2>
          <p className="text-gray-400">Browsing {filteredMembers.length} {type} members.</p>
      </div>

      <div className="bg-[#16191f] p-4 rounded-lg border border-[#2a2f3a] mb-6 flex items-center gap-2 focus-within:border-blue-500 transition-colors">
         <Search className="text-gray-500" size={20} />
         <input 
            type="text" 
            placeholder="Search members..." 
            className="bg-transparent border-none focus:outline-none text-white w-full placeholder-gray-600"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
         />
      </div>

      {filteredMembers.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 animate-in fade-in duration-300">
             {filteredMembers.map(member => (
                <Link to={`/profile/${member.id}`} key={member.id} className="bg-[#16191f] border border-[#2a2f3a] rounded-lg p-4 flex flex-col items-center gap-3 hover:-translate-y-1 transition-transform duration-300 group cursor-pointer">
                   <div className="relative">
                      {member.avatar ? (
                          <img src={member.avatar || undefined} alt={member.username} className="w-20 h-20 rounded-full border-2 border-[#2a2f3a] group-hover:border-white/50 transition-colors object-cover" />
                      ) : (
                          <div className="w-20 h-20 rounded-full border-2 border-[#2a2f3a] group-hover:border-white/50 transition-colors bg-emerald-900 flex items-center justify-center">
                              <span className="text-white font-black text-2xl">{member.username?.charAt(0) || '?'}</span>
                          </div>
                      )}
                      {['admin', 'owner', 'manager'].includes(member.role) && <div className="absolute bottom-0 right-0 bg-red-600 text-white p-1 rounded-full"><Shield size={10} fill="white" /></div>}
                      {member.role === 'vip' && <div className="absolute bottom-0 right-0 bg-yellow-500 text-white p-1 rounded-full"><Star size={10} fill="white" /></div>}
                   </div>
                   <div className="text-center">
                      <h4 className={clsx("font-bold text-sm truncate w-full", ['admin', 'owner'].includes(member.role) ? "text-red-500" : member.role === 'vip' ? "text-yellow-400" : ["staff", "manager", "dj", "journalist"].includes(member.role) ? "text-emerald-400" : "text-gray-300")}>{member.username}</h4>
                      <p className="text-[10px] text-gray-500 uppercase font-bold">{member.role || 'Member'}</p>
                   </div>
                </Link>
             ))}
          </div>
      ) : (
          <div className="text-center py-12 text-gray-500">
              <p>No members found matching "{searchTerm}"</p>
          </div>
      )}
    </div>
  );
};
