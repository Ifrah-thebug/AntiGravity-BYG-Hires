// src/components/MockEmailSimulator.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ChevronDown, ChevronUp, Bell, CheckCircle2, FileText, Lock, Send, Inbox, ExternalLink, X } from 'lucide-react';
import { talentService } from '../services/talentService';
import { Link, useNavigate } from 'react-router-dom';

const MockEmailSimulator = () => {
  const [emails, setEmails] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeEmail, setActiveEmail] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  const loadEmails = () => {
    const list = talentService.getEmails();
    setEmails(list);
    
    // Simple unread count based on storage vs state
    const lastViewed = sessionStorage.getItem('byg_last_email_viewed') || 0;
    const unread = list.filter(e => new Date(e.timestamp).getTime() > Number(lastViewed));
    setUnreadCount(unread.length);
  };

  useEffect(() => {
    loadEmails();
    
    // Listen to storage events so we catch emails immediately
    window.addEventListener('storage', loadEmails);
    const interval = setInterval(loadEmails, 2000);

    return () => {
      window.removeEventListener('storage', loadEmails);
      clearInterval(interval);
    };
  }, []);

  const toggleInbox = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      sessionStorage.setItem('byg_last_email_viewed', Date.now().toString());
      setUnreadCount(0);
    }
  };

  const selectEmail = (email) => {
    setActiveEmail(email);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    talentService.clearEmails();
    setActiveEmail(null);
    setEmails([]);
  };

  const navigateToEmailAction = (email) => {
    setIsOpen(false);
    if (email.token) {
      navigate(`/assessment?token=${email.token}`);
    } else if (email.talentId) {
      navigate(`/talent/dashboard?id=${email.talentId}`);
    }
  };

  return (
    <>
      {/* Floating Mail Indicator */}
      <div className="fixed bottom-6 left-6 z-[100]">
        <button
          onClick={toggleInbox}
          className={`flex items-center gap-3 px-5 py-3.5 bg-black text-white border-2 rounded-full font-black text-xs uppercase tracking-widest shadow-2xl transition-all duration-300 relative group ${
            unreadCount > 0 ? 'border-red animate-pulse' : 'border-gray-800 hover:border-red hover:bg-red'
          }`}
        >
          <Mail size={16} className={`text-red group-hover:text-white transition-colors ${unreadCount > 0 ? 'animate-bounce' : ''}`} />
          <span>Transactional Mail Simulator</span>
          
          {unreadCount > 0 ? (
            <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red text-white flex items-center justify-center font-bold text-[10px] border-2 border-black animate-none">
              {unreadCount}
            </span>
          ) : (
            emails.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-gray-800 text-gray-400 flex items-center justify-center font-bold text-[9px]">
                {emails.length}
              </span>
            )
          )}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ scale: 0.9, y: 100, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-24 left-6 w-[360px] md:w-[420px] h-[500px] bg-white text-black border-2 border-gray-200 shadow-2xl rounded-3xl z-[99] flex flex-col font-sans overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-black text-white border-b border-gray-800 shrink-0">
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-red" />
                <span className="font-black tracking-widest text-xs uppercase">MAILBOX SIMULATOR</span>
              </div>
              <div className="flex items-center gap-3">
                {emails.length > 0 && (
                  <button 
                    onClick={handleClear}
                    className="text-[10px] font-bold text-gray-400 hover:text-red transition-colors uppercase"
                  >
                    Clear All
                  </button>
                )}
                <button 
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Main view container */}
            <div className="flex flex-1 overflow-hidden min-h-0 bg-gray-50">
              
              {/* If no emails */}
              {emails.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
                  <Inbox size={48} className="text-gray-300 mb-4 stroke-1 animate-pulse" />
                  <p className="font-bold text-gray-700 mb-1">Your inbox is empty</p>
                  <p className="text-xs text-gray-400 leading-normal max-w-[240px]">Apply to the talent pool on the main page to trigger your initial invitation email.</p>
                </div>
              ) : activeEmail ? (
                
                /* DETAILED VIEW */
                <div className="flex-1 flex flex-col h-full bg-white animate-fadeIn">
                  {/* Subject Details */}
                  <div className="p-5 border-b border-gray-100 bg-gray-50 shrink-0">
                    <button 
                      onClick={() => setActiveEmail(null)}
                      className="text-[10px] font-bold text-red hover:text-black uppercase tracking-wider mb-3 flex items-center gap-1"
                    >
                      &larr; Back to Inbox
                    </button>
                    <h3 className="font-black text-base text-gray-900 leading-tight mb-2">{activeEmail.subject}</h3>
                    <div className="flex items-center justify-between text-[11px] text-gray-500 font-medium">
                      <span>To: <span className="font-bold text-gray-700">{activeEmail.to}</span></span>
                      <span>{new Date(activeEmail.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-6 flex-1 overflow-y-auto min-h-0 text-sm text-gray-700 font-medium leading-relaxed whitespace-pre-wrap">
                    {activeEmail.body}
                  </div>

                  {/* Dynamic CTA Button inside email */}
                  {(activeEmail.token || activeEmail.talentId) && (
                    <div className="p-5 border-t border-gray-100 bg-gray-50 shrink-0">
                      <button
                        onClick={() => navigateToEmailAction(activeEmail)}
                        className="w-full py-3 bg-red hover:bg-black text-white font-black text-[11px] tracking-widest uppercase rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red/10"
                      >
                        {activeEmail.type === 'assessment_invite' && 'Start 25-Min Assessment Challenge'}
                        {activeEmail.type === 'revision_email' && 'Revise Assessment Responses'}
                        {activeEmail.type === 'admit_email' && 'Access Admitted Dashboard'}
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  )}
                </div>

              ) : (

                /* INBOX LIST */
                <div className="flex-1 overflow-y-auto min-h-0 bg-white">
                  {emails.map((email, idx) => (
                    <div
                      key={email.id}
                      onClick={() => selectEmail(email)}
                      className={`p-5 border-b border-gray-100 hover:bg-red/5 cursor-pointer transition-all duration-200 relative group flex gap-3.5 items-start ${
                        idx === 0 && unreadCount > 0 ? 'bg-red/[0.03]' : ''
                      }`}
                    >
                      {/* Read/Unread dot indicator */}
                      {idx === 0 && unreadCount > 0 && (
                        <div className="absolute top-6 left-2.5 w-2 h-2 rounded-full bg-red animate-pulse"></div>
                      )}

                      <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-500 group-hover:bg-red group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                        <Mail size={16} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{email.to}</span>
                          <span className="text-[10px] text-gray-400 font-medium">
                            {new Date(email.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-gray-900 truncate mb-1 pr-4">{email.subject}</h4>
                        <p className="text-xs text-gray-500 line-clamp-2 leading-normal">{email.body}</p>
                      </div>
                    </div>
                  ))}
                </div>

              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default MockEmailSimulator;
