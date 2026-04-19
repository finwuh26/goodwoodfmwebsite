import React, { useState, useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { User, Clock, ArrowLeft, Heart, Flame, ThumbsUp, MessageSquare, Send, Trash2, FileText, Share2 } from 'lucide-react';
import { motion } from 'motion/react';
import { doc, getDoc, collection, query, where, orderBy, addDoc, serverTimestamp, deleteDoc, getDocs, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { formatDate } from '../utils';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';
import Markdown from 'react-markdown';
import { UserAvatar } from '../components/UserAvatar';
import { ConfirmModal } from '../components/ConfirmModal';
import { toast } from 'react-hot-toast';
import { readFirestoreWithGuard } from '../utils/firestoreReadGuards';

const ARTICLE_PAGE_READ_TTL_MS = 2 * 60 * 1000;

export const ArticlePage = () => {
    const { id } = useParams();
    const { user, userProfile } = useAuth();
    const [article, setArticle] = useState<any>(null);
    const [comments, setComments] = useState<any[]>([]);
    const [reactions, setReactions] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');
    const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
    const [replyComment, setReplyComment] = useState('');
    const [submittingReply, setSubmittingReply] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState<{isOpen: boolean; commentId: string | null}>({isOpen: false, commentId: null});

    useEffect(() => {
        if (!id) return;
        let isMounted = true;
        const loadArticle = async () => {
            try {
                const articleDocRef = doc(db, 'articles', id);
                const qComments = query(collection(db, 'articleComments'), where('articleId', '==', id), orderBy('timestamp', 'desc'));
                const qReactions = query(collection(db, 'articleReactions'), where('articleId', '==', id));

                const [articleDoc, commentsSnap, reactionsSnap] = await Promise.all([
                    readFirestoreWithGuard(`articlePage:${id}:article`, () => getDoc(articleDocRef), { ttlMs: ARTICLE_PAGE_READ_TTL_MS }),
                    readFirestoreWithGuard(`articlePage:${id}:comments`, () => getDocs(qComments), { ttlMs: ARTICLE_PAGE_READ_TTL_MS }),
                    readFirestoreWithGuard(`articlePage:${id}:reactions`, () => getDocs(qReactions), { ttlMs: ARTICLE_PAGE_READ_TTL_MS }),
                ]);

                if (!isMounted) return;
                setArticle(articleDoc.exists() ? { id: articleDoc.id, ...articleDoc.data() } : null);
                setComments(commentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setReactions(reactionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            } catch (err) {
                if (!isMounted) return;
                handleFirestoreError(err, OperationType.GET, `articles/${id}`);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadArticle();
        const refreshInterval = window.setInterval(loadArticle, ARTICLE_PAGE_READ_TTL_MS);
        return () => {
            isMounted = false;
            window.clearInterval(refreshInterval);
        };
    }, [id]);

    const qComments = id
        ? query(collection(db, 'articleComments'), where('articleId', '==', id), orderBy('timestamp', 'desc'))
        : null;
    const qReactions = id
        ? query(collection(db, 'articleReactions'), where('articleId', '==', id))
        : null;

    const refreshComments = async () => {
        if (!id || !qComments) return;
        try {
            const snap = await readFirestoreWithGuard(
                `articlePage:${id}:comments:refresh`,
                () => getDocs(qComments),
                { ttlMs: 10_000 }
            );
            setComments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (err) {
            handleFirestoreError(err, OperationType.GET, 'articleComments');
        }
    };

    const refreshReactions = async () => {
        if (!id || !qReactions) return;
        try {
            const snap = await readFirestoreWithGuard(
                `articlePage:${id}:reactions:refresh`,
                () => getDocs(qReactions),
                { ttlMs: 10_000 }
            );
            setReactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (err) {
            handleFirestoreError(err, OperationType.GET, 'articleReactions');
        }
    };

    const handlePostComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newComment.trim()) return;
        try {
            const commentContent = newComment.trim();
            const docRef = await addDoc(collection(db, 'articleComments'), {
                articleId: id,
                authorId: user.uid,
                authorName: userProfile?.username || 'Anonymous',
                authorAvatar: userProfile?.avatar || '',
                content: commentContent,
                timestamp: serverTimestamp()
            });
            setComments((prev) => [
                {
                    id: docRef.id,
                    articleId: id,
                    authorId: user.uid,
                    authorName: userProfile?.username || 'Anonymous',
                    authorAvatar: userProfile?.avatar || '',
                    content: commentContent,
                    timestamp: Timestamp.now()
                },
                ...prev
            ]);
            setNewComment('');
        } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, 'articleComments');
        } finally {
            refreshComments().catch(() => undefined);
        }
    };

    const handlePostReply = async (e: React.FormEvent, parentCommentId: string) => {
        e.preventDefault();
        if (!user || !replyComment.trim() || !parentCommentId) return;
        setSubmittingReply(true);
        try {
            const replyContent = replyComment.trim();
            const docRef = await addDoc(collection(db, 'articleComments'), {
                articleId: id,
                authorId: user.uid,
                authorName: userProfile?.username || 'Anonymous',
                authorAvatar: userProfile?.avatar || '',
                content: replyContent,
                parentCommentId,
                timestamp: serverTimestamp()
            });
            setComments((prev) => [
                {
                    id: docRef.id,
                    articleId: id,
                    authorId: user.uid,
                    authorName: userProfile?.username || 'Anonymous',
                    authorAvatar: userProfile?.avatar || '',
                    content: replyContent,
                    parentCommentId,
                    timestamp: Timestamp.now()
                },
                ...prev
            ]);
            setReplyComment('');
            setReplyToCommentId(null);
        } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, 'articleComments');
        } finally {
            setSubmittingReply(false);
            refreshComments().catch(() => undefined);
        }
    };

    const handleDeleteComment = (commentId: string) => {
        setIsConfirmDeleteOpen({isOpen: true, commentId});
    };

    const confirmDeleteComment = async () => {
        if (!isConfirmDeleteOpen.commentId) return;
        const targetId = isConfirmDeleteOpen.commentId;
        const replyIds = comments
            .filter((comment) => comment.parentCommentId === targetId)
            .map((comment) => comment.id);
        try {
            await Promise.all([
                deleteDoc(doc(db, 'articleComments', targetId)),
                ...replyIds.map((replyId) => deleteDoc(doc(db, 'articleComments', replyId)))
            ]);
            setComments((prev) => prev.filter((comment) => comment.id !== targetId && comment.parentCommentId !== targetId));
            setIsConfirmDeleteOpen({isOpen: false, commentId: null});
        } catch (err) {
            handleFirestoreError(err, OperationType.DELETE, `articleComments/${targetId}`);
        } finally {
            refreshComments().catch(() => undefined);
        }
    };

    const handleReact = async (reactionType: string) => {
        if (!user || !id) return;
        try {
            const existingReaction = reactions.find(r => r.userId === user.uid && r.reaction === reactionType);
            if (existingReaction) {
                await deleteDoc(doc(db, 'articleReactions', existingReaction.id));
                setReactions((prev) => prev.filter((reaction) => reaction.id !== existingReaction.id));
            } else {
                const docRef = await addDoc(collection(db, 'articleReactions'), {
                    articleId: id,
                    userId: user.uid,
                    reaction: reactionType
                });
                setReactions((prev) => [...prev, { id: docRef.id, articleId: id, userId: user.uid, reaction: reactionType, timestamp: Timestamp.now() }]);
            }
        } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, 'articleReactions');
        } finally {
            refreshReactions().catch(() => undefined);
        }
    };

    const handleCopyShareLink = async () => {
        if (!id) return;
        const shareUrl = `${window.location.origin}/share/article/${id}`;
        try {
            if (!navigator.clipboard?.writeText) {
                toast.error('Clipboard not supported in this browser');
                return;
            }
            await navigator.clipboard.writeText(shareUrl);
            toast.success('Share link copied');
        } catch {
            toast.error('Unable to copy share link');
        }
    };

    const getReactionCount = (type: string) => reactions.filter(r => r.reaction === type).length;
    const hasReacted = (type: string) => reactions.some(r => r.userId === user?.uid && r.reaction === type);
    const topLevelComments = comments
        .filter((comment) => !comment.parentCommentId)
        .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
    const getReplies = (parentCommentId: string) => comments
        .filter((comment) => comment.parentCommentId === parentCommentId)
        .sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
        </div>
    );

    if (!article) return <Navigate to="/content" replace />;

    return (
        <div className="container mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <Link to="/content" className="inline-flex items-center gap-2 text-gray-500 hover:text-white mb-8 transition-colors font-bold uppercase text-[10px] tracking-widest group">
                  <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Back to Articles
              </Link>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-goodwood-card border border-goodwood-border rounded-2xl overflow-hidden shadow-2xl"
            >
                <div className="h-[280px] sm:h-[380px] md:h-[450px] relative overflow-hidden">
                    {article.image ? (
                        <motion.img 
                          initial={{ scale: 1.1 }}
                          animate={{ scale: 1 }}
                          transition={{ duration: 1.5 }}
                          src={article.image} 
                          alt={article.title} 
                          className="w-full h-full object-cover" 
                        />
                    ) : (
                        <motion.div 
                          initial={{ scale: 1.1 }}
                          animate={{ scale: 1 }}
                          transition={{ duration: 1.5 }}
                          className="w-full h-full bg-emerald-900 flex items-center justify-center"
                        >
                            <FileText size={64} className="text-white/50" />
                        </motion.div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-goodwood-card via-goodwood-card/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 p-4 sm:p-8 md:p-12 w-full">
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                          className="mb-4 sm:mb-6 flex flex-wrap items-center gap-2 sm:gap-3"
                        >
                             <span className="bg-white text-black text-[10px] font-black px-3 py-1 rounded uppercase tracking-widest">{article.category || 'News'}</span>
                             <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                                <Clock size={12} /> {formatDate(article.date)}
                             </span>
                        </motion.div>
                          <motion.h1 
                           initial={{ opacity: 0, y: 20 }}
                           animate={{ opacity: 1, y: 0 }}
                           transition={{ delay: 0.3 }}
                            className="max-w-5xl text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white italic tracking-tight leading-tight md:leading-[0.95] mb-4 sm:mb-8 drop-shadow-2xl break-words [text-wrap:balance]"
                         >
                           {article.title}
                         </motion.h1>
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.4 }}
                           className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-white/10 pt-4 sm:pt-8"
                        >
                            <div className="flex items-center gap-4">
                                <UserAvatar 
                                    userId={article.authorId} 
                                    fallbackAvatar={article.authorAvatar} 
                                    fallbackName={article.authorName} 
                                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-goodwood-border shadow-xl bg-emerald-900 object-cover shrink-0" 
                                />
                                <div>
                                    <Link to={`/profile/${article.authorId}`} className="text-white font-black text-xs sm:text-sm uppercase italic tracking-tight hover:text-emerald-400 transition-colors">{article.authorName}</Link>
                                    <div className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Author</div>
                                </div>
                            </div>
                            <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded flex items-center justify-center gap-2">
                                <Clock size={12} className="text-blue-500" />
                                {Math.max(1, Math.ceil((article.content || '').split(/\s+/).length / 200))} MIN READ
                            </div>
                        </motion.div>
                    </div>
                </div>

                <div className="p-4 sm:p-8 md:p-16">
                    <div className="prose prose-invert max-w-none">
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.6 }}
                          className="text-gray-400 leading-relaxed sm:leading-loose text-base sm:text-lg space-y-5 sm:space-y-6 markdown-body"
                        >
                          <Markdown>{article.content}</Markdown>
                        </motion.div>
                    </div>

                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.7 }}
                      className="mt-10 sm:mt-16 pt-6 sm:pt-10 border-t border-goodwood-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6"
                    >
                        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                            <button onClick={() => handleReact('like')} className={clsx("flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-colors", hasReacted('like') ? "bg-blue-500/20 text-blue-400" : "bg-goodwood-dark text-gray-400 hover:bg-goodwood-card-hover")}>
                                <ThumbsUp size={18} className={hasReacted('like') ? "fill-current" : ""} /> {getReactionCount('like')}
                            </button>
                            <button onClick={() => handleReact('heart')} className={clsx("flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-colors", hasReacted('heart') ? "bg-pink-500/20 text-pink-400" : "bg-goodwood-dark text-gray-400 hover:bg-goodwood-card-hover")}>
                                <Heart size={18} className={hasReacted('heart') ? "fill-current" : ""} /> {getReactionCount('heart')}
                            </button>
                            <button onClick={() => handleReact('fire')} className={clsx("flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-colors", hasReacted('fire') ? "bg-orange-500/20 text-orange-400" : "bg-goodwood-dark text-gray-400 hover:bg-goodwood-card-hover")}>
                                <Flame size={18} className={hasReacted('fire') ? "fill-current" : ""} /> {getReactionCount('fire')}
                            </button>
                            <button onClick={handleCopyShareLink} className="flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-colors bg-goodwood-dark text-gray-400 hover:bg-goodwood-card-hover">
                                <Share2 size={18} /> Share
                            </button>
                        </div>
                    </motion.div>
                </div>

                {/* Comments Section */}
                <div className="bg-[#0f1014] p-4 sm:p-8 md:p-12 lg:p-16 border-t border-goodwood-border">
                    <h3 className="text-xl sm:text-2xl font-bold text-white mb-6 sm:mb-8 flex items-center gap-3">
                        <MessageSquare className="text-emerald-500" /> Comments ({comments.length})
                    </h3>

                    {user ? (
                        <form onSubmit={handlePostComment} className="mb-12">
                            <div className="flex gap-4">
                                {userProfile?.avatar ? (
                                    <img src={userProfile.avatar} alt="Avatar" className="w-12 h-12 rounded-full border border-goodwood-border object-cover shrink-0" />
                                ) : (
                                    <div className="w-12 h-12 rounded-full border border-goodwood-border bg-emerald-900 flex items-center justify-center shrink-0">
                                        <span className="text-white font-bold">{userProfile?.username?.charAt(0) || '?'}</span>
                                    </div>
                                )}
                                <div className="flex-1 relative">
                                    <textarea 
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        placeholder="Add a comment..."
                                        className="w-full bg-goodwood-dark border border-goodwood-border rounded-xl p-4 text-white resize-none focus:outline-none focus:border-emerald-500 transition-colors min-h-[100px]"
                                        required
                                    />
                                    <button type="submit" className="absolute bottom-4 right-4 bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-lg transition-colors shadow-lg">
                                        <Send size={18} />
                                    </button>
                                </div>
                            </div>
                        </form>
                    ) : (
                        <div className="bg-goodwood-dark border border-goodwood-border rounded-xl p-6 text-center mb-12">
                            <p className="text-gray-400 mb-4">You must be logged in to comment.</p>
                        </div>
                    )}

                    <div className="space-y-6">
                        {topLevelComments.map(comment => (
                            <div key={comment.id} className="flex gap-3 sm:gap-4 group">
                                <UserAvatar 
                                    userId={comment.authorId} 
                                    fallbackAvatar={comment.authorAvatar} 
                                    fallbackName={comment.authorName} 
                                    className="w-10 h-10 rounded-full border border-goodwood-border shrink-0" 
                                />
                                <div className="flex-1 bg-goodwood-dark border border-goodwood-border rounded-xl p-4 relative">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <Link to={`/profile/${comment.authorId}`} className="text-white font-bold hover:text-emerald-400 transition-colors">{comment.authorName}</Link>
                                            <span className="text-gray-500 text-xs ml-3">{comment.timestamp?.toDate ? comment.timestamp.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Just now'}</span>
                                        </div>
                                        {(user?.uid === comment.authorId || userProfile?.role === 'admin') && (
                                            <button onClick={() => handleDeleteComment(comment.id)} className="text-gray-500 hover:text-red-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-gray-300 leading-relaxed">{comment.content}</p>
                                    <div className="mt-3 flex items-center gap-3">
                                        {user && (
                                            <button
                                                onClick={() => {
                                                    setReplyToCommentId((prev) => prev === comment.id ? null : comment.id);
                                                    setReplyComment('');
                                                }}
                                                className="text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-emerald-400 transition-colors"
                                            >
                                                Reply
                                            </button>
                                        )}
                                    </div>

                                    {replyToCommentId === comment.id && user && (
                                        <form onSubmit={(e) => handlePostReply(e, comment.id)} className="mt-4">
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={replyComment}
                                                    onChange={(e) => setReplyComment(e.target.value)}
                                                    placeholder={`Reply to ${comment.authorName}...`}
                                                    className="flex-1 bg-[#090b0f] border border-goodwood-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                                                    required
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={submittingReply || !replyComment.trim()}
                                                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest"
                                                >
                                                    Send
                                                </button>
                                            </div>
                                        </form>
                                    )}

                                    {getReplies(comment.id).length > 0 && (
                                        <div className="mt-4 space-y-3 border-l border-goodwood-border/70 pl-4 sm:pl-6">
                                            {getReplies(comment.id).map((reply) => (
                                                <div key={reply.id} className="rounded-lg border border-goodwood-border bg-[#090b0f] p-3">
                                                    <div className="mb-1 flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <Link to={`/profile/${reply.authorId}`} className="text-xs font-bold text-white hover:text-emerald-400">{reply.authorName}</Link>
                                                            <span className="text-[10px] text-gray-500">{reply.timestamp?.toDate ? reply.timestamp.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Just now'}</span>
                                                        </div>
                                                        {(user?.uid === reply.authorId || userProfile?.role === 'admin') && (
                                                            <button onClick={() => handleDeleteComment(reply.id)} className="text-gray-500 hover:text-red-500">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-300 leading-relaxed">{reply.content}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {topLevelComments.length === 0 && (
                            <p className="text-gray-500 text-center italic">No comments yet. Be the first to share your thoughts!</p>
                        )}
                    </div>
                </div>
            </motion.div>
            
            <ConfirmModal 
                isOpen={isConfirmDeleteOpen.isOpen}
                title="Delete Comment"
                message="Are you sure you want to delete this comment? This action cannot be undone."
                onConfirm={confirmDeleteComment}
                onCancel={() => setIsConfirmDeleteOpen({isOpen: false, commentId: null})}
            />
        </div>
    );
}
