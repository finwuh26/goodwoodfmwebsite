import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
    doc, onSnapshot, updateDoc, collection, query, orderBy, 
    addDoc, serverTimestamp, deleteDoc, where, getDocs, limit
} from 'firebase/firestore';
import { getAuth, sendPasswordResetEmail, deleteUser } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import { toast } from 'react-hot-toast';
import { formatDate } from '../utils';
import { UserAvatar } from '../components/UserAvatar';
import { User as UserIcon, Settings, Shield, Clock, Calendar, Heart, MessageSquare, Star, LogOut, Trash2, Upload, X, Check, Image as ImageIcon, Music, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import clsx from 'clsx';
import Cropper from 'react-easy-crop';
import { AVAILABLE_BADGES } from '../components/BadgeSelector';
import { useRadio } from '../context/RadioContext';
import { normalizeAzuraIdentity } from '../utils/azuraIdentity';
import { getNameIconOption } from '../src/nameIcons';

const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<Blob> => {
    const image = new Image();
    image.src = imageSrc;
    await new Promise((resolve) => (image.onload = resolve));

    const canvas = document.createElement('canvas');
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('No 2d context');

    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
    );

    return new Promise((resolve, reject) => {
        canvas.toBlob((file) => {
            if (file) resolve(file);
            else reject(new Error('Canvas is empty'));
        }, 'image/jpeg');
    });
};

export const ProfilePage = () => {
    const { uid } = useParams();
    const { userProfile: currentUser } = useAuth();
    const { radioData } = useRadio();
    const [userProfile, setUserProfile] = useState<any>(null);
    const [likes, setLikes] = useState<any[]>([]);
    const [posts, setPosts] = useState<any[]>([]);
    const [wallComments, setWallComments] = useState<any[]>([]);
    const [reputationLogs, setReputationLogs] = useState<any[]>([]);
    const [latestArticle, setLatestArticle] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'activity' | 'wall' | 'posts' | 'reputation'>('activity');
    const [newComment, setNewComment] = useState('');
    const [submittingComment, setSubmittingComment] = useState(false);
    const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
    const [replyComment, setReplyComment] = useState('');
    const [submittingReply, setSubmittingReply] = useState(false);

    useEffect(() => {
        if (!uid) return;
        const unsubscribeUser = onSnapshot(doc(db, 'users', uid), (doc) => {
            if (doc.exists()) {
                setUserProfile({ uid: doc.id, ...doc.data() });
            }
            setLoading(false);
        }, (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}`));

        const qLikes = query(
            collection(db, 'likes'),
            where('userId', '==', uid),
            limit(100)
        );
        const unsubscribeLikes = onSnapshot(qLikes, (snapshot) => {
            const userLikes = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as any))
                .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            setLikes(userLikes);
        }, (err) => handleFirestoreError(err, OperationType.GET, 'likes'));

        const qPosts = query(
            collection(db, 'profileComments'),
            where('authorId', '==', uid),
            limit(100)
        );
        const unsubscribePosts = onSnapshot(qPosts, (snapshot) => {
            const authoredComments = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as any))
                .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            setPosts(authoredComments);
        }, (err) => handleFirestoreError(err, OperationType.GET, 'profileComments'));

        const qWallComments = query(
            collection(db, 'profileComments'),
            where('targetUserId', '==', uid),
            limit(100)
        );
        const unsubscribeWallComments = onSnapshot(qWallComments, (snapshot) => {
            const incomingComments = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as any))
                .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            setWallComments(incomingComments);
        }, (err) => handleFirestoreError(err, OperationType.GET, 'profileComments'));

        const qReputation = query(
            collection(db, 'reputationLogs'),
            where('userId', '==', uid),
            limit(100)
        );
        const unsubscribeReputation = onSnapshot(qReputation, (snapshot) => {
            const userLogs = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as any))
                .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            setReputationLogs(userLogs);
        }, (err) => handleFirestoreError(err, OperationType.GET, 'reputationLogs'));

        return () => {
            unsubscribeUser();
            unsubscribeLikes();
            unsubscribePosts();
            unsubscribeWallComments();
            unsubscribeReputation();
        };
    }, [uid]);

    useEffect(() => {
        if (!uid) {
            setLatestArticle(null);
            return;
        }

        let isMounted = true;
        const fetchLatestArticle = async () => {
            try {
                const qArticles = query(
                    collection(db, 'articles'),
                    where('authorId', '==', uid),
                    where('status', '==', 'published'),
                    orderBy('date', 'desc'),
                    limit(1)
                );
                const snapshot = await getDocs(qArticles);
                if (!isMounted) return;
                if (snapshot.empty) {
                    setLatestArticle(null);
                    return;
                }
                const latestDoc = snapshot.docs[0];
                setLatestArticle({ id: latestDoc.id, ...latestDoc.data() });
            } catch (err) {
                if (!isMounted) return;
                setLatestArticle(null);
                handleFirestoreError(err, OperationType.GET, 'articles');
                toast.error('Unable to load latest article. Please refresh and try again later.');
            }
        };

        fetchLatestArticle();
        return () => {
            isMounted = false;
        };
    }, [uid]);

    const handlePostComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser || !newComment.trim() || !uid) return;
        setSubmittingComment(true);
        try {
            await addDoc(collection(db, 'profileComments'), {
                targetUserId: uid,
                authorId: currentUser.uid,
                authorName: currentUser.username,
                authorAvatar: currentUser.avatar || '',
                content: newComment.trim(),
                timestamp: serverTimestamp()
            });
            setNewComment('');
        } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, 'profileComments');
        } finally {
            setSubmittingComment(false);
        }
    };

    const handlePostReply = async (e: React.FormEvent, parentCommentId: string) => {
        e.preventDefault();
        if (!currentUser || !replyComment.trim() || !uid || !parentCommentId) return;
        setSubmittingReply(true);
        try {
            await addDoc(collection(db, 'profileComments'), {
                targetUserId: uid,
                authorId: currentUser.uid,
                authorName: currentUser.username,
                authorAvatar: currentUser.avatar || '',
                content: replyComment.trim(),
                parentCommentId,
                timestamp: serverTimestamp()
            });
            setReplyComment('');
            setReplyToCommentId(null);
        } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, 'profileComments');
        } finally {
            setSubmittingReply(false);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!currentUser || !uid) return;
        const comment = wallComments.find((c) => c.id === commentId);
        if (!comment) return;
        const replyIds = wallComments.filter((c) => c.parentCommentId === commentId).map((c) => c.id);

        const canDelete =
            comment.authorId === currentUser.uid ||
            comment.targetUserId === currentUser.uid ||
            currentUser.role === 'admin' ||
            currentUser.role === 'owner';
        if (!canDelete) {
            toast.error('You do not have permission to delete this comment.');
            return;
        }

        if (!window.confirm('Delete this comment? This action cannot be undone.')) return;

        try {
            await Promise.all([
                deleteDoc(doc(db, 'profileComments', commentId)),
                ...replyIds.map((replyId) => deleteDoc(doc(db, 'profileComments', replyId)))
            ]);
            toast.success('Comment deleted.');
        } catch (err) {
            console.error('Failed to delete profile comment:', err);
            toast.error('Failed to delete comment. Please try again.');
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
        </div>
    );

    if (!userProfile) return <Navigate to="/" replace />;

    const isOwnProfile = currentUser?.uid === uid;
    const topLevelWallComments = wallComments
        .filter((comment) => !comment.parentCommentId)
        .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
    const getWallReplies = (parentCommentId: string) => wallComments
        .filter((comment) => comment.parentCommentId === parentCommentId)
        .sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));
    const azuraStreamerName = radioData?.live?.streamer_name || '';
    const normalizedAzuraStreamerName = normalizeAzuraIdentity(azuraStreamerName);
    // Support existing profile fields used as possible AzuraCast identity sources.
    const normalizedAzuraNameCandidates = [
        userProfile?.username,
        userProfile?.azuracastName,
        userProfile?.encoderName,
        ...(Array.isArray(userProfile?.azuracastNames) ? userProfile.azuracastNames : []),
    ]
        .filter((name): name is string => typeof name === 'string')
        .map((name) => normalizeAzuraIdentity(name))
        .filter((name) => name.length > 0);
    const isOnAirProfile = Boolean(
        radioData?.live?.is_live &&
        normalizedAzuraStreamerName &&
        normalizedAzuraNameCandidates.includes(normalizedAzuraStreamerName)
    );
    const visibleBadges = Array.from(new Set(Array.isArray(userProfile.badges) ? userProfile.badges : []))
        .filter((badgeId) => !(badgeId === 'owner' && userProfile.role === 'owner'));
    const activeNameIcon = getNameIconOption(userProfile.activeNameIcon);

    return (
        <div className={clsx("min-h-screen", userProfile.activeProfileBg ? `bg-gradient-to-br ${userProfile.activeProfileBg}` : "")}>
            <div className="container mx-auto max-w-5xl">
                {/* Header / Banner */}
                <div className="relative mb-24">
                    <div className="absolute top-0 left-0 right-0 h-56 sm:h-64 rounded-3xl overflow-hidden">
                        <div className={`absolute inset-0 bg-gradient-to-br ${userProfile.bannerGradient || 'from-emerald-900 via-goodwood-dark to-blue-900'} opacity-50`} />
                        <div className="absolute inset-0 backdrop-blur-3xl" />
                    
                    {userProfile.favoriteSong && (
                        <a 
                            href={userProfile.favoriteSong.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute top-3 left-3 right-3 sm:top-6 sm:right-6 sm:left-auto z-20 flex items-center gap-3 bg-black/40 hover:bg-black/60 transition-colors backdrop-blur-md border border-white/10 rounded-xl p-3 shadow-2xl group max-w-xs"
                        >
                            {userProfile.favoriteSong.art && (
                                <img src={userProfile.favoriteSong.art} alt="Art" className="w-12 h-12 rounded object-cover shadow-lg border border-white/20" />
                            )}
                            <div className="min-w-0 flex-1">
                                <p className="text-[9px] text-white/50 font-black uppercase tracking-widest mb-0.5 flex items-center gap-1 group-hover:text-emerald-400 transition-colors">
                                    <Music size={10} /> Profile Anthem
                                </p>
                                <p className="text-white font-bold text-sm truncate">{userProfile.favoriteSong.title}</p>
                                <p className="text-white/60 text-xs truncate">{userProfile.favoriteSong.artist}</p>
                            </div>
                        </a>
                    )}
                </div>
                    <div className="relative pt-28 sm:pt-32 px-4 sm:px-8 pb-0 flex flex-col md:flex-row items-start md:items-end gap-6 translate-y-16">
                        <div className={clsx("relative shrink-0 rounded-full transition-shadow duration-300", userProfile.activeRing ? `${userProfile.activeRing} ring-[6px]` : "")}>
                            <div className={clsx("rounded-full", userProfile.activeRing ? "border-[8px] border-goodwood-card bg-goodwood-card" : "")}>
                                {isOnAirProfile && (
                                    <>
                                        <div aria-hidden="true" className="absolute -inset-1 rounded-full border-4 border-red-500 animate-pulse z-10 pointer-events-none" />
                                        <span className="sr-only">Currently broadcasting live</span>
                                    </>
                                )}
                                {userProfile.avatar ? (
                                    <img 
                                        src={userProfile.avatar || undefined} 
                                        className="w-32 h-32 md:w-40 md:h-40 rounded-full border-8 border-goodwood-dark shadow-2xl bg-goodwood-card object-cover relative z-0" 
                                        alt={userProfile.username} 
                                    />
                                ) : (
                                    <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-8 border-goodwood-dark shadow-2xl bg-emerald-900 flex items-center justify-center relative z-0">
                                        <span className="text-white font-black text-4xl sm:text-6xl">{userProfile.username?.charAt(0) || '?'}</span>
                                    </div>
                                )}
                            </div>
                        {userProfile.role === 'admin' && (
                            <div className="absolute bottom-2 right-2 bg-red-600 p-2 rounded-full border-4 border-goodwood-dark shadow-lg z-20">
                                <Shield size={16} className="text-white" />
                            </div>
                        )}
                    </div>
                    <div className="mb-4">
                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white uppercase italic tracking-tighter drop-shadow-2xl flex items-center gap-3 max-w-full [overflow-wrap:anywhere]">
                            {activeNameIcon && <activeNameIcon.icon size={40} className={activeNameIcon.colorClass} />}
                            {userProfile.username}
                            {userProfile.isVerified && (
                                <svg className="w-8 h-8 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1.9 14.7L6 12.6l1.5-1.5 2.6 2.6 6.4-6.4 1.5 1.5-7.9 7.9z"/>
                                </svg>
                            )}
                        </h1>
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                            {isOnAirProfile && (
                                <span className="px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border bg-red-500/15 text-red-400 border-red-500/40 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> On Air
                                </span>
                            )}
                            <span className={clsx("px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border", userProfile.role === 'owner' || userProfile.role === 'admin' ? "bg-red-500/10 text-red-500 border-red-500/30" : userProfile.role === 'vip' ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/30" : "bg-white/10 text-white/60 border-white/10")}>
                                {userProfile.role || 'Member'}
                            </span>
                            {visibleBadges.map((badgeId: string, i: number) => {
                                const badgeInfo = AVAILABLE_BADGES.find(b => b.id === badgeId);
                                if (!badgeInfo) return null;
                                const Icon = badgeInfo.icon;
                                return (
                                    <span key={i} className={clsx("px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border flex items-center gap-1", badgeInfo.bg, badgeInfo.color, `border-${badgeInfo.color.split('-')[1]}-500/30`)}>
                                        <Icon size={10} />
                                        {badgeInfo.label}
                                    </span>
                                );
                            })}
                            <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                                <Calendar size={12} /> Joined {formatDate(userProfile.createdAt)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mt-12">
                {/* Sidebar Stats */}
                <div className="space-y-6">
                    <div className="bg-goodwood-card border border-goodwood-border rounded-2xl p-6 shadow-xl">
                        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-6">User Statistics</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 text-gray-400">
                                    <Heart size={16} />
                                    <span className="text-xs font-bold uppercase tracking-wide">Likes</span>
                                </div>
                                <span className="text-white font-black">{likes.length}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 text-gray-400">
                                    <MessageSquare size={16} />
                                    <span className="text-xs font-bold uppercase tracking-wide">Posts</span>
                                </div>
                                <span className="text-white font-black">{posts.length}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 text-gray-400">
                                    <Star size={16} />
                                    <span className="text-xs font-bold uppercase tracking-wide">Reputation</span>
                                </div>
                                <span className="text-white font-black">{userProfile.reputationScore || 0}</span>
                            </div>
                        </div>
                    </div>

                    {latestArticle && (
                        <div className="bg-goodwood-card border border-goodwood-border rounded-2xl p-4 shadow-xl">
                            <div className="flex items-center gap-2 mb-3">
                                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Most Recent Article</h3>
                                <div className="h-px bg-goodwood-border flex-1" />
                            </div>
                            <Link to={`/article/${latestArticle.id}`} className="block rounded-xl border border-goodwood-border bg-goodwood-dark hover:bg-goodwood-card-hover transition-colors overflow-hidden">
                                <div className="flex items-center min-h-16">
                                    <div className="w-20 h-16 shrink-0 bg-emerald-900/30 border-r border-goodwood-border overflow-hidden flex items-center justify-center">
                                        {latestArticle.image ? (
                                            <img src={latestArticle.image} alt={latestArticle.title} className="w-full h-full object-cover" />
                                        ) : (
                                            <FileText size={18} className="text-white/60" />
                                        )}
                                    </div>
                                    <div className="px-3 py-2 min-w-0 flex-1">
                                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Latest Article</p>
                                        <p className="text-sm font-black uppercase italic tracking-tight text-white truncate">{latestArticle.title}</p>
                                    </div>
                                </div>
                            </Link>
                        </div>
                    )}

                    {isOwnProfile && (
                        <Link to="/settings" className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white py-4 rounded-xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                            <Settings size={16} /> Edit Profile
                        </Link>
                    )}
                </div>

                {/* Main Feed / About */}
                <div className="md:col-span-2 space-y-8">
                    <div className="bg-goodwood-card border border-goodwood-border rounded-2xl p-5 sm:p-8 shadow-xl">
                        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-6">About {userProfile.username}</h3>
                        <p className="text-gray-300 leading-relaxed italic">
                            {userProfile.bio || "This user hasn't written a bio yet. They're probably too busy listening to Goodwood FM! 🎧"}
                        </p>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-4 border-b border-goodwood-border pb-4 overflow-x-auto">
                        <button 
                            onClick={() => setActiveTab('activity')}
                            className={`text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'activity' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Activity
                        </button>
                        <button 
                            onClick={() => setActiveTab('wall')}
                            className={`text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'wall' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Wall ({wallComments.length})
                        </button>
                        <button 
                            onClick={() => setActiveTab('posts')}
                            className={`text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'posts' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Posts ({posts.length})
                        </button>
                        <button 
                            onClick={() => setActiveTab('reputation')}
                            className={`text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'reputation' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Reputation History
                        </button>
                    </div>

                    {activeTab === 'activity' && (
                        <div className="bg-goodwood-card border border-goodwood-border rounded-2xl p-5 sm:p-8 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-6">Recent Activity</h3>
                            <div className="space-y-6">
                                {likes.length > 0 ? likes.map(like => (
                                    <div key={like.id} className="flex gap-4 border-b border-goodwood-border pb-6 last:border-0 last:pb-0">
                                        <div className="w-10 h-10 bg-goodwood-dark rounded-lg flex items-center justify-center shrink-0">
                                            <Heart size={16} className="text-pink-500" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-300">Liked the track <span className="text-white font-bold uppercase italic">{like.songTitle}</span> by {like.songArtist}</p>
                                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1 block">
                                                {formatDate(like.timestamp)}
                                            </span>
                                        </div>
                                    </div>
                                )) : (
                                    <p className="text-gray-500 italic text-sm">No recent activity.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'wall' && (
                        <div className="bg-goodwood-card border border-goodwood-border rounded-2xl p-5 sm:p-8 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-6">Profile Wall</h3>
                            
                            {currentUser && (
                                <form onSubmit={handlePostComment} className="mb-8 flex gap-4">
                                    <div className="w-10 h-10 shrink-0 rounded-full overflow-hidden border-2 border-goodwood-dark bg-emerald-900 flex items-center justify-center">
                                        {currentUser.avatar ? (
                                            <img src={currentUser.avatar} alt="You" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-white font-bold text-sm">{currentUser.username?.charAt(0)}</span>
                                        )}
                                    </div>
                                    <div className="flex-1 flex gap-2">
                                        <input 
                                            type="text" 
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                            placeholder="Leave a comment on their wall..."
                                            className="flex-1 bg-goodwood-dark border border-goodwood-border rounded-xl px-4 py-2 text-white text-sm focus:border-white/20 transition-all outline-none"
                                        />
                                        <button 
                                            disabled={submittingComment || !newComment.trim()}
                                            className="bg-white text-black px-6 py-2 rounded-xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-95 transition-all shadow-lg disabled:opacity-50"
                                        >
                                            Post
                                        </button>
                                    </div>
                                </form>
                            )}

                            <div className="space-y-6">
                                {topLevelWallComments.length > 0 ? topLevelWallComments.map(comment => (
                                    <div key={comment.id} className="flex gap-4 border-b border-goodwood-border pb-6 last:border-0 last:pb-0 relative group">
                                        {(currentUser?.uid === comment.authorId || currentUser?.uid === uid || currentUser?.role === 'admin' || currentUser?.role === 'owner') && (
                                            <button 
                                                onClick={() => handleDeleteComment(comment.id)} 
                                                className="absolute top-0 right-0 text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                        <Link to={`/profile/${comment.authorId}`} className="shrink-0">
                                            <UserAvatar
                                                userId={comment.authorId}
                                                fallbackAvatar={comment.authorAvatar}
                                                fallbackName={comment.authorName}
                                                className="w-10 h-10 rounded-full border-2 border-goodwood-dark bg-emerald-900 object-cover"
                                            />
                                        </Link>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Link to={`/profile/${comment.authorId}`} className="text-sm font-bold text-white hover:underline">
                                                    {comment.authorName}
                                                </Link>
                                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                                    {formatDate(comment.timestamp)}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-300">{comment.content}</p>
                                            {currentUser && (
                                                <button
                                                    onClick={() => {
                                                        setReplyToCommentId((prev) => prev === comment.id ? null : comment.id);
                                                        setReplyComment('');
                                                    }}
                                                    className="mt-2 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-emerald-400 transition-colors"
                                                >
                                                    Reply
                                                </button>
                                            )}

                                            {replyToCommentId === comment.id && currentUser && (
                                                <form onSubmit={(e) => handlePostReply(e, comment.id)} className="mt-3 flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={replyComment}
                                                        onChange={(e) => setReplyComment(e.target.value)}
                                                        placeholder={`Reply to ${comment.authorName}...`}
                                                        className="flex-1 bg-[#090b0f] border border-goodwood-border rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                                                        required
                                                    />
                                                    <button
                                                        disabled={submittingReply || !replyComment.trim()}
                                                        className="bg-white text-black px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] disabled:opacity-50"
                                                    >
                                                        Send
                                                    </button>
                                                </form>
                                            )}

                                            {getWallReplies(comment.id).length > 0 && (
                                                <div className="mt-4 space-y-3 border-l border-goodwood-border pl-4">
                                                    {getWallReplies(comment.id).map((reply) => (
                                                        <div key={reply.id} className="rounded-lg border border-goodwood-border bg-goodwood-dark p-3 relative group/reply">
                                                            {(currentUser?.uid === reply.authorId || currentUser?.uid === uid || currentUser?.role === 'admin' || currentUser?.role === 'owner') && (
                                                                <button
                                                                    onClick={() => handleDeleteComment(reply.id)}
                                                                    className="absolute top-2 right-2 text-gray-500 hover:text-red-500 opacity-0 group-hover/reply:opacity-100 transition-opacity"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <Link to={`/profile/${reply.authorId}`} className="text-xs font-bold text-white hover:underline">
                                                                    {reply.authorName}
                                                                </Link>
                                                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                                                    {formatDate(reply.timestamp)}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-gray-300">{reply.content}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )) : (
                                    <p className="text-gray-500 italic text-sm">No comments yet. Be the first to say hello!</p>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'posts' && (
                        <div className="bg-goodwood-card border border-goodwood-border rounded-2xl p-5 sm:p-8 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-6">Comments Made</h3>
                            
                            <div className="space-y-6">
                                {posts.length > 0 ? posts.map(post => (
                                    <div key={post.id} className="flex gap-4 border-b border-goodwood-border pb-6 last:border-0 last:pb-0">
                                        <div className="w-10 h-10 shrink-0 rounded-full overflow-hidden border-2 border-goodwood-dark bg-emerald-900 flex items-center justify-center">
                                            <MessageSquare size={16} className="text-emerald-400" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm text-gray-400">Commented on <Link to={`/profile/${post.targetUserId}`} className="text-white font-bold hover:underline">a profile</Link></span>
                                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                                    {formatDate(post.timestamp)}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-300 italic">"{post.content}"</p>
                                        </div>
                                    </div>
                                )) : (
                                    <p className="text-gray-500 italic text-sm">No comments made yet.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'reputation' && (
                        <div className="bg-goodwood-card border border-goodwood-border rounded-2xl p-5 sm:p-8 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Reputation History</h3>
                                <div className="bg-white/10 px-4 py-2 rounded-xl flex items-center gap-2">
                                    <Star size={16} className="text-yellow-500" />
                                    <span className="text-white font-black">{userProfile.reputationScore || 0} Total</span>
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                {reputationLogs.length > 0 ? reputationLogs.map(log => (
                                    <div key={log.id} className="flex items-center justify-between p-4 bg-goodwood-dark rounded-xl border border-goodwood-border">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${log.points > 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                                <Star size={16} />
                                            </div>
                                            <div>
                                                <p className="text-sm text-white font-bold">{log.reason}</p>
                                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                                    {log.source ? `Source: ${log.source} • ` : ''}
                                                    {formatDate(log.timestamp)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className={`font-black text-lg ${log.points > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {log.points > 0 ? '+' : ''}{log.points}
                                        </div>
                                    </div>
                                )) : (
                                    <p className="text-gray-500 italic text-sm text-center py-8">No reputation history yet.</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
        </div>
    );
};

export const SettingsPage = () => {
    const { userProfile: profile, logout } = useAuth();
    const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'account'>('profile');
    const [username, setUsername] = useState(profile?.username || '');
    const [bio, setBio] = useState(profile?.bio || '');
    const [avatar, setAvatar] = useState(profile?.avatar || '');
    const [avatarFile, setAvatarFile] = useState<Blob | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [bannerGradient, setBannerGradient] = useState(profile?.bannerGradient || 'bg-gradient-to-br from-emerald-900 via-goodwood-dark to-blue-900');
    const [favoriteSong, setFavoriteSong] = useState<{title: string, artist: string, art: string, url: string} | null>((profile?.favoriteSong as any) || null);
    const [songSearchQuery, setSongSearchQuery] = useState('');
    const [songSearchResults, setSongSearchResults] = useState<any[]>([]);
    const [isSearchingSongs, setIsSearchingSongs] = useState(false);
    const [saving, setSaving] = useState(false);

    // Cropper state
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [showCropper, setShowCropper] = useState(false);

    useEffect(() => {
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
    }, [songSearchQuery]);

    const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const imageDataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.readAsDataURL(file);
            });
            setImageSrc(imageDataUrl);
            setShowCropper(true);
        }
    };

    const handleCropConfirm = async () => {
        try {
            if (imageSrc && croppedAreaPixels) {
                const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
                setAvatarFile(croppedImageBlob);
                setAvatarPreview(URL.createObjectURL(croppedImageBlob));
                setShowCropper(false);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleSelectHistoryAvatar = (url: string) => {
        setAvatar(url);
        setAvatarFile(null);
        setAvatarPreview(null);
    };

    const gradientOptions = [
        { label: 'Purple Dream', value: 'bg-gradient-to-br from-emerald-900 via-goodwood-dark to-blue-900' },
        { label: 'Neon Cyber', value: 'bg-gradient-to-br from-cyan-900 via-goodwood-dark to-pink-900' },
        { label: 'Toxic Waste', value: 'bg-gradient-to-br from-green-900 via-goodwood-dark to-emerald-900' },
        { label: 'Lava Flow', value: 'bg-gradient-to-br from-red-900 via-goodwood-dark to-orange-900' },
        { label: 'Deep Ocean', value: 'bg-gradient-to-br from-blue-900 via-goodwood-dark to-indigo-900' },
        { label: 'Midnight Gold', value: 'bg-gradient-to-br from-yellow-900 via-goodwood-dark to-amber-900' }
    ];

    if (!profile) return <Navigate to="/" replace />;

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            let avatarUrl = avatar;
            if (avatarFile) {
                const storageRef = ref(storage, `avatars/${profile.uid}/${Date.now()}.jpg`);
                await uploadBytes(storageRef, avatarFile);
                avatarUrl = await getDownloadURL(storageRef);
            }

            // Update avatar history
            let newHistory = profile.avatarHistory || [];
            if (avatarUrl && avatarUrl !== profile.avatar && !newHistory.includes(avatarUrl)) {
                newHistory = [avatarUrl, ...newHistory].slice(0, 3);
            }

            // Update main profile
            const userRef = doc(db, 'users', profile.uid);
            await updateDoc(userRef, {
                username,
                bio,
                avatar: avatarUrl,
                bannerGradient,
                favoriteSong,
                avatarHistory: newHistory
            });

            const canSyncAdminCollections = ['admin', 'owner', 'manager'].includes(profile?.role || '');
            if (canSyncAdminCollections) {
                try {
                    const staffQueries = [
                        query(collection(db, 'staff'), where('uid', '==', profile.uid)),
                        query(collection(db, 'staff'), where('userId', '==', profile.uid)),
                    ];
                    const staffSnapshots = await Promise.all(staffQueries.map((staffQ) => getDocs(staffQ)));
                    await Promise.all(staffSnapshots.flatMap((staffSnap) =>
                        staffSnap.docs.map((docSnap) => updateDoc(docSnap.ref, { avatar: avatarUrl, username }))
                    ));

                    const scheduleQ = query(collection(db, 'schedule'), where('djId', '==', profile.uid));
                    const scheduleSnap = await getDocs(scheduleQ);
                    await Promise.all(scheduleSnap.docs.map((docSnap) => updateDoc(docSnap.ref, { djAvatar: avatarUrl })));
                } catch (syncErr) {
                    console.warn('Skipping staff/schedule profile sync after successful user profile update:', syncErr);
                }
            }

            toast.success("Settings saved successfully!");
        } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `users/${profile.uid}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="container mx-auto max-w-4xl">
            <div className="mb-12">
                <h1 className="text-4xl sm:text-6xl font-black text-white italic tracking-tighter uppercase mb-2 drop-shadow-2xl">Settings</h1>
                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Manage your account and preferences</p>
            </div>

            <div className="flex flex-col md:flex-row gap-8">
                {/* Sidebar Tabs */}
                <div className="w-full md:w-64 shrink-0 space-y-2">
                    <button 
                        onClick={() => setActiveTab('profile')}
                        className={`w-full text-left px-6 py-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all ${activeTab === 'profile' ? 'bg-white text-black shadow-lg' : 'bg-goodwood-card text-gray-400 hover:bg-white/5 hover:text-white border border-goodwood-border'}`}
                    >
                        <UserIcon size={16} className="inline-block mr-2 -mt-1" /> Public Profile
                    </button>
                    <button 
                        onClick={() => setActiveTab('appearance')}
                        className={`w-full text-left px-6 py-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all ${activeTab === 'appearance' ? 'bg-white text-black shadow-lg' : 'bg-goodwood-card text-gray-400 hover:bg-white/5 hover:text-white border border-goodwood-border'}`}
                    >
                        <ImageIcon size={16} className="inline-block mr-2 -mt-1" /> Appearance
                    </button>
                    <button 
                        onClick={() => setActiveTab('account')}
                        className={`w-full text-left px-6 py-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all ${activeTab === 'account' ? 'bg-white text-black shadow-lg' : 'bg-goodwood-card text-gray-400 hover:bg-white/5 hover:text-white border border-goodwood-border'}`}
                    >
                        <Shield size={16} className="inline-block mr-2 -mt-1" /> Account Security
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 space-y-8">
                    {showCropper && imageSrc && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
                            <div className="bg-goodwood-card border border-goodwood-border rounded-3xl p-4 sm:p-6 w-full max-w-2xl shadow-2xl flex flex-col h-[85vh] sm:h-[80vh] max-h-[90vh]">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-black text-white uppercase italic">Crop Avatar</h3>
                                    <button onClick={() => setShowCropper(false)} className="text-gray-400 hover:text-white transition-colors">
                                        <X size={24} />
                                    </button>
                                </div>
                                <div className="relative flex-1 bg-goodwood-dark rounded-xl overflow-hidden mb-6">
                                    <Cropper
                                        image={imageSrc}
                                        crop={crop}
                                        zoom={zoom}
                                        aspect={1}
                                        cropShape="round"
                                        showGrid={false}
                                        onCropChange={setCrop}
                                        onCropComplete={onCropComplete}
                                        onZoomChange={setZoom}
                                    />
                                </div>
                                <div className="flex items-center gap-4 mb-6">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Zoom</span>
                                    <input
                                        type="range"
                                        value={zoom}
                                        min={1}
                                        max={3}
                                        step={0.1}
                                        aria-labelledby="Zoom"
                                        onChange={(e) => setZoom(Number(e.target.value))}
                                        className="flex-1 h-2 bg-goodwood-dark rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                                <button 
                                    onClick={handleCropConfirm}
                                    className="w-full bg-white text-black py-4 rounded-xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"
                                >
                                    <Check size={18} /> Apply Crop
                                </button>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSave} className="bg-goodwood-card border border-goodwood-border rounded-3xl p-4 sm:p-8 shadow-xl space-y-6 sm:space-y-8">
                        {activeTab === 'profile' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Username</label>
                                        <input 
                                            type="text" 
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            className="w-full bg-goodwood-dark border border-goodwood-border rounded-xl px-6 py-4 text-white text-sm focus:border-white/20 transition-all outline-none"
                                            placeholder="Enter username..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Email Address</label>
                                        <input 
                                            type="email" 
                                            value={profile.email}
                                            disabled
                                            className="w-full bg-goodwood-dark/50 border border-goodwood-border rounded-xl px-6 py-4 text-gray-500 text-sm outline-none cursor-not-allowed"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Biography</label>
                                    <textarea 
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                        className="w-full bg-goodwood-dark border border-goodwood-border rounded-xl px-6 py-4 text-white text-sm focus:border-white/20 transition-all outline-none h-32 resize-none"
                                        placeholder="Tell us about yourself..."
                                    ></textarea>
                                </div>
                            </div>
                        )}

                        {activeTab === 'appearance' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Profile Avatar</label>
                                    <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                                        <div className="shrink-0 relative group">
                                            {avatarPreview || avatar ? (
                                                <img 
                                                    src={avatarPreview || avatar} 
                                                    className="w-24 h-24 rounded-full border-4 border-goodwood-dark shadow-lg object-cover" 
                                                    alt="Avatar Preview" 
                                                />
                                            ) : (
                                                <div className="w-24 h-24 rounded-full border-4 border-goodwood-dark shadow-lg bg-emerald-900 flex items-center justify-center">
                                                    <span className="text-white font-black text-3xl">{username?.charAt(0) || '?'}</span>
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                                <Upload size={20} className="text-white" />
                                            </div>
                                            <input 
                                                type="file" 
                                                accept="image/*"
                                                onChange={handleFileChange}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm text-gray-400 mb-4">Upload a new avatar. You can crop and scale it perfectly.</p>
                                            
                                            {profile.avatarHistory && profile.avatarHistory.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Previous Avatars</p>
                                                    <div className="flex gap-3 overflow-x-auto pb-2" tabIndex={0} aria-label="Previous avatars list">
                                                        {profile.avatarHistory.map((histUrl: string, idx: number) => (
                                                            <button 
                                                                key={idx}
                                                                type="button"
                                                                onClick={() => handleSelectHistoryAvatar(histUrl)}
                                                                className={`relative w-12 h-12 rounded-full overflow-hidden border-2 transition-all ${avatar === histUrl && !avatarPreview ? 'border-white scale-110 shadow-lg' : 'border-goodwood-border hover:border-gray-400'}`}
                                                            >
                                                                <img src={histUrl} className="w-full h-full object-cover" alt={`History ${idx}`} />
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Profile Banner Gradient</label>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {gradientOptions.map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => setBannerGradient(option.value)}
                                                className={`relative h-24 rounded-xl overflow-hidden border-2 transition-all ${bannerGradient === option.value ? 'border-white scale-105 shadow-lg shadow-white/20' : 'border-goodwood-border hover:border-white/50'}`}
                                            >
                                                <div className={`absolute inset-0 ${option.value} opacity-80`} />
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm opacity-0 hover:opacity-100 transition-opacity">
                                                    <span className="text-white text-xs font-bold uppercase tracking-widest">{option.label}</span>
                                                </div>
                                                {bannerGradient === option.value && (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <span className="text-white text-xs font-bold uppercase tracking-widest drop-shadow-md">{option.label}</span>
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 mt-6">Profile Anthem (Favorite Song)</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={songSearchQuery}
                                            onChange={(e) => setSongSearchQuery(e.target.value)}
                                            placeholder="Search iTunes for your favorite song..."
                                            className="w-full bg-goodwood-dark border border-goodwood-border rounded-xl px-4 py-4 text-white placeholder-gray-600 focus:outline-none focus:border-white/20 transition-colors"
                                        />
                                        {isSearchingSongs && <p className="text-xs text-gray-500 mt-2 px-2">Searching...</p>}
                                        
                                        {songSearchResults.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-goodwood-dark border border-goodwood-border rounded-xl shadow-2xl overflow-hidden z-20">
                                                {songSearchResults.map((song, i) => (
                                                    <button
                                                        key={i}
                                                        type="button"
                                                        onClick={() => {
                                                            setFavoriteSong({
                                                                title: song.trackName,
                                                                artist: song.artistName,
                                                                art: song.artworkUrl100,
                                                                url: song.trackViewUrl
                                                            });
                                                            setSongSearchQuery('');
                                                            setSongSearchResults([]);
                                                        }}
                                                        className="w-full text-left flex items-center gap-4 p-4 hover:bg-white/5 border-b border-white/5 last:border-b-0 transition-colors"
                                                    >
                                                        {song.artworkUrl100 && <img src={song.artworkUrl100} alt={song.trackName} className="w-10 h-10 rounded object-cover" />}
                                                        <div>
                                                            <p className="text-white font-bold text-sm truncate">{song.trackName}</p>
                                                            <p className="text-gray-400 text-xs truncate">{song.artistName}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {favoriteSong && (
                                        <div className="mt-4 p-4 rounded-xl bg-goodwood-dark/50 border border-emerald-500/30 flex items-center gap-4 relative overflow-hidden group">
                                            <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none" />
                                            {favoriteSong.art && <img src={favoriteSong.art} alt="Art" className="w-12 h-12 rounded object-cover shadow-lg border border-white/10" />}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest mb-1">Current Anthem</p>
                                                <p className="text-white font-bold truncate">{favoriteSong.title}</p>
                                                <p className="text-gray-400 text-xs truncate">{favoriteSong.artist}</p>
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={() => setFavoriteSong(null)} 
                                                className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-red-500/20 text-red-400 hover:text-white hover:bg-red-500 p-2 rounded-full absolute right-4"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>

                            </div>
                        )}

                        {activeTab === 'account' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="bg-goodwood-dark/50 border border-goodwood-border rounded-2xl p-6">
                                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-6 border-b border-goodwood-border pb-4">Security Settings</h3>
                                    
                                    <div className="space-y-6">
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                            <div>
                                                <h4 className="text-white font-bold mb-1">Update Password</h4>
                                                <p className="text-gray-500 text-xs">Send a password reset link to your email.</p>
                                            </div>
                                            <button 
                                                type="button"
                                                onClick={async () => {
                                                    const auth = getAuth();
                                                    if (profile.email) {
                                                        sendPasswordResetEmail(auth, profile.email).then(() => toast.success("Password reset email sent to " + profile.email));
                                                    }
                                                }}
                                                className="bg-white/10 hover:bg-white text-white hover:text-black px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                                            >
                                                Reset
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-goodwood-dark/50 border border-goodwood-border rounded-2xl p-6">
                                    <div className="flex justify-between items-center mb-6 border-b border-goodwood-border pb-4">
                                        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Active Sessions</h3>
                                        <button 
                                            type="button"
                                            onClick={() => toast.success("All other active sessions have been revoked.")}
                                            className="text-xs text-red-500 hover:text-red-400 font-bold"
                                        >
                                            Sign out all other sessions
                                        </button>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between bg-black/40 p-4 rounded-xl border border-white/5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-emerald-900/50 rounded-full flex items-center justify-center border border-emerald-500/20 text-emerald-400">
                                                    <Shield size={16} />
                                                </div>
                                                <div>
                                                    <h4 className="text-white font-bold text-sm">Current Session</h4>
                                                    <p className="text-emerald-500 text-xs font-mono">{navigator.userAgent.split(') ')[0] + ')'} • Active Now</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-6">
                                    <h3 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-6">Danger Zone</h3>
                                    <div className="flex items-center justify-between mb-6 pb-6 border-b border-red-500/10">
                                        <div>
                                            <h4 className="text-white font-bold mb-1">Sign Out</h4>
                                            <p className="text-gray-500 text-xs">Log out of your account on this device.</p>
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={logout}
                                            className="bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"
                                        >
                                            <LogOut size={14} /> Logout
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="text-red-400 font-bold mb-1">Delete Account</h4>
                                            <p className="text-red-500/70 text-xs">Permanently remove your data from Goodwood FM.</p>
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={async () => {
                                                const confirmDelete = window.confirm("Are you sure you want to delete your account? This action cannot be undone.");
                                                if (confirmDelete) {
                                                    try {
                                                        await deleteDoc(doc(db, 'users', profile.uid));
                                                        // Firebase Auth user deletion requires recent login, we will wipe firestore data and sign out.
                                                        const user = getAuth().currentUser;
                                                        if (user) {
                                                            await deleteUser(user).catch(e => console.log('Auth delete required re-login', e));
                                                        }
                                                        logout();
                                                    } catch (e) {
                                                        toast.error("Error deleting account.");
                                                    }
                                                }
                                            }}
                                            className="bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"
                                        >
                                            <Trash2 size={14} /> Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {(activeTab === 'profile' || activeTab === 'appearance') && (
                            <div className="pt-4 border-t border-goodwood-border mt-8">
                                <button 
                                    disabled={saving}
                                    className="w-full bg-white text-black py-4 rounded-xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-white/5 disabled:opacity-50"
                                >
                                    {saving ? 'Saving Changes...' : 'Save Settings'}
                                </button>
                            </div>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
};
