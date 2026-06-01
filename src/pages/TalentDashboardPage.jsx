// src/pages/TalentDashboardPage.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, Star, Eye, MessageSquare, Briefcase, User, Calendar, Award, LogOut, ChevronDown, Sparkles 
} from 'lucide-react';
import { talentService } from '../services/talentService';
import { formatDisplayName } from '../lib/formatDisplayName';

const TalentDashboardPage = () => {
  const [searchParams] = useSearchParams();
  const talentId = searchParams.get('id');
  const navigate = useNavigate();

  const [talent, setTalent] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'matches'

  const refreshTalent = () => {
    const list = talentService.getSubmissions();
    let current = null;

    if (talentId) {
      current = list.find(s => s.id === talentId);
    } else {
      // Fallback to first admitted candidate or Maria seed for preview
      const admitted = list.find(s => s.status === 'admitted');
      current = admitted || list[0];
    }
    setTalent(current);
  };

  useEffect(() => {
    refreshTalent();
    window.addEventListener('storage', refreshTalent);
    return () => window.removeEventListener('storage', refreshTalent);
  }, [talentId]);

  const handleLogout = () => {
    navigate('/talent-pool');
  };

  if (!talent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 pt-32 text-black">
        <div className="max-w-md w-full text-center bg-white border border-gray-200 rounded-[2.5rem] p-10 shadow-xl font-sans">
          <Award size={48} className="text-red mx-auto mb-6" />
          <h2 className="text-2xl font-black uppercase mb-4">ACCESS DASHBOARD</h2>
          <p className="text-gray-500 font-medium text-sm leading-relaxed mb-8">
            Admitted candidates receive a unique dashboard login link in their congratulations email. Please apply or sign in.
          </p>
          <a href="/talent-pool/apply" className="px-8 py-4 bg-black hover:bg-red text-white font-black text-xs uppercase tracking-widest rounded-xl transition-colors block text-center shadow-lg">
            JOIN TALENT POOL
          </a>
        </div>
      </div>
    );
  }

  // Generate dynamic client matchmaking suggestions based on their role
  const getClientMatches = () => {
    switch (talent.expertise) {
      case 'Operations':
        return [
          { company: 'TravelCo Inc.', role: 'Senior Operations Lead', type: 'pending', desc: 'Requested an intro regarding logistics optimization.' },
          { company: 'Noon Logistics', role: 'Fulfillment Specialist', type: 'viewed', desc: 'Viewed your profile coordinates 4 hours ago.' },
          { company: 'Careem Aggregators', role: 'Ops Analyst', type: 'viewed', desc: 'Flagged your profile as an interview priority.' }
        ];
      case 'Customer Success':
        return [
          { company: 'SaaS Labs Dubai', role: 'Enterprise CS Manager', type: 'pending', desc: 'Requested a client alignment intro regarding ARR support.' },
          { company: 'StarSaaS Dubai', role: 'CS Specialist', type: 'viewed', desc: 'Downloaded your parsed skills scorecard.' }
        ];
      case 'Marketing':
        return [
          { company: 'Agency99 Media', role: 'Paid Acquisition Lead', type: 'pending', desc: 'Requested an interview for regional ad optimization.' },
          { company: 'D2C Coffee Co.', role: 'Growth Specialist', type: 'viewed', desc: 'Viewed your campaign variance report.' }
        ];
      default:
        return [
          { company: 'Startup Labs GCC', role: 'Functional Consultant', type: 'pending', desc: 'Requested an intro to align with their Q3 goals.' },
          { company: 'Majid Al Futtaim', role: 'Special Project Support', type: 'viewed', desc: 'Viewed your profile tags.' }
        ];
    }
  };

  const matches = getClientMatches();
  const admittedDate = talent.decisionTimestamp 
    ? new Date(talent.decisionTimestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'May 17, 2024';

  return (
    <div className="min-h-screen bg-gray-50 pt-32 pb-24 font-sans text-black">
      <div className="max-w-6xl mx-auto px-6">
        
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center border-b border-gray-200 pb-8 mb-12 gap-4">
          <div>
            <span className="text-red font-black text-[10px] tracking-widest uppercase flex items-center gap-1.5 mb-1">
              <Sparkles size={12} className="text-red animate-pulse" />
              <span>BYG HIRES TALENT MEMBER PANEL</span>
            </span>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none uppercase">Hello, {formatDisplayName(talent.name)}!</h1>
            <p className="text-gray-500 font-medium text-sm mt-2">Welcome back to your Verified Talent Dashboard.</p>
          </div>
          <button 
            onClick={handleLogout}
            className="px-5 py-3.5 bg-white border border-gray-200 hover:border-red text-gray-500 hover:text-red font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center gap-2 shrink-0"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Dashboard Grid Split */}
        <div className="grid md:grid-cols-3 gap-8">
          
          {/* LEFT/MID COLUMN: Profile & Assessment Scores (Colspan 2) */}
          <div className="md:col-span-2 space-y-8">
            
            {/* Profile Credentials Card */}
            <div className="bg-white rounded-[2rem] p-8 border border-gray-200 shadow-sm relative overflow-hidden">
              <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                <User className="text-red shrink-0" />
                <h2 className="text-lg font-black uppercase tracking-wider text-gray-900">Your Placement Profile</h2>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
                      <Briefcase size={20} className="text-gray-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">VERIFIED ROLE</p>
                      <p className="font-bold text-gray-800 text-base">{talent.parsedResumeData?.detected_expertise || talent.expertise}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center shrink-0 border border-green-100">
                      <CheckCircle2 size={20} className="text-green-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">POOL STATUS</p>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                        talent.status === 'admitted'
                          ? 'bg-green-500/10 border-green-500/20 text-green-600'
                          : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600 animate-pulse'
                      }`}>
                        {talent.status === 'admitted' ? '✓ Admitted' : 'Under human review'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
                      <Calendar size={20} className="text-gray-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">MEMBER SINCE</p>
                      <p className="font-bold text-gray-800">{admittedDate}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                      <Star size={20} className="text-gray-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">EXPERTISE TAGS</p>
                      <div className="flex flex-wrap gap-1.5">
                        {talent.parsedResumeData?.key_skills ? (
                          talent.parsedResumeData.key_skills.map((tag, idx) => (
                            <span key={idx} className="px-2.5 py-1 bg-red/5 border border-red/10 text-red font-bold text-[10px] rounded-lg uppercase">
                              {tag}
                            </span>
                          ))
                        ) : (
                          <>
                            <span className="px-2.5 py-1 bg-red/5 border border-red/10 text-red font-bold text-[10px] rounded-lg uppercase">Asana</span>
                            <span className="px-2.5 py-1 bg-red/5 border border-red/10 text-red font-bold text-[10px] rounded-lg uppercase">SOPs</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Assessment feedback block */}
            <div className="bg-white rounded-[2rem] p-8 border border-gray-200 shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                <Award className="text-red shrink-0" />
                <h2 className="text-lg font-black uppercase tracking-wider text-gray-900">Your Technical Assessment</h2>
              </div>
              
              <div className="flex items-center justify-between bg-green-50 border border-green-200 p-6 rounded-2xl flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shrink-0 text-white shadow-lg shadow-green-500/25">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <p className="font-black text-green-800 text-lg uppercase tracking-wide">Graded & Approved</p>
                    <p className="text-green-700 font-bold text-sm">Grading Score: {talent.aiScore?.total_score || 94}/100</p>
                  </div>
                </div>
                
                <button 
                  onClick={() => setShowFeedback(!showFeedback)}
                  className="px-5 py-2.5 bg-white hover:bg-green-100/50 border border-green-200 hover:border-green-300 text-green-700 font-black text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center gap-1 shrink-0"
                >
                  <span>Detailed Feedback Report</span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${showFeedback ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Expandable Feedback Report Accordion */}
              <AnimatePresence>
                {showFeedback && talent.aiScore && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden space-y-6 bg-gray-50 border border-gray-200 p-6 rounded-2xl"
                  >
                    <div className="border-b border-gray-200/50 pb-3 flex items-center justify-between">
                      <span className="text-[10px] font-black text-gray-500 tracking-wider uppercase">CLAUDE AI REPORT MEMO</span>
                      <span className="text-[10px] text-green-600 font-bold uppercase">{talent.aiScore.recommendation}</span>
                    </div>

                    <blockquote className="text-xs leading-relaxed text-gray-700 font-semibold italic">
                      "{talent.aiScore.summary}"
                    </blockquote>

                    <div className="grid md:grid-cols-2 gap-6 pt-2">
                      <div className="space-y-3.5">
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between font-bold text-gray-800">
                            <span>Clarity & Structure</span>
                            <span className="text-red">{talent.aiScore.clarity_score}/25</span>
                          </div>
                          <p className="text-[10px] text-gray-500 leading-normal">{talent.aiScore.clarity_feedback}</p>
                        </div>
                        
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between font-bold text-gray-800">
                            <span>Scenario Relevance</span>
                            <span className="text-red">{talent.aiScore.relevance_score}/25</span>
                          </div>
                          <p className="text-[10px] text-gray-500 leading-normal">{talent.aiScore.relevance_feedback}</p>
                        </div>
                      </div>

                      <div className="space-y-3.5">
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between font-bold text-gray-800">
                            <span>Execution Decisiveness</span>
                            <span className="text-red">{talent.aiScore.speed_score}/25</span>
                          </div>
                          <p className="text-[10px] text-gray-500 leading-normal">{talent.aiScore.speed_feedback}</p>
                        </div>
                        
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between font-bold text-gray-800">
                            <span>Systemic Solutions</span>
                            <span className="text-red">{talent.aiScore.problem_solving_score}/25</span>
                          </div>
                          <p className="text-[10px] text-gray-500 leading-normal">{talent.aiScore.problem_solving_feedback}</p>
                        </div>
                      </div>
                    </div>

                    {/* Reviewer human notes */}
                    {talent.reviewerNotes && (
                      <div className="border-t border-gray-200/50 pt-4 space-y-1.5 text-xs">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">BYG Reviewer Decision Notes:</p>
                        <p className="text-gray-700 leading-relaxed font-semibold italic">"{talent.reviewerNotes}"</p>
                      </div>
                    )}

                  </motion.div>
                )}
              </AnimatePresence>

            </div>

            {/* Read-Only Profile Actions */}
            <div className="flex flex-wrap gap-4 pt-4 shrink-0">
              <button 
                onClick={() => alert("Verification Profile Editing Sandbox Active. Read-only for now.")}
                className="px-8 py-4 bg-white border border-gray-200 text-gray-700 hover:border-gray-300 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-sm"
              >
                Edit Profile
              </button>
              <button 
                onClick={() => alert("Matches list active! BYG clients are automatically notified as matching parameters align.")}
                className="px-8 py-4 bg-black hover:bg-red text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-black/10"
              >
                View Job Opportunities
              </button>
            </div>

          </div>

          {/* RIGHT COLUMN: Active Matches Panel (Colspan 1) */}
          <div className="space-y-8">
            <div className="bg-black text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden border border-gray-800">
              
              {/* Glowing ambient light */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-red rounded-full blur-[80px] opacity-25 pointer-events-none -mr-10 -mt-10" />
              
              <div className="flex items-center gap-3 mb-8 relative z-10">
                <Star className="text-red shrink-0" />
                <h2 className="text-lg font-black uppercase tracking-wider text-white">Active Placement Matches</h2>
              </div>
              
              <div className="space-y-6 relative z-10">
                
                {/* Viewed counts */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <div className="flex items-center gap-3 mb-1">
                    <Eye className="text-gray-400 shrink-0" size={24} />
                    <p className="font-black text-3xl leading-none">3</p>
                  </div>
                  <p className="text-xs font-semibold text-gray-400 leading-normal">employers have inspected your skill credentials in the matchmaking panel.</p>
                </div>

                {/* Direct Intro Requests */}
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-gray-500 tracking-wider uppercase">Active Requests</p>
                  
                  {matches.map((item, idx) => (
                    <div key={idx} className="bg-white/5 border border-white/5 hover:border-red/20 rounded-2xl p-5 relative overflow-hidden transition-all duration-200 flex flex-col gap-3">
                      {item.type === 'pending' && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red"></div>
                      )}
                      
                      <div className="flex items-start gap-3 min-w-0">
                        <MessageSquare className={`mt-0.5 shrink-0 ${item.type === 'pending' ? 'text-red' : 'text-gray-400'}`} size={16} />
                        <div className="min-w-0">
                          <p className="font-black text-sm text-white leading-tight truncate">{item.company}</p>
                          <span className="text-[9px] font-black text-gray-500 uppercase tracking-wider mt-0.5">{item.role}</span>
                        </div>
                      </div>
                      
                      <p className="text-xs text-gray-400 leading-normal font-medium">{item.desc}</p>
                      
                      <div className="border-t border-white/5 pt-3.5 flex items-center justify-between mt-1.5 text-[10px]">
                        <span className={`font-black uppercase tracking-wider ${item.type === 'pending' ? 'text-red animate-pulse' : 'text-gray-500'}`}>
                          {item.type === 'pending' ? 'Pending Intro sync' : 'Profile Viewed'}
                        </span>
                        {item.type === 'pending' && (
                          <button 
                            onClick={() => alert(`Intro requested with ${item.company}! Our team will schedule the introductory call sync.`)}
                            className="font-bold text-white hover:text-red transition-colors flex items-center gap-1"
                          >
                            <span>Details</span>
                            <span>&rarr;</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

              </div>

              <div className="mt-8 relative z-10 shrink-0">
                <button 
                  onClick={() => alert("Verification Matches List Active. All matches synced automatically.")}
                  className="w-full py-4.5 bg-white/5 hover:bg-white/10 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-colors border border-white/10"
                >
                  View All Matches
                </button>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default TalentDashboardPage;
