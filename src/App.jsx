import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';

const CANONICAL_BASE = 'https://byghires.com';

function canonicalUrl(pathname) {
  if (!pathname || pathname === '/') return CANONICAL_BASE;
  return `${CANONICAL_BASE}${pathname.replace(/\/$/, '')}`;
}

function updateCanonicalLink(pathname) {
  const href = canonicalUrl(pathname);
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    updateCanonicalLink(pathname);
  }, [pathname]);
  return null;
};
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import HowItWorksPage from './pages/HowItWorksPage';
import CaseStudiesPage from './pages/CaseStudiesPage';
import WhyUsPage from './pages/WhyUsPage';
import RemoteSalesTeamPage from './pages/RemoteSalesTeamPage';
import RemoteSupportTeamPage from './pages/RemoteSupportTeamPage';
import RequestIntroPage from './pages/RequestIntroPage';
import TalentDashboardPage from './pages/TalentDashboardPage';

// Import New System Pages
import AssessmentPage from './pages/AssessmentPage';
import StatusPage from './pages/StatusPage';
import AdminReviewsPage from './pages/AdminReviewsPage';
import AdminTalentImportPage from './pages/AdminTalentImportPage';
import TalentActivatePage from './pages/TalentActivatePage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';

// Import Supabase-backed Talent Pool Pages
import TalentSignupPage from './pages/TalentSignupPage';
import TalentLoginPage from './pages/TalentLoginPage';
import LoginPage from './pages/LoginPage';
import TalentSetupPage from './pages/TalentSetupPage';
import TalentDirectoryPage from './pages/TalentDirectoryPage';
import TalentProfilePage from './pages/TalentProfilePage';
import PortalPage from './pages/PortalPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminSignupPage from './pages/AdminSignupPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminClientsPage from './pages/AdminClientsPage';
import ClientActivatePage from './pages/ClientActivatePage';
import ClientLoginPage from './pages/ClientLoginPage';
import ClientDashboardPage from './pages/ClientDashboardPage';
import NotFoundPage from './pages/NotFoundPage';
import AdminRoute from './components/AdminRoute';
import { AuthProvider } from './context/AuthContext';

// Import Global Sandbox Tools
import DeveloperConsole from './components/DeveloperConsole';
import MockEmailSimulator from './components/MockEmailSimulator';
import { talentService } from './services/talentService';

const AppContent = () => {
  const location = useLocation();
  const isTalentPool = location.pathname === '/talent-pool' || location.pathname === '/talent-pool/apply';
  const debug = new URLSearchParams(location.search).get('debug') === 'true';
  const isAssessment = location.pathname === '/assessment';
  const isAdmin = location.pathname.startsWith('/admin');
  const isSuperAdminShell =
    location.pathname === '/admin/login' ||
    location.pathname === '/admin/signup';
  const isPortalPage =
    location.pathname === '/portal' ||
    location.pathname === '/login' ||
    location.pathname.startsWith('/talent/login') ||
    location.pathname.startsWith('/talent/signup') ||
    location.pathname.startsWith('/talent/setup') ||
    location.pathname === '/talent/activate' ||
    location.pathname === '/client' ||
    location.pathname.startsWith('/client/');

  // One-time cleanup: remove any test/Ifrah profiles from localStorage
  useEffect(() => {
    talentService.purgeProfilesByName('ifrah');
    talentService.purgeProfilesByName('meraj');
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <ScrollToTop />
      {!isSuperAdminShell && <Navbar />}
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/case-studies" element={<CaseStudiesPage />} />
          <Route path="/why-us" element={<WhyUsPage />} />
          <Route path="/remote-sales-team" element={<RemoteSalesTeamPage />} />
          <Route path="/remote-support-team" element={<RemoteSupportTeamPage />} />
          <Route path="/talent-pool" element={<Navigate to="/talent/signup" replace />} />
          <Route path="/talent-pool/apply" element={<Navigate to="/talent/signup" replace />} />
          <Route path="/assessment" element={<AssessmentPage />} />
          <Route path="/status" element={<StatusPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/signup" element={<AdminSignupPage />} />
          <Route
            path="/admin/dashboard"
            element={(
              <AdminRoute>
                <AdminDashboardPage />
              </AdminRoute>
            )}
          />
          <Route
            path="/admin/clients"
            element={(
              <AdminRoute>
                <AdminClientsPage />
              </AdminRoute>
            )}
          />
          <Route
            path="/admin/reviews"
            element={(
              <AdminRoute>
                <AdminReviewsPage />
              </AdminRoute>
            )}
          />
          <Route
            path="/admin/talent/import"
            element={(
              <AdminRoute>
                <AdminTalentImportPage />
              </AdminRoute>
            )}
          />
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/talent-browse" element={<Navigate to="/talent" replace />} />
          <Route path="/talent/dashboard" element={<TalentDashboardPage />} />
          <Route path="/request-intro" element={<RequestIntroPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          {/* Supabase-backed Talent Pool System */}
          <Route path="/talent" element={<TalentDirectoryPage />} />
          <Route path="/talent/signup" element={<TalentSignupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/talent/login" element={<Navigate to="/login" replace />} />
          <Route path="/talent/activate" element={<TalentActivatePage />} />
          <Route path="/talent/setup" element={<TalentSetupPage />} />
          <Route path="/talent/:id" element={<TalentProfilePage />} />
          <Route path="/portal" element={<PortalPage />} />
          <Route path="/client/activate" element={<ClientActivatePage />} />
          <Route path="/client/login" element={<Navigate to="/login" replace />} />
          <Route path="/client" element={<ClientDashboardPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      {!isTalentPool && !isAssessment && !isAdmin && !isPortalPage && <Footer />}
      {/* Sandbox Debug Overlay Widgets - visible only with ?debug=true */}
      {debug && (
        <>
          <DeveloperConsole />
          <MockEmailSimulator />
        </>
      )}
    </div>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
