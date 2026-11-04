import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  MessageCircle, X, Send, Loader2, Sparkles, ArrowRight, DollarSign, ExternalLink, Trash2,
  Mic, MicOff,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAccountType } from '../../hooks/useAccountType';
import { useSpeechToText } from '../../hooks/useSpeechToText';
import { ACCOUNT_PROFILE_UPDATED } from '../../lib/talentAuth';
import {
  fetchTalentChatSession,
  fetchTalentChatNotifications,
  sendTalentChatMessage,
  clearTalentChatSession,
  QUICK_PROMPTS,
} from '../../lib/talentChat';
import {
  fetchClientChatSession,
  fetchClientChatNotifications,
  sendClientChatMessage,
  clearClientChatSession,
  CLIENT_QUICK_PROMPTS,
} from '../../lib/clientChat';
import {
  BGuidesCommandType,
  dispatchBGuidesUiCommands,
  highlightDomSection,
} from '../../lib/bguidesUiCommands';

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
  const bubbleRef = useRef(null);

  useEffect(() => {
    if (!isUser && bubbleRef.current) {
      bubbleRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isUser, message.id]);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        ref={bubbleRef}
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
      highlightDomSection(sectionId);
      return;
    }
    if (tries < 15) {
      setTimeout(() => attemptScroll(tries + 1), 120);
    }
  };

  const initialDelay = pathname === window.location.pathname ? 120 : 380;
  setTimeout(() => attemptScroll(), initialDelay);
}

function applyUiCommands(commands) {
  if (!Array.isArray(commands) || !commands.length) return;
  dispatchBGuidesUiCommands(commands);
}

function todayKey(prefix) {
  const d = new Date();
  return `${prefix}-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function GuestBGuidesCta() {
  return (
    <Link
      to="/login"
      className="fixed z-[90] bottom-5 right-4 sm:right-6 flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white border border-gray-200 text-gray-800 font-black text-[10px] uppercase tracking-widest shadow-lg hover:border-red hover:text-red transition-colors"
    >
      <Sparkles size={14} className="text-red" />
      <span className="hidden sm:inline">Sign in for BGuides</span>
      <span className="sm:hidden">Sign in</span>
    </Link>
  );
}

/** Single BGuides agent shell — talent onboarding OR client hiring (role-aware). */
export default function TalentOnboardingChat() {
  const { user } = useAuth();
  const accountType = useAccountType(user);
  const location = useLocation();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([]);
  const [context, setContext] = useState(null);
  const [input, setInput] = useState('');
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [clearing, setClearing] = useState(false);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const sendingRef = useRef(false);
  const pendingRefreshRef = useRef(false);
  const endRef = useRef(null);
  const voiceBaseRef = useRef('');

  const applyVoiceTranscript = useCallback(({ interim, finalsJoined }) => {
    const base = voiceBaseRef.current.trim();
    const spoken = [finalsJoined, interim].filter(Boolean).join(' ').trim();
    const next = [base, spoken].filter(Boolean).join(base && spoken ? ' ' : '');
    setInput(next);
  }, []);

  const {
    supported: voiceSupported,
    listening: voiceListening,
    error: voiceError,
    toggle: toggleVoice,
    stop: stopVoice,
    resetError: resetVoiceError,
  } = useSpeechToText({ onTranscript: applyVoiceTranscript });

  const currentPath = `${location.pathname}${location.search}${location.hash}`;
  const chatRole = accountType === 'client' ? 'client' : accountType === 'talent' ? 'talent' : null;
  const onGuestSurface =
    location.pathname === '/talent' ||
    location.pathname === '/portal' ||
    location.pathname === '/client' ||
    location.pathname.startsWith('/request-intro');
  const showGuestCta = accountType === 'guest' && onGuestSurface && !location.pathname.startsWith('/admin');

  const visible =
    Boolean(user?.id) &&
    Boolean(chatRole) &&
    !location.pathname.startsWith('/admin') &&
    !location.pathname.startsWith('/ambassador');

  const quickPrompts = useMemo(() => {
    const fromSteps = (context?.nextSteps || [])
      .slice(0, 4)
      .map((s) => s.prompt || s.label)
      .filter(Boolean);
    if (fromSteps.length) return fromSteps;
    return chatRole === 'client' ? CLIENT_QUICK_PROMPTS : QUICK_PROMPTS;
  }, [chatRole, context?.nextSteps]);

  const subtitle = useMemo(() => {
    if (chatRole === 'client') {
      return context?.guideNotificationLabel || 'Describe a role — I filter talent live';
    }
    return (
      context?.guideNotificationLabel ||
      (context?.pendingPortfolioRequestCount > 0
        ? `${context.pendingPortfolioRequestCount} portfolio request${context.pendingPortfolioRequestCount > 1 ? 's' : ''} waiting`
        : context?.directoryStatus === 'approved'
          ? 'Profile live — let\'s get you more intros'
          : 'Finish your profile faster')
    );
  }, [chatRole, context]);

  const completionText = useMemo(() => {
    if (chatRole === 'client') return context?.completionLabel || null;
    const c = context?.completion;
    if (c && Number.isFinite(c.done) && Number.isFinite(c.total)) {
      return `${c.done} of ${c.total} setup steps`;
    }
    return null;
  }, [chatRole, context]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    });
  }, []);

  const prefetchNotifications = useCallback(async () => {
    if (!visible || !chatRole) return;
    try {
      const data =
        chatRole === 'client'
          ? await fetchClientChatNotifications()
          : await fetchTalentChatNotifications(currentPath);
      setContext((prev) => ({
        ...(prev || {}),
        ...(data.context || {}),
        guideNotificationCount:
          data.guideNotificationCount ?? data.context?.guideNotificationCount ?? 0,
        guideNotificationLabel:
          data.guideNotificationLabel ?? data.context?.guideNotificationLabel ?? null,
        nextSteps: data.context?.nextSteps || prev?.nextSteps || [],
        completion: data.completion || data.context?.completion || prev?.completion,
        completionLabel:
          data.completionLabel || data.context?.completionLabel || prev?.completionLabel,
      }));
    } catch {
      // Badge prefetch is best-effort; full session load still works when opened.
    }
  }, [visible, chatRole, currentPath]);

  const loadSession = useCallback(async () => {
    if (!visible || !chatRole) return;
    setLoading(true);
    setError('');
    try {
      const data =
        chatRole === 'client'
          ? await fetchClientChatSession()
          : await fetchTalentChatSession(currentPath);
      const nextMessages = data.messages || [];
      setMessages(nextMessages);
      setContext(data.context || null);
      // Do not auto-apply HIGHLIGHT/NAVIGATE on session load — that remounts the route
      // mid-chat and surfaces as "Connection lost while BGuides was thinking."
    } catch (err) {
      setError(err.message || 'Could not load chat.');
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }, [visible, chatRole, currentPath, scrollToBottom]);

  // Prefetch badge without opening the panel
  useEffect(() => {
    if (!visible) return undefined;
    prefetchNotifications();
    return undefined;
  }, [visible, prefetchNotifications, refreshNonce, currentPath]);

  useEffect(() => {
    if (!visible || !open || sendingRef.current) return;
    loadSession();
  }, [visible, open, refreshNonce, loadSession]);

  useEffect(() => {
    if (!visible || chatRole !== 'talent') return undefined;
    const onProfileUpdated = () => {
      if (sendingRef.current) {
        pendingRefreshRef.current = true;
        return;
      }
      setRefreshNonce((n) => n + 1);
    };
    window.addEventListener(ACCOUNT_PROFILE_UPDATED, onProfileUpdated);
    return () => window.removeEventListener(ACCOUNT_PROFILE_UPDATED, onProfileUpdated);
  }, [visible, chatRole]);

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

  // Auto-open once per session for clients landing on directory / client hub
  useEffect(() => {
    if (!visible || chatRole !== 'client') return;
    const key = 'bguides-client-autopened';
    if (sessionStorage.getItem(key)) return;
    const onHiringSurface =
      location.pathname === '/talent' ||
      location.pathname === '/client' ||
      location.pathname.startsWith('/request-intro');
    if (!onHiringSurface) return;
    sessionStorage.setItem(key, '1');
    setOpen(true);
  }, [visible, chatRole, location.pathname]);

  // Soft once-per-day auto-open for talent on /portal when there are notifications
  useEffect(() => {
    if (!visible || chatRole !== 'talent') return;
    if (location.pathname !== '/portal') return;
    const count = Number(context?.guideNotificationCount) || 0;
    if (count <= 0) return;
    const key = todayKey('bguides-talent-portal-autopen');
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    setOpen(true);
  }, [visible, chatRole, location.pathname, context?.guideNotificationCount]);

  const handleSend = async (text) => {
    const msg = String(text ?? input).trim();
    if (!msg || sending || navigating || !chatRole) return;

    stopVoice();
    voiceBaseRef.current = '';
    setInput('');
    sendingRef.current = true;
    setSending(true);
    setError('');
    resetVoiceError();

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
      const data =
        chatRole === 'client'
          ? await sendClientChatMessage(msg)
          : await sendTalentChatMessage(msg, currentPath);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimistic.id),
        { ...optimistic, id: `user-${Date.now()}` },
        data.message,
      ]);
      setContext(data.context || null);
      applyUiCommands(data.message?.uiCommands || data.uiCommands || []);
    } catch (err) {
      const friendly = /failed to fetch|networkerror|load failed/i.test(String(err?.message || ''))
        ? 'Connection lost while BGuides was thinking. Checking if your message was saved…'
        : (err.message || 'Could not send message.');
      setError(friendly);
      try {
        const data =
          chatRole === 'client'
            ? await fetchClientChatSession()
            : await fetchTalentChatSession(currentPath);
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

  const closePanel = () => {
    stopVoice();
    voiceBaseRef.current = '';
    resetVoiceError();
    setOpen(false);
  };

  const handleMicClick = () => {
    if (sending || navigating || clearing) return;
    if (voiceListening) {
      stopVoice();
      return;
    }
    resetVoiceError();
    setError('');
    voiceBaseRef.current = input.trim();
    toggleVoice();
  };

  const handleClearChat = async () => {
    if (!chatRole || clearing || sending) return;
    stopVoice();
    voiceBaseRef.current = '';
    resetVoiceError();
    const ok = window.confirm('Clear this BGuides chat? You’ll get a fresh welcome and proactive tips.');
    if (!ok) return;
    setClearing(true);
    setError('');
    try {
      const data =
        chatRole === 'client'
          ? await clearClientChatSession()
          : await clearTalentChatSession(currentPath);
      setMessages(data.messages || []);
      setContext(data.context || null);
      scrollToBottom();
    } catch (err) {
      setError(err.message || 'Could not clear chat.');
    } finally {
      setClearing(false);
    }
  };

  const handleAction = (action) => {
    if (!action || navigating) return;

    const hasUiCommands = Array.isArray(action.uiCommands) && action.uiCommands.length > 0;
    if (hasUiCommands) {
      applyUiCommands(action.uiCommands);
    }

    if (action.id === 'book' && action.talentId) {
      applyUiCommands([{ type: BGuidesCommandType.OPEN_BOOKING, payload: { talentId: action.talentId } }]);
      closePanel();
      return;
    }

    if (!action.href) {
      if (hasUiCommands) closePanel();
      return;
    }
    if (action.external || action.href.startsWith('http')) {
      window.open(action.href, '_blank', 'noopener,noreferrer');
      return;
    }

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

    const appliedDirectoryFilters = hasUiCommands
      && action.uiCommands.some((c) => c?.type === BGuidesCommandType.APPLY_DIRECTORY_FILTERS);
    const bareTalentNav = targetPath === '/talent' && !targetSearch && !targetHash;
    if (appliedDirectoryFilters && bareTalentNav) {
      closePanel();
      setTimeout(() => setRefreshNonce((n) => n + 1), 800);
      return;
    }

    setNavigating(true);
    navigate({ pathname: targetPath, search: targetSearch, hash: targetHash });
    scrollToSectionTarget({ pathname: targetPath, hash: targetHash, search: targetSearch });
    if (hash) {
      applyUiCommands([
        {
          type: BGuidesCommandType.HIGHLIGHT_SECTION,
          payload: { sectionId: hash, pathname: targetPath, search: targetSearch },
        },
      ]);
    }
    closePanel();
    setTimeout(() => {
      setNavigating(false);
      setRefreshNonce((n) => n + 1);
    }, 800);
  };

  if (showGuestCta) {
    return <GuestBGuidesCta />;
  }

  if (!visible) return null;

  const busy = sending || navigating;
  const bannerError = error || voiceError;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', damping: 28, stiffness: 360 }}
            className="fixed z-[90] bottom-24 right-4 sm:right-6 w-[min(100vw-2rem,24rem)] sm:w-[26rem] max-h-[min(72vh,640px)] sm:max-h-[min(78vh,640px)] bg-white border border-gray-200 rounded-[1.75rem] shadow-[0_24px_80px_-20px_rgba(0,0,0,0.35)] flex flex-col overflow-hidden mb-[env(safe-area-inset-bottom,0px)]"
          >
            <div className="bg-black text-white px-5 py-4 relative shrink-0">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red rounded-full blur-[80px] opacity-25 -mr-10 -mt-10 pointer-events-none" />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red flex items-center gap-1">
                    <Sparkles size={10} />
                    {chatRole === 'client' ? 'Hiring assistant' : 'Onboarding assistant'}
                  </p>
                  <h3 className="font-black text-base tracking-tight mt-0.5">BGuides</h3>
                  <p className="text-[11px] text-gray-400 font-medium mt-1">{subtitle}</p>
                  {completionText && (
                    <p className="text-[10px] text-gray-500 font-bold mt-1.5 tracking-wide">
                      {completionText}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleClearChat}
                    disabled={clearing || sending || loading}
                    className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center disabled:opacity-40"
                    aria-label="Clear chat"
                    title="Clear chat"
                  >
                    {clearing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={closePanel}
                    className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center"
                    aria-label="Close chat"
                  >
                    <X size={15} />
                  </button>
                </div>
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
              <div ref={endRef} />
            </div>

            {bannerError && (
              <div className="px-4 py-2 bg-red/5 border-t border-red/10 text-red text-[11px] font-semibold flex items-start justify-between gap-2">
                <span className="min-w-0">{bannerError}</span>
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    resetVoiceError();
                  }}
                  className="shrink-0 text-red/70 hover:text-red"
                  aria-label="Dismiss error"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {!loading && messages.length <= 3 && (
              <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1.5 bg-white border-t border-gray-100">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleSend(prompt)}
                    disabled={busy}
                    className="px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-red/5 hover:text-red border border-gray-200 text-[10px] font-bold text-gray-600 transition-colors disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            <form
              className="p-3 bg-white border-t border-gray-100 flex gap-2 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  if (voiceListening) stopVoice();
                  voiceBaseRef.current = e.target.value;
                  setInput(e.target.value);
                }}
                placeholder={
                  voiceListening
                    ? 'Listening…'
                    : chatRole === 'client'
                      ? 'Describe the talent you need…'
                      : 'Ask about your profile…'
                }
                disabled={busy}
                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-red outline-none disabled:opacity-50"
              />
              {voiceSupported && (
                <button
                  type="button"
                  onClick={handleMicClick}
                  disabled={busy || clearing}
                  title={voiceListening ? 'Stop listening' : 'Speak instead of typing'}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center disabled:opacity-40 transition-colors shrink-0 ${
                    voiceListening
                      ? 'bg-red text-white animate-pulse'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                  aria-label={voiceListening ? 'Stop voice input' : 'Start voice input'}
                  aria-pressed={voiceListening}
                >
                  {voiceListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              )}
              <button
                type="submit"
                disabled={busy || !input.trim()}
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
        onClick={() => {
          if (open) closePanel();
          else setOpen(true);
        }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className={`fixed z-[90] bottom-5 right-4 sm:right-6 flex items-center gap-2 px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-colors mb-[env(safe-area-inset-bottom,0px)] ${
          open ? 'bg-black text-white' : 'bg-red hover:bg-black text-white'
        }`}
        aria-label={open ? 'Close BGuides' : 'Open BGuides'}
      >
        {open ? <X size={16} /> : <MessageCircle size={16} />}
        <span className="hidden sm:inline">{open ? 'Close' : 'BGuides'}</span>
        {!open && Number(context?.guideNotificationCount) > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-red text-[9px] font-black flex items-center justify-center border-2 border-red leading-none">
            {context.guideNotificationCount > 9 ? '9+' : context.guideNotificationCount}
          </span>
        )}
      </motion.button>
    </>
  );
}
