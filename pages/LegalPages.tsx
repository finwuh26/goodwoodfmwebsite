import React from 'react';
import { Shield, FileText, Lock } from 'lucide-react';

export const TermsOfService = () => (
    <div className="container mx-auto max-w-4xl py-12">
        <div className="text-center mb-12">
            <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-4 flex items-center justify-center gap-3">
                <FileText className="text-blue-500" size={40} /> Terms of Service
            </h1>
            <p className="text-gray-400">Last updated: {new Date().toLocaleDateString()}</p>
        </div>
        <div className="bg-goodwood-card border border-goodwood-border rounded-xl p-8 text-gray-300 space-y-6 leading-relaxed">
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">1. Acceptance of Terms</h2>
                <p>By accessing and using Goodwood FM, you accept and agree to be bound by the terms and provision of this agreement.</p>
            </section>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">2. User Conduct</h2>
                <p>Users must behave respectfully in all community areas. Harassment, hate speech, and spam are strictly prohibited and will result in immediate account termination.</p>
            </section>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">3. Content Ownership</h2>
                <p>All content broadcasted on Goodwood FM remains the property of its respective owners. User-submitted content grants Goodwood FM a non-exclusive license to use and display it.</p>
            </section>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">4. Modifications</h2>
                <p>We reserve the right to modify these terms at any time. Continued use of the site constitutes acceptance of the new terms.</p>
            </section>
        </div>
    </div>
);

export const PrivacyPolicy = () => (
    <div className="container mx-auto max-w-4xl py-12">
        <div className="text-center mb-12">
            <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-4 flex items-center justify-center gap-3">
                <Lock className="text-green-500" size={40} /> Privacy Policy
            </h1>
            <p className="text-gray-400">Last updated: {new Date().toLocaleDateString()}</p>
        </div>
        <div className="bg-goodwood-card border border-goodwood-border rounded-xl p-8 text-gray-300 space-y-6 leading-relaxed">
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">1. Information Collection</h2>
                <p>We collect information you provide directly to us when you create an account, apply for a role, or contact us. This may include your name, email address, and Discord ID.</p>
            </section>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">2. Use of Information</h2>
                <p>We use the information we collect to provide, maintain, and improve our services, communicate with you, and ensure a safe environment for our community.</p>
            </section>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">3. Data Sharing</h2>
                <p>We do not sell your personal data. We may share information with third-party vendors who need access to such information to carry out work on our behalf.</p>
            </section>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">4. Cookies</h2>
                <p>We use essential cookies and similar local storage technologies to support core site features such as sign-in and account access. You can review and update your cookie preferences when prompted on the site.</p>
            </section>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">5. Security</h2>
                <p>We take reasonable measures to help protect information about you from loss, theft, misuse and unauthorized access.</p>
            </section>
        </div>
    </div>
);

export const Safety = () => (
    <div className="container mx-auto max-w-4xl py-12">
        <div className="text-center mb-12">
            <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-4 flex items-center justify-center gap-3">
                <Shield className="text-red-500" size={40} /> Safety Center
            </h1>
            <p className="text-gray-400">Your safety is our top priority.</p>
        </div>
        <div className="bg-goodwood-card border border-goodwood-border rounded-xl p-8 text-gray-300 space-y-6 leading-relaxed">
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">Community Guidelines</h2>
                <p>Goodwood FM is committed to providing a safe, inclusive environment. We do not tolerate bullying, harassment, or discrimination of any kind.</p>
            </section>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">Reporting Issues</h2>
                <p>If you encounter behavior that violates our guidelines, please report it immediately to a staff member via our Discord server or through the contact form.</p>
            </section>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">Account Security</h2>
                <p>Protect your account by using a strong password and never sharing your login credentials. Staff will never ask for your password.</p>
            </section>
        </div>
    </div>
);
