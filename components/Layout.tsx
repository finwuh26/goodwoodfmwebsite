import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Play, Pause, ShoppingBag, User as UserIcon, ChevronDown, Heart, Volume2, LogOut, Mail, Maximize2, MoreHorizontal, Radio, Settings, Shield } from 'lucide-react';
import { NAV_ITEMS } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useRadio } from '../context/RadioContext';
import { useAuth } from '../context/AuthContext';
import { collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc, onSnapshot, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { makeLikeReadKey, readFirestoreWithGuard, seedFirestoreReadCache } from '../utils/firestoreReadGuards';

import { Marquee } from './Marquee';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

interface LayoutProps {
  children: React.ReactNode;
}

type LikeQuerySnapshot = Awaited<ReturnType<typeof getDocs>>;

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { radioData, isPlaying, setIsPlaying, volume, setVolume } = useRadio();
  const { userProfile, login, logout, loginWithEmail, signupWithEmail } = useAuth();
  const audioRef = useRef<HTMLAudioElement>(null);

  // Auth Modal State
  const [showLogin, setShowLogin] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestType, setRequestType] = useState('Song Request');
  const [requestMessage, setRequestMessage] = useState('');
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [songSearchResults, setSongSearchResults] = useState<any[]>([]);
  const [isSearchingSongs, setIsSearchingSongs] = useState(false);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeDocId, setLikeDocId] = useState<string | null>(null);
  
  // UI State
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [showMiniplayer, setShowMiniplayer] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (requestType !== 'Song Request') {
        setSongSearchResults([]);
        setSongSearchQuery('');
        return;
    }
    if (!songSearchQuery.trim()) {
        setSongSearchResults([]);
        return;
    }

    const delayDebounceFn = setTimeout(async () => {
        setIsSearchingSongs(true);
        try {
            const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(songSearchQuery)}&entity=song&limit=4`);
            const data = await response.json();
            setSongSearchResults(data.results || []);
        } catch (error) {
            console.error("Error searching songs", error);
        } finally {
            setIsSearchingSongs(false);
        }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [songSearchQuery, requestType]);

  useEffect(() => {
    const handleScroll = () => {
      // Show miniplayer if scrolled down more than 200px
      setShowMiniplayer(window.scrollY > 200);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Reset dropdown on route change
  useEffect(() => {
    setActiveDropdown(null);
  }, [location]);

  // Audio Logic
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.load();
        audioRef.current.play().catch(e => {
            console.error("Audio play failed:", e);
            setIsPlaying(false);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  // Safe Accessors
  const streamUrl = radioData?.station?.listen_url || "";
  const albumArt = radioData?.now_playing?.song?.art || "";
  const bgImage = radioData?.now_playing?.song?.art || "";
  const songTitle = radioData?.now_playing?.song?.title || "Loading...";
  const songArtist = radioData?.now_playing?.song?.artist || "Goodwood FM";
  const isLive = radioData?.live?.is_live || false;
  const streamerName = radioData?.live?.streamer_name || "";
  const nextSong = radioData?.playing_next?.song;
  const history = radioData?.song_history || [];

  // Check if current song is liked by user
  useEffect(() => {
    if (!userProfile || !songTitle || !songArtist || songTitle === "Loading...") {
        setIsLiked(false);
        setLikeDocId(null);
        return;
    }

    let unsubscribe = () => {};
    let isActive = true;

    const q = query(
      collection(db, 'likes'),
      where('userId', '==', userProfile.uid),
      where('songTitle', '==', songTitle),
      where('songArtist', '==', songArtist)
    );
    const likeReadKey = makeLikeReadKey(userProfile.uid, songTitle, songArtist);

    const applyLikeSnapshot = (snapshot: LikeQuerySnapshot) => {
      if (!snapshot.empty) {
        setLikeDocId(snapshot.docs[0].id);
        setIsLiked(true);
        return;
      }
      setLikeDocId(null);
      setIsLiked(false);
    };

    const subscribeToLike = async () => {
      try {
        // Cache + throttling prevents remount bursts from re-reading Firestore inside 10s.
        const cachedOrFreshSnapshot = await readFirestoreWithGuard(likeReadKey, () => getDocs(q));
        applyLikeSnapshot(cachedOrFreshSnapshot);
      } catch (err) {
        console.warn("Like read was throttled or failed; waiting for live updates.", err);
      }

      if (!isActive) return;

      // Real-time listener replaces repeated polling reads and keeps UI near real-time.
      unsubscribe = onSnapshot(q, (snapshot) => {
        seedFirestoreReadCache(likeReadKey, snapshot);
        applyLikeSnapshot(snapshot);
      }, (err) => handleFirestoreError(err, OperationType.GET, 'likes'));
    };

    subscribeToLike();

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [userProfile, songTitle, songArtist]);

  const handleLike = async () => {
    if (!userProfile) {
        setShowLogin(true);
        return;
    }

    try {
        if (likeDocId) {
            // Unlike
            await deleteDoc(doc(db, 'likes', likeDocId));
            setIsLiked(false);
            setLikeDocId(null);
        } else {
            // Like
            await addDoc(collection(db, 'likes'), {
                userId: userProfile.uid,
                songTitle,
                songArtist,
                timestamp: serverTimestamp()
            });
            setIsLiked(true);
        }
    } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'likes');
    }
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    
    setSubmittingRequest(true);
    try {
        await addDoc(collection(db, 'enquiries'), {
            type: requestType,
            name: userProfile.username,
            email: userProfile.email,
            message: requestMessage,
            createdAt: serverTimestamp(),
            department: 'Radio'
        });
        alert("Your request has been sent!");
        setShowRequestModal(false);
        setRequestMessage('');
    } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'enquiries');
    } finally {
        setSubmittingRequest(false);
    }
  };

  const { systemSettings } = useAuth();
  
  if (systemSettings?.maintenanceMode && userProfile?.role !== 'admin' && userProfile?.role !== 'manager' && userProfile?.role !== 'owner') {
     return (
        <div className="min-h-screen bg-[#0a0b0f] flex flex-col items-center justify-center text-white px-6">
            <div className="text-center space-y-6 max-w-md">
                <Shield size={64} className="mx-auto text-emerald-500 mb-8 blur-[2px] opacity-80" />
                <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter uppercase">We'll be right back</h1>
                <p className="text-gray-400 text-lg leading-relaxed">
                    Goodwood FM is currently undergoing scheduled maintenance. Our engineers are working hard to bring you an even better experience.
                </p>
                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden relative">
                    <div className="absolute top-0 bottom-0 left-0 w-1/3 bg-emerald-500 rounded-full animate-[pulse_2s_ease-in-out_infinite]" />
                </div>
                <div className="pt-8 flex flex-col gap-4">
                  {userProfile ? (
                     <button onClick={logout} className="text-sm font-bold text-gray-500 hover:text-white transition-colors uppercase tracking-widest">Logout</button>
                  ) : (
                     <button onClick={() => setShowLogin(true)} className="text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors uppercase tracking-widest">Staff Login</button>
                  )}
                </div>
            </div>
            
            {showLogin && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-goodwood-card border border-goodwood-border rounded-2xl w-full max-w-sm p-6 relative">
                    <button onClick={() => setShowLogin(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><LogOut size={20} /></button>
                    <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-6">Staff Access</h2>
                    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const target = e.target as any; loginWithEmail(target.email.value, target.password.value).catch(console.error); }}>
                      <input name="email" type="email" placeholder="Email" className="w-full bg-goodwood-dark border border-goodwood-border rounded p-3 text-white outline-none focus:border-emerald-500" required />
                      <input name="password" type="password" placeholder="Password" className="w-full bg-goodwood-dark border border-goodwood-border rounded p-3 text-white outline-none focus:border-emerald-500" required />
                      <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-3 rounded uppercase tracking-widest hover:bg-emerald-700 transition-colors">Login</button>
                    </form>
                    <div className="mt-4 text-center">
                      <button onClick={login} className="text-sm text-gray-400 hover:text-white underline">Or login with Google</button>
                    </div>
                  </div>
                </div>
            )}
        </div>
     );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans text-sm selection:bg-white selection:text-black">
      {/* Background Ambience */}
      <div className="fixed inset-0 z-[-1] bg-goodwood-dark" />
      
      <audio 
        ref={audioRef}
        src={streamUrl || undefined}
        crossOrigin="anonymous"
        preload="none"
      />

      {/* Header Section */}
      <header className="relative w-full h-[450px] flex flex-col">
        {/* Background Wrapper */}
        <div className="absolute inset-0 overflow-hidden z-0">
            {/* Blurred Background */}
            <AnimatePresence mode="wait">
              <motion.div 
                key={bgImage}
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 0.3, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                transition={{ duration: 2, ease: "easeInOut" }}
                className="absolute inset-0 bg-cover bg-center blur-3xl mask-image-gradient"
                style={{ 
                  backgroundImage: bgImage ? `url('${bgImage}')` : undefined,
                  backgroundColor: '#0f1014'
                }}
              />
            </AnimatePresence>
            <div className="absolute inset-0 bg-gradient-to-b from-goodwood-dark/60 via-goodwood-dark/80 to-goodwood-dark" />
            <div className="absolute inset-0 bg-gradient-to-r from-goodwood-dark/80 via-transparent to-goodwood-dark/20" />
        </div>

        {/* Main Player Area */}
        <div className="relative z-10 flex-1 flex flex-col justify-end pb-8">
          <div className="container mx-auto px-6 md:px-12 flex flex-col md:flex-row items-end gap-8">
            
            {/* Album Art */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative shrink-0 group"
            >
                <div className="w-48 h-48 md:w-60 md:h-60 rounded-lg shadow-2xl shadow-black/50 overflow-hidden border border-white/10 bg-goodwood-card relative">
                   <AnimatePresence mode="wait">
                     {albumArt ? (
                          <motion.img 
                            key={albumArt}
                            src={albumArt} 
                           alt="Album Art" 
                           initial={{ opacity: 0 }}
                           animate={{ opacity: 1 }}
                           exit={{ opacity: 0 }}
                           transition={{ duration: 0.5 }}
                           className="w-full h-full object-cover"
                         />
                     ) : (
                         <motion.div 
                           key="placeholder"
                           initial={{ opacity: 0 }}
                           animate={{ opacity: 1 }}
                           exit={{ opacity: 0 }}
                           transition={{ duration: 0.5 }}
                           className="w-full h-full flex items-center justify-center bg-emerald-900"
                         >
                             <Radio size={64} className="text-white/20" />
                         </motion.div>
                     )}
                   </AnimatePresence>
                   
                 </div>
             </motion.div>

            {/* Track Info & Controls */}
            <div className="flex-1 w-full min-w-0 mb-2">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-gray-500 text-xs font-bold tracking-widest uppercase">Now Playing</span>
                  </div>
                  <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-none mb-2 drop-shadow-lg w-full overflow-hidden">
                      <Marquee text={songTitle} className="w-full" />
                  </h1>
                  <div className="text-xl md:text-2xl text-gray-400 font-medium mb-4 w-full overflow-hidden">
                      <Marquee text={songArtist} className="w-full" />
                  </div>
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 mb-8"
                  >
                     <span className="bg-white/10 px-1.5 py-0.5 rounded text-[8px] font-black text-white/60 tracking-widest uppercase">ON AIR</span>
                      <span className="text-white/30 text-[10px] font-bold uppercase tracking-widest truncate">
                        {isLive && streamerName ? streamerName : 'AutoDJ'}
                      </span>
                   </motion.div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center gap-6"
                >
                    {/* Play Button */}
                    <button 
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="w-14 h-14 bg-white rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-white/10 group"
                    >
                        {isPlaying ? (
                            <Pause className="w-6 h-6 text-black fill-current" />
                        ) : (
                            <Play className="w-6 h-6 text-black fill-current ml-1" />
                        )}
                    </button>

                    {/* Divider */}
                    <div className="h-8 w-[1px] bg-white/10 mx-2 hidden md:block" />

                    {/* Volume Slider */}
                    <div className="flex items-center gap-3 group">
                        <Volume2 size={20} className="text-gray-400 group-hover:text-white transition-colors" />
                        <div className="w-24 h-1 bg-white/10 rounded-full relative cursor-pointer overflow-hidden">
                            <motion.div 
                              className="absolute top-0 left-0 h-full bg-white rounded-full" 
                              animate={{ width: `${volume}%` }}
                              transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            />
                            <input 
                                type="range" 
                                min="0" 
                                max="100" 
                                value={volume}
                                onChange={(e) => setVolume(Number(e.target.value))}
                                className="absolute inset-0 w-full opacity-0 cursor-pointer"
                            />
                        </div>
                    </div>

                    {/* Right Actions */}
                    <div className="ml-auto flex items-center gap-4 text-gray-400">
                        <button 
                          onClick={handleLike}
                          className={clsx(
                            "p-2 rounded-full transition-all duration-300",
                            isLiked ? "text-pink-500 bg-pink-500/10" : "hover:text-white hover:bg-white/10"
                          )}
                        >
                            <Heart size={20} className={clsx(isLiked && "fill-current")} />
                        </button>
                        <button 
                          onClick={() => setShowRequestModal(true)}
                          className="p-2 hover:text-white hover:bg-white/10 rounded-full transition-colors hidden sm:block"
                        >
                            <Mail size={20} />
                        </button>
                    </div>
                </motion.div>
            </div>
          </div>
        </div>

        {/* Navigation Bar */}
        <div className="relative z-20 container mx-auto px-4 pb-0">
          <nav className="flex items-center justify-between bg-goodwood-card/80 backdrop-blur-md border border-goodwood-border rounded-t-lg px-2">
            {/* Left Nav */}
            <ul className="flex items-center">
              {NAV_ITEMS.map((item) => (
                <li 
                  key={item.label} 
                  className="relative group"
                  onMouseEnter={() => setActiveDropdown(item.label)}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <Link 
                    to={item.href}
                    className="flex items-center gap-2 px-5 py-5 text-gray-400 hover:text-white hover:bg-white/5 transition-all font-medium text-xs tracking-wide uppercase border-b-2 border-transparent hover:border-white/20"
                  >
                    <item.icon size={14} className="mb-0.5" />
                    {item.label}
                    {item.subItems && <ChevronDown size={10} className="ml-1 opacity-50 group-hover:opacity-100 transition-opacity" />}
                  </Link>

                  {/* Dropdown */}
                  <AnimatePresence>
                    {item.subItems && activeDropdown === item.label && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full left-0 w-56 bg-goodwood-card border border-goodwood-border rounded-b-md shadow-2xl py-2 z-50"
                      >
                        {item.subItems.map((sub) => (
                          sub.href.startsWith('http') ? (
                            <a 
                              key={sub.label} 
                              href={sub.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block px-6 py-2.5 text-xs text-gray-400 hover:text-white hover:bg-white/5 hover:pl-8 transition-all"
                            >
                              {sub.label}
                            </a>
                          ) : (
                            <Link 
                              key={sub.label} 
                              to={sub.href}
                              className="block px-6 py-2.5 text-xs text-gray-400 hover:text-white hover:bg-white/5 hover:pl-8 transition-all"
                            >
                              {sub.label}
                            </Link>
                          )
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              ))}
            </ul>

            {/* Right Nav */}
            <div className="flex items-center border-l border-goodwood-border pl-2">
               
               {userProfile ? (
                   <div className="relative group">
                       <button className="flex items-center gap-2 px-4 py-4 text-white hover:bg-white/5 transition-colors text-xs font-bold uppercase">
                          {userProfile.avatar ? (
                              <img src={userProfile.avatar} className="w-5 h-5 rounded-full border border-gray-500 object-cover" alt="Avatar" />
                          ) : (
                              <div className="w-5 h-5 rounded-full border border-gray-500 bg-emerald-900 flex items-center justify-center">
                                  <span className="text-[10px] font-bold text-white">{userProfile.username?.charAt(0) || '?'}</span>
                              </div>
                          )}
                          {userProfile.username}
                          <ChevronDown size={10} className="opacity-50" />
                       </button>
                       <div className="absolute right-0 top-full w-48 bg-goodwood-card border border-goodwood-border rounded-b-md shadow-2xl py-2 hidden group-hover:block z-50">
                          <Link to={`/profile/${userProfile.uid}`} className="w-full text-left px-4 py-2 text-xs text-gray-400 hover:bg-white/5 flex items-center gap-2">
                              <UserIcon size={12} /> My Profile
                          </Link>
                          <Link to="/settings" className="w-full text-left px-4 py-2 text-xs text-gray-400 hover:bg-white/5 flex items-center gap-2">
                              <Settings size={12} /> Settings
                          </Link>
                          {(userProfile.role === 'admin' || userProfile.role === 'staff' || userProfile.role === 'manager' || userProfile.role === 'dj' || userProfile.role === 'journalist' || userProfile.role === 'owner') && (
                              <Link to="/staff/dashboard" className="w-full text-left px-4 py-2 text-xs text-emerald-400 hover:bg-white/5 flex items-center gap-2">
                                  <Shield size={12} /> Staff Dashboard
                              </Link>
                          )}
                          <div className="h-[1px] bg-goodwood-border my-1" />
                          <button onClick={logout} className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-white/5 flex items-center gap-2">
                              <LogOut size={12} /> Sign Out
                          </button>
                       </div>
                   </div>
               ) : (
                   <button 
                    onClick={() => { setShowLogin(true); }}
                    className="flex items-center gap-2 px-4 py-4 text-gray-400 hover:text-white transition-colors text-xs font-bold uppercase hover:bg-white/5"
                   >
                      <UserIcon size={14} />
                      Account
                   </button>
               )}
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 container mx-auto px-4 py-8 relative z-10 bg-goodwood-dark">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-goodwood-border bg-[#0c0d11] pt-12 pb-24 mt-auto">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-8">
           <div className="text-xs text-gray-500 space-y-2 text-center md:text-left">
              <div className="flex items-center gap-3 justify-center md:justify-start text-gray-400 font-bold">
                <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
                <span>/</span>
                <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
                <span>/</span>
                <Link to="/safety" className="hover:text-white transition-colors">Safety</Link>
              </div>
              <p>Designed with passion by Fin in 2026.</p>
           </div>

           <div className="text-center">
              <h2 className="text-4xl font-thin tracking-[0.4em] text-gray-700 hover:text-gray-500 transition-colors cursor-default select-none">GOODWOOD</h2>
           </div>

           <div className="text-xs text-gray-500 text-center md:text-right space-y-2">
              <p className="text-white font-medium">© Goodwood FM 2026. All rights reserved.</p>
              <p className="flex items-center justify-center md:justify-end gap-1">
                Hosted with <Heart size={10} className="text-pink-600 fill-pink-600" /> in the <span className="text-white">UK</span>.
              </p>
              <p className="opacity-50">v1.2.4-stable</p>
           </div>
        </div>
      </footer>

      {/* Fixed Bottom Radio Player (Shows on scroll) */}
      <AnimatePresence>
          {showMiniplayer && (
              <motion.div 
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 100, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="fixed bottom-0 left-0 right-0 bg-goodwood-card/95 backdrop-blur-md border-t border-goodwood-border p-3 z-[60] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
              >
                  <div className="container mx-auto max-w-7xl flex items-center justify-between gap-4">
                      {/* Song Info */}
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="w-12 h-12 rounded bg-goodwood-dark border border-white/10 overflow-hidden shrink-0 flex items-center justify-center shadow-lg">
                              {albumArt ? (
                                  <img src={albumArt} alt="Art" className="w-full h-full object-cover" />
                              ) : (
                                  <Radio size={20} className="text-gray-500" />
                              )}
                          </div>
                          <div className="min-w-0 flex-1">
                              <h4 className="text-white font-bold text-sm truncate">{songTitle}</h4>
                              <p className="text-gray-400 text-xs truncate">{songArtist}</p>
                          </div>
                      </div>
                      
                      {/* Controls */}
                      <div className="flex items-center gap-6 shrink-0">
                          <button 
                              onClick={() => {
                                  setRequestType('Song Request');
                                  setShowRequestModal(true);
                              }}
                              className="hidden md:flex items-center gap-2 bg-goodwood-dark hover:bg-white/5 border border-goodwood-border px-3 py-1.5 rounded-lg text-xs font-bold text-gray-300 hover:text-white transition-all"
                          >
                              <Mail size={14} /> Contact Goodwood FM
                          </button>

                          <button 
                              onClick={() => setIsPlaying(!isPlaying)}
                              className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-white/10"
                          >
                              {isPlaying ? <Pause className="w-4 h-4 text-black fill-current" /> : <Play className="w-4 h-4 text-black fill-current ml-1" />}
                          </button>
                          
                          <div className="hidden md:flex items-center gap-3 w-32">
                              <Volume2 size={16} className="text-gray-400" />
                              <input 
                                  type="range" 
                                  min="0" 
                                  max="100" 
                                  value={volume}
                                  onChange={(e) => setVolume(Number(e.target.value))}
                                  className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                              />
                          </div>
                      </div>
                  </div>
              </motion.div>
          )}
      </AnimatePresence>

      {/* Request Modal */}
      <AnimatePresence>
        {showRequestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRequestModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#12141a] w-full max-w-md rounded-lg shadow-2xl border border-goodwood-border overflow-hidden relative z-10"
            >                <div className="p-8">
                  <h2 className="text-2xl font-bold text-white mb-6 uppercase tracking-tighter italic">Send a Request</h2>
                  <form className="space-y-4" onSubmit={handleRequestSubmit}>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Message Type</label>
                      <select 
                        value={requestType}
                        onChange={(e) => setRequestType(e.target.value)}
                        className="w-full bg-goodwood-dark border border-goodwood-border rounded-lg px-4 py-3 text-white text-sm focus:border-white/20 transition-colors outline-none"
                      >
                        <option>Song Request</option>
                        <option>Shoutout</option>
                        <option>Competition Entry</option>
                      </select>
                    </div>
                    {requestType === 'Song Request' && (
                      <div className="relative">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Search Song (Optional)</label>
                        <input 
                          type="text"
                          value={songSearchQuery}
                          onChange={(e) => setSongSearchQuery(e.target.value)}
                          placeholder="Search iTunes..."
                          className="w-full bg-goodwood-dark border border-goodwood-border rounded-lg px-4 py-3 text-white text-sm focus:border-white/20 transition-colors outline-none mb-2"
                        />
                        {isSearchingSongs && <p className="text-xs text-gray-500 italic px-2">Searching...</p>}
                        {songSearchResults.length > 0 && (
                          <div className="bg-goodwood-dark border border-goodwood-border rounded-lg overflow-hidden absolute z-20 w-full shadow-2xl">
                            {songSearchResults.map((song, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setRequestMessage(`I want to request: ${song.trackName} by ${song.artistName}`);
                                  setSongSearchResults([]);
                                  setSongSearchQuery('');
                                }}
                                className="w-full text-left p-3 hover:bg-white/5 border-b border-white/5 last:border-b-0 flex items-center gap-3 transition-colors"
                              >
                                {song.artworkUrl100 && (
                                  <img src={song.artworkUrl100} alt={song.trackName} className="w-10 h-10 rounded object-cover" />
                                )}
                                <div>
                                  <p className="text-sm font-bold text-white truncate">{song.trackName}</p>
                                  <p className="text-xs text-gray-400 truncate">{song.artistName}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Your Message</label>
                      <textarea 
                        value={requestMessage}
                        onChange={(e) => setRequestMessage(e.target.value)}
                        className="w-full bg-goodwood-dark border border-goodwood-border rounded-lg px-4 py-3 text-white text-sm focus:border-white/20 transition-colors outline-none h-32 resize-none"
                        placeholder="Type your message here..."
                        required
                      ></textarea>
                    </div>
                    <button 
                      disabled={submittingRequest || !userProfile}
                      className="w-full bg-white text-black py-4 rounded-xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-white/5 disabled:opacity-50"
                    >
                      {submittingRequest ? 'Sending...' : userProfile ? 'Send Request' : 'Login to Send'}
                    </button>
                  </form>
               </div>

               <div className="bg-goodwood-dark py-4 px-8 border-t border-goodwood-border flex justify-center items-center">
                   <button onClick={() => setShowRequestModal(false)} className="text-gray-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors">Close</button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Auth Modal (Login/Signup) */}
      <AnimatePresence>
        {showLogin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogin(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#12141a] w-full max-w-md rounded-lg shadow-2xl border border-goodwood-border overflow-hidden relative z-10"
            >
               
               <div className="p-8">
                  <div className="text-center mb-8">
                     <div className="w-16 h-16 bg-[#1a1d26] rounded-full mx-auto flex items-center justify-center mb-4 border border-goodwood-border">
                        <UserIcon size={32} className="text-white" />
                     </div>
                     <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
                       Welcome to Goodwood FM
                     </h2>
                     <p className="text-gray-400 text-sm">
                       Sign in with your Google account or email to join the community.
                     </p>
                  </div>

                  <div className="space-y-4">
                     <form onSubmit={async (e) => {
                         e.preventDefault();
                         const formData = new FormData(e.currentTarget);
                         const email = formData.get('email') as string;
                          const password = formData.get('password') as string;
                          const isSignup = formData.get('isSignup') === 'true';
                          const username = ((formData.get('username') as string) || '').trim();
                          try {
                              if (isSignup) {
                                  if (username.length < 3 || username.length > 30) {
                                      alert('Username must be between 3 and 30 characters after trimming spaces.');
                                      return;
                                  }
                                  if (signupWithEmail) await signupWithEmail(email, password, username);
                              } else {
                                  if (loginWithEmail) await loginWithEmail(email, password);
                              }
                             setShowLogin(false);
                         } catch (err: any) {
                             alert(err.message);
                         }
                     }}>
                         <div className="space-y-3 mb-4">
                             <input type="email" name="email" placeholder="Email Address" required className="w-full bg-goodwood-dark border border-goodwood-border rounded-lg px-4 py-3 text-white text-sm focus:border-white/20 transition-colors outline-none" />
                             <input type="password" name="password" placeholder="Password" required className="w-full bg-goodwood-dark border border-goodwood-border rounded-lg px-4 py-3 text-white text-sm focus:border-white/20 transition-colors outline-none" />
                             <div className="flex items-center gap-2">
                                 <input type="checkbox" name="isSignup" id="isSignup" value="true" className="rounded bg-goodwood-dark border-goodwood-border" onChange={(e) => {
                                     const usernameInput = document.getElementById('usernameInput');
                                     if (usernameInput) usernameInput.style.display = e.target.checked ? 'block' : 'none';
                                 }} />
                                 <label htmlFor="isSignup" className="text-xs text-gray-400">I need to create an account</label>
                             </div>
                              <input type="text" name="username" id="usernameInput" placeholder="Username" style={{display: 'none'}} className="w-full bg-goodwood-dark border border-goodwood-border rounded-lg px-4 py-3 text-white text-sm focus:border-white/20 transition-colors outline-none" />
                         </div>
                         <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-bold uppercase tracking-widest transition-all mb-4">
                             Continue with Email
                         </button>
                     </form>

                     <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-goodwood-border"></div>
                        </div>
                        <div className="relative flex justify-center text-[10px] font-bold tracking-[0.2em]">
                          <span className="bg-[#12141a] px-4 text-gray-500 uppercase">Or</span>
                        </div>
                     </div>

                     <button 
                       type="button" 
                       onClick={async () => {
                         await login();
                         setShowLogin(false);
                       }}
                       className="w-full bg-white text-black py-4 rounded-xl font-black uppercase tracking-widest transition-all shadow-lg shadow-white/5 transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-3"
                     >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                        Continue with Google
                     </button>
                     
                     <p className="text-center text-gray-500 text-[10px] leading-relaxed uppercase tracking-wider mt-6">
                       By continuing, you agree to our <br/>
                       <Link to="/terms" onClick={() => setShowLogin(false)} className="text-gray-400 hover:text-white transition-colors">Terms of Service</Link> & <Link to="/privacy" onClick={() => setShowLogin(false)} className="text-gray-400 hover:text-white transition-colors">Privacy Policy</Link>
                     </p>
                  </div>
               </div>
               <div className="bg-goodwood-dark py-4 px-8 border-t border-goodwood-border flex justify-center items-center">
                   <button onClick={() => setShowLogin(false)} className="text-gray-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors">Cancel</button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
