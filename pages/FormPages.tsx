import React, { useState, useEffect } from 'react';
import { Send, Mail, Briefcase, Mic, Edit3, MessageSquare, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';

const FormInput = ({ label, name, type = "text", placeholder, rows, required = false, value, onChange }: { label: string, name: string, type?: string, placeholder?: string, rows?: number, required?: boolean, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void }) => (
    <div className="mb-4">
        <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">{label} {required && <span className="text-red-500">*</span>}</label>
        {rows ? (
            <textarea name={name} value={value} onChange={onChange} required={required} rows={rows} className="w-full bg-[#0f1014] border border-[#2a2f3a] rounded p-3 text-white focus:border-blue-500 focus:outline-none transition-colors text-sm" placeholder={placeholder} />
        ) : (
            <input name={name} value={value} onChange={onChange} required={required} type={type} className="w-full bg-[#0f1014] border border-[#2a2f3a] rounded p-3 text-white focus:border-blue-500 focus:outline-none transition-colors text-sm" placeholder={placeholder} />
        )}
    </div>
);

export const ApplicationForm = ({ role }: { role: string }) => {
    const { user, userProfile } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [formData, setFormData] = useState({
        username: '',
        discordId: '',
        timezone: '',
        reason: '',
        additionalInfo: ''
    });

    useEffect(() => {
        if (userProfile && user) {
            setFormData(prev => ({
                ...prev,
                username: userProfile.username || prev.username
            }));
        }
    }, [userProfile, user]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const audio = new Audio(URL.createObjectURL(file));
            audio.onloadedmetadata = () => {
                if (audio.duration > 15) { // Giving them a tiny bit of grace period, 15s absolute max
                    alert("Audio file is too long. Please ensure it is 10 seconds or less.");
                    e.target.value = ''; // clear input
                    setAudioFile(null);
                } else {
                    setAudioFile(file);
                }
            };
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            alert("Please sign in to submit an application.");
            return;
        }
        setIsSubmitting(true);
        try {
            let audioUrl = '';
            if (role === 'presenter' && audioFile) {
                const storageRef = ref(storage, `avatars/${user.uid}/applications_audio_${Date.now()}_${audioFile.name}`);
                await uploadBytes(storageRef, audioFile);
                audioUrl = await getDownloadURL(storageRef);
            }

            await addDoc(collection(db, 'applications'), {
                ...formData,
                role,
                status: 'pending',
                uid: user.uid,
                avatar: user.photoURL || '',
                audioUrl: audioUrl || null,
                createdAt: serverTimestamp()
            });
            setIsSubmitting(false);
            setIsSubmitted(true);
            window.scrollTo(0, 0);
        } catch (error) {
            setIsSubmitting(false);
            handleFirestoreError(error, OperationType.CREATE, 'applications');
        }
    };

    if (isSubmitted) {
        return (
            <div className="container mx-auto max-w-2xl py-20 text-center animate-in fade-in zoom-in duration-300">
                <div className="bg-[#16191f] border border-[#2a2f3a] rounded-lg p-12 shadow-2xl">
                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle size={40} className="text-green-500" />
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-4">Application Sent!</h2>
                    <p className="text-gray-400 mb-8">Thanks for applying for the {role} position. Our team will review your application and get back to you via Discord within 48 hours.</p>
                    <button onClick={() => setIsSubmitted(false)} className="bg-[#0f1014] border border-[#2a2f3a] text-white px-6 py-2 rounded hover:bg-[#1a1d26] transition-colors">
                        Return to Forms
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-3xl">
            <div className="text-center mb-10">
                <h2 className="text-3xl font-bold text-white flex items-center justify-center gap-3 mb-2 uppercase">
                    {role === 'presenter' && <Mic className="text-blue-500" />}
                    {role === 'reporter' && <Edit3 className="text-green-500" />}
                    {role === 'staff' && <Briefcase className="text-emerald-500" />}
                    {role} APPLICATION
                </h2>
                <p className="text-gray-400">Join the best team on the internet. Apply below.</p>
            </div>

            <form onSubmit={handleSubmit} className="bg-[#16191f] border border-[#2a2f3a] rounded-lg p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-pink-500" />
                
                {!user && (
                    <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-sm flex items-center gap-3">
                        <AlertCircle size={18} />
                        Please sign in to submit an application.
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <FormInput label="Username" name="username" value={formData.username} onChange={handleChange} placeholder="Your Goodwood FM username" required />
                    <FormInput label="Discord ID" name="discordId" value={formData.discordId} onChange={handleChange} placeholder="user#1234" required />
                </div>
                
                <FormInput label="Timezone / Region" name="timezone" value={formData.timezone} onChange={handleChange} placeholder="e.g. GMT / UK" required />
                
                <FormInput label="Why do you want to join?" name="reason" value={formData.reason} onChange={handleChange} rows={4} placeholder="Tell us about yourself and your motivation..." required />
                
                {role === 'presenter' && (
                    <div className="mb-4">
                        <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Microphone Quality Check <span className="text-red-500">*</span></label>
                        <p className="text-xs text-gray-400 mb-2">Please upload a max 10 seconds audio file saying: "Hi, I'm [name] and this is Goodwood FM"</p>
                        <input name="audioFile" type="file" accept="audio/*" onChange={handleFileChange} required className="w-full bg-[#0f1014] border border-[#2a2f3a] rounded p-3 text-white focus:border-blue-500 focus:outline-none transition-colors text-sm" />
                    </div>
                )}
                
                {role === 'reporter' && (
                    <FormInput label="Previous Work" name="additionalInfo" value={formData.additionalInfo} onChange={handleChange} rows={3} placeholder="Links to any articles you have written..." required />
                )}

                <div className="mt-8 pt-6 border-t border-[#2a2f3a] flex items-center justify-between">
                     <p className="text-xs text-gray-500 flex items-center gap-1">
                        <AlertCircle size={12} />
                        Applications are reviewed within 48 hours.
                     </p>
                     <button 
                        type="submit" 
                        disabled={isSubmitting || !user}
                        className="bg-white text-black font-bold px-8 py-3 rounded hover:bg-gray-200 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} 
                        {isSubmitting ? 'Sending...' : 'Submit Application'}
                     </button>
                </div>
            </form>
        </div>
    );
};

export const ContactForm = ({ type }: { type: string }) => {
    const { user, userProfile } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        department: 'General Enquiries',
        message: ''
    });

    useEffect(() => {
        let defaultDept = 'General Enquiries';
        if (type === 'Partnership Enquiry') defaultDept = 'Advertising / Partners';
        if (type === 'Site Feedback') defaultDept = 'Management Team';

        setFormData(prev => ({
            ...prev,
            department: defaultDept
        }));

        if (userProfile && user) {
            setFormData(prev => ({
                ...prev,
                name: userProfile.username || prev.name,
                email: user.email || prev.email,
            }));
        }
    }, [type, userProfile, user]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            alert("Please sign in to send a message.");
            return;
        }
        setIsSubmitting(true);
        try {
            await addDoc(collection(db, 'enquiries'), {
                ...formData,
                type,
                createdAt: serverTimestamp()
            });
            setIsSubmitting(false);
            setIsSubmitted(true);
            window.scrollTo(0, 0);
        } catch (error) {
            setIsSubmitting(false);
            handleFirestoreError(error, OperationType.CREATE, 'enquiries');
        }
    };

    if (isSubmitted) {
        return (
            <div className="container mx-auto max-w-2xl py-20 text-center animate-in fade-in zoom-in duration-300">
                <div className="bg-[#16191f] border border-[#2a2f3a] rounded-lg p-12 shadow-2xl">
                    <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle size={40} className="text-orange-500" />
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-4">Message Sent!</h2>
                    <p className="text-gray-400 mb-8">We have received your enquiry. Someone from the team will respond to your email shortly.</p>
                    <button onClick={() => setIsSubmitted(false)} className="bg-[#0f1014] border border-[#2a2f3a] text-white px-6 py-2 rounded hover:bg-[#1a1d26] transition-colors">
                        Send Another
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-3xl">
            <div className="text-center mb-10">
                <h2 className="text-3xl font-bold text-white flex items-center justify-center gap-3 mb-2 uppercase">
                    <Mail className="text-orange-500" /> {type}
                </h2>
                <p className="text-gray-400">We'd love to hear from you. Fill out the form below.</p>
            </div>

             <form onSubmit={handleSubmit} className="bg-[#16191f] border border-[#2a2f3a] rounded-lg p-8 shadow-xl">
                {!user && (
                    <div className="mb-6 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg text-orange-400 text-sm flex items-center gap-3">
                        <AlertCircle size={18} />
                        Please sign in to send a message.
                    </div>
                )}

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <FormInput label="Name" name="name" value={formData.name} onChange={handleChange} placeholder="Your Name" required />
                    <FormInput label="Email Address" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="you@example.com" required />
                </div>

                <div className="mb-6">
                     <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Department</label>
                     <select name="department" value={formData.department} onChange={handleChange} className="w-full bg-[#0f1014] border border-[#2a2f3a] rounded p-3 text-white focus:border-blue-500 focus:outline-none text-sm appearance-none">
                         <option>General Enquiries</option>
                         <option>Management Team</option>
                         <option>Advertising / Partners</option>
                         <option>Technical Support</option>
                     </select>
                </div>

                <FormInput label="Message" name="message" value={formData.message} onChange={handleChange} rows={6} placeholder="How can we help you?" required />

                <button 
                    type="submit" 
                    disabled={isSubmitting || !user}
                    className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded transition-colors flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    {isSubmitting ? 'Sending...' : 'Send Message'}
                </button>
             </form>
        </div>
    );
};
