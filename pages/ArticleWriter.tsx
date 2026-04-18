import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate, useNavigate, useParams, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { ArrowLeft, Save, Send, Image as ImageIcon, Tag, Info, ExternalLink, CheckCircle, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { ImageUpload } from '../components/ImageUpload';
import Markdown from 'react-markdown';

const CATEGORIES = ['News', 'Music', 'Events', 'Interviews', 'Reviews', 'Community'];

export const ArticleWriter = () => {
    const { id } = useParams(); // if id exists, we are editing
    const { user, userProfile } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(!!id);
    const [saving, setSaving] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    
    // Auto-save State
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    const [form, setForm] = useState({
        title: '',
        summary: '',
        content: '',
        image: '',
        category: 'News',
        status: 'draft',
        url: '',
        originalTitle: '',
        originalSummary: ''
    });

    useEffect(() => {
        if (!id) return;
        const fetchArticle = async () => {
            try {
                const docRef = doc(db, 'articles', id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setForm({
                        title: data.title || '',
                        summary: data.summary || '',
                        content: data.content || '',
                        image: data.image || '',
                        category: data.category || 'News',
                        status: data.status || 'draft',
                        url: data.url || '',
                        originalTitle: data.originalTitle || '',
                        originalSummary: data.originalSummary || ''
                    });
                }
            } catch (err) {
                handleFirestoreError(err, OperationType.GET, `articles/${id}`);
            } finally {
                setLoading(false);
            }
        };
        fetchArticle();
    }, [id]);

    const handleSave = async (status: string, preventRedirect = false) => {
        if (!form.title.trim()) {
            if (!preventRedirect) alert("Title is required.");
            return;
        }
        
        setSaving(true);
        try {
            if (id) {
                const articleData = {
                    ...form,
                    status,
                    date: serverTimestamp()
                };
                await updateDoc(doc(db, 'articles', id), articleData);
            } else {
                const articleData = {
                    ...form,
                    status,
                    authorId: user?.uid,
                    authorName: userProfile?.username || 'Staff',
                    date: serverTimestamp()
                };
                const docRef = await addDoc(collection(db, 'articles'), articleData);
                if (preventRedirect) {
                    navigate(`/staff/article/${docRef.id}`, { replace: true });
                }
            }
            if (!preventRedirect) {
                navigate('/staff/dashboard');
            } else {
                setLastSaved(new Date());
            }
        } catch (err) {
            if (!preventRedirect) handleFirestoreError(err, id ? OperationType.UPDATE : OperationType.CREATE, 'articles');
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        if (!form.title.trim() || !form.content.trim()) return;
        
        const saveInterval = setInterval(() => {
             handleSave('draft', true);
        }, 30000); 

        return () => clearInterval(saveInterval);
    }, [form.title, form.content, id]);

    if (!user || !['admin', 'staff', 'manager', 'owner', 'journalist'].includes(userProfile?.role || '')) {
        return <Navigate to="/" replace />;
    }

    if (loading) return (
        <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#0a0b0f] text-white p-6">
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link to="/staff/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors font-bold uppercase tracking-widest text-xs">
                            <ArrowLeft size={16} /> Back to Dashboard
                        </Link>
                        {lastSaved && (
                            <span className="text-emerald-500 font-mono text-[10px] tracking-widest uppercase">
                                <CheckCircle size={10} className="inline mr-1 -mt-0.5" /> Auto-saved at {lastSaved.toLocaleTimeString()}
                            </span>
                        )}
                    </div>
                    <div className="flex gap-4">
                        <button 
                            onClick={() => handleSave('draft')}
                            disabled={saving || !form.title.trim()}
                            className="flex items-center gap-2 bg-goodwood-dark hover:bg-goodwood-card border border-goodwood-border px-6 py-2 rounded-lg font-bold transition-colors disabled:opacity-50"
                        >
                            <Save size={16} /> Save Draft
                        </button>
                        <button 
                            onClick={() => handleSave('review')}
                            disabled={saving || !form.title.trim()}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 px-6 py-2 rounded-lg font-bold transition-colors disabled:opacity-50 shadow-lg shadow-emerald-600/20"
                        >
                            <Send size={16} /> Submit for Review
                        </button>
                    </div>
                </div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-1 lg:grid-cols-3 gap-8"
                >
                    <div className="lg:col-span-2 space-y-6">
                        {/* Reference Section */}
                        {((form.originalTitle && form.originalTitle !== form.title) || (form.originalSummary && form.originalSummary !== form.summary)) && (
                            <div className="bg-goodwood-dark/50 border border-goodwood-border rounded-xl p-4 flex gap-4 items-start">
                                <div className="p-2 bg-goodwood-card rounded-lg text-blue-400">
                                    <Info size={16} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-2">Original Assignment / Intent</p>
                                    {form.originalTitle !== form.title && (
                                        <p className="text-sm text-gray-500 font-bold italic mb-1">Title: {form.originalTitle}</p>
                                    )}
                                    {form.originalSummary !== form.summary && (
                                        <p className="text-sm text-gray-500 font-bold italic">Summary: {form.originalSummary}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        <input 
                            type="text" 
                            placeholder="Article Title..." 
                            value={form.title}
                            onChange={e => setForm({...form, title: e.target.value})}
                            className="w-full bg-transparent text-4xl md:text-5xl font-black italic uppercase tracking-tighter placeholder:text-gray-700 outline-none border-b border-goodwood-border pb-4 focus:border-emerald-500 transition-colors"
                        />
                        
                        <textarea 
                            placeholder="Write a brief summary..." 
                            value={form.summary}
                            onChange={e => setForm({...form, summary: e.target.value})}
                            className="w-full bg-goodwood-card border border-goodwood-border rounded-xl p-6 text-gray-300 text-lg italic outline-none focus:border-emerald-500 transition-colors resize-none h-32"
                        />

                        <div className="bg-goodwood-card border border-goodwood-border rounded-xl overflow-hidden flex flex-col min-h-[600px]">
                            <div className="bg-goodwood-dark border-b border-goodwood-border flex items-center justify-between">
                                <div className="flex">
                                    <button 
                                        onClick={() => setShowPreview(false)}
                                        className={`px-6 py-4 text-xs font-bold uppercase tracking-widest transition-colors ${!showPreview ? 'bg-goodwood-card text-white border-b-2 border-emerald-500' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        Write
                                    </button>
                                    <button 
                                        onClick={() => setShowPreview(true)}
                                        className={`px-6 py-4 text-xs font-bold uppercase tracking-widest transition-colors ${showPreview ? 'bg-goodwood-card text-white border-b-2 border-emerald-500' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        Preview
                                    </button>
                                </div>
                            </div>

                            {!showPreview ? (
                                <textarea 
                                    placeholder="Start writing your article here... (Markdown supported)" 
                                    value={form.content}
                                    onChange={e => setForm({...form, content: e.target.value})}
                                    className="flex-1 bg-transparent p-6 text-gray-300 font-mono text-sm leading-relaxed outline-none resize-y min-h-[500px]"
                                />
                            ) : (
                                <div className="flex-1 bg-goodwood-dark/50 p-6 min-h-[500px] overflow-y-auto w-full">
                                    <div className="prose prose-invert prose-emerald max-w-none prose-headings:font-black prose-headings:italic prose-headings:uppercase prose-headings:tracking-tighter prose-a:text-emerald-400 hover:prose-a:text-emerald-300 prose-img:rounded-xl">
                                        <Markdown>{form.content || '*No content yet...*'}</Markdown>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-goodwood-card border border-goodwood-border rounded-xl p-6">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <ImageIcon size={14} /> Featured Image
                            </h3>
                            <ImageUpload 
                                value={form.image}
                                onChange={(base64) => setForm({...form, image: base64})}
                            />
                        </div>

                        <div className="bg-goodwood-card border border-goodwood-border rounded-xl p-6">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Tag size={14} /> Category
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {CATEGORIES.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setForm({...form, category: cat})}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${form.category === cat ? 'bg-emerald-600 text-white' : 'bg-goodwood-dark text-gray-400 hover:bg-goodwood-card-hover border border-goodwood-border'}`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};
