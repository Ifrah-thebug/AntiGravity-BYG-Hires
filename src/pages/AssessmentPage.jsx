// src/pages/AssessmentPage.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Timer, AlertTriangle, CheckCircle2, Save, Send, ShieldAlert, FileText, ArrowLeft } from 'lucide-react';
import { talentService } from '../services/talentService';

const AssessmentPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [sub, setSub] = useState(null);
  const [answers, setAnswers] = useState({
    deliverable1: '',
    deliverable2: '',
    deliverable3: ''
  });

  // Time remaining (in seconds)
  const [timeRemaining, setTimeRemaining] = useState(25 * 60);
  const [isSubmitActive, setIsSubmitActive] = useState(false);
  const [saveDraftState, setSaveDraftState] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const [submitState, setSubmitState] = useState('idle'); // 'idle' | 'submitting'

  // Load applicant details
  useEffect(() => {
    if (token) {
      const applicant = talentService.getSubmissionByToken(token);
      if (applicant) {
        setSub(applicant);
        
        // Prefill any existing draft answers
        if (applicant.assessmentAnswers) {
          setAnswers({
            deliverable1: applicant.assessmentAnswers.deliverable1 || '',
            deliverable2: applicant.assessmentAnswers.deliverable2 || '',
            deliverable3: applicant.assessmentAnswers.deliverable3 || ''
          });
        }
        
        // Initialize timer based on role estimated time
        const timeInMinutes = applicant.assessmentTask?.estimated_time_minutes || 25;
        setTimeRemaining(timeInMinutes * 60);
      }
    }
  }, [token]);

  // Countdown timer effect
  useEffect(() => {
    let timer;
    if (sub && timeRemaining > 0 && submitState === 'idle') {
      timer = setInterval(() => {
        setTimeRemaining(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [sub, timeRemaining, submitState]);

  // Enable submit button only if all fields have some text
  useEffect(() => {
    const active = 
      answers.deliverable1.trim().length > 10 &&
      answers.deliverable2.trim().length > 10 &&
      answers.deliverable3.trim().length > 10;
    setIsSubmitActive(active);
  }, [answers]);

  const handleTextareaChange = (e, key) => {
    const val = e.target.value;
    setAnswers(prev => ({ ...prev, [key]: val }));
  };

  // Save draft to localStorage
  const handleSaveDraft = () => {
    setSaveDraftState('saving');
    talentService.saveDraftAnswers(token, answers);
    
    setTimeout(() => {
      setSaveDraftState('saved');
      setTimeout(() => setSaveDraftState('idle'), 2500);
    }, 1000);
  };

  // Submit assessment answers
  const handleSubmit = async () => {
    if (!isSubmitActive) return;
    setSubmitState('submitting');
    
    try {
      await talentService.submitAssessment(token, answers);
      
      setTimeout(() => {
        navigate(`/status?token=${token}`);
      }, 2000);
    } catch (err) {
      alert(err.message || 'Submission failed.');
      setSubmitState('idle');
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Invalid Token Check
  if (!token || !sub) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 pt-32 text-black">
        <div className="max-w-md w-full text-center bg-white border border-gray-200 rounded-[2.5rem] p-10 shadow-xl">
          <ShieldAlert size={48} className="text-red mx-auto mb-6" />
          <h2 className="text-2xl font-black uppercase mb-4">INVALID OR EXPIRED LINK</h2>
          <p className="text-gray-500 font-medium text-sm leading-relaxed mb-8">
            This assessment token appears to be invalid or has expired after the 7-day cutoff period. Please request a new invite.
          </p>
          <a href="/talent-pool/apply" className="px-8 py-4 bg-black hover:bg-red text-white font-black text-xs uppercase tracking-widest rounded-xl transition-colors block text-center shadow-lg">
            REAPPLY NOW
          </a>
        </div>
      </div>
    );
  }

  // Already submitted check
  if (sub.status !== 'invited' && sub.status !== 'revision_requested' && submitState === 'idle') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 pt-32 text-black">
        <div className="max-w-md w-full text-center bg-white border border-gray-200 rounded-[2.5rem] p-10 shadow-xl">
          <CheckCircle2 size={48} className="text-green-500 mx-auto mb-6" />
          <h2 className="text-2xl font-black uppercase mb-4">ASSESSMENT COMPLETED</h2>
          <p className="text-gray-500 font-medium text-sm leading-relaxed mb-8">
            You have already submitted your answers for this challenge. We are busy reviewing your responses!
          </p>
          <a href={`/status?token=${token}`} className="px-8 py-4 bg-black hover:bg-red text-white font-black text-xs uppercase tracking-widest rounded-xl transition-colors block text-center shadow-lg">
            CHECK APPLICATION STATUS
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 text-black min-h-screen pt-32 pb-24 font-sans px-4 sm:px-6 relative">
      
      {/* Submitting Loader Overlay */}
      <AnimatePresence>
        {submitState === 'submitting' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center text-center p-8"
          >
            <div className="w-16 h-16 border-4 border-red/20 border-t-red rounded-full animate-spin mb-6" />
            <h3 className="text-white font-black text-xl tracking-wider uppercase mb-2">LOCKING ASSESSMENT ANSWERS</h3>
            <p className="text-gray-400 text-xs font-mono max-w-sm leading-relaxed">Uploading response.txt to Google Drive Submissions directory, flagging timestamp, and initiating Claude Grading Rubrics...</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-5xl mx-auto">
        
        {/* Sticky Task Timer Header */}
        <div className="bg-black text-white p-6 md:p-8 rounded-[2rem] border border-gray-800 flex flex-wrap items-center justify-between gap-6 shadow-xl mb-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red rounded-full blur-[80px] opacity-20 pointer-events-none -mr-10 -mt-10" />
          
          <div className="relative z-10">
            <span className="text-red font-black text-[9px] tracking-wider uppercase mb-1 block">ACTIVE CANDIDATE CHALLENGE</span>
            <h2 className="text-2xl font-black uppercase tracking-wide leading-none">{sub.expertise} Assessment Workshop</h2>
            <p className="text-gray-400 text-xs mt-1.5 font-medium">Candidate: <span className="font-bold text-white">{sub.name}</span></p>
          </div>

          <div className="flex items-center gap-6 relative z-10 shrink-0">
            <div className="text-right hidden md:block">
              <p className="text-gray-400 font-bold text-[9px] uppercase tracking-widest mb-1">Time Budget</p>
              <p className="text-white font-black text-sm">{sub.assessmentTask?.estimated_time_minutes || 25} Minutes Recommended</p>
            </div>
            
            <div className={`flex items-center gap-2.5 px-6 py-3.5 bg-white/5 border border-white/10 rounded-2xl font-mono font-black text-2xl ${
              timeRemaining < 300 ? 'text-red border-red/30 animate-pulse' : 'text-white'
            }`}>
              <Timer size={22} className="text-red" />
              <span>{formatTime(timeRemaining)}</span>
            </div>
          </div>
        </div>

        {/* Task Scenario details */}
        <div className="bg-white border border-gray-200 rounded-[2rem] p-8 md:p-10 shadow-sm mb-12">
          <div className="flex items-center gap-2 mb-4 text-xs font-black text-gray-400 tracking-wider uppercase">
            <FileText size={16} className="text-red" />
            <span>THE SCENARIO CASE STUDY</span>
          </div>
          <h3 className="text-xl md:text-2xl font-black mb-4 uppercase text-gray-900 leading-snug">The Challenge Context</h3>
          <p className="text-gray-600 text-sm md:text-base leading-relaxed font-medium">
            {sub.assessmentTask?.scenario}
          </p>
        </div>

        {/* Deliverables inputs Form */}
        <div className="space-y-12">
          
          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-red font-black text-sm tracking-wider uppercase">REQUIRED TASK DELIVERABLES</h3>
            <p className="text-gray-400 text-xs mt-1 font-medium">All deliverables must contain at least 10 characters to activate submit.</p>
          </div>

          {/* Deliverable 1 */}
          <div className="space-y-4">
            <label className="font-bold text-gray-800 text-sm flex items-start gap-3">
              <span className="w-6 h-6 bg-black text-white text-[10px] rounded-lg flex items-center justify-center shrink-0 mt-0.5">1</span>
              <span className="leading-snug">{sub.assessmentTask?.deliverable_1}</span>
            </label>
            <textarea
              value={answers.deliverable1}
              onChange={(e) => handleTextareaChange(e, 'deliverable1')}
              placeholder="Provide your diagnostic reasoning here..."
              className="w-full p-6 bg-white border border-gray-200 rounded-2xl focus:border-red focus:bg-white outline-none min-h-[140px] text-sm leading-relaxed font-medium transition-all shadow-sm resize-y"
            />
          </div>

          {/* Deliverable 2 */}
          <div className="space-y-4">
            <label className="font-bold text-gray-800 text-sm flex items-start gap-3">
              <span className="w-6 h-6 bg-black text-white text-[10px] rounded-lg flex items-center justify-center shrink-0 mt-0.5">2</span>
              <span className="leading-snug">{sub.assessmentTask?.deliverable_2}</span>
            </label>
            <textarea
              value={answers.deliverable2}
              onChange={(e) => handleTextareaChange(e, 'deliverable2')}
              placeholder="Provide your coordination drafts or details here..."
              className="w-full p-6 bg-white border border-gray-200 rounded-2xl focus:border-red focus:bg-white outline-none min-h-[140px] text-sm leading-relaxed font-medium transition-all shadow-sm resize-y"
            />
          </div>

          {/* Deliverable 3 */}
          <div className="space-y-4">
            <label className="font-bold text-gray-800 text-sm flex items-start gap-3">
              <span className="w-6 h-6 bg-black text-white text-[10px] rounded-lg flex items-center justify-center shrink-0 mt-0.5">3</span>
              <span className="leading-snug">{sub.assessmentTask?.deliverable_3}</span>
            </label>
            <textarea
              value={answers.deliverable3}
              onChange={(e) => handleTextareaChange(e, 'deliverable3')}
              placeholder="Provide your systemic SOP layout or structural outline here..."
              className="w-full p-6 bg-white border border-gray-200 rounded-2xl focus:border-red focus:bg-white outline-none min-h-[180px] text-sm leading-relaxed font-medium transition-all shadow-sm resize-y"
            />
          </div>

          {/* Bottom actions control bar */}
          <div className="pt-8 border-t border-gray-200 flex flex-col sm:flex-row gap-4 justify-between items-center bg-gray-50 p-6 rounded-2xl border">
            
            <button
              onClick={handleSaveDraft}
              disabled={saveDraftState === 'saving'}
              className="px-6 py-4 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold text-xs uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 shrink-0 shadow-sm"
            >
              {saveDraftState === 'saving' ? (
                <span>Saving Draft...</span>
              ) : saveDraftState === 'saved' ? (
                <>
                  <CheckCircle2 size={14} className="text-green-500" />
                  <span className="text-green-600 font-black">Draft Saved Successfully!</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Save Draft Responses</span>
                </>
              )}
            </button>

            <button
              onClick={handleSubmit}
              disabled={!isSubmitActive}
              className={`px-10 py-4 font-black text-xs tracking-[0.15em] uppercase rounded-xl transition-all flex items-center gap-2 ${
                isSubmitActive 
                  ? 'bg-red hover:bg-black text-white cursor-pointer shadow-xl shadow-red/10'
                  : 'bg-gray-200 text-gray-400 border border-gray-200 cursor-not-allowed'
              }`}
            >
              <span>LOCK & SUBMIT ASSESSMENT</span>
              <Send size={12} />
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

export default AssessmentPage;
