import React from 'react';
import { Shield, FileText, Lock, Cookie, Scale } from 'lucide-react';
import { Link } from 'react-router-dom';

const LEGAL_EFFECTIVE_DATE = '19 April 2026';
const LEGAL_CONTACT_EMAIL = 'contact@finwuh.uk';

const SectionCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <section className="bg-goodwood-card border border-goodwood-border rounded-xl p-8 text-gray-300 space-y-6 leading-relaxed">
        {children}
    </section>
);

export const LegalHub = () => (
    <div className="container mx-auto max-w-5xl py-12">
        <div className="text-center mb-12">
            <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-4 flex items-center justify-center gap-3">
                <Scale className="text-amber-500" size={40} /> Legal
            </h1>
            <p className="text-gray-400">Effective date: {LEGAL_EFFECTIVE_DATE}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link to="/terms" className="bg-goodwood-card border border-goodwood-border rounded-xl p-6 hover:border-white/30 transition-colors">
                <h2 className="text-xl font-bold text-white mb-2">Terms & Conditions</h2>
                <p className="text-sm text-gray-300">Rules, eligibility, user content terms, and legal limits.</p>
            </Link>
            <Link to="/privacy" className="bg-goodwood-card border border-goodwood-border rounded-xl p-6 hover:border-white/30 transition-colors">
                <h2 className="text-xl font-bold text-white mb-2">Privacy Policy</h2>
                <p className="text-sm text-gray-300">How we collect, use, retain, and protect personal data.</p>
            </Link>
            <Link to="/cookies" className="bg-goodwood-card border border-goodwood-border rounded-xl p-6 hover:border-white/30 transition-colors">
                <h2 className="text-xl font-bold text-white mb-2">Cookie Information</h2>
                <p className="text-sm text-gray-300">Strictly necessary cookie/local storage usage on this site.</p>
            </Link>
            <Link to="/safety" className="bg-goodwood-card border border-goodwood-border rounded-xl p-6 hover:border-white/30 transition-colors">
                <h2 className="text-xl font-bold text-white mb-2">Safety</h2>
                <p className="text-sm text-gray-300">Community safety expectations and reporting pathways.</p>
            </Link>
        </div>

        <div className="mt-6 bg-goodwood-card border border-goodwood-border rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-3">Policy version history</h2>
            <ul className="text-sm text-gray-300 space-y-2 list-disc pl-5">
                <li><strong>2026-04-uk-legal-v1 (19 April 2026)</strong> — UK-focused Terms, Privacy, cookie information, and legal hub published.</li>
                <li><strong>2026-04-legal-corrections-v1 (earlier April 2026)</strong> — Earlier legal correction release.</li>
            </ul>
        </div>
    </div>
);

export const TermsOfService = () => (
    <div className="container mx-auto max-w-4xl py-12">
        <div className="text-center mb-12">
            <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-4 flex items-center justify-center gap-3">
                <FileText className="text-blue-500" size={40} /> Terms & Conditions
            </h1>
            <p className="text-gray-400">Effective date: {LEGAL_EFFECTIVE_DATE}</p>
        </div>
        <SectionCard>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">1. Acceptance of Terms</h2>
                <p>By using Goodwood FM, you agree to these Terms. If you do not agree, do not use the site.</p>
            </section>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">2. Who We Are</h2>
                <p>Goodwood FM is operated in the United Kingdom. Contact: <a className="text-white underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.</p>
            </section>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">3. Eligibility</h2>
                <p>You must be at least 13 years old to use this service. If local law requires a higher age, that higher age applies.</p>
            </section>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">4. Acceptable Use</h2>
                <p>Users must behave respectfully. Harassment, hate speech, illegal content, impersonation, spam, and attempts to abuse or disrupt the service are prohibited.</p>
            </section>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">5. Accounts and Enforcement</h2>
                <p>We may refuse, suspend, or terminate access where these Terms are breached or where needed to protect users, staff, or the platform.</p>
            </section>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">6. User Content</h2>
                <p>You retain ownership of content you submit. You grant Goodwood FM a non-exclusive, worldwide, royalty-free licence to host, display, and distribute that content in connection with operating and promoting the service.</p>
            </section>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">7. Service Availability and Liability</h2>
                <p>The service is provided on an “as available” basis. To the extent allowed by law, we exclude implied warranties and limit liability for indirect or consequential loss. Nothing limits liability that cannot be limited by law.</p>
            </section>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">8. Changes to Terms</h2>
                <p>We may update these Terms. Material updates may require renewed acceptance before continued account access.</p>
            </section>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">9. Governing Law</h2>
                <p>These Terms are governed by the laws of England and Wales. Courts of England and Wales have non-exclusive jurisdiction.</p>
            </section>
        </SectionCard>
    </div>
);

export const PrivacyPolicy = () => (
    <div className="container mx-auto max-w-4xl py-12">
        <div className="text-center mb-12">
            <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-4 flex items-center justify-center gap-3">
                <Lock className="text-green-500" size={40} /> Privacy Policy
            </h1>
            <p className="text-gray-400">Effective date: {LEGAL_EFFECTIVE_DATE}</p>
        </div>
        <SectionCard>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">1. Data Controller</h2>
                <p>Goodwood FM is the controller of personal data covered by this policy. Contact: <a className="text-white underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.</p>
            </section>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">2. UK Legal Basis</h2>
                <p>We process personal data under UK GDPR and the Data Protection Act 2018 using lawful bases including contract, legitimate interests, and consent (where required).</p>
            </section>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">3. Data We Collect</h2>
                <ul className="list-disc pl-6 space-y-1">
                    <li>Account and profile data (username, email, avatar, role, optional profile details).</li>
                    <li>Community and content data (posts, comments, reactions, article activity).</li>
                    <li>Form submissions (applications, enquiries, and related details such as Discord ID and message content).</li>
                    <li>Uploaded files you submit (for example presenter application audio samples).</li>
                    <li>Technical and service data (timestamps, authentication status, and security/error logs).</li>
                </ul>
            </section>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">4. Why We Use Data</h2>
                <ul className="list-disc pl-6 space-y-1">
                    <li>To provide account access and core site features (contract).</li>
                    <li>To moderate community safety and prevent abuse (legitimate interests).</li>
                    <li>To process applications and enquiries (legitimate interests / pre-contract steps).</li>
                    <li>To maintain platform security, diagnostics, and service reliability (legitimate interests).</li>
                </ul>
            </section>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">5. Sharing and Processors</h2>
                <p>We do not sell personal data. We use service providers to run the platform, including Firebase/Google Cloud services (authentication, database, and file storage). Where article notifications are enabled, data may also be sent to Discord webhooks for publication workflows.</p>
            </section>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">6. Data Retention</h2>
                <p>We keep data only as long as reasonably required for account operation, moderation, legal obligations, and dispute handling. Retention periods may vary by dataset and role of the data.</p>
            </section>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">7. International Transfers</h2>
                <p>Some providers may process data outside the UK. Where that happens, we rely on appropriate safeguards recognised under UK data protection law.</p>
            </section>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">8. Your Rights</h2>
                <p>You may have rights to access, correct, erase, restrict, object, and request portability of your data. You also have the right to complain to the Information Commissioner’s Office (ICO).</p>
            </section>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">9. Data Rights Requests</h2>
                <p>Send requests to <a className="text-white underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>. We aim to acknowledge requests within 7 days and respond within one calendar month where applicable.</p>
            </section>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">10. Cookies and PECR</h2>
                <p>We currently use strictly necessary local storage/cookie equivalents only. See <Link to="/cookies" className="text-white underline">Cookie Information</Link> for details.</p>
            </section>
        </SectionCard>
    </div>
);

export const CookiePolicy = () => (
    <div className="container mx-auto max-w-4xl py-12">
        <div className="text-center mb-12">
            <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-4 flex items-center justify-center gap-3">
                <Cookie className="text-amber-500" size={40} /> Cookie Information
            </h1>
            <p className="text-gray-400">Effective date: {LEGAL_EFFECTIVE_DATE}</p>
        </div>
        <SectionCard>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">1. Essential only</h2>
                <p>Goodwood FM uses strictly necessary storage only to operate core features. We do not currently use analytics or advertising cookies.</p>
            </section>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">2. Keys in use</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-goodwood-border">
                        <thead>
                            <tr className="bg-goodwood-dark text-left text-white">
                                <th className="p-3 border-b border-goodwood-border">Key</th>
                                <th className="p-3 border-b border-goodwood-border">Purpose</th>
                                <th className="p-3 border-b border-goodwood-border">Duration</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b border-goodwood-border">
                                <td className="p-3 font-mono">goodwood_cookie_consent</td>
                                <td className="p-3">Stores your acknowledgement to allow essential cookie/local storage usage for core site functions.</td>
                                <td className="p-3">Persistent until cleared by you in browser storage settings.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>
            <section>
                <h2 className="text-2xl font-bold text-white mb-4">3. Control</h2>
                <p>You can clear browser storage at any time in your browser settings. Clearing storage may sign you out and reset core site preferences.</p>
            </section>
        </SectionCard>
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
