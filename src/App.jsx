import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import HowItWorksPage from './pages/HowItWorksPage';
import CaseStudiesPage from './pages/CaseStudiesPage';
import WhyUsPage from './pages/WhyUsPage';
import RemoteSalesTeamPage from './pages/RemoteSalesTeamPage';
import RemoteSupportTeamPage from './pages/RemoteSupportTeamPage';

function App() {
  return (
    <Router>
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
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
