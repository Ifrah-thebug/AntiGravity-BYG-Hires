// src/pages/AdminReviewsPage.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, Eye, Filter, ArrowUpDown, FileText, CheckCircle2, AlertTriangle, XCircle, ChevronRight, User, Mail, Award, MessageSquare, LogOut, Check 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { talentService } from '../services/talentService';
import { useAuth } from '../context/AuthContext';
import { fetchIsAdmin } from '../lib/adminAuth';

const AdminReviewsPage = () => {
  const { user } = useAuth();
  const [passcode, setPasscode] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSupabaseAdmin, setIsSupabaseAdmin] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Queue and Review state
  const [submissions, setSubmissions] = useState([]);
  const [selectedSub, setSelectedSub] = useState(null);
  const [filterRole, setFilterRole] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'highest_score'

  // Reviewer Decision form state
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [reviewerName, setReviewerName] = useState('Team Member');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  const loadData = () => {
    setIsLoggedIn(talentService.isAdminLoggedIn());
    const list = talentService.getSubmissions();
    setSubmissions(list);

    // Auto-select first item if queue loaded and none active
    if (list.length > 0 && !selectedSub) {
      // Prefer pending human review, then newest
      const pending = list.find(s => s.status === 'pending_human_review' || s.status === 'pending_ai_review');
      setSelectedSub(pending || list[0]);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchIsAdmin()
      .then((ok) => {
        if (ok) {
          setIsSupabaseAdmin(true);
          setIsLoggedIn(true);
          loadData();
        }
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!isLoggedIn) return;
    loadData();
    window.addEventListener('storage', loadData);
    const interval = setInterval(loadData, 3000);
    return () => {
      window.removeEventListener('storage', loadData);
      clearInterval(interval);
    };
  }, [selectedSub, isLoggedIn]);

  const handleLogin = (e) => {
    e.preventDefault();
    const success = talentService.adminLogin(passcode);
    if (success) {
      setIsLoggedIn(true);
      setLoginError('');
      loadData();
    } else {
      setLoginError('Invalid passcode. Hint: Use 12345 to review.');
    }
  };

  const handleLogout = () => {
    talentService.adminLogout();
    setIsLoggedIn(false);
    setSelectedSub(null);
  };

  const selectCandidate = (cand) => {
    setSelectedSub(cand);
    setReviewerNotes(cand.reviewerNotes || '');
  };

  // Dispatch human decision
  const handleDecision = async (decision) => {
    if (decision === 'rejected' && !reviewerNotes.trim()) {
      alert("A reviewer explanation note is strictly required for rejections to provide constructive candidate feedback.");
      return;
    }

    setIsSubmittingDecision(true);
    try {
      const updated = talentService.makeAdminDecision(selectedSub.id, decision, reviewerNotes, reviewerName);
      
      // Update selected sub state
      setSelectedSub(updated);
      setIsSubmittingDecision(false);
      loadData();
    } catch (err) {
      alert(err.message || 'Decision failed.');
      setIsSubmittingDecision(false);
    }
  };

  // Filters & Sorting logic
  const filteredList = submissions.filter(s => {
    const matchesRole = filterRole === 'All' || s.expertise === filterRole;
    const matchesStatus = filterStatus === 'All' || s.status === filterStatus;
    return matchesRole && matchesStatus;
  }).sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
    } else if (sortBy === 'highest_score') {
      const aScore = a.aiScore?.total_score || 0;
      const bScore = b.aiScore?.total_score || 0;
      return bScore - aScore;
    }
    return 0;
  });

  // Calculate dynamic email preview contents for the reviews panel
  const getEmailPreview = (decision) => {
    if (!selectedSub) return { subject: '', body: '' };
    
    const score = selectedSub.aiScore?.total_score || 78;
    const notesStr = reviewerNotes.trim() || '[Your custom feedback notes entered below]';

    switch (decision) {
      case 'admit':
        return {
          subject: `You're in the BYG Hires Talent Pool! 🎉`,
          body: `Congratulations, ${selectedSub.name}. Your assessment scored ${score}/100.\n\nYou're now visible to our clients.\n\nLog in to see matches: /talent/dashboard?id=${selectedSub.id}\n\nBYG Hires Team`
        };
      case 'reject':
        return {
          subject: `Next Steps — Your BYG Hires Assessment`,
          body: `Thanks for applying, ${selectedSub.name}. Your assessment scored ${score}/100.\n\nReason from our team:\n"${notesStr}"\n\nYou can reapply in 7 days: /talent-pool/apply`
        };
      case 'revise':
        return {
          subject: `One More Step — Please Revise Your Assessment`,
          body: `Your assessment was strong (${score}/100), but we'd like to see more detail on:\n\n"${notesStr}"\n\nResubmit revised response here: /assessment?token=${selectedSub.token}\n\nNew deadline: 7 days`
        };
      default:
        return { subject: '', body: '' };
    }
  };

  // 1. Passcode login screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4 pt-32">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red rounded-full blur-[180px] opacity-10 pointer-events-none -mr-20 -mt-20" />
        
        <div className="max-w-md w-full bg-[#141418] border border-gray-800 rounded-[2.5rem] p-10 shadow-2xl relative z-10 text-center">
          <div className="w-16 h-16 bg-red/10 rounded-full flex items-center justify-center text-red mx-auto mb-6 border border-red/20 shadow-[0_10px_20px_rgba(255,74,74,0.1)]">
            <Lock size={26} />
          </div>
          
          <h2 className="text-2xl font-black uppercase tracking-wider mb-2">TEAM MEMBER SECURE ACCESS</h2>
          <p className="text-gray-500 font-medium text-xs leading-normal mb-8">
            Please enter your authorization code to access the BYG Hires assessment review database.
          </p>

          <form onSubmit={handleLogin} className="space-y-6">
            {loginError && (
              <div className="p-3 bg-red/10 border border-red/20 text-red rounded-xl text-xs font-semibold">
                {loginError}
              </div>
            )}
            
            <input 
              type="password"
              placeholder="•••••"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="w-full text-center px-6 py-4 bg-[#0f0f12] border border-gray-800 rounded-xl focus:border-red outline-none font-bold text-2xl tracking-[0.3em] placeholder:text-gray-700 text-white"
              required
              autoFocus
            />

            <button
              type="submit"
              className="w-full py-4.5 bg-red hover:bg-white hover:text-red text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-red/10"
            >
              AUTHORIZE SIGN IN
            </button>
          </form>

          <p className="text-gray-600 text-xs font-medium mt-8 leading-relaxed">
            Signed in as super admin?{' '}
            <Link to="/admin/dashboard" className="text-red font-bold hover:underline">
              Browse Candidates
            </Link>
            {' '}(no passcode required).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0b0b0e] text-white min-h-screen pt-24 pb-12 font-sans px-4 sm:px-6">

      {isSupabaseAdmin && (
        <div className="max-w-8xl mx-auto mb-6 p-4 bg-red/10 border border-red/20 rounded-2xl text-xs font-semibold text-red-200">
          Signed in as super admin. This queue uses local assessment demo data. For live talent, use{' '}
          <Link to="/admin/dashboard" className="text-red font-black hover:underline">
            Browse Candidates
          </Link>
          .
        </div>
      )}

      {/* Dashboard Top bar */}
      <div className="max-w-8xl mx-auto flex items-center justify-between border-b border-gray-800 pb-6 mb-8 gap-4">
        <div>
          <span className="text-red font-black text-[9px] tracking-widest uppercase">QUALITY ASSURANCE CONTROL ROOM</span>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wide">Pending Assessments Review Queue</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <span className="text-gray-500 text-[10px] uppercase font-bold block">LOGGED IN AS</span>
            <input 
              type="text"
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              className="bg-transparent border-b border-gray-800 text-sm font-bold text-white text-right focus:border-red outline-none max-w-[120px]"
            />
          </div>
          <button 
            onClick={handleLogout}
            className="w-10 h-10 bg-gray-800/50 hover:bg-red/10 text-gray-400 hover:text-red rounded-xl flex items-center justify-center transition-colors border border-gray-800 shrink-0"
            title="Log Out Team Session"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <div className="max-w-8xl mx-auto grid lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Queue & Filters (Colspan 4) */}
        <div className="lg:col-span-4 bg-[#111115] border border-gray-800 rounded-[2rem] p-6 space-y-6 shadow-xl h-[80vh] overflow-y-auto min-h-[500px]">
          
          <div className="flex items-center gap-2 text-white font-black text-[10px] tracking-wider uppercase border-b border-gray-800 pb-3 shrink-0">
            <Filter size={14} className="text-red" />
            <span>QUEUE FILTER SETTINGS</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs shrink-0">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">ROLE</label>
              <select 
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="w-full bg-[#16161c] border border-gray-800 rounded-lg p-2.5 outline-none font-bold text-gray-300"
              >
                <option value="All">All Roles</option>
                <option value="Operations">Operations</option>
                <option value="Customer Success">CS</option>
                <option value="Marketing">Marketing</option>
                <option value="EA">EA</option>
                <option value="Data">Data</option>
                <option value="Finance">Finance</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">STATUS</label>
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full bg-[#16161c] border border-gray-800 rounded-lg p-2.5 outline-none font-bold text-gray-300"
              >
                <option value="All">All Statuses</option>
                <option value="pending_human_review">Pending Review</option>
                <option value="pending_ai_review">AI Scoring Active</option>
                <option value="admitted">Admitted</option>
                <option value="rejected">Rejected</option>
                <option value="revision_requested">Revision Req</option>
              </select>
            </div>
          </div>

          <div className="space-y-1 shrink-0 pb-3 border-b border-gray-800">
            <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1">
              <ArrowUpDown size={10} />
              <span>SORTING ORDER</span>
            </label>
            <div className="flex gap-2">
              <button 
                onClick={() => setSortBy('newest')}
                className={`flex-1 py-2 px-3 border rounded-lg text-xs font-bold transition-all ${
                  sortBy === 'newest' ? 'bg-red border-red text-white' : 'border-gray-800 hover:border-gray-600 text-gray-400'
                }`}
              >
                Newest First
              </button>
              <button 
                onClick={() => setSortBy('highest_score')}
                className={`flex-1 py-2 px-3 border rounded-lg text-xs font-bold transition-all ${
                  sortBy === 'highest_score' ? 'bg-red border-red text-white' : 'border-gray-800 hover:border-gray-600 text-gray-400'
                }`}
              >
                Highest Score
              </button>
            </div>
          </div>

          {/* List items */}
          <div className="space-y-3">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Candidates ({filteredList.length})</div>
            
            {filteredList.length === 0 ? (
              <p className="text-gray-500 text-center italic py-8 text-xs">No matching candidates in queue.</p>
            ) : (
              filteredList.map((item) => {
                const isActive = selectedSub?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => selectCandidate(item)}
                    className={`p-4.5 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col gap-3 relative ${
                      isActive 
                        ? 'bg-red/5 border-red/45 shadow-[0_10px_20px_rgba(255,74,74,0.03)]' 
                        : 'bg-[#15151b] border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    {/* Status dot */}
                    {item.status === 'pending_human_review' && (
                      <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
                    )}

                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-sm text-white truncate leading-tight mb-0.5">{item.name}</h4>
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">{item.expertise}</span>
                      </div>
                      
                      {/* AI score badge */}
                      {item.aiScore ? (
                        <div className="text-right shrink-0">
                          <p className="text-xs font-black text-white leading-none">{item.aiScore.total_score}</p>
                          <span className="text-[8px] text-gray-500 font-bold uppercase">AI SCORE</span>
                        </div>
                      ) : (
                        <span className="text-[9px] text-gray-500 font-bold uppercase italic shrink-0">Grading...</span>
                      )}
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-gray-500 border-t border-gray-800/40 pt-2.5">
                      <span>Submitted: {new Date(item.submittedAt).toLocaleDateString()}</span>
                      <span className={`px-2 py-0.5 rounded font-black uppercase text-[8px] border ${
                        item.status === 'admitted'
                          ? 'bg-green-500/10 border-green-500/20 text-green-500'
                          : item.status === 'rejected'
                          ? 'bg-red/10 border-red/20 text-red'
                          : item.status === 'pending_human_review'
                          ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'
                          : 'bg-gray-500/10 border-gray-500/20 text-gray-400'
                      }`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </div>

                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* MIDDLE/RIGHT: Evaluation Details Panel (Colspan 8) */}
        <div className="lg:col-span-8 bg-[#111115] border border-gray-800 rounded-[2rem] p-6 shadow-xl h-[80vh] overflow-y-auto">
          
          {!selectedSub ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-gray-500">
              <FileText size={48} className="mx-auto mb-4 stroke-1" />
              <p className="font-bold">Select a candidate in queue to begin manual review</p>
            </div>
          ) : (
            <div className="space-y-8 animate-fadeIn">
              
              {/* Header profile details */}
              <div className="flex flex-wrap items-center justify-between border-b border-gray-800 pb-6 gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-red/10 border border-red/25 flex items-center justify-center text-red font-black text-xl shrink-0 uppercase">
                    {selectedSub.name.substring(0,2)}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white leading-tight uppercase tracking-wide">{selectedSub.name}</h2>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-400 font-medium mt-1">
                      <span className="flex items-center gap-1"><Mail size={12} /> {selectedSub.email}</span>
                      <span className="flex items-center gap-1"><User size={12} /> {selectedSub.phone}</span>
                      <span className="px-2 py-0.5 bg-gray-800 border border-gray-700 text-gray-300 font-black text-[9px] rounded uppercase">EXP: {selectedSub.yearsExp}</span>
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">DECISION STATE</span>
                  <span className={`px-3 py-1 rounded-lg font-black uppercase text-[10px] border ${
                    selectedSub.status === 'admitted'
                      ? 'bg-green-500/10 border-green-500/20 text-green-500'
                      : selectedSub.status === 'rejected'
                      ? 'bg-red/10 border-red/20 text-red'
                      : selectedSub.status === 'pending_human_review'
                      ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'
                      : 'bg-gray-500/10 border-gray-500/20 text-gray-400'
                  }`}>
                    {selectedSub.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* TWO COLUMN WORKSPACE SPLIT */}
              <div className="grid md:grid-cols-2 gap-8">
                
                {/* 2A. LEFT COLUMN: Resume details & Deliverables answers */}
                <div className="space-y-8">
                  
                  {/* Resume box */}
                  <div className="bg-[#15151b] border border-gray-800 p-5 rounded-2xl">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <FileText size={14} className="text-red" />
                      <span>ATTACHED APPLICANT RESUME</span>
                    </p>
                    <div className="flex items-center justify-between py-2 px-3 bg-black/40 rounded border border-gray-800">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText size={16} className="text-red shrink-0" />
                        <span className="text-xs text-white font-bold truncate">{selectedSub.resumeFile?.name || 'resume.pdf'}</span>
                      </div>
                      <a
                        href={`/BYG_Hires_Fulfillment_Database/${selectedSub.resumeFile?.name || 'resume.pdf'}`}
                        onClick={(e) => { e.preventDefault(); alert("Verification Download Simulated. Live raw file mirror hosted in Developer Console under Google Drive Tab!"); }}
                        className="text-[10px] font-bold text-red hover:underline uppercase shrink-0"
                      >
                        Verify PDF
                      </a>
                    </div>

                    {selectedSub.parsedResumeData && (
                      <div className="mt-4 space-y-2 text-xs border-t border-gray-800/40 pt-3">
                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Gemini Vision Extraction:</p>
                        <p className="text-gray-300 font-medium">Expertise: <span className="font-bold text-white">{selectedSub.parsedResumeData.detected_expertise}</span></p>
                        <p className="text-gray-300 font-medium">Skills: <span className="text-red font-bold">{selectedSub.parsedResumeData.key_skills.slice(0, 3).join(', ')}</span></p>
                      </div>
                    )}
                  </div>

                  {/* Text Answers */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                      <span className="text-[10px] font-black text-gray-500 tracking-widest uppercase">Assessment Submissions</span>
                      <span className="text-[10px] text-gray-400 font-medium">Time Taken: 24 mins</span>
                    </div>

                    {selectedSub.assessmentAnswers ? (
                      <div className="space-y-6">
                        <div>
                          <p className="text-[9px] font-black text-red uppercase tracking-widest mb-1.5">Deliverable 1: Diagnosis</p>
                          <blockquote className="p-4 bg-black/40 border-l-2 border-gray-700 text-xs leading-relaxed text-gray-300 font-medium rounded-r-xl whitespace-pre-line">
                            {selectedSub.assessmentAnswers.deliverable1}
                          </blockquote>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-red uppercase tracking-widest mb-1.5">Deliverable 2: Coordination/Copy</p>
                          <blockquote className="p-4 bg-black/40 border-l-2 border-gray-700 text-xs leading-relaxed text-gray-300 font-medium rounded-r-xl whitespace-pre-line">
                            {selectedSub.assessmentAnswers.deliverable2}
                          </blockquote>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-red uppercase tracking-widest mb-1.5">Deliverable 3: SOP Planning</p>
                          <blockquote className="p-4 bg-black/40 border-l-2 border-gray-700 text-xs leading-relaxed text-gray-300 font-medium rounded-r-xl whitespace-pre-line">
                            {selectedSub.assessmentAnswers.deliverable3}
                          </blockquote>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 bg-black/20 border border-gray-800/40 rounded-2xl">
                        <AlertTriangle size={32} className="mx-auto mb-3 text-yellow-500/80 stroke-1 animate-pulse" />
                        <p className="text-xs font-bold text-gray-400">Applicant Has Not Completed Assessment Answers</p>
                        <p className="text-[10px] text-gray-500 mt-1 max-w-[200px] mx-auto">This invitation link remains active for 7 days.</p>
                      </div>
                    )}
                  </div>

                </div>

                {/* 2B. RIGHT COLUMN: Claude Grading report details */}
                <div className="space-y-8">
                  
                  {/* AI Scores Summary */}
                  {selectedSub.aiScore ? (
                    <div className="bg-[#15151b] border border-gray-800 p-6 rounded-2xl space-y-6">
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">CLAUDE EVALUATION SCORE</p>
                          <h3 className="text-3xl font-black text-white leading-none">{selectedSub.aiScore.total_score}<span className="text-xs text-gray-500 font-normal">/100</span></h3>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">AI RECOMMENDATION</p>
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                            selectedSub.aiScore.recommendation.includes('Admit')
                              ? 'bg-green-500/10 border-green-500/30 text-green-400 shadow-[0_4px_10px_rgba(34,197,94,0.05)]'
                              : 'bg-red/10 border-red/30 text-red'
                          }`}>
                            {selectedSub.aiScore.recommendation}
                          </span>
                        </div>
                      </div>

                      <div className="bg-black/40 border border-gray-800 p-4 rounded-xl text-xs leading-relaxed text-gray-300 font-medium">
                        <p className="text-[9px] font-black text-[#66d9ef] uppercase tracking-wider mb-1">AI Grading Summary Memo:</p>
                        "{selectedSub.aiScore.summary}"
                      </div>

                      {/* Domain breakdown list */}
                      <div className="space-y-4 pt-2">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Rubric Axes Detailed Breakdown</p>
                        
                        {/* Clarity */}
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between font-bold text-gray-300">
                            <span>Clarity & Directness</span>
                            <span>{selectedSub.aiScore.clarity_score}/25</span>
                          </div>
                          <p className="text-[10px] text-gray-500 leading-normal">{selectedSub.aiScore.clarity_feedback}</p>
                        </div>

                        {/* Relevance */}
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between font-bold text-gray-300">
                            <span>Scenario Relevance</span>
                            <span>{selectedSub.aiScore.relevance_score}/25</span>
                          </div>
                          <p className="text-[10px] text-gray-500 leading-normal">{selectedSub.aiScore.relevance_feedback}</p>
                        </div>

                        {/* Speed */}
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between font-bold text-gray-300">
                            <span>Execution & Urgency</span>
                            <span>{selectedSub.aiScore.speed_score}/25</span>
                          </div>
                          <p className="text-[10px] text-gray-500 leading-normal">{selectedSub.aiScore.speed_feedback}</p>
                        </div>

                        {/* Problem solving */}
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between font-bold text-gray-300">
                            <span>Systemic Problem Solving</span>
                            <span>{selectedSub.aiScore.problem_solving_score}/25</span>
                          </div>
                          <p className="text-[10px] text-gray-500 leading-normal">{selectedSub.aiScore.problem_solving_feedback}</p>
                        </div>

                      </div>

                    </div>
                  ) : (
                    <div className="text-center py-20 bg-[#15151b] border border-gray-800 rounded-2xl">
                      <div className="w-12 h-12 border-4 border-gray-800 border-t-red rounded-full animate-spin mx-auto mb-4" />
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">AI Scoring Pipeline Triggered</p>
                      <p className="text-[10px] text-gray-500 mt-1.5 max-w-[220px] mx-auto leading-normal">Claude is performing rubric calibrations and compiling scoring explanations in the background.</p>
                    </div>
                  )}

                </div>

              </div>

              {/* TEAM PANEL: Actions note & decision dispatchers */}
              <div className="border-t border-gray-800 pt-8 mt-4 space-y-6">
                
                <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                  <span className="text-[10px] font-black text-gray-500 tracking-widest uppercase">HUMAN REVIEW DECISION ENGINE</span>
                  <span className="text-[10px] text-red font-medium">Auto-signed: {reviewerName}</span>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <MessageSquare size={12} className="text-gray-500" />
                    <span>Reviewer Notes & Feedback explanation (Strictly Required for Rejections)</span>
                  </label>
                  <textarea
                    value={reviewerNotes}
                    onChange={(e) => setReviewerNotes(e.target.value)}
                    placeholder="Enter final decision rationale or specific revision comments here..."
                    className="w-full p-4.5 bg-[#0f0f12] border border-gray-800 rounded-xl focus:border-red outline-none min-h-[90px] text-xs leading-normal font-medium text-gray-300 resize-y"
                  />
                </div>

                {/* Email Previews Carousel */}
                <div className="bg-[#15151b] border border-gray-800 rounded-2xl p-5 space-y-3">
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-800/40 pb-2 flex items-center gap-1">
                    <Mail size={12} className="text-red animate-pulse" />
                    <span>Real-Time Transactional Email Preview</span>
                  </p>
                  
                  <div className="grid md:grid-cols-3 gap-4 text-[10px]">
                    {/* Admit preview */}
                    <div className="bg-black/35 p-3 rounded-lg border border-green-500/10 flex flex-col justify-between">
                      <div>
                        <p className="font-bold text-green-400 uppercase tracking-wider text-[8px] mb-1">IF ADMITTED PREVIEW:</p>
                        <p className="font-bold text-white truncate mb-1">Subject: {getEmailPreview('admit').subject}</p>
                        <p className="text-gray-500 line-clamp-3 leading-normal">{getEmailPreview('admit').body}</p>
                      </div>
                    </div>

                    {/* Reject preview */}
                    <div className="bg-black/35 p-3 rounded-lg border border-red/10 flex flex-col justify-between">
                      <div>
                        <p className="font-bold text-red uppercase tracking-wider text-[8px] mb-1">IF REJECTED PREVIEW:</p>
                        <p className="font-bold text-white truncate mb-1">Subject: {getEmailPreview('reject').subject}</p>
                        <p className="text-gray-500 line-clamp-3 leading-normal">{getEmailPreview('reject').body}</p>
                      </div>
                    </div>

                    {/* Revise preview */}
                    <div className="bg-black/35 p-3 rounded-lg border border-yellow-500/10 flex flex-col justify-between">
                      <div>
                        <p className="font-bold text-yellow-500 uppercase tracking-wider text-[8px] mb-1">IF REVISION PREVIEW:</p>
                        <p className="font-bold text-white truncate mb-1">Subject: {getEmailPreview('revise').subject}</p>
                        <p className="text-gray-500 line-clamp-3 leading-normal">{getEmailPreview('revise').body}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Final dispatch buttons */}
                <div className="flex flex-wrap gap-4 pt-2">
                  
                  <button
                    onClick={() => handleDecision('admitted')}
                    disabled={isSubmittingDecision || !selectedSub.assessmentAnswers}
                    className={`flex-1 py-4.5 font-black text-xs tracking-widest uppercase rounded-xl transition-all flex items-center justify-center gap-2 border-2 ${
                      selectedSub.assessmentAnswers
                        ? 'bg-green-500 hover:bg-black hover:text-green-500 border-green-500 text-white shadow-lg cursor-pointer shadow-green-500/5'
                        : 'bg-gray-800 text-gray-500 border-gray-800 cursor-not-allowed'
                    }`}
                  >
                    <CheckCircle2 size={14} />
                    <span>✓ Admit to Pool</span>
                  </button>

                  <button
                    onClick={() => handleDecision('revision_requested')}
                    disabled={isSubmittingDecision || !selectedSub.assessmentAnswers}
                    className={`flex-1 py-4.5 font-black text-xs tracking-widest uppercase rounded-xl transition-all flex items-center justify-center gap-2 border-2 ${
                      selectedSub.assessmentAnswers
                        ? 'bg-transparent border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-white cursor-pointer shadow-lg'
                        : 'bg-gray-800 text-gray-500 border-gray-800 cursor-not-allowed'
                    }`}
                  >
                    <AlertTriangle size={14} />
                    <span>⚠ Request Revision</span>
                  </button>

                  <button
                    onClick={() => handleDecision('rejected')}
                    disabled={isSubmittingDecision || !selectedSub.assessmentAnswers}
                    className={`flex-1 py-4.5 font-black text-xs tracking-widest uppercase rounded-xl transition-all flex items-center justify-center gap-2 border-2 ${
                      selectedSub.assessmentAnswers
                        ? 'bg-transparent border-red text-red hover:bg-red hover:text-white cursor-pointer'
                        : 'bg-gray-800 text-gray-500 border-gray-800 cursor-not-allowed'
                    }`}
                  >
                    <XCircle size={14} />
                    <span>✗ Reject Applicant</span>
                  </button>

                </div>

              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
};

export default AdminReviewsPage;
