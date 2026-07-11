import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  MessageCircle, X, Send, Loader2, Sparkles, ArrowRight, DollarSign, ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAccountType } from '../../hooks/useAccountType';
import { ACCOUNT_PROFILE_UPDATED } from '../../lib/talentAuth';
import {
  fetchTalentChatSession,
  sendTalentChatMessage,
  QUICK_PROMPTS,
} from '../../lib/talentChat';

function PricingTipCard({ tip }) {
  if (!tip?.suggestedMonthlyUsd) return null;
  return (
    <div className="mt-3 p-3 rounded-xl bg-black text-white border border-white/10">
      <p className="text-[9px] font-black uppercase tracking-widest text-red mb-2 flex items-center gap-1">
        <DollarSign size={10} /> Suggested pricing
      </p>
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <p className="text-[10px] text-gray-400 font-bold uppercase">Monthly</p>
          <p className="text-xl font-black">${tip.suggestedMonthlyUsd}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 font-bold uppercase">Client sees</p>
          <p className="text-lg font-black text-red">${tip.suggestedDirectoryUsd}</p>
        </div>
      </div>
      {tip.rationale && (
        <p className="text-[11px] text-gray-300 font-medium mt-2 leading-relaxed">{tip.rationale}</p>
      )}
    </div>
  );
}

function ActionButtons({ actions, onAction }) {
  if (!actions?.length) return null;
  return (
    <div className="mt-3 flex flex-col gap-2">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={() => onAction(action)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-red hover:bg-black text-white text-[10px] font-black uppercase tracking-widest transition-colors text-left"
        >
          <span>{action.label}</span>
          {action.external ? <ExternalLink size={12} className="shrink-0" /> : <ArrowRight size={12} className="shrink-0" />}
        </button>
      ))}
    </div>
  );
}

function ChatMessage({ message, onAction }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm font-medium leading-relaxed ${
          isUser
            ? 'bg-black text-white rounded-br-md'
            : 'bg-gray-50 text-gray-700 border border-gray-100 rounded-bl-md'
        }`}
      >
        {!isUser && (
          <p className="text-[9px] font-black uppercase tracking-widest text-red mb-1.5 flex items-center gap-1">
            <Sparkles size={9} /> BGuides
          </p>
        )}
        <p className="whitespace-pre-wrap">{message.content}</p>
        {!isUser && <PricingTipCard tip={message.pricingTip} />}
        {!isUser && <ActionButtons actions={message.actions} onAction={onAction} />}
      </div>
    </div>
  );
}

function scrollToSectionTarget({ pathname, hash, search }) {
  const sectionId = String(hash || '').replace(/^#/, '');
  if (!sectionId) return;

  const searchRaw = String(search || '').replace(/^\?/, '');
  const params = new URLSearchParams(searchRaw);
  const openAddPortfolio = params.get('portfolio') === 'add' || params.get('add') === '1';

  const attemptScroll = (tries = 0) => {
    if (pathname === '/portal' && sectionId === 'talent-portfolio') {
      window.dispatchEvent(new CustomEvent('byg-portfolio-scroll', { detail: { openAdd: openAddPortfolio } }));
    }

    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (tries < 15) {
      setTimeout(() => attemptScroll(tries + 1), 120);
    }
  };

  const initialDelay = pathname === window.location.pathname ? 120 : 380;
  setTimeout(() => attemptScroll(), initialDelay);
}

export default function TalentOnboardingChat() {
  const { user } = useAuth();
  const accountType = useAccountType(user);
  const location = useLocation();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([]);
  const [context, setContext] = useState(null);
  const [input, setInput] = useState('');
  const [refreshNonce, setRefreshNonce] = useState(0);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const sendingRef = useRef(false);
  const pendingRefreshRef = useRef(false);

  const currentPath = `${location.pathname}${location.search}${location.hash}`;
  const visible = Boolean(user?.id) && accountType === 'talent' && !location.pathname.startsWith('/admin');

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    });
  }, []);

  const loadSession = useCallback(async () => {
    if (!visible) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchTalentChatSession(currentPath);
      setMessages(data.messages || []);
      setContext(data.context || null);
    } catch (err) {
      setError(err.message || 'Could not load chat.');
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }, [visible, currentPath, scrollToBottom]);

  useEffect(() => {
    if (!visible || !open || sendingRef.current) return;
    loadSession();
  }, [visible, open, refreshNonce, loadSession]);

  useEffect(() => {
    if (!visible) return undefined;
    const onProfileUpdated = () => {
      if (sendingRef.current) {
        pendingRefreshRef.current = true;
        return;
      }
      setRefreshNonce((n) => n + 1);
    };
    window.addEventListener(ACCOUNT_PROFILE_UPDATED, onProfileUpdated);
    return () => window.removeEventListener(ACCOUNT_PROFILE_UPDATED, onProfileUpdated);
  }, [visible]);

  useEffect(() => {
    if (!open || !visible || sendingRef.current) return;
    setRefreshNonce((n) => n + 1);
  }, [currentPath, open, visible]);

  useEffect(() => {
    if (open) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open, messages, scrollToBottom]);

  const handleSend = async (text) => {
    const msg = String(text ?? input).trim();
    if (!msg || sending) return;

    setInput('');
    sendingRef.current = true;
    setSending(true);
    setError('');

    const optimistic = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content: msg,
      actions: [],
      pricingTip: null,
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollToBottom();

    try {
      const data = await sendTalentChatMessage(msg, currentPath);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimistic.id),
        { ...optimistic, id: `user-${Date.now()}` },
        data.message,
      ]);
      setContext(data.context || null);
    } catch (err) {
      const friendly = /failed to fetch|networkerror|load failed/i.test(String(err?.message || ''))
        ? 'Connection lost while BGuides was thinking. Checking if your message was saved…'
        : (err.message || 'Could not send message.');
      setError(friendly);
      try {
        const data = await fetchTalentChatSession(currentPath);
        setMessages(data.messages || []);
        setContext(data.context || null);
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
      if (pendingRefreshRef.current) {
        pendingRefreshRef.current = false;
        setRefreshNonce((n) => n + 1);
      }
      scrollToBottom();
    }
  };

  const handleAction = (action) => {
    if (!action?.href) return;
    if (action.external || action.href.startsWith('http')) {
      window.open(action.href, '_blank', 'noopener,noreferrer');
    } else {
      const rawHref = String(action.href).trim();
      const hashIndex = rawHref.indexOf('#');
      const pathPart = hashIndex >= 0 ? rawHref.slice(0, hashIndex) : rawHref;
      const hash = hashIndex >= 0 ? rawHref.slice(hashIndex + 1) : '';
      const queryIndex = pathPart.indexOf('?');
      const pathname = queryIndex >= 0 ? pathPart.slice(0, queryIndex) : pathPart;
      const search = queryIndex >= 0 ? pathPart.slice(queryIndex) : '';
      const targetPath = pathname || location.pathname;
      const targetSearch = search || '';
      const targetHash = hash ? `#${hash}` : '';
      navigate({ pathname: targetPath, search: targetSearch, hash: targetHash });
      scrollToSectionTarget({ pathname: targetPath, hash: targetHash, search: targetSearch });
      setOpen(false);
      setTimeout(() => setRefreshNonce((n) => n + 1), 800);
    }
  };

  if (!visible) return null;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', damping: 28, stiffness: 360 }}
            className="fixed z-[90] bottom-24 right-4 sm:right-6 w-[min(100vw-2rem,24rem)] sm:w-[26rem] max-h-[min(78vh,640px)] bg-white border border-gray-200 rounded-[1.75rem] shadow-[0_24px_80px_-20px_rgba(0,0,0,0.35)] flex flex-col overflow-hidden"
          >
            <div className="bg-black text-white px-5 py-4 relative shrink-0">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red rounded-full blur-[80px] opacity-25 -mr-10 -mt-10 pointer-events-none" />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red flex items-center gap-1">
                    <Sparkles size={10} /> Onboarding assistant
                  </p>
                  <h3 className="font-black text-base tracking-tight mt-0.5">BGuides</h3>
                  <p className="text-[11px] text-gray-400 font-medium mt-1">
                    {context?.directoryStatus === 'approved'
                      ? 'Profile live — let\'s get you more intros'
                      : 'Finish your profile faster'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center shrink-0"
                  aria-label="Close chat"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-[#fafafa]">
              {loading && messages.length === 0 ? (
                <div className="flex justify-center py-10">
                  <Loader2 size={22} className="animate-spin text-gray-300" />
                </div>
              ) : (
                messages.map((m) => (
                  <ChatMessage key={m.id} message={m} onAction={handleAction} />
                ))
              )}
              {sending && (
                <div className="flex justify-start">
                  <div className="px-4 py-3 rounded-2xl bg-gray-50 border border-gray-100 text-gray-400 text-xs font-bold flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin" /> Thinking…
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="px-4 py-2 bg-red/5 border-t border-red/10 text-red text-[11px] font-semibold">
                {error}
              </div>
            )}

            {!loading && messages.length <= 2 && (
              <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1.5 bg-white border-t border-gray-100">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleSend(prompt)}
                    disabled={sending}
                    className="px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-red/5 hover:text-red border border-gray-200 text-[10px] font-bold text-gray-600 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            <form
              className="p-3 bg-white border-t border-gray-100 flex gap-2 shrink-0"
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your profile…"
                disabled={sending}
                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-red outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="w-11 h-11 rounded-xl bg-red hover:bg-black text-white flex items-center justify-center disabled:opacity-40 transition-colors shrink-0"
                aria-label="Send message"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className={`fixed z-[90] bottom-5 right-4 sm:right-6 flex items-center gap-2 px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-colors ${
          open ? 'bg-black text-white' : 'bg-red hover:bg-black text-white'
        }`}
        aria-label={open ? 'Close BGuides' : 'Open BGuides'}
      >
        {open ? <X size={16} /> : <MessageCircle size={16} />}
        <span className="hidden sm:inline">{open ? 'Close' : 'BGuides'}</span>
      </motion.button>
    </>
  );
}
