import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRadio } from '../context/RadioContext';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, addDoc, serverTimestamp, getDocs, getDoc, orderBy, limit, where, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Users, FileText, Calendar, MessageSquare, Settings, CheckCircle, XCircle, Plus, Trash2, Shield, Play, Pause, Volume2, Radio, Edit3, Check, Filter, Layers, Zap, Clock, UserPlus, ExternalLink, Activity, Info, AlertTriangle, Loader2, X, ChevronDown, Headphones } from 'lucide-react';
import { Marquee } from '../components/Marquee';
import { Modal, Dropdown, Input, TextArea } from '../components/DashboardUI';
import { ImageUpload } from '../components/ImageUpload';
import { BadgeSelector } from '../components/BadgeSelector';
import { checkPlagiarism } from '../services/geminiService';
import { getDatesForThisWeek, formatDate } from '../utils';
import { toast } from 'react-hot-toast';

import { ConfirmModal } from '../components/ConfirmModal';
import { UserAvatar } from '../components/UserAvatar';

const ARTICLE_CATEGORIES = [
    { value: 'News', label: 'News' },
    { value: 'Music', label: 'Music' },
    { value: 'Events', label: 'Events' },
    { value: 'Lifestyle', label: 'Lifestyle' },
    { value: 'Gaming', label: 'Gaming' },
    { value: 'Staff', label: 'Staff' },
    { value: 'Interviews', label: 'Interviews' },
];

const USER_ROLES = [
    { value: 'member', label: 'Member' },
    { value: 'vip', label: 'VIP Member' },
    { value: 'staff', label: 'Staff' },
    { value: 'dj', label: 'Radio DJ' },
    { value: 'journalist', label: 'Journalist' },
    { value: 'manager', label: 'Manager' },
    { value: 'admin', label: 'Administrator' },
    { value: 'owner', label: 'Owner' },
];

const POSITION_OPTIONS = [
    { value: 'Radio Presenter', label: 'Radio Presenter' },
    { value: 'Music Journalist', label: 'Music Journalist' },
    { value: 'Community Manager', label: 'Community Manager' },
    { value: 'Lead Developer', label: 'Lead Developer' },
    { value: 'Event Coordinator', label: 'Event Coordinator' },
    { value: 'Radio Admin', label: 'Radio Admin' },
];

const DEPARTMENT_OPTIONS = [
    { value: 'Leadership', label: 'Leadership' },
    { value: 'Management', label: 'Administration' },
    { value: 'Radio', label: 'Radio Department' },
    { value: 'News', label: 'News Department' },
    { value: 'Community', label: 'Community Department' },
    { value: 'Development', label: 'Development Department' },
];

const USERS_DASHBOARD_LIMIT = 200;
const DASHBOARD_POLL_INTERVAL_MS = 2 * 60 * 1000;
const createEmptyBannerForm = () => ({ title: '', topic: '', image: '', link: '', active: true });

export const StaffDashboard = () => {
    const { user, userProfile } = useAuth();
    const { radioData, isPlaying, setIsPlaying, volume, setVolume } = useRadio();
    const navigate = useNavigate();
    const audioRef = useRef<HTMLAudioElement>(null);

    const [activeTab, setActiveTab] = useState('overview');
    const [applications, setApplications] = useState<any[]>([]);
    const [messages, setMessages] = useState<any[]>([]);
    const [articles, setArticles] = useState<any[]>([]);
    const [schedule, setSchedule] = useState<any[]>([]);
    const [staff, setStaff] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [partners, setPartners] = useState<any[]>([]);
    const [banners, setBanners] = useState<any[]>([]);
    const [redeemCodes, setRedeemCodes] = useState<any[]>([]);
    const [codeForm, setCodeForm] = useState({ code: '', credits: 100, usesLeft: 1 });
    const [showCodeModal, setShowCodeModal] = useState(false);
    const [reputationLogs, setReputationLogs] = useState<any[]>([]);
    const [weekOffset, setWeekOffset] = useState(0);
    const [systemSettings, setSystemSettings] = useState<any>({
        firewallStrictMode: false,
        maintenanceMode: false
    });

    // Modal States
    const [showArticleModal, setShowArticleModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showStaffModal, setShowStaffModal] = useState(false);
    const [showUserModal, setShowUserModal] = useState(false);
    const [showPartnerModal, setShowPartnerModal] = useState(false);
    const [showBannerModal, setShowBannerModal] = useState(false);
    
    // Azuracast State
    const [azuracastData, setAzuracastData] = useState<any>(null);
    const [loadingAzuracast, setLoadingAzuracast] = useState(false);

    useEffect(() => {
        // Mock Azuracast loading just for slightly realistic UI transition if wanted, or just skip it
        if (activeTab === 'dj-connection') {
             setLoadingAzuracast(true);
             setTimeout(() => setLoadingAzuracast(false), 500);
        }
    }, [activeTab]);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState<{isOpen: boolean, collectionName: string | null, docId: string | null}>({isOpen: false, collectionName: null, docId: null});
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingBannerId, setEditingBannerId] = useState<string | null>(null);

    // Form States
    const [articleForm, setArticleForm] = useState({ title: '', summary: '', content: '', image: '', category: 'News', status: 'idea', url: '', originalTitle: '', originalSummary: '' });
    const [scheduleForm, setScheduleForm] = useState({ showName: '', day: 'Monday', time: '12:00', status: 'open', claimedBy: '', duration: 60 });
    const [staffForm, setStaffForm] = useState({ uid: '', username: '', avatar: '', role: 'staff', position: POSITION_OPTIONS[0].value, department: DEPARTMENT_OPTIONS[0].value });
    const [userForm, setUserForm] = useState({ role: 'member', isVerified: false, badges: [] as string[] });
    const [partnerForm, setPartnerForm] = useState({ name: '', logo: '', website: '' });
    const [bannerForm, setBannerForm] = useState(createEmptyBannerForm);

    const [isSaving, setIsSaving] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResults, setAnalysisResults] = useState<Record<string, any>>({});

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

    const streamUrl = radioData?.station?.listen_url || "";
    const songTitle = radioData?.now_playing?.song?.title || "Loading...";
    const songArtist = radioData?.now_playing?.song?.artist || "Goodwood FM";

    useEffect(() => {
        if (!user) return;
        const includeCodes = ['admin', 'owner'].includes(userProfile?.role || '');

        const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
            if (docSnap.exists()) {
                setSystemSettings(docSnap.data());
            } else {
                setSystemSettings({ firewallStrictMode: false, maintenanceMode: false });
            }
        });

        const qUsers = query(collection(db, 'users'), limit(USERS_DASHBOARD_LIMIT));
        const unsubUsers = onSnapshot(qUsers, (snap) => {
            const usersList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
            usersList.sort((a: any, b: any) => {
                const aTs = a?.lastActive?.seconds || a?.createdAt?.seconds || 0;
                const bTs = b?.lastActive?.seconds || b?.createdAt?.seconds || 0;
                return bTs - aTs;
            });
            setUsers(usersList);
        }, (err) => handleFirestoreError(err, OperationType.GET, 'users'));

        let isMounted = true;
        const fetchLowPriorityData = async () => {
            try {
                const requests = [
                    getDocs(query(collection(db, 'applications'), limit(200))),
                    getDocs(query(collection(db, 'enquiries'), limit(300))),
                    getDocs(query(collection(db, 'articles'), limit(300))),
                    getDocs(query(collection(db, 'schedule'), limit(300))),
                    getDocs(query(collection(db, 'staff'), limit(300))),
                    getDocs(query(collection(db, 'partners'), limit(100))),
                    getDocs(query(collection(db, 'banners'), limit(100))),
                    getDocs(query(collection(db, 'reputationLogs'), orderBy('timestamp', 'desc'), limit(50))),
                ];

                if (includeCodes) {
                    requests.push(getDocs(query(collection(db, 'redeemCodes'), orderBy('createdAt', 'desc'), limit(200))));
                }

                const [
                    appsSnap,
                    msgsSnap,
                    articlesSnap,
                    scheduleSnap,
                    staffSnap,
                    partnersSnap,
                    bannersSnap,
                    logsSnap,
                    codesSnap
                ] = await Promise.all(requests);

                if (!isMounted) return;

                setApplications(appsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setMessages(msgsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setArticles(articlesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setSchedule(scheduleSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setStaff(staffSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setPartners(partnersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setBanners(bannersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setReputationLogs(logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                if (includeCodes && codesSnap) {
                    setRedeemCodes(codesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                } else {
                    setRedeemCodes([]);
                }
            } catch (err) {
                handleFirestoreError(err, OperationType.GET, 'staffDashboard:lowPriorityPolling');
            }
        };

        fetchLowPriorityData();
        const pollingInterval = window.setInterval(fetchLowPriorityData, DASHBOARD_POLL_INTERVAL_MS);

        return () => {
            isMounted = false;
            window.clearInterval(pollingInterval);
            unsubSettings();
            unsubUsers();
        };
    }, [user, userProfile?.role]);

    if (!user) return <Navigate to="/" replace />;
    if (userProfile && ['user', 'member', 'vip'].includes(userProfile.role)) {
        return <Navigate to="/" replace />;
    }

    const handleUpdateAppStatus = async (app: any, status: string) => {
        try {
            await updateDoc(doc(db, 'applications', app.id), { status });
            
            if (status === 'approved') {
                // Determine mapped role
                let mappedRole = 'staff';
                let lowerRole = (app.role || '').toLowerCase();
                if (lowerRole.includes('dj') || lowerRole.includes('presenter') || lowerRole.includes('radio')) mappedRole = 'dj';
                if (lowerRole.includes('journalist') || lowerRole.includes('writer')) mappedRole = 'journalist';
                if (lowerRole.includes('manager')) mappedRole = 'manager';
                if (lowerRole.includes('admin')) mappedRole = 'admin';

                // Automatically add to staff
                await addDoc(collection(db, 'staff'), {
                    username: app.username,
                    avatar: app.avatar || '',
                    role: mappedRole,
                    position: app.role,
                    department: 'General',
                    uid: app.uid || ''
                });

                // Update user role if uid exists
                if (app.uid) {
                    await updateDoc(doc(db, 'users', app.uid), {
                        role: mappedRole
                    }).catch((err) => {
                         console.warn("Could not update user role, they may not have a user document yet", err);
                    });
                }
            }
        } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `applications/${app.id}`);
        }
    };

    const handleDeleteDoc = (collectionName: string, id: string) => {
        setIsConfirmDeleteOpen({ isOpen: true, collectionName, docId: id });
    };

    const confirmDeleteDoc = async () => {
        if (!isConfirmDeleteOpen.collectionName || !isConfirmDeleteOpen.docId) return;
        try {
            await deleteDoc(doc(db, isConfirmDeleteOpen.collectionName, isConfirmDeleteOpen.docId));
        } catch (err) {
            handleFirestoreError(err, OperationType.DELETE, `${isConfirmDeleteOpen.collectionName}/${isConfirmDeleteOpen.docId}`);
        } finally {
            setIsConfirmDeleteOpen({ isOpen: false, collectionName: null, docId: null });
        }
    };

    const handlePlagiarismCheck = async (articleId: string, content: string) => {
        setIsAnalyzing(true);
        const result = await checkPlagiarism(content);
        setAnalysisResults(prev => ({ ...prev, [articleId]: result }));
        setIsAnalyzing(false);
    };

    const handleSaveArticle = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (editingId) {
                await updateDoc(doc(db, 'articles', editingId), articleForm);
            } else {
                await addDoc(collection(db, 'articles'), {
                    ...articleForm,
                    authorId: user?.uid,
                    authorName: userProfile?.username || 'Staff',
                    date: serverTimestamp(),
                    status: 'idea',
                    originalTitle: articleForm.title,
                    originalSummary: articleForm.summary
                });
            }
            setShowArticleModal(false);
            setEditingId(null);
            setArticleForm({ title: '', summary: '', content: '', image: '', category: 'News', status: 'idea', url: '', originalTitle: '', originalSummary: '' });
        } catch (err) {
            handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'articles');
        } finally {
            setIsSaving(false);
        }
    };

    const handleFetchFromUrl = async () => {
        if (!articleForm.url) return;
        try {
            const res = await fetch(`/api/fetch-article-metadata`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: articleForm.url })
            });
            const data = await res.json();
            
            if (data && (data.title || data.image || data.description)) {
                setArticleForm(prev => ({
                    ...prev,
                    title: data.title || prev.title,
                    image: data.image || prev.image,
                    summary: data.description || prev.summary
                }));
            }
        } catch (err) {
            console.error("Failed to fetch article metadata", err);
        }
    };

    const handleClaimArticle = async (art: any) => {
        try {
            await updateDoc(doc(db, 'articles', art.id), {
                status: 'draft',
                authorId: user?.uid,
                authorName: userProfile?.username,
                authorAvatar: userProfile?.avatar || '',
                originalTitle: art.originalTitle || art.title,
                originalSummary: art.originalSummary || art.summary
            });
        } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `articles/${art.id}`);
        }
    };

    const notifyArticlePublished = async (articleId: string) => {
        if (!user) {
            throw new Error('You must be signed in to publish an article.');
        }

        const token = await user.getIdToken();
        for (let attempt = 1; attempt <= 3; attempt += 1) {
            const response = await fetch('/api/notify-article-published', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ articleId }),
            });

            if (response.ok) {
                return;
            }

            let errorMessage = `Notification failed (${response.status})`;
            try {
                const payload = await response.json();
                if (typeof payload?.error === 'string' && payload.error.trim()) {
                    errorMessage = payload.error;
                }
            } catch {
                // ignore non-JSON responses
            }

            if (attempt === 3) {
                throw new Error(errorMessage);
            }

            await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
        }
    };

    const handleReviewArticle = async (articleId: string, authorId: string, approved: boolean) => {
        try {
            if (approved) {
                await updateDoc(doc(db, 'articles', articleId), { status: 'published' });
                await notifyArticlePublished(articleId);
                // Award reputation
                await addDoc(collection(db, 'reputationLogs'), {
                    userId: authorId,
                    points: 50,
                    reason: 'Article Published',
                    source: 'Staff Dashboard',
                    timestamp: serverTimestamp()
                });
                
                // Update user score
                const userRef = doc(db, 'users', authorId);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    const currentScore = userSnap.data().reputationScore || 0;
                    await updateDoc(userRef, { reputationScore: currentScore + 50 });
                }
            } else {
                await updateDoc(doc(db, 'articles', articleId), { status: 'rejected' });
            }
        } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `articles/${articleId}`);
        }
    };

    const handleSaveSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                await updateDoc(doc(db, 'schedule', editingId), scheduleForm);
            } else {
                await addDoc(collection(db, 'schedule'), { ...scheduleForm, status: 'open' });
            }
            setShowScheduleModal(false);
            setEditingId(null);
            setScheduleForm({ showName: '', day: 'Monday', time: '12:00', status: 'open', claimedBy: '', duration: 60 });
        } catch (err) {
            handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'schedule');
        }
    };

    const handleClaimSlot = async (slotId: string) => {
        try {
            await updateDoc(doc(db, 'schedule', slotId), {
                status: 'claimed',
                claimedBy: user?.uid,
                showName: `${userProfile?.username}'s Show`
            });
            // Award reputation
            await addDoc(collection(db, 'reputationLogs'), {
                userId: user?.uid,
                points: 10,
                reason: 'Claimed Radio Slot',
                source: 'Staff Dashboard',
                timestamp: serverTimestamp()
            });
            
            // Update user score
            const userRef = doc(db, 'users', user?.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const currentScore = userSnap.data().reputationScore || 0;
                await updateDoc(userRef, { reputationScore: currentScore + 10 });
            }
        } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `schedule/${slotId}`);
        }
    };

    const handleSaveStaff = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                await updateDoc(doc(db, 'staff', editingId), staffForm);
            } else {
                await addDoc(collection(db, 'staff'), staffForm);
            }

            if (staffForm.uid) {
                await updateDoc(doc(db, 'users', staffForm.uid), { role: staffForm.role }).catch((err) => {
                    console.warn(`Could not sync staff role for user ${staffForm.uid} back to users collection:`, err);
                });
            }

            setShowStaffModal(false);
            setEditingId(null);
            setStaffForm({ uid: '', username: '', avatar: '', role: 'staff', position: '', department: '' });
        } catch (err) {
            handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'staff');
        }
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;
        try {
            const elevatedRoles = ['staff', 'dj', 'journalist', 'manager', 'admin', 'owner'];
            const staffUsername = selectedUser.username || selectedUser.email || 'Staff';
            await updateDoc(doc(db, 'users', selectedUser.id), {
                role: userForm.role,
                isVerified: userForm.isVerified,
                badges: userForm.badges
            });

            const staffQuery = query(collection(db, 'staff'), where('uid', '==', selectedUser.id), limit(1));
            const staffSnap = await getDocs(staffQuery);

            if (elevatedRoles.includes(userForm.role)) {
                if (!staffSnap.empty) {
                    await updateDoc(staffSnap.docs[0].ref, {
                        username: staffUsername,
                        avatar: selectedUser.avatar || '',
                        role: userForm.role,
                        uid: selectedUser.id
                    });
                } else {
                    await addDoc(collection(db, 'staff'), {
                        uid: selectedUser.id,
                        username: staffUsername,
                        avatar: selectedUser.avatar || '',
                        role: userForm.role,
                        position: userForm.role,
                        department: 'General'
                    });
                }
            } else if (!staffSnap.empty) {
                await deleteDoc(staffSnap.docs[0].ref);
            }

            setShowUserModal(false);
            setSelectedUser(null);
        } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `users/${selectedUser.id}`);
        }
    };

    const handleSavePartner = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                await updateDoc(doc(db, 'partners', editingId), partnerForm);
            } else {
                await addDoc(collection(db, 'partners'), partnerForm);
            }
            setShowPartnerModal(false);
            setEditingId(null);
            setPartnerForm({ name: '', logo: '', website: '' });
        } catch (err) {
            handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'partners');
        }
    };

    const handleSaveBanner = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingBannerId) {
                await updateDoc(doc(db, 'banners', editingBannerId), bannerForm);
            } else {
                await addDoc(collection(db, 'banners'), bannerForm);
            }
            setShowBannerModal(false);
            setEditingBannerId(null);
            setBannerForm(createEmptyBannerForm());
        } catch (err) {
            handleFirestoreError(err, editingBannerId ? OperationType.UPDATE : OperationType.CREATE, 'banners');
        }
    };

    const handleOpenAddBannerModal = () => {
        setEditingBannerId(null);
        setBannerForm(createEmptyBannerForm());
        setShowBannerModal(true);
    };

    const handleOpenEditBannerModal = (banner: any) => {
        setEditingBannerId(banner.id);
        setBannerForm({
            title: banner.title || '',
            topic: banner.topic || '',
            image: banner.image || '',
            link: banner.link || '',
            active: Boolean(banner.active),
        });
        setShowBannerModal(true);
    };

    const handleToggleSystemSetting = async (setting: string, value: boolean) => {
        try {
            await setDoc(doc(db, 'settings', 'global'), { [setting]: value }, { merge: true });
        } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, 'settings/global');
        }
    };

    const handleUpdateSystemSettingString = async (setting: string, value: string) => {
        try {
            await setDoc(doc(db, 'settings', 'global'), { [setting]: value }, { merge: true });
        } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, 'settings/global');
        }
    };

    const handleSaveCode = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const codeRef = doc(db, 'redeemCodes', codeForm.code.toUpperCase());
            const codeSnap = await getDoc(codeRef);
            if (codeSnap.exists() && !editingId) {
                toast.error("This code already exists.");
                return;
            }
            await setDoc(codeRef, {
                credits: codeForm.credits,
                usesLeft: codeForm.usesLeft,
                createdAt: serverTimestamp(),
                createdBy: userProfile?.uid
            }, { merge: true });
            
            toast.success("Code saved!");
            setShowCodeModal(false);
            setCodeForm({ code: '', credits: 100, usesLeft: 1 });
            setEditingId(null);
        } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, 'redeemCodes');
        }
    };

    const role = userProfile?.role || 'member';

    const categories = [
        { 
            name: 'General Staff', 
            allowedRoles: ['admin', 'owner', 'manager', 'staff', 'dj', 'journalist'],
            items: [ { id: 'overview', name: 'Overview', icon: Shield } ]
        },
        {
            name: 'Radio DJs',
            allowedRoles: ['admin', 'owner', 'manager', 'dj'],
            items: [ 
                { id: 'schedule', name: 'Timetable Management', icon: Calendar },
                { id: 'dj-tools', name: 'DJ Workspace', icon: Headphones }
            ]
        },
        {
            name: 'Journalists & Editors',
            allowedRoles: ['admin', 'owner', 'manager', 'journalist'],
            items: [ { id: 'editorial', name: 'Editorial Suite', icon: FileText } ]
        },
        {
            name: 'Management',
            allowedRoles: ['admin', 'owner', 'manager'],
            items: [
                { id: 'applications', name: 'Job Applications', icon: Users },
                { id: 'messages', name: 'Site Messages', icon: MessageSquare },
            ]
        },
        {
            name: 'Administrators',
            allowedRoles: ['admin', 'owner'],
            items: [
                { id: 'staff', name: 'Staff Directory', icon: Settings },
                { id: 'users', name: 'User Database', icon: Users },
                { id: 'branding', name: 'Banners & Partners', icon: Layers },
                { id: 'shop-settings', name: 'Credit Codes', icon: Zap },
                { id: 'audit-logs', name: 'Audit Logs', icon: FileText },
                { id: 'system-settings', name: 'System Settings', icon: Activity },
            ]
        }
    ];

    const recentActiveUsers = users.filter(u => {
        if (!u.lastActive) return false;
        const lastActive = u.lastActive?.seconds ? new Date(u.lastActive.seconds * 1000) : new Date(u.lastActive);
        const diff = Date.now() - lastActive.getTime();
        return diff < 48 * 60 * 60 * 1000;
    });

    return (
        <div className="min-h-screen bg-[#0a0b0f] flex flex-col font-sans text-sm selection:bg-white selection:text-black">
            <audio ref={audioRef} src={streamUrl || undefined} crossOrigin="anonymous" preload="none" />
            
            {/* Top Navigation */}
            <div className="bg-goodwood-card border-b border-goodwood-border px-6 py-4 flex items-center justify-between sticky top-0 z-40 shadow-xl">
                <div className="flex items-center gap-4">
                    <Link to="/" className="text-2xl font-black text-white italic tracking-tighter uppercase hover:text-gray-300 transition-colors">GOODWOOD</Link>
                    <span className="bg-emerald-600 text-white px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest hidden md:inline-block">Staff</span>
                </div>
                <div className="flex items-center gap-4">
                    <Link to="/" className="text-gray-400 hover:text-white font-bold text-xs uppercase tracking-widest transition-colors hidden md:inline-block">Back to Home</Link>
                    <div className="h-6 w-px bg-goodwood-border hidden md:inline-block" />
                    <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                            <p className="text-white font-bold text-xs leading-none">{userProfile?.username}</p>
                            <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest mt-1 leading-none">{userProfile?.role}</p>
                        </div>
                        {userProfile?.avatar ? (
                            <img src={userProfile.avatar} className="w-8 h-8 rounded-full border border-gray-500 object-cover" alt="Avatar" />
                        ) : (
                            <div className="w-8 h-8 rounded-full border border-gray-500 bg-emerald-900 flex items-center justify-center">
                                <span className="text-xs font-bold text-white">{userProfile?.username?.charAt(0) || '?'}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 container mx-auto max-w-7xl py-8 px-4 flex flex-col md:flex-row gap-8 mb-24">
                {/* Sidebar */}
                <div className="w-full md:w-64 space-y-6">
                    {categories.filter(cat => cat.allowedRoles.includes(role)).map(category => (
                        <div key={category.name} className="space-y-2">
                            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-4">{category.name}</h3>
                            <div className="space-y-1">
                                {category.items.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-bold transition-all ${activeTab === tab.id ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                                    >
                                        <tab.icon size={18} />
                                        {tab.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 bg-goodwood-card border border-goodwood-border rounded-xl p-6">
                    {activeTab === 'overview' && (
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-6">Overview</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                                <div className="bg-goodwood-dark/50 border border-goodwood-border rounded-xl p-6 shadow-xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 group-hover:opacity-20 transition-all">
                                        <Users size={48} className="text-blue-500" />
                                    </div>
                                    <h3 className="text-gray-500 font-black uppercase tracking-[0.2em] text-[10px] mb-2">Total Community</h3>
                                    <p className="text-4xl font-black text-white italic tracking-tighter">{users.length}</p>
                                    <div className="mt-4 flex items-center gap-2">
                                        <div className="flex -space-x-2">
                                            {users.slice(0, 3).map((u, i) => (
                                                <div key={i} className="w-6 h-6 rounded-full border border-goodwood-dark bg-goodwood-card flex items-center justify-center text-[8px] font-bold text-gray-400">
                                                    {u.username?.charAt(0)}
                                                </div>
                                            ))}
                                        </div>
                                        <span className="text-[10px] text-gray-600 font-bold">Latest users</span>
                                    </div>
                                </div>
                                <div className="bg-goodwood-dark/50 border border-goodwood-border rounded-xl p-6 shadow-xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 group-hover:opacity-20 transition-all">
                                        <FileText size={48} className="text-yellow-500" />
                                    </div>
                                    <h3 className="text-gray-500 font-black uppercase tracking-[0.2em] text-[10px] mb-2">Pending Proposals</h3>
                                    <p className="text-4xl font-black text-white italic tracking-tighter">{articles.filter(a => a.status === 'idea').length}</p>
                                    <div className="mt-4 flex items-center gap-2">
                                        <div className="px-2 py-0.5 bg-yellow-500/10 text-yellow-500 rounded text-[9px] font-black uppercase">Requires Action</div>
                                    </div>
                                </div>
                                <div className="bg-goodwood-dark/50 border border-goodwood-border rounded-xl p-6 shadow-xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 group-hover:opacity-20 transition-all">
                                        <MessageSquare size={48} className="text-green-500" />
                                    </div>
                                    <h3 className="text-gray-500 font-black uppercase tracking-[0.2em] text-[10px] mb-2">Radio Messages</h3>
                                    <p className="text-4xl font-black text-white italic tracking-tighter">{messages.length}</p>
                                    <div className="mt-4 flex items-center gap-2 text-green-400">
                                        <Radio size={12} className="animate-pulse" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Live Feed</span>
                                    </div>
                                </div>
                                <div className="bg-goodwood-dark/50 border border-goodwood-border rounded-xl p-6 shadow-xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 group-hover:opacity-20 transition-all">
                                        <Shield size={48} className="text-emerald-500" />
                                    </div>
                                    <h3 className="text-gray-500 font-black uppercase tracking-[0.2em] text-[10px] mb-2">Staff Operations</h3>
                                    <p className="text-4xl font-black text-white italic tracking-tighter">{staff.length}</p>
                                    <div className="mt-4 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">All systems nominal</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-goodwood-dark/30 border border-goodwood-border rounded-xl p-6 backdrop-blur-sm">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                                            <Shield size={16} className="text-emerald-400" /> Recent Applications
                                        </h3>
                                        <button onClick={() => setActiveTab('applications')} className="text-[10px] text-emerald-400 font-bold uppercase hover:underline">View All</button>
                                    </div>
                                    <div className="space-y-3">
                                        {applications.slice(0, 5).map(app => (
                                            <div key={app.id} className="flex justify-between items-center bg-goodwood-card/50 p-4 rounded-xl border border-white/[0.03] group hover:border-white/10 transition-all">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-goodwood-dark border border-goodwood-border flex items-center justify-center text-xs font-black text-gray-500">
                                                        {app.username?.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-white font-bold text-sm tracking-tight">{app.username}</p>
                                                        <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{app.role}</p>
                                                    </div>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                                                    app.status === 'approved' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                                                    app.status === 'rejected' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 
                                                    'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                                }`}>
                                                    {app.status || 'Pending'}
                                                </span>
                                            </div>
                                        ))}
                                        {applications.length === 0 && (
                                            <div className="text-center py-10 border border-dashed border-goodwood-border rounded-xl opacity-30">
                                                <p className="text-xs font-bold uppercase tracking-widest italic">No pending applications</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-goodwood-dark/30 border border-goodwood-border rounded-xl p-6 backdrop-blur-sm">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                                            <MessageSquare size={16} className="text-blue-400" /> Recent Inquiries
                                        </h3>
                                        <button onClick={() => setActiveTab('radio')} className="text-[10px] text-blue-400 font-bold uppercase hover:underline">Manage All</button>
                                    </div>
                                    <div className="space-y-3">
                                        {messages.slice(0, 5).map(msg => (
                                            <div key={msg.id} className="bg-goodwood-card/50 p-4 rounded-xl border border-white/[0.03] group">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <p className="text-white font-bold text-sm tracking-tight">{msg.name}</p>
                                                        <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{msg.department}</p>
                                                    </div>
                                                    <span className="text-emerald-400 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-emerald-400/10 rounded">{msg.type || 'General'}</span>
                                                </div>
                                                <p className="text-gray-300 text-xs leading-relaxed line-clamp-2 italic">"{msg.message || msg.text}"</p>
                                            </div>
                                        ))}
                                        {messages.length === 0 && (
                                            <div className="text-center py-10 border border-dashed border-goodwood-border rounded-xl opacity-30">
                                                <p className="text-xs font-bold uppercase tracking-widest italic">No recent inquiries</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'applications' && (
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-6">Job Applications</h2>
                            <div className="space-y-4">
                                {applications.length === 0 ? <p className="text-gray-400">No applications found.</p> : applications.map(app => (
                                    <div key={app.id} className="bg-goodwood-dark border border-goodwood-border rounded-lg p-4">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="text-white font-bold text-lg">{app.username} - <span className="text-emerald-400">{app.role}</span></h3>
                                                <p className="text-gray-400 text-sm">Discord: {app.discordId} | Timezone: {app.timezone}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${app.status === 'approved' ? 'bg-green-500/20 text-green-400' : app.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                                    {app.status || 'Pending'}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-gray-300 text-sm mb-4 bg-black/20 p-3 rounded"><strong>Reason:</strong> {app.reason}</p>
                                        {app.additionalInfo && <p className="text-gray-300 text-sm mb-4 bg-black/20 p-3 rounded"><strong>Additional Info:</strong> {app.additionalInfo}</p>}
                                        {app.audioUrl && (
                                            <div className="mb-4 bg-black/20 p-3 rounded flex flex-col gap-2">
                                                <strong className="text-gray-300 text-sm">Audio Demo (Presenter Role):</strong>
                                                <audio controls src={app.audioUrl} className="w-full h-8" />
                                            </div>
                                        )}
                                        <div className="flex gap-2">
                                            <button onClick={() => handleUpdateAppStatus(app, 'approved')} className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-bold"><CheckCircle size={16}/> Approve</button>
                                            <button onClick={() => handleUpdateAppStatus(app, 'rejected')} className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm font-bold"><XCircle size={16}/> Reject</button>
                                            <button onClick={() => handleDeleteDoc('applications', app.id)} className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm font-bold ml-auto"><Trash2 size={16}/> Delete</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'messages' && (
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-6">Site Enquiries</h2>
                            <div className="space-y-4">
                                {messages.filter(m => m.department !== 'Radio').length === 0 ? <p className="text-gray-400">No site enquiries found.</p> : messages.filter(m => m.department !== 'Radio').map(msg => (
                                    <div key={msg.id} className="bg-goodwood-dark border border-goodwood-border rounded-lg p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h3 className="text-white font-bold">{msg.name} <span className="text-gray-500 text-sm font-normal">({msg.email})</span></h3>
                                                <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest">{msg.type} - {msg.department}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleDeleteDoc('enquiries', msg.id)} className="text-blue-500 hover:text-blue-400 font-bold text-sm bg-blue-500/10 px-3 py-1 rounded">Mark as Resolved</button>
                                                <button onClick={() => handleDeleteDoc('enquiries', msg.id)} className="text-gray-500 hover:text-red-500"><Trash2 size={18}/></button>
                                            </div>
                                        </div>
                                        <p className="text-gray-300 text-sm mt-2">{msg.message}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'dj-tools' && (
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-6">DJ Workspace</h2>
                            <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-goodwood-dark border border-goodwood-border rounded-xl p-6">
                                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Radio size={16} className="text-blue-500" /> Currently On Air
                                    </h3>
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 rounded-lg bg-emerald-900 overflow-hidden flex items-center justify-center border border-white/10 shadow-lg shrink-0">
                                            {radioData?.now_playing?.song?.art ? (
                                                <img src={radioData.now_playing.song.art} alt="Art" className="w-full h-full object-cover" />
                                            ) : (
                                                <Radio size={24} className="text-gray-500" />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-white font-bold truncate text-lg">{radioData?.now_playing?.song?.title || "Loading..."}</p>
                                            <p className="text-gray-400 text-sm truncate">{radioData?.now_playing?.song?.artist || "-"}</p>
                                            {radioData?.live?.is_live && (
                                                <span className="inline-flex items-center gap-1 text-[10px] bg-red-600/20 text-red-500 px-2 py-0.5 rounded uppercase mt-2 font-black tracking-widest mr-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Live: {radioData.live.streamer_name}
                                                </span>
                                            )}
                                            {radioData?.listeners && (
                                                <span className="inline-flex items-center gap-1 text-[10px] bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded uppercase mt-2 font-black tracking-widest">
                                                    <Users size={10} /> Listeners: {radioData.listeners.total}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <h3 className="text-lg font-bold text-white mb-4 border-b border-goodwood-border pb-2">Live Studio Requests</h3>
                            <div className="space-y-4">
                                {messages.filter(m => m.department === 'Radio').length === 0 ? <p className="text-gray-400">No live requests from the player right now.</p> : messages.filter(m => m.department === 'Radio').map(msg => (
                                    <div key={msg.id} className="bg-gradient-to-r from-emerald-900/30 to-[#0f1014] border-l-4 border-l-emerald-500 border border-t-white/5 border-b-white/5 border-r-white/5 shadow-2xl rounded-r-lg p-5 relative overflow-hidden group">
                                        <div className="absolute -right-10 -top-10 opacity-5 group-hover:opacity-10 transition-opacity">
                                            <Headphones size={120} />
                                        </div>
                                        <div className="flex justify-between items-start mb-3 relative z-10">
                                            <div className="flex items-center gap-3">
                                                {msg.avatar ? (
                                                    <img src={msg.avatar} alt={msg.name} className="w-10 h-10 rounded-full object-cover border border-emerald-500/30 shadow-md" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 shadow-md">
                                                        <span className="text-emerald-400 font-black text-lg">{msg.name.charAt(0).toUpperCase()}</span>
                                                    </div>
                                                )}
                                                <div>
                                                    <h3 className="text-white font-bold text-lg leading-tight">{msg.name}</h3>
                                                    <span className="text-emerald-400 text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full">{msg.type}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleDeleteDoc('enquiries', msg.id)} className="text-white hover:text-emerald-900 font-bold text-[10px] uppercase tracking-widest bg-emerald-600 hover:bg-emerald-400 transition-colors px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                                                   <Check size={14} /> Fulfill
                                                </button>
                                            </div>
                                        </div>
                                        <div className="bg-black/30 p-4 rounded-lg relative z-10 border border-white/5">
                                            <p className="text-gray-200 text-sm italic font-medium leading-relaxed">"{msg.message}"</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'editorial' && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-white">Editorial Suite</h2>
                                <Link 
                                    to="/staff/article/new" 
                                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-emerald-900/20"
                                >
                                    <Edit3 size={18} /> 
                                    Write Article
                                </Link>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Link to="/staff/ideas-pool" className="bg-goodwood-dark border border-goodwood-border rounded-xl p-5 shadow-inner hover:border-emerald-500/40 transition-colors">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <Layers size={16} className="text-emerald-400" />
                                            <h3 className="text-sm font-black text-white uppercase tracking-widest">Ideas Pool</h3>
                                        </div>
                                        <span className="bg-black/40 text-[10px] text-gray-400 px-2 py-0.5 rounded-full font-bold">
                                            {articles.filter(a => a.status === 'idea').length}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400 mb-4">Triage and claim fresh story ideas with filters, search, and faster assignment actions.</p>
                                    <div className="text-emerald-400 text-xs font-black uppercase tracking-widest">Open Page</div>
                                </Link>

                                <Link to="/staff/my-workflow" className="bg-goodwood-dark border border-goodwood-border rounded-xl p-5 shadow-inner hover:border-blue-500/40 transition-colors">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <Edit3 size={16} className="text-blue-400" />
                                            <h3 className="text-sm font-black text-white uppercase tracking-widest">My Workflow</h3>
                                        </div>
                                        <span className="bg-black/40 text-[10px] text-gray-400 px-2 py-0.5 rounded-full font-bold">
                                            {articles.filter(a => (a.status === 'draft' || a.status === 'review' || a.status === 'rejected') && a.authorId === user?.uid).length}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400 mb-4">Track your drafts, resubmit revisions, and jump directly into writing flow.</p>
                                    <div className="text-blue-400 text-xs font-black uppercase tracking-widest">Open Page</div>
                                </Link>

                                <Link to="/staff/editorial-queue" className="bg-goodwood-dark border border-goodwood-border rounded-xl p-5 shadow-inner hover:border-yellow-500/40 transition-colors">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <Shield size={16} className="text-yellow-400" />
                                            <h3 className="text-sm font-black text-white uppercase tracking-widest">Editorial Queue</h3>
                                        </div>
                                        <span className="bg-black/40 text-[10px] text-gray-400 px-2 py-0.5 rounded-full font-bold">
                                            {articles.filter(a => a.status === 'review').length}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400 mb-4">Approve or reject submissions with publication and reputation flow in one place.</p>
                                    <div className="text-yellow-400 text-xs font-black uppercase tracking-widest">Open Page</div>
                                </Link>
                            </div>
                        </div>
                    )}

                    {activeTab === 'schedule' && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-2">Radio Timetable</h2>
                                    <p className="text-gray-400 text-sm">Claim available slots to broadcast on Goodwood FM. Schedule is in UTC.</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setWeekOffset(w => w - 1)} className="px-3 py-1 bg-goodwood-dark border border-goodwood-border rounded text-xs font-bold text-gray-400 hover:text-white">&larr; Previous Week</button>
                                    <button onClick={() => setWeekOffset(0)} className="px-3 py-1 bg-goodwood-dark border border-goodwood-border rounded text-xs font-bold text-gray-400 hover:text-white">This Week</button>
                                    <button onClick={() => setWeekOffset(w => w + 1)} className="px-3 py-1 bg-goodwood-dark border border-goodwood-border rounded text-xs font-bold text-gray-400 hover:text-white">Next Week &rarr;</button>
                                </div>
                            </div>
                            <div className="bg-goodwood-dark border border-goodwood-border rounded-xl overflow-hidden shadow-2xl">
                                <div className="grid grid-cols-8 border-b border-white/5 bg-goodwood-card/50">
                                    <div className="p-3 text-[10px] font-black uppercase text-gray-500 border-r border-white/5 flex items-center justify-center">Time (UTC)</div>
                                    {getDatesForThisWeek(weekOffset).map(({ dayString, formattedString }) => (
                                        <div key={dayString} className="p-3 flex items-center justify-center flex-col text-[10px] font-black uppercase text-gray-400 text-center border-r border-white/5 last:border-r-0">
                                            <span>{dayString.slice(0, 3)}</span>
                                            <span className="text-[8px] opacity-70 text-gray-500 leading-none mt-1">{formattedString}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                                    {Array.from({ length: 24 }).map((_, i) => {
                                        const hour = `${i.toString().padStart(2, '0')}:00`;
                                        return (
                                            <div key={hour} className="grid grid-cols-8 border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]">
                                                <div className="p-3 text-[10px] font-medium text-gray-500 border-r border-white/5 flex items-center justify-center bg-goodwood-card/20">
                                                    {hour}
                                                </div>
                                                {getDatesForThisWeek(weekOffset).map(({ dateObj, dayString }) => {
                                                    const day = dayString;
                                                    const slot = schedule.find(s => s.day === day && s.time === hour);
                                                    const isClaimed = slot && slot.status === 'claimed';
                                                    const isOwnSlot = slot && slot.claimedBy === user?.uid;
                                                    
                                                    const now = new Date();
                                                    // Convert UTC to local correctly to avoid cross-day shift
                                                    const slotTimeObj = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), i, 0, 0, 0));
                                                    // If the dateObj local date representation differs from its local day-of-week, we should just use its local year/month/date. (Because getDatesForThisWeek uses local start-of-day).
                                                    const isPast = slotTimeObj.getTime() < now.getTime();

                                                    return (
                                                        <div key={`${day}-${hour}`} className="border-r border-white/5 last:border-r-0 p-1 relative min-h-[60px]">
                                                            {slot ? (
                                                                <div className={`w-full h-full rounded border p-2 flex flex-col justify-center items-center text-center cursor-pointer transition-all ${
                                                                    isOwnSlot 
                                                                    ? 'bg-emerald-900/40 border-emerald-500/50 hover:bg-emerald-900/60' 
                                                                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                                                                }`}
                                                                onClick={() => {
                                                                    if (userProfile?.role === 'admin' || isOwnSlot) {
                                                                        handleDeleteDoc('schedule', slot.id);
                                                                    }
                                                                }}
                                                                >
                                                                    <UserAvatar userId={slot.claimedBy} fallbackName={slot.authorName} className="w-6 h-6 rounded-full mb-1 border border-goodwood-border shadow-sm object-cover" />
                                                                    <span className={`text-[9px] font-bold uppercase truncate w-full mt-1 ${isOwnSlot ? 'text-emerald-300' : 'text-gray-300'}`}>
                                                                        {slot.showName}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <button 
                                                                    disabled={isPast && userProfile?.role !== 'admin'}
                                                                    onClick={async () => {
                                                                        if (isPast && userProfile?.role !== 'admin') return;
                                                                        try {
                                                                            await addDoc(collection(db, 'schedule'), {
                                                                                showName: `${userProfile?.username}'s Show`,
                                                                                day,
                                                                                time: hour,
                                                                                status: 'claimed',
                                                                                claimedBy: user?.uid,
                                                                                authorName: userProfile?.username,
                                                                                duration: 60
                                                                            });
                                                                            // Add rep
                                                                            const userRef = doc(db, 'users', user!.uid);
                                                                            const userSnap = await getDoc(userRef);
                                                                            if (userSnap.exists()) {
                                                                                const currentScore = userSnap.data().reputationScore || 0;
                                                                                await updateDoc(userRef, { reputationScore: currentScore + 10 });
                                                                            }
                                                                        } catch (err) {
                                                                            handleFirestoreError(err, OperationType.CREATE, 'schedule');
                                                                        }
                                                                    }}
                                                                    className={`w-full h-full rounded border border-dashed flex items-center justify-center font-black text-[10px] uppercase transition-all ${
                                                                        isPast && userProfile?.role !== 'admin'
                                                                        ? 'border-transparent bg-transparent text-gray-500/30 cursor-not-allowed'
                                                                        : 'border-white/10 bg-transparent hover:bg-green-500/10 hover:border-green-500/30 text-transparent hover:text-green-500 cursor-pointer'
                                                                    }`}
                                                                >
                                                                    {isPast && userProfile?.role !== 'admin' ? 'Past' : 'Claim'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'staff' && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-white">Staff Management</h2>
                                <button onClick={() => { setEditingId(null); setStaffForm({ uid: '', username: '', avatar: '', role: 'staff', position: '', department: '' }); setShowStaffModal(true); }} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold"><Plus size={18}/> Add Staff</button>
                            </div>
                            <div className="space-y-6">
                                {Array.from(new Set([...staff.map(s => s.department || 'General'), 'Leadership', 'Management', 'Radio'])).map(dept => {
                                    const deptStaff = staff.filter(s => (s.department === dept) || (!s.department && dept === 'General'));
                                    if (deptStaff.length === 0) return null;
                                    return (
                                        <details key={dept} className="group bg-goodwood-dark/50 border border-goodwood-border rounded-lg overflow-hidden" open>
                                            <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors">
                                                <h3 className="text-white font-bold uppercase tracking-widest text-sm">{dept} Team <span className="text-gray-500 font-normal ml-2">({deptStaff.length})</span></h3>
                                                <ChevronDown size={18} className="text-gray-500 group-open:rotate-180 transition-transform" />
                                            </summary>
                                            <div className="p-4 space-y-4 border-t border-goodwood-border bg-goodwood-dark">
                                                {deptStaff.map(s => (
                                                    <div key={s.id} className="bg-goodwood-card border border-goodwood-border rounded-lg p-4 flex justify-between items-center">
                                                        <div className="flex items-center gap-4">
                                                            {s.avatar ? (
                                                                <img src={s.avatar} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-gray-600" />
                                                            ) : (
                                                                <div className="w-10 h-10 rounded-full bg-emerald-900 flex items-center justify-center text-white font-bold">
                                                                    {s.username?.charAt(0) || '?'}
                                                                </div>
                                                            )}
                                                            <div>
                                                                <h3 className="text-white font-bold">{s.username}</h3>
                                                                <p className="text-gray-400 text-xs">{s.position || s.role || 'Staff Member'}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button 
                                                                onClick={() => {
                                                                    setEditingId(s.id);
                                                                    setStaffForm({ uid: s.uid || '', username: s.username, avatar: s.avatar || '', role: s.role, position: s.position, department: s.department });
                                                                    setShowStaffModal(true);
                                                                }} 
                                                                className="text-emerald-400 hover:text-emerald-300 font-bold text-sm bg-emerald-400/10 px-3 py-1 rounded"
                                                            >
                                                                Edit
                                                            </button>
                                                            <button onClick={() => handleDeleteDoc('staff', s.id)} className="text-red-500 hover:text-red-400 bg-red-500/10 p-2 rounded"><Trash2 size={16}/></button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </details>
                                    );
                                })}
                                {staff.length === 0 && <p className="text-gray-400">No staff found.</p>}
                            </div>
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-white">User Management</h2>
                            </div>
                            <div className="space-y-4">
                                {users.length === 0 ? <p className="text-gray-400">No users found.</p> : users.map(u => (
                                    <div key={u.id} className="bg-goodwood-dark border border-goodwood-border rounded-lg p-4 flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-emerald-900 flex items-center justify-center text-white font-bold">
                                                {u.username?.charAt(0) || '?'}
                                            </div>
                                            <div>
                                                <h3 className="text-white font-bold flex items-center gap-2">
                                                    {u.username}
                                                    {u.isVerified && <CheckCircle size={14} className="text-blue-400" />}
                                                </h3>
                                                <p className="text-gray-400 text-xs">{u.email} | Role: {u.role || 'member'}</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                setSelectedUser(u);
                                                setUserForm({
                                                    role: u.role || 'member',
                                                    isVerified: u.isVerified || false,
                                                    badges: u.badges || []
                                                });
                                                setShowUserModal(true);
                                            }} 
                                            className="text-emerald-400 hover:text-emerald-300 font-bold text-sm"
                                        >
                                            Edit
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {activeTab === 'branding' && (
                        <div>
                            <div className="mb-10">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-2xl font-bold text-white">Banners Management</h2>
                                    <button onClick={handleOpenAddBannerModal} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold"><Plus size={18}/> Add Banner</button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {banners.map(b => (
                                        <div key={b.id} className="bg-goodwood-dark border border-goodwood-border rounded-lg overflow-hidden group">
                                            {b.image && <img src={b.image} alt={b.title} className="w-full h-32 object-cover opacity-80 group-hover:opacity-100 transition-opacity" />}
                                            <div className="p-4 flex justify-between items-center">
                                                <div>
                                                    <h3 className="text-white font-bold">{b.title}</h3>
                                                    <a href={b.link} target="_blank" rel="noopener noreferrer" className="text-emerald-400 text-xs hover:text-emerald-300">{b.link}</a>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${b.active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                        {b.active ? 'ACTIVE' : 'INACTIVE'}
                                                    </span>
                                                    <button onClick={() => handleOpenEditBannerModal(b)} className="p-2 text-emerald-400 hover:text-emerald-300"><Edit3 size={16} /></button>
                                                    <button onClick={() => handleDeleteDoc('banners', b.id)} className="p-2 text-red-400 hover:text-red-300"><Trash2 size={16} /></button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {banners.length === 0 && <p className="text-gray-400 col-span-full">No banners found.</p>}
                                </div>
                            </div>
                            
                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-2xl font-bold text-white">Partners Management</h2>
                                    <button onClick={() => { setEditingId(null); setPartnerForm({ name: '', logo: '', website: '' }); setShowPartnerModal(true); }} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold"><Plus size={18}/> Add Partner</button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                    {partners.map(p => (
                                        <div key={p.id} className="bg-goodwood-dark border border-goodwood-border rounded-lg p-4 flex flex-col items-center gap-3 text-center">
                                            {p.logo ? (
                                                <img src={p.logo} alt={p.name} className="w-16 h-16 object-cover rounded-xl" />
                                            ) : (
                                                <div className="w-16 h-16 rounded-xl bg-emerald-900 border border-goodwood-border flex items-center justify-center">
                                                    <span className="text-white font-black text-xl">{p.name.charAt(0)}</span>
                                                </div>
                                            )}
                                            <div>
                                                <h3 className="text-white font-bold">{p.name}</h3>
                                                <a href={p.website} target="_blank" rel="noopener noreferrer" className="text-emerald-400 text-xs hover:text-emerald-300">{p.website}</a>
                                            </div>
                                            <div className="flex items-center gap-2 mt-2">
                                                <button onClick={() => { setEditingId(p.id); setPartnerForm({ name: p.name, logo: p.logo, website: p.website }); setShowPartnerModal(true); }} className="p-2 text-emerald-400 hover:bg-emerald-400/10 rounded transition-colors"><Edit3 size={16} /></button>
                                                <button onClick={() => handleDeleteDoc('partners', p.id)} className="p-2 text-red-400 hover:bg-red-400/10 rounded transition-colors"><Trash2 size={16} /></button>
                                            </div>
                                        </div>
                                    ))}
                                    {partners.length === 0 && <p className="text-gray-400 col-span-full">No partners found.</p>}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'dj-connection' && (
                        <div>
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold text-white">Live Studio Connection</h2>
                                <p className="text-gray-400 text-sm">Use these details to connect your broadcast software (e.g. BUTT, OBS, Mixxx) to the stream.</p>
                            </div>
                            <div className="bg-goodwood-dark border border-goodwood-border rounded-xl p-8 shadow-2xl max-w-2xl">
                                {loadingAzuracast ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                        <Loader2 className="animate-spin mb-4" size={32} />
                                        <p>Connecting to broadcast server...</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-4 bg-emerald-900/20 text-emerald-300 p-4 rounded-lg border border-emerald-500/20">
                                            <Info size={24} className="shrink-0" />
                                            <p className="text-sm font-medium">Broadcasting endpoints are ready.</p>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Server Type</label>
                                                <div className="bg-black/50 border border-white/5 rounded px-4 py-3 font-mono text-sm text-white">Icecast v2 / Shoutcast</div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Server Host / IP</label>
                                                <div className="bg-black/50 border border-white/5 rounded px-4 py-3 font-mono text-sm text-emerald-400 select-all">{systemSettings?.serverUrl || 'stream.domain.com'}</div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Port</label>
                                                <div className="bg-black/50 border border-white/5 rounded px-4 py-3 font-mono text-sm text-emerald-400 select-all">{systemSettings?.serverPort || '8000'}</div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Mountpoint</label>
                                                <div className="bg-black/50 border border-white/5 rounded px-4 py-3 font-mono text-sm text-emerald-400 select-all">{systemSettings?.serverMountpoint || '/live'}</div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">DJ Username</label>
                                                <div className="bg-black/50 border border-white/5 rounded px-4 py-3 font-mono text-sm text-white select-all">{userProfile?.username || 'dj_username'}</div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">DJ Password</label>
                                                <div className="bg-black/50 border border-white/5 rounded px-4 py-3 justify-between items-center flex group">
                                                    <span className="font-mono text-sm text-gray-500 group-hover:text-white transition-colors blur-sm group-hover:blur-none select-all transition-all">{systemSettings?.serverPassword || 'hunter2_configured'}</span>
                                                    <span className="text-[10px] uppercase font-bold text-gray-600 group-hover:opacity-0">Hover to reveal</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    
                    {activeTab === 'shop-settings' && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-white">Credit Codes</h2>
                                    <p className="text-gray-400 text-sm">Create and manage redeemable codes for Goodwood Credits.</p>
                                </div>
                                <button onClick={() => {
                                    setEditingId(null);
                                    setCodeForm({ code: '', credits: 100, usesLeft: 1 });
                                    setShowCodeModal(true);
                                }} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold">
                                    <Plus size={18}/> New Code
                                </button>
                            </div>
                            
                            <div className="bg-goodwood-card border border-goodwood-border rounded-xl overflow-hidden shadow-2xl">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-[#12141a] border-b border-goodwood-border text-xs uppercase tracking-widest text-gray-400">
                                            <th className="p-4 font-bold">Code</th>
                                            <th className="p-4 font-bold">Credits</th>
                                            <th className="p-4 font-bold">Uses Left</th>
                                            <th className="p-4 font-bold hidden sm:table-cell">Created</th>
                                            <th className="p-4 font-boldtext-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-goodwood-border text-gray-300 text-sm">
                                        {redeemCodes.map(code => (
                                            <tr key={code.id} className="hover:bg-white/5 transition-colors group">
                                                <td className="p-4 font-mono text-emerald-400 font-bold">{code.id}</td>
                                                <td className="p-4 font-bold text-yellow-400">{code.credits}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${code.usesLeft > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-500'}`}>
                                                        {code.usesLeft}
                                                    </span>
                                                </td>
                                                <td className="p-4 hidden sm:table-cell text-xs text-gray-500">{formatDate(code.createdAt)}</td>
                                                <td className="p-4 text-right">
                                                    <div className="flex items-center gap-2">
                                                        <button 
                                                            onClick={() => {
                                                                setEditingId(code.id);
                                                                setCodeForm({ code: code.id, credits: code.credits, usesLeft: code.usesLeft });
                                                                setShowCodeModal(true);
                                                            }}
                                                            className="p-1 text-gray-500 hover:text-white transition-colors"
                                                        >
                                                            <Edit3 size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteDoc('redeemCodes', code.id)}
                                                            className="p-1 text-red-500 hover:text-red-400 transition-colors"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {redeemCodes.length === 0 && (
                                    <div className="p-8 text-center text-gray-500 text-sm">No redeem codes created yet.</div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'audit-logs' && (
                        <div>
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold text-white">Audit Logs</h2>
                                <p className="text-gray-400 text-sm">System and staff action records.</p>
                            </div>
                            
                            <div className="bg-goodwood-dark border border-goodwood-border rounded-xl overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm text-gray-400">
                                        <thead className="text-xs uppercase bg-black/40 text-gray-500">
                                            <tr>
                                                <th className="px-6 py-4">Action</th>
                                                <th className="px-6 py-4">User ID</th>
                                                <th className="px-6 py-4">Points</th>
                                                <th className="px-6 py-4">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {reputationLogs.length === 0 ? (
                                                <tr><td colSpan={4} className="px-6 py-4 text-center">No logs found</td></tr>
                                            ) : (
                                                reputationLogs.map(log => (
                                                    <tr key={log.id} className="hover:bg-white/[0.02]">
                                                        <td className="px-6 py-4 font-medium text-white">{log.reason}</td>
                                                        <td className="px-6 py-4 text-xs font-mono">{log.userId}</td>
                                                        <td className="px-6 py-4"><span className="text-green-400">+{log.points}</span></td>
                                                        <td className="px-6 py-4">{log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleString() : 'Just now'}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'system-settings' && (
                        <div>
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold text-white">System Settings</h2>
                                <p className="text-gray-400 text-sm">Advanced system configurations. Some settings require environment flags to be fully active.</p>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-goodwood-dark border border-goodwood-border rounded-xl p-6">
                                    <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
                                        <Radio className="text-emerald-500" />
                                        <h3 className="font-bold text-lg text-white">Streaming Engine (AzuraCast)</h3>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Server Host / IP</label>
                                            <input 
                                                type="text" 
                                                value={systemSettings?.serverUrl || ''} 
                                                onChange={(e) => handleUpdateSystemSettingString('serverUrl', e.target.value)}
                                                placeholder="e.g. stream.domain.com"
                                                className="w-full bg-black/50 border border-white/5 rounded px-4 py-3 font-mono text-sm text-emerald-400 focus:outline-none focus:border-emerald-500 transition-colors"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Port</label>
                                            <input 
                                                type="text" 
                                                value={systemSettings?.serverPort || ''} 
                                                onChange={(e) => handleUpdateSystemSettingString('serverPort', e.target.value)}
                                                placeholder="e.g. 8000"
                                                className="w-full bg-black/50 border border-white/5 rounded px-4 py-3 font-mono text-sm text-emerald-400 focus:outline-none focus:border-emerald-500 transition-colors"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Mountpoint</label>
                                            <input 
                                                type="text" 
                                                value={systemSettings?.serverMountpoint || ''} 
                                                onChange={(e) => handleUpdateSystemSettingString('serverMountpoint', e.target.value)}
                                                placeholder="e.g. /live"
                                                className="w-full bg-black/50 border border-white/5 rounded px-4 py-3 font-mono text-sm text-emerald-400 focus:outline-none focus:border-emerald-500 transition-colors"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">DJ Default Password</label>
                                            <input 
                                                type="text" 
                                                value={systemSettings?.serverPassword || ''} 
                                                onChange={(e) => handleUpdateSystemSettingString('serverPassword', e.target.value)}
                                                placeholder="Master DJ Connection Password"
                                                className="w-full bg-black/50 border border-white/5 rounded px-4 py-3 font-mono text-sm text-emerald-400 focus:outline-none focus:border-emerald-500 transition-colors"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-goodwood-dark border border-goodwood-border rounded-xl p-6">
                                    <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
                                        <Shield className="text-blue-500" />
                                        <h3 className="font-bold text-lg text-white">Security & Audit</h3>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-4 bg-black/40 rounded-lg border border-white/5">
                                            <div>
                                                <p className="text-sm font-bold text-white mb-1">Firewall Strict Mode</p>
                                                <p className="text-xs text-gray-500">Force all article endpoints to require Review.</p>
                                            </div>
                                            <button 
                                                onClick={() => handleToggleSystemSetting('firewallStrictMode', !systemSettings.firewallStrictMode)}
                                                className={`w-10 h-5 rounded-full relative transition-colors ${systemSettings.firewallStrictMode ? 'bg-emerald-600' : 'bg-gray-600'}`}
                                            >
                                                <span className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${systemSettings.firewallStrictMode ? 'right-1' : 'left-1'}`}></span>
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between p-4 bg-black/40 rounded-lg border border-white/5">
                                            <div>
                                                <p className="text-sm font-bold text-white mb-1">Maintenance Mode</p>
                                                <p className="text-xs text-gray-500">Lock non-admins out of the website.</p>
                                            </div>
                                            <button 
                                                onClick={() => handleToggleSystemSetting('maintenanceMode', !systemSettings.maintenanceMode)}
                                                className={`w-10 h-5 rounded-full relative transition-colors ${systemSettings.maintenanceMode ? 'bg-emerald-600' : 'bg-gray-600'}`}
                                            >
                                                <span className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${systemSettings.maintenanceMode ? 'right-1' : 'left-1'}`}></span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Fixed Bottom Radio Player */}
            <div className="fixed bottom-0 left-0 right-0 bg-goodwood-card border-t border-goodwood-border p-4 z-50">
                <div className="container mx-auto max-w-7xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-12 h-12 rounded bg-goodwood-dark border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                            {radioData?.now_playing?.song?.art ? (
                                <img src={radioData.now_playing.song.art} alt="Art" className="w-full h-full object-cover" />
                            ) : (
                                <Radio size={20} className="text-gray-500" />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h4 className="text-white font-bold text-sm truncate">{songTitle}</h4>
                            <p className="text-gray-400 text-xs truncate">{songArtist}</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-6 shrink-0">
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
            </div>

            {/* Modals */}
            <Modal 
                isOpen={showArticleModal} 
                onClose={() => setShowArticleModal(false)}
                title={editingId ? 'Edit Article' : 'Create Article Idea'}
            >
                <form onSubmit={handleSaveArticle} className="space-y-6">
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <Input 
                                label="Source URL"
                                type="url" 
                                placeholder="Paste URL to fetch details (e.g., BBC News)" 
                                value={articleForm.url} 
                                onChange={e => setArticleForm({...articleForm, url: e.target.value})} 
                            />
                        </div>
                        <div className="pt-5">
                            <button 
                                type="button" 
                                onClick={handleFetchFromUrl} 
                                className="h-[46px] px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-all active:scale-95 flex items-center gap-2"
                            >
                                <Zap size={16} /> Fetch
                            </button>
                        </div>
                    </div>
                    
                    <Input 
                        label="Article Title"
                        placeholder="e.g. New Goodwood FM Music Trends 2026" 
                        value={articleForm.title} 
                        onChange={e => setArticleForm({...articleForm, title: e.target.value})} 
                        required 
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Dropdown 
                            label="Category"
                            value={articleForm.category}
                            onChange={(val) => setArticleForm({...articleForm, category: val})}
                            options={ARTICLE_CATEGORIES}
                        />
                        <ImageUpload 
                            label="Cover Image"
                            value={articleForm.image} 
                            onChange={(base64) => setArticleForm({...articleForm, image: base64})} 
                        />
                    </div>

                    <TextArea 
                        label="Summary / TL;DR"
                        placeholder="Brief overview of the article..." 
                        value={articleForm.summary} 
                        onChange={e => setArticleForm({...articleForm, summary: e.target.value})} 
                        required 
                    />
                    
                    {articleForm.status !== 'idea' && (
                        <TextArea 
                            label="Main Content (Markdown)"
                            placeholder="Write your article here..." 
                            value={articleForm.content} 
                            onChange={e => setArticleForm({...articleForm, content: e.target.value})} 
                            required 
                            className="min-h-[300px] font-mono text-sm"
                        />
                    )}
                    
                    <div className="flex justify-end gap-3 pt-4 border-t border-goodwood-border">
                        <button type="button" onClick={() => setShowArticleModal(false)} className="px-6 py-2 text-gray-400 hover:text-white font-bold transition-colors">Cancel</button>
                        <button 
                            type="submit" 
                            disabled={isSaving}
                            className={`bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2 rounded-lg font-bold transition-all active:scale-95 flex items-center gap-2 ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isSaving ? <Clock className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                            {editingId ? 'Update Article' : 'Submit Idea'}
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={showScheduleModal}
                onClose={() => setShowScheduleModal(false)}
                title={editingId ? 'Edit Schedule Slot' : 'Add Schedule Slot'}
                maxWidth="max-w-md"
            >
                <form onSubmit={handleSaveSchedule} className="space-y-6">
                    <Input 
                        label="Show Name / Title"
                        placeholder="e.g. Midnight Goodwood FM Mix" 
                        value={scheduleForm.showName} 
                        onChange={e => setScheduleForm({...scheduleForm, showName: e.target.value})} 
                        required 
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                        <Dropdown 
                            label="Week Day"
                            value={scheduleForm.day}
                            onChange={(val) => setScheduleForm({...scheduleForm, day: val})}
                            options={['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => ({ value: d, label: d }))}
                        />
                        <Input 
                            label="Start Time"
                            type="time" 
                            value={scheduleForm.time} 
                            onChange={e => setScheduleForm({...scheduleForm, time: e.target.value})} 
                            required 
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-goodwood-border">
                        <button type="button" onClick={() => setShowScheduleModal(false)} className="px-6 py-2 text-gray-400 hover:text-white font-bold transition-colors">Cancel</button>
                        <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2 rounded-lg font-bold transition-all active:scale-95 flex items-center gap-2">
                            <Plus size={18} /> {editingId ? 'Update Slot' : 'Create Slot'}
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={showStaffModal}
                onClose={() => setShowStaffModal(false)}
                title={editingId ? 'Edit Staff Member' : 'Add Staff Member'}
                maxWidth="max-w-md"
            >
                <form onSubmit={handleSaveStaff} className="space-y-6">
                    {!editingId ? (
                        <Dropdown 
                            label="Target User"
                            value={staffForm.uid}
                            onChange={(val) => {
                                const matchedUser = users.find(u => u.id === val);
                                if (matchedUser) {
                                    setStaffForm(prev => ({
                                        ...prev,
                                        uid: matchedUser.id,
                                        username: matchedUser.username,
                                        avatar: matchedUser.avatar || ''
                                    }));
                                }
                            }}
                            options={[
                                { value: '', label: 'Select a user...' },
                                ...users.map(u => ({ value: u.id, label: u.username || 'Unknown User' }))
                            ]}
                        />
                    ) : (
                        <div className="flex items-center gap-4 bg-goodwood-dark/50 p-4 rounded-xl border border-goodwood-border">
                            {staffForm.avatar ? (
                                <img src={staffForm.avatar} alt="Avatar" className="w-12 h-12 rounded-full object-cover shadow-lg" />
                            ) : (
                                <div className="w-12 h-12 rounded-full bg-emerald-900 border border-goodwood-border flex items-center justify-center">
                                    <span className="text-white font-black text-xl">{staffForm.username.charAt(0)}</span>
                                </div>
                            )}
                            <span className="text-white font-bold">{staffForm.username}</span>
                        </div>
                    )}
                    
                    <Dropdown 
                        label="System Role"
                        value={staffForm.role}
                        onChange={(val) => setStaffForm({...staffForm, role: val})}
                        options={USER_ROLES}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Dropdown 
                            label="Department"
                            value={staffForm.department}
                            onChange={(val) => setStaffForm({...staffForm, department: val})}
                            options={DEPARTMENT_OPTIONS}
                        />
                        <Dropdown 
                            label="Position"
                            value={staffForm.position}
                            onChange={(val) => setStaffForm({...staffForm, position: val})}
                            options={POSITION_OPTIONS}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-goodwood-border">
                        <button type="button" onClick={() => setShowStaffModal(false)} className="px-6 py-2 text-gray-400 hover:text-white font-bold transition-colors">Cancel</button>
                        <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2 rounded-lg font-bold transition-all active:scale-95 flex items-center gap-2">
                             <Shield size={18} /> {editingId ? 'Save Changes' : 'Initialize Staff'}
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={showUserModal && !!selectedUser}
                onClose={() => {setShowUserModal(false); setSelectedUser(null);}}
                title={`User Identity: ${selectedUser?.username}`}
                maxWidth="max-w-md"
            >
                <form onSubmit={handleUpdateUser} className="space-y-6">
                    <Dropdown 
                        label="Account Role Authority"
                        value={userForm.role}
                        onChange={(val) => setUserForm({...userForm, role: val})}
                        options={USER_ROLES}
                    />
                    
                    <div className="flex items-center gap-3 p-4 bg-goodwood-dark/50 border border-goodwood-border rounded-lg">
                        <div className="flex items-center h-5">
                            <input 
                                type="checkbox" 
                                id="isVerified" 
                                checked={userForm.isVerified} 
                                onChange={e => setUserForm({...userForm, isVerified: e.target.checked})} 
                                className="w-5 h-5 rounded border-goodwood-border text-emerald-600 focus:ring-emerald-500 bg-goodwood-card" 
                            />
                        </div>
                        <div className="ml-2 text-sm">
                            <label htmlFor="isVerified" className="font-bold text-white flex items-center gap-2">
                                Verified Authority {userForm.isVerified && <CheckCircle size={14} className="text-blue-400" />}
                            </label>
                            <p className="text-gray-500 text-xs">Grants verified badge and higher reputation weight.</p>
                        </div>
                    </div>

                    <BadgeSelector 
                        selectedBadges={Array.isArray(userForm.badges) ? userForm.badges : []}
                        onChange={(badges) => setUserForm({...userForm, badges})}
                    />

                    <div className="flex justify-end gap-3 pt-4 border-t border-goodwood-border">
                        <button type="button" onClick={() => {setShowUserModal(false); setSelectedUser(null);}} className="px-6 py-2 text-gray-400 hover:text-white font-bold transition-colors">Abort</button>
                        <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2 rounded-lg font-bold transition-all active:scale-95 flex items-center gap-2">
                            <UserPlus size={18} /> Sync Permissions
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={showPartnerModal}
                onClose={() => setShowPartnerModal(false)}
                title={editingId ? 'Edit Partner' : 'Add Partner'}
                maxWidth="max-w-md"
            >
                <form onSubmit={handleSavePartner} className="space-y-6">
                    <Input 
                        label="Partner Name"
                        placeholder="e.g. Energy Drink Co" 
                        value={partnerForm.name} 
                        onChange={e => setPartnerForm({...partnerForm, name: e.target.value})} 
                        required 
                    />
                    <Input 
                        label="Website URL"
                        placeholder="https://..." 
                        value={partnerForm.website} 
                        onChange={e => setPartnerForm({...partnerForm, website: e.target.value})} 
                        required 
                    />
                    <ImageUpload 
                        label="Partner Logo"
                        value={partnerForm.logo} 
                        onChange={(base64) => setPartnerForm({...partnerForm, logo: base64})} 
                    />
                    <div className="flex justify-end gap-3 pt-4 border-t border-goodwood-border">
                        <button type="button" onClick={() => setShowPartnerModal(false)} className="px-6 py-2 text-gray-400 hover:text-white font-bold transition-colors">Cancel</button>
                        <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2 rounded-lg font-bold transition-all active:scale-95 flex items-center gap-2">
                            <Plus size={18} /> {editingId ? 'Save Changes' : 'Add Partner'}
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={showCodeModal}
                onClose={() => { setShowCodeModal(false); setEditingId(null); setCodeForm({ code: '', credits: 100, usesLeft: 1 }); }}
                title={editingId ? 'Edit Credit Code' : 'Create Credit Code'}
                maxWidth="max-w-md"
            >
                <form onSubmit={handleSaveCode} className="space-y-4">
                    <Input 
                        label="Code String"
                        placeholder="e.g. SUMMER2024"
                        value={codeForm.code} 
                        onChange={e => setCodeForm({...codeForm, code: e.target.value.toUpperCase()})}
                        disabled={!!editingId}
                        required
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input 
                            label="Credits"
                            type="number"
                            min="1"
                            value={codeForm.credits} 
                            onChange={e => setCodeForm({...codeForm, credits: parseInt(e.target.value) || 0})}
                            required
                        />
                        <Input 
                            label="Uses Left"
                            type="number"
                            min="1"
                            value={codeForm.usesLeft} 
                            onChange={e => setCodeForm({...codeForm, usesLeft: parseInt(e.target.value) || 0})}
                            required
                        />
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={() => setShowCodeModal(false)} className="px-4 py-2 text-gray-400 hover:text-white font-bold">Cancel</button>
                        <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold">Save Code</button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={showBannerModal}
                onClose={() => { setShowBannerModal(false); setEditingBannerId(null); setBannerForm(createEmptyBannerForm()); }}
                title={editingBannerId ? 'Edit Banner' : 'Add Banner'}
                maxWidth="max-w-md"
            >
                <form onSubmit={handleSaveBanner} className="space-y-6">
                    <Input 
                        label="Banner Title (Optional)"
                        placeholder="e.g. Summer Festival" 
                        value={bannerForm.title} 
                        onChange={e => setBannerForm({...bannerForm, title: e.target.value})} 
                    />
                    <Input 
                        label="Topic/Subtitle (Optional)"
                        placeholder="e.g. Featured Event" 
                        value={bannerForm.topic} 
                        onChange={e => setBannerForm({...bannerForm, topic: e.target.value})} 
                    />
                    <Input 
                        label="Target Link"
                        placeholder="https://..." 
                        value={bannerForm.link} 
                        onChange={e => setBannerForm({...bannerForm, link: e.target.value})} 
                        required 
                    />
                    <ImageUpload 
                        label="Banner Image"
                        value={bannerForm.image} 
                        onChange={(base64) => setBannerForm({...bannerForm, image: base64})} 
                    />
                    <div className="flex items-center gap-3 p-4 bg-goodwood-dark/50 border border-goodwood-border rounded-lg">
                        <input 
                            type="checkbox" 
                            id="isActiveBanner" 
                            checked={bannerForm.active} 
                            onChange={e => setBannerForm({...bannerForm, active: e.target.checked})} 
                            className="w-5 h-5 rounded border-goodwood-border text-emerald-600 focus:ring-emerald-500 bg-goodwood-card" 
                        />
                        <label htmlFor="isActiveBanner" className="font-bold text-white cursor-pointer">
                            Banner is Active (Visible on Homepage)
                        </label>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-goodwood-border">
                        <button type="button" onClick={() => { setShowBannerModal(false); setEditingBannerId(null); setBannerForm(createEmptyBannerForm()); }} className="px-6 py-2 text-gray-400 hover:text-white font-bold transition-colors">Cancel</button>
                        <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2 rounded-lg font-bold transition-all active:scale-95 flex items-center gap-2">
                            <CheckCircle size={18} /> {editingBannerId ? 'Save Changes' : 'Add Banner'}
                        </button>
                    </div>
                </form>
            </Modal>

            <ConfirmModal 
                isOpen={isConfirmDeleteOpen.isOpen}
                title="Confirm Action"
                message="Are you sure you want to perform this deletion? This action cannot be undone."
                onConfirm={confirmDeleteDoc}
                onCancel={() => setIsConfirmDeleteOpen({isOpen: false, collectionName: null, docId: null})}
            />
        </div>
    );
};
