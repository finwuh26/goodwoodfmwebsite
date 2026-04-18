import React, { useState, useEffect } from 'react';
import { formatDate } from '../utils';
import { Link } from 'react-router-dom';
import { DiscordWidget, StaffOfTheMonth, RecentlyActiveWidget } from '../components/HomeWidgets';
import { UserAvatar } from '../components/UserAvatar';
import { FileText, User, Clock, ChevronRight, History, Radio, ExternalLink } from 'lucide-react';

import { motion } from 'motion/react';
import { useRadio } from '../context/RadioContext';
import { collection, onSnapshot, query, orderBy, limit, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';

export const Home = () => {
  const { radioData } = useRadio();
  const { user } = useAuth();
  const history = radioData?.song_history || [];
  const [articles, setArticles] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  useEffect(() => {
    const qArticles = query(collection(db, 'articles'), where('status', '==', 'published'), orderBy('date', 'desc'), limit(5));
    const unsubscribe = onSnapshot(qArticles, (snapshot) => {
      setArticles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'articles'));

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const qSchedule = query(collection(db, 'schedule'), where('day', '==', today), orderBy('time', 'asc'));
    const sunsubscribe = onSnapshot(qSchedule, (snapshot) => {
      setSchedule(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'schedule'));

    const qBanners = query(collection(db, 'banners'), where('active', '==', true));
    const bunsubscribe = onSnapshot(qBanners, (snapshot) => {
        const fallbacks = [
              {
                  id: 'fallback-1',
                  title: 'WANT TO BE A PART OF A TEAM OF PASSIONATE INDIVIDUALS?',
                  topic: 'Join The Best',
                  link: '#/jobs',
                  active: true
              },
              {
                  id: 'fallback-2',
                  title: 'A BRAND NEW ERA FOR GOODWOOD',
                  topic: 'Version 1.0',
                  link: '#/community/all',
                  active: true
              },
              {
                  id: 'fallback-3',
                  title: 'STAY CONNECTED WITH OUR COMMUNITY',
                  topic: 'Join Discord',
                  link: 'https://discord.gg/goodwoodfm',
                  active: true
              }
        ];

      if (!snapshot.empty) {
          const customBanners = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setBanners([...customBanners, ...fallbacks]);
      } else {
          setBanners(fallbacks);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'banners'));

    return () => {
      unsubscribe();
      sunsubscribe();
      bunsubscribe();
    };
  }, []);

  useEffect(() => {
     if (banners.length <= 1) return;
     const interval = setInterval(() => {
         setCurrentBannerIndex(prev => (prev + 1) % banners.length);
     }, 8000);
     return () => clearInterval(interval);
  }, [banners.length]);

  const activeBanner = banners[currentBannerIndex];

  const now = new Date();
  const currentHour = now.getHours();
  const liveShow = schedule.find(s => parseInt(s.time.split(':')[0]) === currentHour);
  const nextShow = schedule.find(s => parseInt(s.time.split(':')[0]) === currentHour + 1);
  const laterShow = schedule.find(s => parseInt(s.time.split(':')[0]) === currentHour + 2);

  const formatTime = (hour: number) => {
    const h = hour % 24;
    return `${h.toString().padStart(2, '0')}:00 - ${((h + 1) % 24).toString().padStart(2, '0')}:00`;
  };

  const timetableItems = [
    { label: 'LIVE', show: liveShow?.showName || 'AutoDJ', time: formatTime(currentHour), opacity: 'bg-white/20', slot: liveShow },
    { label: 'NEXT', show: nextShow?.showName || 'AutoDJ', time: formatTime(currentHour + 1), opacity: 'bg-white/10', slot: nextShow },
    { label: 'LATER', show: laterShow?.showName || 'AutoDJ', time: formatTime(currentHour + 2), opacity: 'bg-white/5', slot: laterShow }
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6 md:gap-8">
      {/* Left Column (Content) */}
      <div className="flex-1 min-w-0">
        {!user && (
          <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-5 py-4">
            <p className="text-xs md:text-sm text-emerald-200 font-bold tracking-wide">
              Sign in to unlock your profile, activity status, comments, and more community features.
            </p>
            <Link to="/login" className="inline-flex mt-3 text-xs font-black uppercase tracking-widest text-black bg-emerald-400 px-4 py-2 rounded hover:bg-emerald-300 transition-colors">
              Sign In
            </Link>
          </div>
        )}
        
        {/* Timetable Overview Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {timetableItems.map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-goodwood-card border border-goodwood-border rounded p-3 sm:p-4 flex items-center gap-3 sm:gap-4 relative overflow-hidden group cursor-pointer hover:border-white/20 transition-all"
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.opacity} group-hover:bg-white transition-colors`} />
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded bg-emerald-900 flex items-center justify-center border border-goodwood-border shadow-inner overflow-hidden">
                    {item.slot?.claimedBy ? (
                        <UserAvatar userId={item.slot.claimedBy} fallbackName={item.show} className="w-full h-full object-cover" />
                    ) : (
                        <Radio size={20} className="text-white/50" />
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <h4 className="text-white font-bold uppercase text-xs tracking-wider truncate">{item.label} - {item.show}</h4>
                    <p className="text-[10px] text-gray-500 font-mono mt-1">{item.time}</p>
                </div>
              </motion.div>
            ))}
        </div>

        {/* Hero Banner */}
        {activeBanner ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full h-44 sm:h-56 rounded-lg overflow-hidden relative mb-10 sm:mb-12 group cursor-pointer border border-goodwood-border shadow-2xl"
            onClick={() => window.open(activeBanner.link, activeBanner.link?.startsWith('#') ? '_self' : '_blank')}
          >
              <div className="absolute inset-0 bg-goodwood-dark mix-blend-overlay z-0" />
              {activeBanner.image ? (
                  <img src={activeBanner.image} alt={activeBanner.title} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700 z-0" />
              ) : (
                  <div className="absolute inset-0 bg-gradient-to-r from-teal-600 via-emerald-600 to-emerald-900 opacity-80 group-hover:opacity-100 transition-all duration-700 group-hover:scale-105 z-0" />
              )}
              <div className="absolute inset-0 bg-black/30 mix-blend-overlay z-[5]" />
              <div className="absolute inset-0 bg-gradient-to-t from-goodwood-dark via-goodwood-dark/40 to-transparent z-10" />
              
              {banners.length > 1 && (
                  <div className="absolute top-3 right-3 sm:top-6 sm:right-6 z-20 flex gap-2">
                       {banners.map((_, i) => (
                           <button 
                               key={i} 
                               onClick={(e) => { e.stopPropagation(); setCurrentBannerIndex(i); }} 
                               className={`w-2 h-2 rounded-full transition-all ${i === currentBannerIndex ? 'bg-white w-6' : 'bg-white/40'}`}
                           />
                       ))}
                  </div>
              )}
              
              {(activeBanner.title || activeBanner.topic) && (
                  <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 z-20 pr-3">
                      {activeBanner.topic && (
                          <motion.p 
                            key={`topic-${activeBanner.id}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="text-[9px] sm:text-[10px] tracking-[0.3em] sm:tracking-[0.4em] font-bold text-white/80 mb-2 uppercase drop-shadow-md"
                          >
                            {activeBanner.topic}
                          </motion.p>
                      )}
                      {activeBanner.title && (
                          <motion.h2 
                            key={`title-${activeBanner.id}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="text-xl sm:text-3xl md:text-5xl font-black text-white italic tracking-tighter drop-shadow-2xl"
                          >
                            {activeBanner.title}
                          </motion.h2>
                      )}
                  </div>
              )}
              
              <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="flex items-center gap-2 text-white font-bold uppercase tracking-widest text-[10px] sm:text-xs bg-white/10 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full backdrop-blur-md shadow-2xl">
                      Go Here <ExternalLink size={14} />
                  </span>
              </div>
          </motion.div>
        ) : null}

        {/* Content Section */}
        <div>
            <div className="flex items-center gap-3 mb-8">
                <FileText className="text-white" size={18} />
                <h3 className="text-white font-bold uppercase tracking-[0.2em] text-xs">Latest Content</h3>
                <div className="h-[1px] bg-goodwood-border flex-1 ml-2" />
            </div>

            <div className="space-y-6">
                {articles.length > 0 ? articles.map((article, idx) => (
                    <motion.div
                      key={article.id}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.1 }}
                    >
                      <Link to={`/article/${article.id}`} className="block relative h-[200px] sm:h-[240px] rounded-xl overflow-hidden border border-goodwood-border group cursor-pointer shadow-xl">
                           {article.image ? (
                               <img src={article.image} alt={article.title} className="w-full h-full object-cover opacity-30 group-hover:opacity-50 transition-all duration-700 group-hover:scale-105" />
                           ) : (
                               <div className="w-full h-full bg-emerald-900 flex items-center justify-center opacity-30 group-hover:opacity-50 transition-all duration-700 group-hover:scale-105">
                                   <FileText size={64} className="text-white/50" />
                               </div>
                           )}
                           <div className="absolute inset-0 bg-gradient-to-t from-goodwood-dark via-goodwood-dark/40 to-transparent" />
                           
                            <div className="absolute bottom-0 left-0 w-full p-4 sm:p-8">
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-2 mb-3"
                              >
                                <span className="bg-white/10 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Article</span>
                                <span className="w-1 h-1 bg-gray-600 rounded-full" />
                                <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                                  {formatDate(article.date)}
                                </span>
                              </motion.div>
                              <h2 title={article.title} aria-label={article.title} className="text-xl sm:text-3xl md:text-4xl font-black text-white uppercase italic leading-tight mb-3 sm:mb-4 drop-shadow-md max-w-2xl group-hover:text-white/90 transition-colors line-clamp-2">{article.title}</h2>
                              <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                  <div className="flex items-center gap-2 group-hover:text-white transition-colors">
                                      <User size={12} />
                                      <span>{article.authorName}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                      <Clock size={12} />
                                      <span>{Math.max(1, Math.ceil((article.content || '').split(/\s+/).length / 200))} min read</span>
                                  </div>
                              </div>
                           </div>
                      </Link>
                    </motion.div>
                )) : (
                  <div className="p-12 text-center text-gray-600 font-bold uppercase tracking-widest italic border border-goodwood-border rounded-xl">
                    No articles found
                  </div>
                )}
            </div>
        </div>
      </div>

      {/* Right Column (Sidebar) */}
      <div className="w-full lg:w-[320px] flex-shrink-0 space-y-8">
         {/* Recent Tracks Widget */}
         <motion.div
           initial={{ opacity: 0, y: 20 }}
           whileInView={{ opacity: 1, y: 0 }}
           viewport={{ once: true }}
           className="bg-goodwood-card border border-goodwood-border rounded-xl p-6 shadow-xl"
         >
            <h3 className="flex items-center gap-2 text-gray-500 font-bold text-[10px] tracking-[0.3em] uppercase mb-6">
                <History size={14} /> Recent Tracks
            </h3>
            <div className="space-y-4">
                {history.length > 0 ? history.map((item, i) => (
                    <motion.div 
                      key={item.sh_id}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 group cursor-default"
                    >
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-goodwood-border group-hover:border-white/20 transition-colors">
                            {item.song.art ? (
                                <img src={item.song.art} alt={item.song.title} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-emerald-900 flex items-center justify-center">
                                    <Radio size={20} className="text-white/50" />
                                </div>
                            )}
                        </div>
                        <div className="min-w-0">
                            <h4 className="text-white font-bold text-xs truncate group-hover:text-white transition-colors uppercase italic tracking-tight">{item.song.title}</h4>
                            <p className="text-gray-500 text-[10px] font-bold truncate uppercase tracking-widest">{item.song.artist}</p>
                        </div>
                    </motion.div>
                )).slice(0, 5) : (
                  <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest text-center py-4 italic">No history available</p>
                )}
            </div>
         </motion.div>

         <DiscordWidget />
         <StaffOfTheMonth />
         <RecentlyActiveWidget />
      </div>
    </div>
  );
};
