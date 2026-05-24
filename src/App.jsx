import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import HowItWorksPage from './pages/HowItWorksPage';
import CaseStudiesPage from './pages/CaseStudiesPage';
import WhyUsPage from './pages/WhyUsPage';
import RemoteSalesTeamPage from './pages/RemoteSalesTeamPage';
import RemoteSupportTeamPage from './pages/RemoteSupportTeamPage';
import TalentPoolPage from './pages/TalentPoolPage';
import TalentBrowsePage from './pages/TalentBrowsePage';
import RequestIntroPage from './pages/RequestIntroPage';
import TalentDashboardPage from './pages/TalentDashboardPage';

// Import New System Pages
import TalentApplyPage from './pages/TalentApplyPage';
import AssessmentPage from './pages/AssessmentPage';
import StatusPage from './pages/StatusPage';
import AdminReviewsPage from './pages/AdminReviewsPage';

// Import Global Sandbox Tools
import DeveloperConsole from './components/DeveloperConsole';
import MockEmailSimulator from './components/MockEmailSimulator';

const AppContent = () => {
  const location = useLocation();
  const isTalentPool = location.pathname === '/talent-pool' || location.pathname === '/talent-pool/apply';
  const debug = new URLSearchParams(location.search).get('debug') === 'true';
  const isAssessment = location.pathname === '/assessment';
  const isAdmin = location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/case-studies" element={<CaseStudiesPage />} />
          <Route path="/why-us" element={<WhyUsPage />} />
          <Route path="/remote-sales-team" element={<RemoteSalesTeamPage />} />
          <Route path="/remote-support-team" element={<RemoteSupportTeamPage />} />
          <Route path="/talent-pool" element={<TalentPoolPage />} />
          <Route path="/talent-pool/apply" element={<TalentApplyPage />} />
          <Route path="/assessment" element={<AssessmentPage />} />
          <Route path="/status" element={<StatusPage />} />
          <Route path="/admin/reviews" element={<AdminReviewsPage />} />
          <Route path="/talent-browse" element={<TalentBrowsePage />} />
          <Route path="/talent/dashboard" element={<TalentDashboardPage />} />
          <Route path="/request-intro" element={<RequestIntroPage />} />
        </Routes>
      </main>
      {!isTalentPool && !isAssessment && !isAdmin && <Footer />}
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
      <AppContent />
    </Router>
  );
}

export default App;
