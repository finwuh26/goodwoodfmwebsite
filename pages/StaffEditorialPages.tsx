import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { addDoc, collection, deleteDoc, doc, getDoc, limit, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { ArrowLeft, CheckCircle, Clock, ExternalLink, FileText, Layers, Search, Shield, Trash2, Zap } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';

const STAFF_BLOCKED_ROLES = ['user', 'member', 'vip'];
const EDITORIAL_ROLES = ['admin', 'owner', 'manager', 'journalist'];
const EDITORIAL_REVIEW_ROLES = ['admin', 'owner', 'manager'];

const StaffEditorialShell: React.FC<{
  title: string;
  subtitle: string;
  children: React.ReactNode;
}> = ({ title, subtitle, children }) => (
  <div className="min-h-screen bg-[#0a0b0f] px-4 py-8 md:px-8">
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">{title}</h1>
          <p className="mt-2 text-sm text-gray-400">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/staff/dashboard" className="inline-flex items-center gap-2 rounded-lg border border-goodwood-border bg-goodwood-card px-3 py-2 text-xs font-bold uppercase tracking-widest text-gray-300 hover:text-white">
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <Link to="/staff/ideas-pool" className="rounded-lg border border-goodwood-border bg-goodwood-card px-3 py-2 text-xs font-bold uppercase tracking-widest text-gray-300 hover:text-white">Ideas Pool</Link>
          <Link to="/staff/my-workflow" className="rounded-lg border border-goodwood-border bg-goodwood-card px-3 py-2 text-xs font-bold uppercase tracking-widest text-gray-300 hover:text-white">My Workflow</Link>
          <Link to="/staff/editorial-queue" className="rounded-lg border border-goodwood-border bg-goodwood-card px-3 py-2 text-xs font-bold uppercase tracking-widest text-gray-300 hover:text-white">Editorial Queue</Link>
        </div>
      </div>
      {children}
    </div>
  </div>
);

export const IdeasPoolPage = () => {
  const { user, userProfile } = useAuth();
  const [ideas, setIdeas] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  useEffect(() => {
    const q = query(collection(db, 'articles'), where('status', '==', 'idea'), limit(250));
    const unsub = onSnapshot(q, (snap) => {
      setIdeas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'articles'));
    return () => unsub();
  }, []);

  if (!user) return <Navigate to="/" replace />;
  if (userProfile && STAFF_BLOCKED_ROLES.includes(userProfile.role)) return <Navigate to="/" replace />;
  if (userProfile && !EDITORIAL_ROLES.includes(userProfile.role)) return <Navigate to="/staff/dashboard" replace />;

  const categories = Array.from(new Set(ideas.map((a) => a.category).filter(Boolean)));
  const filtered = ideas
    .filter((a) => category === 'all' || a.category === category)
    .filter((a) => [a.title, a.summary, a.authorName].join(' ').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));

  const claimIdea = async (art: any) => {
    try {
      await updateDoc(doc(db, 'articles', art.id), {
        status: 'draft',
        authorId: user.uid,
        authorName: userProfile?.username,
        authorAvatar: userProfile?.avatar || '',
        originalTitle: art.originalTitle || art.title,
        originalSummary: art.originalSummary || art.summary
      });
      toast.success('Idea claimed into your workflow');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `articles/${art.id}`);
    }
  };

  const deleteIdea = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'articles', id));
      toast.success('Idea removed');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `articles/${id}`);
    }
  };

  return (
    <StaffEditorialShell title="Ideas Pool" subtitle="Review, triage, and claim raw story ideas with faster editorial flow.">
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-goodwood-border bg-goodwood-card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Open Ideas</p><p className="mt-2 text-3xl font-black text-white">{ideas.length}</p></div>
        <div className="rounded-xl border border-goodwood-border bg-goodwood-card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Categories</p><p className="mt-2 text-3xl font-black text-white">{categories.length}</p></div>
        <div className="rounded-xl border border-goodwood-border bg-goodwood-card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Ready to Claim</p><p className="mt-2 text-3xl font-black text-white">{filtered.length}</p></div>
      </div>

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, summary, writer..." className="w-full rounded-lg border border-goodwood-border bg-goodwood-card py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-emerald-500" />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-goodwood-border bg-goodwood-card px-3 py-2 text-sm text-white">
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((art) => (
          <div key={art.id} className="rounded-xl border border-goodwood-border bg-goodwood-card p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <h3 className="text-sm font-bold text-white">{art.title}</h3>
              <span className="rounded-full bg-emerald-950/30 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-400">{art.category || 'News'}</span>
            </div>
            <p className="mb-4 line-clamp-3 text-xs text-gray-400">{art.summary || 'No summary'}</p>
            <div className="flex gap-2">
              <button onClick={() => claimIdea(art)} className="flex-1 rounded-lg bg-emerald-600/20 px-3 py-2 text-xs font-black text-emerald-400 hover:bg-emerald-600/30">Claim</button>
              <Link to={`/staff/article/${art.id}`} className="rounded-lg border border-goodwood-border px-3 py-2 text-xs font-black text-gray-300 hover:text-white">Preview</Link>
              {['admin', 'owner', 'manager'].includes(userProfile?.role || '') && (
                <button onClick={() => deleteIdea(art.id)} className="rounded-lg border border-red-500/30 px-3 py-2 text-xs font-black text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="col-span-full rounded-xl border border-dashed border-goodwood-border bg-goodwood-card p-8 text-center text-sm text-gray-500">No ideas match your current filters.</div>}
      </div>
    </StaffEditorialShell>
  );
};

export const MyWorkflowPage = () => {
  const { user, userProfile } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'articles'), where('authorId', '==', user.uid), limit(250));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'articles'));
    return () => unsub();
  }, [user]);

  if (!user) return <Navigate to="/" replace />;
  if (userProfile && STAFF_BLOCKED_ROLES.includes(userProfile.role)) return <Navigate to="/" replace />;
  if (userProfile && !EDITORIAL_ROLES.includes(userProfile.role)) return <Navigate to="/staff/dashboard" replace />;

  const filtered = items
    .filter((a) => ['draft', 'review', 'rejected', 'published'].includes(a.status))
    .filter((a) => status === 'all' || a.status === status)
    .filter((a) => [a.title, a.summary, a.status].join(' ').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));

  const submitForReview = async (id: string) => {
    try {
      await updateDoc(doc(db, 'articles', id), { status: 'review' });
      toast.success('Submitted to editorial queue');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `articles/${id}`);
    }
  };

  return (
    <StaffEditorialShell title="My Workflow" subtitle="Track your draft pipeline, quickly resume writing, and push ready drafts to editorial review.">
      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your articles..." className="w-full rounded-lg border border-goodwood-border bg-goodwood-card py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-blue-500" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-goodwood-border bg-goodwood-card px-3 py-2 text-sm text-white">
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="review">In Review</option>
          <option value="rejected">Needs Rework</option>
          <option value="published">Published</option>
        </select>
        <Link to="/staff/article/new" className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-emerald-700">New Article</Link>
      </div>

      <div className="space-y-3">
        {filtered.map((art) => (
          <div key={art.id} className="rounded-xl border border-goodwood-border bg-goodwood-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-white">{art.title}</h3>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                art.status === 'review' ? 'bg-yellow-500/20 text-yellow-400' :
                art.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                art.status === 'published' ? 'bg-emerald-500/20 text-emerald-400' :
                'bg-blue-500/20 text-blue-400'
              }`}>{art.status}</span>
            </div>
            <p className="mb-3 text-xs text-gray-400 line-clamp-2">{art.summary || 'No summary'}</p>
            <div className="flex flex-wrap gap-2">
              <Link to={`/staff/article/${art.id}`} className="inline-flex items-center gap-1 rounded-lg border border-goodwood-border px-3 py-2 text-xs font-black text-gray-300 hover:text-white"><ExternalLink size={12} /> Open Editor</Link>
              {art.status === 'draft' && <button onClick={() => submitForReview(art.id)} className="inline-flex items-center gap-1 rounded-lg bg-green-600/20 px-3 py-2 text-xs font-black text-green-400 hover:bg-green-600/30"><CheckCircle size={12} /> Submit for Review</button>}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="rounded-xl border border-dashed border-goodwood-border bg-goodwood-card p-8 text-center text-sm text-gray-500">No workflow items for this filter.</div>}
      </div>
    </StaffEditorialShell>
  );
};

export const EditorialQueuePage = () => {
  const { user, userProfile } = useAuth();
  const [queue, setQueue] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'articles'), where('status', '==', 'review'), limit(250));
    const unsub = onSnapshot(q, (snap) => {
      setQueue(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'articles'));
    return () => unsub();
  }, []);

  if (!user) return <Navigate to="/" replace />;
  if (userProfile && STAFF_BLOCKED_ROLES.includes(userProfile.role)) return <Navigate to="/" replace />;
  if (userProfile && !EDITORIAL_REVIEW_ROLES.includes(userProfile.role)) return <Navigate to="/staff/dashboard" replace />;

  const filtered = useMemo(
    () => queue
      .filter((a) => [a.title, a.summary, a.authorName].join(' ').toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0)),
    [queue, search]
  );

  const notifyArticlePublished = async (articleId: string) => {
    const token = await user.getIdToken();
    const response = await fetch('/api/notify-article-published', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ articleId }),
    });
    if (!response.ok) throw new Error('Failed to notify article publication');
  };

  const review = async (art: any, approved: boolean) => {
    setProcessingId(art.id);
    try {
      if (approved) {
        await updateDoc(doc(db, 'articles', art.id), { status: 'published' });
        await notifyArticlePublished(art.id);
        await addDoc(collection(db, 'reputationLogs'), {
          userId: art.authorId,
          points: 50,
          reason: 'Article Published',
          source: 'Editorial Queue',
          timestamp: serverTimestamp()
        });
        const userRef = doc(db, 'users', art.authorId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const currentScore = userSnap.data().reputationScore || 0;
          await updateDoc(userRef, { reputationScore: currentScore + 50 });
        }
        toast.success('Article approved and published');
        return;
      }

      await updateDoc(doc(db, 'articles', art.id), { status: 'rejected' });
      toast.success('Article sent back for rework');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `articles/${art.id}`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <StaffEditorialShell title="Editorial Queue" subtitle="Fast editorial approvals with publication, scoring, and rejection flow in one place.">
      <div className="mb-5 flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search pending reviews..." className="w-full rounded-lg border border-goodwood-border bg-goodwood-card py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-yellow-500" />
        </div>
        <div className="rounded-lg border border-goodwood-border bg-goodwood-card px-3 py-2 text-xs font-black uppercase tracking-widest text-yellow-400">{filtered.length} Pending</div>
      </div>

      <div className="space-y-3">
        {filtered.map((art) => (
          <div key={art.id} className="rounded-xl border border-goodwood-border bg-goodwood-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-white">{art.title}</h3>
              <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-black uppercase text-yellow-400">Review</span>
            </div>
            <p className="mb-3 text-xs text-gray-400 line-clamp-2">{art.summary || 'No summary'}</p>
            <p className="mb-4 text-[11px] font-bold uppercase tracking-widest text-gray-500">Writer: {art.authorName || 'Unknown'}</p>
            <div className="flex flex-wrap gap-2">
              <Link to={`/staff/article/${art.id}`} className="inline-flex items-center gap-1 rounded-lg border border-goodwood-border px-3 py-2 text-xs font-black text-gray-300 hover:text-white"><FileText size={12} /> Open Draft</Link>
              <button disabled={processingId === art.id} onClick={() => review(art, true)} className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-xs font-black text-white hover:bg-green-700 disabled:opacity-50"><CheckCircle size={12} /> Approve</button>
              <button disabled={processingId === art.id} onClick={() => review(art, false)} className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-black text-red-400 hover:bg-red-500/20 disabled:opacity-50"><Trash2 size={12} /> Reject</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="rounded-xl border border-dashed border-goodwood-border bg-goodwood-card p-8 text-center text-sm text-gray-500">Editorial queue is clear.</div>}
      </div>
    </StaffEditorialShell>
  );
};

