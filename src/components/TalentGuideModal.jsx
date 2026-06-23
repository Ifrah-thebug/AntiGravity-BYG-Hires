import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  X,
  Calendar,
  ClipboardCheck,
  Clock,
  BookOpen,
  Check,
  ArrowRight,
  Mic,
} from 'lucide-react';

const GUIDE_STEPS = [
  {
    id: 'calendar',
    step: 1,
    title: 'Connect your calendar',
    short: 'Sync Cal.com first — intro calls need your live availability.',
    icon: Calendar,
  },
  {
    id: 'assessment',
    step: 2,
    title: 'Take a skills test',
    short: 'Pick one skill and complete the test (~25 min) so clients see verified expertise.',
    icon: ClipboardCheck,
  },
  {
    id: 'voice-interview',
    step: 3,
    title: 'AI voice interview',
    short: 'Only when a client requests it — speak with our AI interviewer about your role.',
    icon: Mic,
  },
  {
    id: 'timings',
    step: 4,
    title: 'Publish intro timings',
    short: 'Choose slots on this page so clients can see when you are free.',
    icon: Clock,
  },
];

function GuideHeader({ doneById, visibleSteps, onClose }) {
  const completedCount = visibleSteps.filter((s) => doneById[s.id]).length;
  const totalSteps = visibleSteps.length;
  const floatIcons = [
    { Icon: Calendar, className: 'top-6 right-24', delay: 0 },
    { Icon: ClipboardCheck, className: 'bottom-5 right-36', delay: 0.35 },
    { Icon: Clock, className: 'top-12 right-10', delay: 0.7 },
  ];

  return (
    <div className="bg-black text-white p-4 pt-5 sm:p-6 relative overflow-hidden shrink-0">
      <div
        className="absolute inset-0 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      />

      <motion.div
        className="absolute top-0 right-0 w-44 h-44 bg-red rounded-full blur-[100px] opacity-30 -mr-14 -mt-14 pointer-events-none"
        animate={{ scale: [1, 1.14, 1], opacity: [0.22, 0.38, 0.22] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-0 left-0 w-32 h-32 bg-red rounded-full blur-[80px] opacity-15 -ml-10 -mb-10 pointer-events-none"
        animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.22, 0.1] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
      />

      {floatIcons.map(({ Icon, className, delay }) => (
        <motion.div
          key={className}
          className={`absolute ${className} text-white pointer-events-none hidden sm:block`}
          style={{ opacity: 0.07 }}
          animate={{ y: [0, -7, 0], rotate: [0, 4, -3, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay }}
        >
          <Icon size={26} strokeWidth={1.75} />
        </motion.div>
      ))}

      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 sm:top-5 sm:right-5 z-20 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
        aria-label="Close guide"
      >
        <X size={16} />
      </button>

      <motion.div
        className="absolute right-5 top-[4.75rem] sm:top-1/2 sm:-translate-y-1/2 pointer-events-none hidden sm:flex"
        initial={{ opacity: 0, scale: 0.85, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.15 }}
      >
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          className="relative"
        >
          <div className="w-[4.5rem] h-[4.5rem] rounded-2xl bg-white/[0.08] border border-white/15 flex items-center justify-center backdrop-blur-sm shadow-lg shadow-black/20">
            <BookOpen size={30} className="text-red" strokeWidth={2} />
          </div>
          <motion.div
            className="absolute inset-0 rounded-2xl border-2 border-red/50"
            animate={{ scale: [1, 1.2, 1], opacity: [0.45, 0, 0.45] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.div
            className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red"
            animate={{ scale: [1, 1.35, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      </motion.div>

      <div className="relative z-10 pr-11 sm:pr-24">
        <div className="min-w-0">
          <motion.div
            className="flex items-center gap-2 mb-2 max-w-[calc(100%-0.5rem)]"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 }}
          >
            <motion.span
              className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-red/20 border border-red/30 text-red sm:hidden"
              animate={{ y: [0, -2, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <BookOpen size={14} strokeWidth={2.25} />
            </motion.span>
            <motion.span
              initial={{ opacity: 0, letterSpacing: '0.12em' }}
              animate={{ opacity: 1, letterSpacing: '0.22em' }}
              transition={{ duration: 0.5 }}
              className="text-red font-black text-[9px] uppercase"
            >
              Talent guide
            </motion.span>
          </motion.div>

          <motion.h2
            id="talent-guide-title"
            className="text-lg sm:text-xl font-black tracking-tight leading-tight pr-1"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 24 }}
          >
            Three quick wins
          </motion.h2>

          <motion.p
            className="text-white/70 text-xs font-semibold mt-2 leading-relaxed max-w-full sm:max-w-[260px]"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
          >
            Do these in order so clients can find you, trust your skills, and book intros.
          </motion.p>

          <motion.div
            className="mt-4 space-y-2"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
          >
            <div className="flex gap-1.5">
              {GUIDE_STEPS.map((step, i) => {
                const done = doneById[step.id];
                return (
                  <motion.div
                    key={step.id}
                    className="h-1 flex-1 rounded-full overflow-hidden bg-white/15"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.32 + i * 0.06, duration: 0.35 }}
                    style={{ transformOrigin: 'left' }}
                  >
                    <motion.div
                      className={`h-full rounded-full ${done ? 'bg-green-500' : 'bg-red/70'}`}
                      initial={{ width: '0%' }}
                      animate={{ width: done ? '100%' : '35%' }}
                      transition={{ type: 'spring', stiffness: 280, damping: 22, delay: 0.4 + i * 0.08 }}
                    />
                  </motion.div>
                );
              })}
            </div>
            <p className="text-[9px] sm:text-[10px] font-bold text-white/45 uppercase tracking-wider leading-snug">
              {completedCount === totalSteps && totalSteps > 0 ? (
                <motion.span
                  className="text-green-400"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  key="all-done"
                >
                  All set — you&apos;re ready for clients
                </motion.span>
              ) : (
                <span>
                  {completedCount} of {totalSteps} complete
                </span>
              )}
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function StepCard({ step, done, index }) {
  const Icon = step.icon;

  return (
    <motion.li
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.12 + index * 0.1, type: 'spring', stiffness: 280, damping: 22 }}
      className={`flex gap-3 rounded-2xl border p-3 sm:p-4 transition-colors ${
        done
          ? 'border-green-200 bg-green-50/60'
          : 'border-gray-100 bg-gray-50/80 hover:border-red/20'
      }`}
    >
      <div className="relative shrink-0">
        <motion.div
          className={`w-11 h-11 rounded-xl flex items-center justify-center ${
            done ? 'bg-green-100 text-green-700' : 'bg-red/10 text-red'
          }`}
          animate={done ? {} : { y: [0, -3, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: index * 0.25 }}
        >
          <Icon size={20} strokeWidth={2.25} />
        </motion.div>
        <span
          className={`absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full text-[9px] font-black flex items-center justify-center border-2 border-white ${
            done ? 'bg-green-600 text-white' : 'bg-black text-white'
          }`}
        >
          {done ? <Check size={10} strokeWidth={3} /> : step.step}
        </span>
      </div>
      <div className="min-w-0 pt-0.5 flex-1">
        <p className="font-black text-sm text-gray-900 leading-tight break-words">{step.title}</p>
        <p className="text-xs font-medium text-gray-600 mt-1 leading-snug break-words">{step.short}</p>
      </div>
    </motion.li>
  );
}

/**
 * Talent onboarding guide — calendar → skills test → publish intro slots.
 */
export default function TalentGuideModal({
  open,
  onClose,
  connectCalendarUrl = '',
  calendarConnected = false,
  assessmentDone = false,
  interviewUnlocked = false,
  interviewCompleted = false,
  introSlotsPublished = false,
  onScrollToTimings,
}) {
  const visibleSteps = GUIDE_STEPS.filter(
    (step) => step.id !== 'voice-interview' || interviewUnlocked
  );

  const doneById = {
    calendar: calendarConnected,
    assessment: assessmentDone,
    'voice-interview': interviewCompleted,
    timings: introSlotsPublished,
  };

  const handleStepAction = (stepId) => {
    if (stepId === 'calendar' && connectCalendarUrl) {
      window.location.href = connectCalendarUrl;
      onClose();
      return;
    }
    if (stepId === 'timings') {
      onScrollToTimings?.();
      onClose();
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] overflow-y-auto overscroll-contain p-0 sm:p-6"
          onClick={onClose}
          role="presentation"
        >
          <div className="min-h-full flex items-end sm:items-center justify-center sm:py-4">
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="talent-guide-title"
            initial={{ scale: 0.98, opacity: 0, y: 32 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0, y: 24 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="bg-white rounded-t-[1.75rem] sm:rounded-[2rem] w-full sm:max-w-md max-h-[min(90dvh,720px)] overflow-hidden flex flex-col shadow-2xl border border-gray-100 border-b-0 sm:border-b"
            onClick={(e) => e.stopPropagation()}
          >
            <GuideHeader doneById={doneById} visibleSteps={visibleSteps} onClose={onClose} />

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4">
              <ol className="space-y-2.5 list-none">
                {visibleSteps.map((step, index) => (
                  <StepCard key={step.id} step={step} done={doneById[step.id]} index={index} />
                ))}
              </ol>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="flex flex-col gap-2"
              >
                {!calendarConnected && connectCalendarUrl && (
                  <button
                    type="button"
                    onClick={() => handleStepAction('calendar')}
                    className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-3 bg-black hover:bg-red text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors"
                  >
                    <Calendar size={14} /> Connect calendar
                  </button>
                )}
                {!assessmentDone && (
                  <Link
                    to="/assessment"
                    onClick={onClose}
                    className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-gray-200 hover:border-red text-gray-900 text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors"
                  >
                    <ClipboardCheck size={14} /> Skills test
                  </Link>
                )}
                {interviewUnlocked && assessmentDone && !interviewCompleted && (
                  <Link
                    to="/interview"
                    onClick={onClose}
                    className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-gray-200 hover:border-red text-gray-900 text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors"
                  >
                    <Mic size={14} /> AI voice interview
                  </Link>
                )}
                {!introSlotsPublished && (
                  <button
                    type="button"
                    onClick={() => handleStepAction('timings')}
                    className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-3 bg-red/5 border border-red/20 hover:bg-red hover:text-white text-red text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors"
                  >
                    <Clock size={14} /> Set timings
                  </button>
                )}
              </motion.div>
            </div>

            <div className="shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 bg-gray-50/80 space-y-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <p className="text-[10px] font-semibold text-gray-500 text-center leading-relaxed px-1">
                Reopen from <span className="font-black text-gray-700">Guide</span> on My Portal or the top menu.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-[44px] py-3.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:text-black hover:border-gray-300 text-[10px] font-black uppercase tracking-widest transition-colors inline-flex items-center justify-center gap-2 shadow-sm"
              >
                Got it <ArrowRight size={12} />
              </button>
            </div>
          </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const TALENT_GUIDE_STORAGE_KEY = 'byg_talent_guide_seen';
