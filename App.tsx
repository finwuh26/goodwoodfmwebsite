import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Timetable, Team, Partners, ContentList, Socials, Jobs } from './pages/SecondaryPages';
import { MembersList } from './pages/CommunityPages';
import { ApplicationForm, ContactForm } from './pages/FormPages';
import { ArticlePage } from './pages/ArticlePage';
import { ProfilePage, SettingsPage } from './pages/UserPages';
import { Shop } from './pages/Shop';
import { StaffDashboard } from './pages/StaffDashboard';
import { ArticleWriter } from './pages/ArticleWriter';
import { IdeasPoolPage, MyWorkflowPage, EditorialQueuePage } from './pages/StaffEditorialPages';
import { TermsOfService, PrivacyPolicy, Safety, LegalHub, CookiePolicy } from './pages/LegalPages';
import { RadioProvider } from './context/RadioContext';
import { AuthProvider } from './context/AuthContext';

const ScrollToTop = () => {
    const { pathname } = useLocation();
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);
    return null;
}

function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <RadioProvider>
          <ScrollToTop />
          <Toaster 
            position="top-right" 
            toastOptions={{ 
                style: { background: '#12161c', color: '#fff', border: '1px solid #1a202c' },
                success: { iconTheme: { primary: '#10b981', secondary: '#fff' } }
            }} 
          />
          <Routes>
            <Route path="/staff/dashboard" element={<StaffDashboard />} />
            <Route path="/staff/ideas-pool" element={<IdeasPoolPage />} />
            <Route path="/staff/my-workflow" element={<MyWorkflowPage />} />
            <Route path="/staff/editorial-queue" element={<EditorialQueuePage />} />
            <Route path="/staff/article/new" element={<Layout><ArticleWriter /></Layout>} />
            <Route path="/staff/article/:id" element={<Layout><ArticleWriter /></Layout>} />
            <Route path="*" element={
              <Layout>
                <Routes>
                  <Route path="/" element={<Home />} />
                  
                  {/* Main Pages */}
                  <Route path="/timetable" element={<Timetable />} />
                  <Route path="/team" element={<Team />} />
                  <Route path="/jobs" element={<Jobs />} />
                  
                  {/* Content */}
                  <Route path="/content" element={<ContentList />} />
                  <Route path="/article/:id" element={<ArticlePage />} />
                  
                  {/* Community */}
                  <Route path="/community/verified" element={<MembersList type="verified" />} />
                  <Route path="/community/all" element={<MembersList type="all" />} />

                  {/* User */}
                  <Route path="/profile/:uid" element={<ProfilePage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/shop" element={<Shop />} />

                  {/* Forms */}
                  <Route path="/apply/presenter" element={<ApplicationForm role="presenter" />} />
                  <Route path="/apply/reporter" element={<ApplicationForm role="reporter" />} />
                  <Route path="/apply/event" element={<ApplicationForm role="event host" />} />
                  <Route path="/apply/developer" element={<ApplicationForm role="developer" />} />
                  <Route path="/apply/media" element={<ApplicationForm role="digital media" />} />
                  <Route path="/apply/staff" element={<ApplicationForm role="staff" />} />
                  
                  <Route path="/contact/general" element={<ContactForm type="General Enquiry" />} />
                  <Route path="/contact/partnership" element={<ContactForm type="Partnership Enquiry" />} />
                  <Route path="/contact/feedback" element={<ContactForm type="Site Feedback" />} />
                  
                  {/* Legal */}
                  <Route path="/legal" element={<LegalHub />} />
                  <Route path="/terms" element={<TermsOfService />} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/cookies" element={<CookiePolicy />} />
                  <Route path="/safety" element={<Safety />} />
                  
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            } />
          </Routes>
        </RadioProvider>
      </AuthProvider>
    </HashRouter>
  );
}

export default App;
