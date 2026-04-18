import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, User, Users, Clock, FileText, Music, Star, Heart, Settings, Shield, Code, Headphones, Twitter, Instagram, Facebook, Youtube, Twitch, Radio, ChevronDown } from 'lucide-react';
import { StaffMember } from '../types';
import clsx from 'clsx';
import { collection, onSnapshot, query, orderBy, limit, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { formatDate, getDatesForThisWeek } from '../utils';
import { UserAvatar } from '../components/UserAvatar';

/* --- TIMETABLE PAGE --- */
export const Timetable = () => {
    const [activeDay, setActiveDay] = useState('');
    const [schedule, setSchedule] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [weekOffset, setWeekOffset] = useState(0);

    const days = [
        'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
    ];

    useEffect(() => {
        // Set active day to current day on mount
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        setActiveDay(today);

        const q = query(collection(db, 'schedule'), orderBy('time', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setSchedule(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        }, (err) => handleFirestoreError(err, OperationType.GET, 'schedule'));
        return () => unsubscribe();
    }, []);

    const currentDaySchedule = schedule.filter(item => item.day === activeDay);
    
    // Find Live, Next, Later
    const now = new Date();
    const currentHour = now.getHours();
    
    const liveShow = currentDaySchedule.find(s => {
        const hour = parseInt(s.time.split(':')[0]);
        return hour === currentHour;
    });
    
    const nextShow = currentDaySchedule.find(s => {
        const hour = parseInt(s.time.split(':')[0]);
        return hour === currentHour + 1;
    });
    
    const laterShow = currentDaySchedule.find(s => {
        const hour = parseInt(s.time.split(':')[0]);
        return hour === currentHour + 2;
    });

    return (
        <div className="container mx-auto max-w-6xl">
            <div className="mb-12">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <h1 className="text-4xl sm:text-6xl font-black text-white italic tracking-tighter uppercase drop-shadow-2xl">Timetable</h1>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setWeekOffset(w => w - 1)} className="px-3 sm:px-4 py-2 bg-goodwood-dark border border-goodwood-border rounded-lg text-[10px] sm:text-xs font-bold text-gray-400 hover:text-white uppercase tracking-widest">&larr; Previous</button>
                        <button onClick={() => setWeekOffset(0)} className="px-3 sm:px-4 py-2 bg-goodwood-dark border border-goodwood-border rounded-lg text-[10px] sm:text-xs font-bold text-white hover:text-white uppercase tracking-widest">This Week</button>
                        <button onClick={() => setWeekOffset(w => w + 1)} className="px-3 sm:px-4 py-2 bg-goodwood-dark border border-goodwood-border rounded-lg text-[10px] sm:text-xs font-bold text-gray-400 hover:text-white uppercase tracking-widest">Next &rarr;</button>
                    </div>
                </div>
                
                {/* Live/Next/Later Blocks */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 mt-8">
                    <div className="bg-goodwood-card/40 border border-goodwood-border rounded-xl p-6 relative group">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Live</span>
                        <span className="text-xs text-emerald-400 font-mono mb-4 block">
                            {`${currentHour.toString().padStart(2, '0')}:00 - ${((currentHour + 1) % 24).toString().padStart(2, '0')}:00`}
                        </span>
                        <h3 className="text-xl sm:text-2xl font-black text-white uppercase italic tracking-tight">{liveShow?.showName || 'AutoDJ'}</h3>
                    </div>

                    <div className="bg-goodwood-card/40 border border-goodwood-border rounded-xl p-6 relative group">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Next</span>
                        <span className="text-xs text-emerald-400 font-mono mb-4 block">
                            {`${((currentHour + 1) % 24).toString().padStart(2, '0')}:00 - ${((currentHour + 2) % 24).toString().padStart(2, '0')}:00`}
                        </span>
                        <h3 className="text-xl sm:text-2xl font-black text-white uppercase italic tracking-tight flex items-center gap-2">
                            {nextShow?.showName || 'AutoDJ'}
                        </h3>
                    </div>

                    <div className="bg-goodwood-card/40 border border-goodwood-border rounded-xl p-6 relative group">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Later</span>
                        <span className="text-xs text-emerald-400 font-mono mb-4 block">
                            {`${((currentHour + 2) % 24).toString().padStart(2, '0')}:00 - ${((currentHour + 3) % 24).toString().padStart(2, '0')}:00`}
                        </span>
                        <h3 className="text-xl sm:text-2xl font-black text-white uppercase italic tracking-tight">{laterShow?.showName || 'AutoDJ'}</h3>
                    </div>
                </div>

                {/* Day Tabs */}
                <div className="flex flex-wrap gap-2 mb-8">
                    {getDatesForThisWeek(weekOffset).map(({ dateObj, dayString }) => {
                        const day = dayString;
                        const date = new Date(dateObj);
                        
                        const isToday = day === new Date().toLocaleDateString('en-US', { weekday: 'long' });
                        const suffix = (d: number) => {
                            if (d > 3 && d < 21) return 'th';
                            switch (d % 10) {
                                case 1: return "st";
                                case 2: return "nd";
                                case 3: return "rd";
                                default: return "th";
                            }
                        };
                        const dayNum = date.getDate();
                        const formattedDate = `${day.substring(0, 3)} ${dayNum}${suffix(dayNum)} ${date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}`;

                        return (
                            <button 
                                key={day}
                                onClick={() => setActiveDay(day)}
                                className={clsx(
                                    "px-4 sm:px-6 py-3 rounded-lg font-black uppercase text-[10px] tracking-widest transition-all min-w-[120px] sm:min-w-[140px]",
                                    activeDay === day 
                                    ? "bg-white/10 text-white border border-white/20" 
                                    : "bg-goodwood-card text-gray-500 hover:text-gray-300 border border-goodwood-border"
                                )}
                            >
                                {isToday ? 'Today' : formattedDate}
                            </button>
                        );
                    })}
                </div>

                {/* Schedule List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentDaySchedule.length > 0 ? currentDaySchedule.map((slot) => (
                        <div key={slot.id} className="bg-goodwood-card/60 border border-goodwood-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 group hover:bg-goodwood-card transition-all">
                            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                <div className="w-10 h-10 bg-emerald-900 rounded-lg flex items-center justify-center border border-goodwood-border overflow-hidden shrink-0">
                                    {slot.claimedBy ? (
                                        <UserAvatar userId={slot.claimedBy} fallbackName={slot.djName} className="w-full h-full" />
                                    ) : (
                                        <Radio className="text-white/50" size={20} />
                                    )}
                                </div>
                                <span className="text-base sm:text-lg font-black text-white uppercase italic tracking-tight truncate">{slot.showName}</span>
                            </div>
                            <span className="text-xs sm:text-sm font-black text-white/40 tracking-widest self-start sm:self-auto">{slot.time}</span>
                        </div>
                    )) : (
                        <div className="col-span-full py-12 text-center text-gray-600 font-bold uppercase tracking-widest italic border border-goodwood-border rounded-xl">
                            No shows scheduled for {activeDay}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/* --- SOCIAL MEDIA PAGE --- */
export const Socials = () => {
    const socials = [
        { name: 'Twitter / X', icon: Twitter, color: 'text-white', link: 'https://twitter.com', desc: 'Follow for updates' },
        { name: 'Instagram', icon: Instagram, color: 'text-pink-500', link: 'https://instagram.com', desc: 'Behind the scenes' },
        { name: 'Facebook', icon: Facebook, color: 'text-blue-600', link: 'https://facebook.com', desc: 'Join the group' },
        { name: 'YouTube', icon: Youtube, color: 'text-red-600', link: 'https://youtube.com', desc: 'Watch highlights' },
        { name: 'Twitch', icon: Twitch, color: 'text-emerald-500', link: 'https://twitch.tv', desc: 'Live streams' },
    ];
    
    return (
        <div className="container mx-auto max-w-4xl text-center">
            <h2 className="text-3xl font-bold text-white mb-8">FOLLOW US</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {socials.map((s) => (
                    <a key={s.name} href={s.link} target="_blank" rel="noreferrer" className="bg-[#16191f] border border-[#2a2f3a] rounded-lg p-6 flex flex-col items-center gap-4 hover:border-white/30 transition-all group">
                        <s.icon size={48} className={s.color} />
                        <div>
                            <h3 className="text-white font-bold text-lg">{s.name}</h3>
                            <p className="text-gray-500 text-xs">{s.desc}</p>
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
};

/* --- PARTNERS PAGE --- */
export const Partners = () => {
    const [partners, setPartners] = useState<any[]>([]);

    useEffect(() => {
        const q = query(collection(db, 'partners'), orderBy('name', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setPartners(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (err) => handleFirestoreError(err, OperationType.GET, 'partners'));
        return () => unsubscribe();
    }, []);

    return (
        <div className="container mx-auto max-w-4xl text-center">
            <h2 className="text-2xl font-bold text-white flex items-center justify-center gap-3 mb-2">
                🤝 GOODWOOD PARTNERSHIPS
            </h2>
            <p className="text-gray-400 mb-12">Take a look at some of the companies that help Goodwood FM.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {partners.length > 0 ? partners.map((partner) => (
                    <div key={partner.id} className="bg-[#16191f] border border-[#2a2f3a] p-8 rounded-lg hover:border-gray-500 transition-colors group">
                        <h3 className="text-2xl font-bold text-white tracking-widest mb-4">{partner.name}</h3>
                        <p className="text-gray-400 text-sm leading-relaxed mb-6">
                            {partner.description || 'No description provided.'}
                        </p>
                        <a href={partner.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-white font-bold text-sm bg-white/5 px-4 py-2 rounded-full group-hover:bg-white/10 transition-colors">
                            🌐 {partner.url.replace(/^https?:\/\//, '')}
                        </a>
                    </div>
                )) : (
                    <div className="col-span-full py-20 text-center text-gray-600 font-bold uppercase tracking-widest italic border border-[#2a2f3a] rounded-lg">
                        No partners listed yet
                    </div>
                )}
            </div>
        </div>
    );
};

/* --- ABOUT PAGE --- */
export const About = () => (
    <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white flex items-center justify-center gap-3 mb-2">
                <span className="bg-white text-black rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold">?</span> ABOUT US
            </h2>
            <p className="text-gray-400">Take a peek into the history of Goodwood FM and where it all started.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-sm leading-relaxed text-gray-300">
            <div>
                <div className="flex items-center gap-4 mb-4">
                     <h3 className="text-white font-bold text-lg uppercase tracking-wider">About Goodwood FM</h3>
                     <div className="h-[1px] bg-[#2a2f3a] flex-1" />
                </div>
                <p className="mb-4">Goodwood FM was originally founded in mid 2025 by Fin. With a new vision for radio, the community began to form, and we set out to build an incredible new radio experience!</p>
                <p className="mb-8">Goodwood FM is a Radio Station dedicated to bringing entertainment to all users across the Goodwood FM platform. Whether you're listening on our site, through our discord bot or through a client, you will always be entertained!</p>

                <div className="flex items-center gap-4 mb-4">
                     <h3 className="text-white font-bold text-lg uppercase tracking-wider">2026 Splash Page</h3>
                     <div className="h-[1px] bg-[#2a2f3a] flex-1" />
                </div>
                {/* Content truncated for brevity based on screenshot */}
            </div>

            <div>
                <div className="flex items-center gap-4 mb-4">
                     <div className="h-[1px] bg-[#2a2f3a] flex-1" />
                     <h3 className="text-white font-bold text-lg uppercase tracking-wider">History of Goodwood FM</h3>
                </div>
                <ul className="space-y-4">
                    <li><strong className="text-white">Mid 2025:</strong> Goodwood FM opened its doors with Fin laying down the initial community structure.</li>
                    <li><strong className="text-white">Late 2025:</strong> Goodwood FM launched its first web platform, building the foundation.</li>
                    <li><strong className="text-white">2026:</strong> Goodwood FM successfully launched the site you're viewing today, continually expanding feature scope!</li>
                </ul>
                <p className="mt-6 italic text-gray-400">After months of planning, designing and building, Fin has finally managed to release a brand new version under Goodwood FM. We all hope you enjoy the site just as much as we do!</p>
            </div>
        </div>
    </div>
);

/* --- TEAM PAGE --- */
const TeamCard: React.FC<{ member: StaffMember }> = ({ member }) => {
    return (
        <div className="bg-[#16191f] border border-[#2a2f3a] rounded-lg p-3 flex items-center gap-4 group hover:border-gray-500 transition-colors relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            {member.avatar ? (
                <img src={member.avatar} alt={member.username} className="w-12 h-12 rounded-full border border-[#2a2f3a] object-cover" />
            ) : (
                <div className="w-12 h-12 rounded-full border border-[#2a2f3a] bg-emerald-900 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">{member.username?.charAt(0) || '?'}</span>
                </div>
            )}
            <div>
                <h4 className="text-white font-bold flex items-center gap-2">
                    {member.username}
                </h4>
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                     {member.department === 'Leadership' && <Star size={10} className="text-yellow-500" />}
                     {member.department === 'Management' && <Settings size={10} className="text-blue-500" />}
                     {member.department === 'Radio' && <Headphones size={10} className="text-emerald-500" />}
                     {member.position}
                </p>
            </div>
        </div>
    );
};

export const Team = () => {
    const [staff, setStaff] = useState<StaffMember[]>([]);

    useEffect(() => {
        const q = query(collection(db, 'staff'), orderBy('username', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const staffData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as unknown as StaffMember));
            
            setStaff(staffData);
        }, (err) => handleFirestoreError(err, OperationType.GET, 'staff'));

        return () => unsubscribe();
    }, []);

    const departmentOrder = ['Leadership', 'Management', 'Development', 'Radio', 'Media'];
    
    return (
        <div className="container mx-auto max-w-5xl">
             <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-white flex items-center justify-center gap-3 mb-2">
                    <Users className="text-white" /> MEET THE TEAM
                </h2>
                <p className="text-gray-400">Meet the entire team behind Goodwood FM below.</p>
            </div>

            <div className="space-y-8">
                {departmentOrder.map(dept => {
                    const deptStaff = staff.filter(s => s.department === dept);
                    if (deptStaff.length === 0) return null;
                    
                    const getDeptIcon = (d: string) => {
                        if (d === 'Leadership') return "🎙️";
                        if (d === 'Management') return "⚙️";
                        if (d === 'Development') return "💻";
                        if (d === 'Radio') return "🎧";
                        if (d === 'Media') return "📱";
                        return "👥";
                    };

                    return (
                        <div key={dept}>
                             <h3 className="text-white font-bold text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="text-lg">{getDeptIcon(dept)}</span> {dept}
                             </h3>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {deptStaff.map(s => <TeamCard key={s.id} member={s} />)}
                             </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

/* --- JOBS PAGE --- */
export const Jobs = () => {
    const jobs = [
        {
            title: "Station Presenter",
            icon: Headphones,
            color: "from-blue-600 to-blue-900",
            description: "A Station Presenter is the core role of Goodwood FM. Station Presenters are responsible for keeping listeners entertained throughout the day by hosting a range of competitions, taking requests and shoutouts and playing the freshest hits. If you love music, this is the role for you!",
            requirements: [
                "You must be able to present a minimum of 2 slots (hours) per week.",
                "You must be the age of 16 or above.",
                "You must be confident and willing to speak infront of a large audience.",
                "You must be willing to play a large variety of music.",
                "You must have a clear and working microphone.",
                "You must have a good attitude and be able to work as part of a team.",
                "You must have a Discord account.",
                "You must have a collection of over 300 songs.",
                "You must be aware that this is a non-paying voluntary role."
            ],
            link: "/apply/presenter"
        },
        {
            title: "Content Reporter",
            icon: FileText,
            color: "from-teal-600 to-teal-900",
            description: "A Content Reporter is responsible for actively posting articles to the Goodwood FM site. Articles are to contain a variety of topics such as Goodwood FM news, affiliate news, music related gossip etc. You are to keep the community and visitors of the site updated with the latest news. If you have a passion for writing, Content Reporter is the role for you!",
            requirements: [
                "You must be able to write a minimum of 2 articles per week.",
                "You must be the age of 16 or above.",
                "You must have thorough understanding of basic punctuation and grammar.",
                "You must be fluent in the English language.",
                "You must have a good attitude and be able to work as part of a team.",
                "You must have a Discord account.",
                "You must be aware that this is a non-paying voluntary role."
            ],
            link: "/apply/reporter"
        }
    ];

    return (
        <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-12 sm:mb-16 relative py-12 sm:py-20 overflow-hidden rounded-3xl">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/40 via-goodwood-card to-blue-900/40 backdrop-blur-md border border-goodwood-border z-0" />
                <div className="relative z-10">
                    <h1 className="text-4xl sm:text-7xl font-black text-white italic tracking-tighter uppercase mb-2 drop-shadow-2xl">Job Openings</h1>
                    <p className="text-emerald-400 font-black uppercase tracking-widest text-[10px] sm:text-sm mb-4 drop-shadow-md">WANT TO BE A PART OF A TEAM OF PASSIONATE INDIVIDUALS?</p>
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] block">Take a look at our voluntary job openings below:</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {jobs.map((job) => (
                    <div key={job.title} className="bg-goodwood-card border border-goodwood-border rounded-3xl overflow-hidden flex flex-col shadow-2xl">
                        <div className={clsx("p-5 sm:p-8 bg-gradient-to-r flex items-center justify-center gap-3 sm:gap-4", job.color)}>
                            <job.icon size={32} className="text-white" />
                            <h2 className="text-xl sm:text-3xl font-black text-white uppercase italic tracking-tight">{job.title}</h2>
                        </div>
                        <div className="p-5 sm:p-8 flex-1 flex flex-col">
                            <p className="text-gray-300 text-sm leading-relaxed mb-8 text-center font-medium">
                                {job.description}
                            </p>
                            <div className="space-y-3 mb-8 flex-1">
                                {job.requirements.map((req, i) => (
                                    <div key={i} className="flex gap-3 text-xs text-gray-400 font-medium">
                                        <span className="text-blue-400">»</span>
                                        <p className="italic">{req}</p>
                                    </div>
                                ))}
                            </div>
                            <Link 
                                to={job.link}
                                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white py-4 rounded-xl font-black uppercase tracking-widest text-center transition-all active:scale-95"
                            >
                                Apply
                            </Link>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

/* --- ARTICLES PAGE --- */
export const ContentList = () => {
    const [articles, setArticles] = useState<any[]>([]);

    useEffect(() => {
        const q = query(collection(db, 'articles'), where('status', '==', 'published'), orderBy('date', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const articleData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date?.toDate?.()?.toISOString() || doc.data().date
            }));
            
            setArticles(articleData);
        }, (err) => handleFirestoreError(err, OperationType.GET, 'articles'));

        return () => unsubscribe();
    }, []);

    return (
        <div className="container mx-auto max-w-4xl">
            <div className="text-center mb-12">
                <h2 className="text-2xl font-bold text-white flex items-center justify-center gap-3 mb-2">
                    <FileText className="text-white" /> CURRENT ARTICLES
                </h2>
                <p className="text-gray-400 flex items-center justify-center gap-2">
                    Take a look at our 20 most recent articles, ordered from newest to oldest. <span>😋</span>
                </p>
            </div>

            <div className="space-y-4">
                {articles.map((article) => (
                    <Link to={`/article/${article.id}`} key={article.id} className="bg-[#16191f] border border-[#2a2f3a] rounded-lg flex flex-col sm:flex-row sm:h-24 overflow-hidden group hover:border-gray-500 transition-colors cursor-pointer relative">
                        <div className="w-full sm:w-48 h-32 sm:h-auto relative overflow-hidden">
                            {article.image ? (
                                <img src={article.image} alt={article.title} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500" />
                            ) : (
                                <div className="w-full h-full bg-emerald-900 flex items-center justify-center opacity-80 group-hover:scale-105 transition-transform duration-500">
                                    <FileText size={32} className="text-white/50" />
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#16191f]" />
                            <div className="absolute bottom-2 left-2 text-[10px] font-bold text-white bg-black/50 px-2 py-1 rounded backdrop-blur-md border border-white/10 uppercase">
                                {article.category || 'News'}
                            </div>
                        </div>
                        <div className="flex-1 p-4 flex flex-col justify-center">
                            <h3 className="text-white font-bold text-base sm:text-lg leading-tight group-hover:text-blue-400 transition-colors">{article.title}</h3>
                        </div>
                        <div className="px-4 sm:px-6 py-3 sm:py-0 flex items-center text-xs text-gray-400 font-mono border-t sm:border-t-0 sm:border-l border-[#2a2f3a]">
                             <Clock size={12} className="mr-2" /> {formatDate(article.date)}
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
};
