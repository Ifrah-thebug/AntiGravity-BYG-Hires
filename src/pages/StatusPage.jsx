// src/pages/StatusPage.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, Mail, User, ShieldAlert, Award, FileText, ArrowRight, CornerDownRight } from 'lucide-react';
import { talentService } from '../services/talentService';

const StatusPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [sub, setSub] = useState(null);
  const [timeSinceSubmitted, setTimeSinceSubmitted] = useState('');

  const refreshStatus = () => {
    if (token) {
      const applicant = talentService.getSubmissionByToken(token);
      if (applicant) {
        setSub(applicant);

        // Calculate relative time since submission
        const submittedTime = applicant.assessmentAnswers?.submittedAt || applicant.submittedAt;
        if (submittedTime) {
          const diffMs = Date.now() - new Date(submittedTime).getTime();
          const diffMins = Math.floor(diffMs / 1000 / 60);
          
          if (diffMins < 1) setTimeSinceSubmitted('just now');
          else if (diffMins < 60) setTimeSinceSubmitted(`${diffMins} minutes ago`);
          else {
            const diffHours = Math.floor(diffMins / 60);
            if (diffHours < 24) setTimeSinceSubmitted(`${diffHours} hours ago`);
            else setTimeSinceSubmitted(`${Math.floor(diffHours / 24)} days ago`);
          }
        }
      }
    }
  };

  useEffect(() => {
    refreshStatus();
    
    // Listen to storage events so changes in admin panel sync here in real time!
    window.addEventListener('storage', refreshStatus);
    const interval = setInterval(refreshStatus, 3000); // Polling for fast update during review testing

    return () => {
      window.removeEventListener('storage', refreshStatus);
      clearInterval(interval);
    };
  }, [token]);

  // Invalid Token Check
  if (!token || !sub) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 pt-32 text-black">
        <div className="max-w-md w-full text-center bg-white border border-gray-200 rounded-[2.5rem] p-10 shadow-xl">
          <ShieldAlert size={48} className="text-red mx-auto mb-6" />
          <h2 className="text-2xl font-black uppercase mb-4">NO APPLICATION FOUND</h2>
          <p className="text-gray-500 font-medium text-sm leading-relaxed mb-8">
            We couldn't locate any application corresponding to this status link. Please verify your token or apply again.
          </p>
          <a href="/talent/signup" className="px-8 py-4 bg-black hover:bg-red text-white font-black text-xs uppercase tracking-widest rounded-xl transition-colors block text-center shadow-lg">
            APPLY NOW
          </a>
        </div>
      </div>
    );
  }

  // Define visual parameters based on current candidate status
  const getStatusHeader = () => {
    switch (sub.status) {
      case 'invited':
        return {
          title: "Intake Submitted",
          subtitle: "Your assessment invite has been generated.",
          color: "text-red",
          pillBg: "bg-red/5 text-red border-red/10",
          pillText: "Status: Assessment Ready",
          badge: <Clock size={48} className="text-red" />
        };
      case 'pending_ai_review':
      case 'pending_human_review':
        return {
          title: "Application Submitted",
          subtitle: "Your assessment answers are being evaluated.",
          color: "text-black",
          pillBg: "bg-yellow-500/10 text-yellow-600 border-yellow-500/25",
          pillText: `Status: Under Review (submitted ${timeSinceSubmitted})`,
          badge: <div className="w-12 h-12 border-4 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin" />
        };
      case 'admitted':
        return {
          title: "Congratulations! You're In! 🎉",
          subtitle: "Scoring & Explanations were verified and your application was approved.",
          color: "text-green-600",
          pillBg: "bg-green-500/10 text-green-600 border-green-500/20",
          pillText: "Status: Admitted to Talent Pool",
          badge: <CheckCircle size={48} className="text-green-500" />
        };
      case 'rejected':
        return {
          title: "Application Update",
          subtitle: `Thanks for completing the challenge. Your assessment scored ${sub.aiScore?.total_score || 50}/100.`,
          color: "text-red",
          pillBg: "bg-red/5 text-red border-red/20",
          pillText: "Status: Reapply Cooldown",
          badge: <ShieldAlert size={48} className="text-red" />
        };
      case 'revision_requested':
        return {
          title: "Revision Requested",
          subtitle: `Your assessment score is ${sub.aiScore?.total_score || 78}/100, but some adjustments are needed.`,
          color: "text-yellow-600",
          pillBg: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
          pillText: "Status: Revision Needed",
          badge: <AlertTriangle size={48} className="text-yellow-500 animate-bounce" />
        };
      default:
        return {
          title: "Application Status",
          subtitle: "Checking status details...",
          color: "text-gray-500",
          pillBg: "bg-gray-100 text-gray-500",
          pillText: "Status: Unknown",
          badge: <Clock size={48} className="text-gray-400" />
        };
    }
  };

  const currentDisplay = getStatusHeader();

  return (
    <div className="bg-white text-black min-h-screen font-sans flex items-center justify-center p-6 pt-32 pb-24">
      <div className="max-w-2xl w-full text-center">
        
        {/* Animated Icon Badge */}
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-8 flex justify-center"
        >
          <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center border-4 border-gray-100">
            {currentDisplay.badge}
          </div>
        </motion.div>
        
        <motion.h1 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className={`text-3xl md:text-5xl font-black mb-4 uppercase tracking-wide ${currentDisplay.color}`}
        >
          {currentDisplay.title}
        </motion.h1>
        
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-50 border border-gray-200 rounded-[2.5rem] p-8 md:p-12 mt-10 text-left"
        >
          <p className="text-xl font-black text-gray-900 mb-6 uppercase tracking-wide">{currentDisplay.subtitle}</p>
          
          <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border font-bold text-xs uppercase tracking-wider inline-flex mb-8 ${currentDisplay.pillBg}`}>
            <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
            <span>{currentDisplay.pillText}</span>
          </div>

          {/* Conditional Decision feedback */}
          {sub.status === 'rejected' && (
            <div className="bg-white p-6 rounded-2xl border border-red/10 mb-8 space-y-3">
              <p className="text-[10px] font-black text-red uppercase tracking-widest">FEEDBACK FROM BYG REVIEWERS</p>
              <p className="text-sm font-semibold text-gray-700 leading-relaxed italic">
                "{sub.reviewerNotes || 'Clear thinking, but responses lacked specific examples.'}"
              </p>
              <p className="text-xs font-bold text-gray-400 border-t border-gray-100 pt-3">
                You can reapply in 7 days after the cooldown completes. Review the feedback above and focus on stronger, more specific responses.
              </p>
            </div>
          )}

          {sub.status === 'revision_requested' && (
            <div className="bg-white p-6 rounded-2xl border border-yellow-500/25 mb-8 space-y-4">
              <div className="flex items-center gap-2 text-yellow-600 font-black text-[10px] tracking-wider uppercase">
                <AlertTriangle size={14} />
                <span>TEAM FEEDBACK TO REVISE</span>
              </div>
              <p className="text-sm font-semibold text-gray-700 leading-relaxed italic">
                "{sub.reviewerNotes || 'Please elaborate on the SOP implementation plan.'}"
              </p>
              <button
                onClick={() => navigate(`/assessment?token=${sub.token}`)}
                className="w-full py-3.5 bg-yellow-500 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-black transition-colors flex items-center justify-center gap-2 shadow-lg"
              >
                <span>RESUBMIT REVISED RESPONSE</span>
                <ArrowRight size={12} />
              </button>
            </div>
          )}

          {sub.status === 'admitted' && (
            <div className="mb-8 pt-2">
              <button
                onClick={() => navigate(`/talent/dashboard?id=${sub.id}`)}
                className="w-full py-4.5 bg-green-500 hover:bg-black text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-colors flex items-center justify-center gap-2 shadow-xl shadow-green-500/10 border-2 border-green-500"
              >
                <span>ACCESS TALENT DASHBOARD</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}

          {/* Core Status Milestones Grid */}
          <div className="space-y-6 border-t border-gray-200 pt-8">
            <h3 className="font-black text-xs tracking-widest uppercase text-gray-400 mb-4">NEXT STEPS IN YOUR PIPELINE:</h3>
            
            <div className="flex items-start gap-4">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 font-bold border-2 ${
                sub.status === 'invited' ? 'border-red bg-red/10 text-red animate-pulse' : 'border-green-500 bg-green-50 text-green-500'
              }`}>
                {sub.status === 'invited' ? '1' : '✓'}
              </div>
              <div>
                <p className="text-gray-800 font-black text-sm uppercase tracking-wide">Complete Visual Assessment</p>
                {sub.status === 'invited' ? (
                  <button 
                    onClick={() => navigate(`/assessment?token=${sub.token}`)}
                    className="text-xs font-black text-red hover:text-black uppercase tracking-wider mt-1.5 flex items-center gap-1"
                  >
                    <span>Click here to start the 25-min assessment</span>
                    <CornerDownRight size={10} />
                  </button>
                ) : (
                  <p className="text-gray-500 text-xs mt-0.5">Your answers were uploaded successfully.</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 font-bold border-2 ${
                sub.status === 'pending_ai_review' || sub.status === 'pending_human_review'
                  ? 'border-yellow-500 bg-yellow-50 text-yellow-600 animate-pulse'
                  : sub.status === 'admitted'
                  ? 'border-green-500 bg-green-50 text-green-500'
                  : 'border-gray-200 text-gray-300'
              }`}>
                {sub.status === 'admitted' ? '✓' : '2'}
              </div>
              <div>
                <p className="text-gray-800 font-black text-sm uppercase tracking-wide">Scoring & Explanations</p>
                <p className="text-gray-500 text-xs mt-0.5">Your assessment will be scored and you'll receive detailed explanations.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 font-bold border-2 ${
                sub.status === 'admitted'
                  ? 'border-green-500 bg-green-50 text-green-500'
                  : 'border-gray-200 text-gray-300'
              }`}>
                {sub.status === 'admitted' ? '✓' : '3'}
              </div>
              <div>
                <p className="text-gray-800 font-black text-sm uppercase tracking-wide">BYG Team Quality Decision</p>
                <p className="text-gray-500 text-xs mt-0.5">Our staffing specialists make the final Admit, Reject, or Revise ruling.</p>
              </div>
            </div>

          </div>
        </motion.div>

        {/* Buttons */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-12 flex justify-center gap-4"
        >
          <a href="/" className="px-8 py-4.5 bg-black hover:bg-red text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-black/10">
            Return to Home
          </a>
          <a href="/how-it-works" className="px-8 py-4.5 bg-white border border-gray-200 hover:border-gray-300 text-gray-600 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-sm">
            View FAQs
          </a>
        </motion.div>

      </div>
    </div>
  );
};

export default StatusPage;
