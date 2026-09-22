import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AdminRoute from './components/AdminRoute';
import { AuthProvider } from './context/AuthContext';
import { talentService } from './services/talentService';

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

/** Route-level code splitting — keeps Vapi / heavy admin / portfolio out of the first paint. */
const HomePage = lazy(() => import('./pages/HomePage'));
const HowItWorksPage = lazy(() => import('./pages/HowItWorksPage'));
const CaseStudiesPage = lazy(() => import('./pages/CaseStudiesPage'));
const WhyUsPage = lazy(() => import('./pages/WhyUsPage'));
const AboutUsPage = lazy(() => import('./pages/AboutUsPage'));
const RemoteSalesTeamPage = lazy(() => import('./pages/RemoteSalesTeamPage'));
const RemoteSupportTeamPage = lazy(() => import('./pages/RemoteSupportTeamPage'));
const RequestIntroPage = lazy(() => import('./pages/RequestIntroPage'));
const TalentDashboardPage = lazy(() => import('./pages/TalentDashboardPage'));
const AssessmentPage = lazy(() => import('./pages/AssessmentPage'));
const TalentAssessmentPage = lazy(() => import('./pages/TalentAssessmentPage'));
const TalentVoiceInterviewPage = lazy(() => import('./pages/TalentVoiceInterviewPage'));
const StatusPage = lazy(() => import('./pages/StatusPage'));
const AdminProfileReviewsPage = lazy(() => import('./pages/AdminProfileReviewsPage'));
const AdminTalentImportPage = lazy(() => import('./pages/AdminTalentImportPage'));
const AdminAmbassadorsPage = lazy(() => import('./pages/AdminAmbassadorsPage'));
const TalentActivatePage = lazy(() => import('./pages/TalentActivatePage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TalentSignupPage = lazy(() => import('./pages/TalentSignupPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const TalentSetupPage = lazy(() => import('./pages/TalentSetupPage'));
const TalentDirectoryPage = lazy(() => import('./pages/TalentDirectoryPage'));
const TalentProfilePage = lazy(() => import('./pages/TalentProfilePage'));
const TalentPortfolioPage = lazy(() => import('./pages/TalentPortfolioPage'));
const PortalPage = lazy(() => import('./pages/PortalPage'));
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'));
const AdminSignupPage = lazy(() => import('./pages/AdminSignupPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const AdminClientsPage = lazy(() => import('./pages/AdminClientsPage'));
const ClientActivatePage = lazy(() => import('./pages/ClientActivatePage'));
const ClientDashboardPage = lazy(() => import('./pages/ClientDashboardPage'));
const AmbassadorGatePage = lazy(() => import('./pages/AmbassadorGatePage'));
const AmbassadorHubPage = lazy(() => import('./pages/AmbassadorHubPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const TalentOnboardingChat = lazy(() => import('./components/talentChat/TalentOnboardingChat'));
const DeveloperConsole = lazy(() => import('./components/DeveloperConsole'));
const MockEmailSimulator = lazy(() => import('./components/MockEmailSimulator'));

function PageFallback() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center text-sm font-semibold text-gray-500">
      Loading…
    </div>
  );
}

const AppContent = () => {
  const location = useLocation();
  const isTalentPool = location.pathname === '/talent-pool' || location.pathname === '/talent-pool/apply';
  const debug = new URLSearchParams(location.search).get('debug') === 'true';
  const isAssessment =
    location.pathname === '/assessment' ||
    location.pathname.startsWith('/assessment/') ||
    location.pathname === '/interview';
  const isAdmin = location.pathname.startsWith('/admin');
  const isSuperAdminShell =
    location.pathname === '/admin/login' ||
    location.pathname === '/admin/signup';
  const isPortalPage =
    location.pathname === '/portal' ||
    location.pathname === '/login' ||
    location.pathname === '/forgot-password' ||
    location.pathname === '/reset-password' ||
    location.pathname.startsWith('/talent/login') ||
    location.pathname.startsWith('/talent/signup') ||
    location.pathname.startsWith('/talent/setup') ||
    location.pathname === '/talent/activate' ||
    location.pathname === '/client' ||
    location.pathname.startsWith('/client/') ||
    location.pathname.startsWith('/ambassador');
  const isPortfolioPage = /\/talent\/[^/]+\/portfolio$/.test(location.pathname);

  useEffect(() => {
    talentService.purgeProfilesByName('ifrah');
    talentService.purgeProfilesByName('meraj');
  }, []);

  return (
    <div className="min-h-screen bg-white overflow-x-hidden max-w-full">
      <ScrollToTop />
      {!isSuperAdminShell && <Navbar />}
      <main className="overflow-x-hidden max-w-full">
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route path="/case-studies" element={<CaseStudiesPage />} />
            <Route path="/why-us" element={<WhyUsPage />} />
            <Route path="/about" element={<AboutUsPage />} />
            <Route path="/remote-sales-team" element={<RemoteSalesTeamPage />} />
            <Route path="/remote-support-team" element={<RemoteSupportTeamPage />} />
            <Route path="/talent-pool" element={<Navigate to="/talent/signup" replace />} />
            <Route path="/talent-pool/apply" element={<Navigate to="/talent/signup" replace />} />
            <Route path="/assessment" element={<TalentAssessmentPage />} />
            <Route path="/interview" element={<TalentVoiceInterviewPage />} />
            <Route path="/assessment/legacy" element={<AssessmentPage />} />
            <Route path="/assessment/coming-soon" element={<Navigate to="/assessment" replace />} />
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
              path="/admin/profile-reviews"
              element={(
                <AdminRoute>
                  <AdminProfileReviewsPage />
                </AdminRoute>
              )}
            />
            <Route path="/admin/reviews" element={<Navigate to="/admin/profile-reviews" replace />} />
            <Route
              path="/admin/talent/import"
              element={(
                <AdminRoute>
                  <AdminTalentImportPage />
                </AdminRoute>
              )}
            />
            <Route
              path="/admin/ambassadors"
              element={(
                <AdminRoute>
                  <AdminAmbassadorsPage />
                </AdminRoute>
              )}
            />
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/talent-browse" element={<Navigate to="/talent" replace />} />
            <Route path="/talent/dashboard" element={<TalentDashboardPage />} />
            <Route path="/request-intro" element={<RequestIntroPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/talent" element={<TalentDirectoryPage />} />
            <Route path="/talent/signup" element={<TalentSignupPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/talent/login" element={<Navigate to="/login" replace />} />
            <Route path="/talent/activate" element={<TalentActivatePage />} />
            <Route path="/talent/setup" element={<TalentSetupPage />} />
            <Route path="/talent/:id/portfolio" element={<TalentPortfolioPage />} />
            <Route path="/talent/:id" element={<TalentProfilePage />} />
            <Route path="/portal" element={<PortalPage />} />
            <Route path="/client/activate" element={<ClientActivatePage />} />
            <Route path="/client/login" element={<Navigate to="/login" replace />} />
            <Route path="/client" element={<ClientDashboardPage />} />
            <Route path="/ambassador" element={<AmbassadorGatePage />} />
            <Route path="/ambassador/hub" element={<AmbassadorHubPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>
      {!isTalentPool && !isAssessment && !isAdmin && !isPortalPage && !isPortfolioPage && <Footer />}
      <Suspense fallback={null}>
        <TalentOnboardingChat />
      </Suspense>
      {debug ? (
        <Suspense fallback={null}>
          <DeveloperConsole />
          <MockEmailSimulator />
        </Suspense>
      ) : null}
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
