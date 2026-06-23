import React from 'react';
import { motion } from 'framer-motion';
import { Headphones, Mic, Sparkles, Wifi } from 'lucide-react';

export default function VoiceInterviewLanding({ context, onStart, isLoading, hasPreviousAttempt = false }) {
  const jobRole = context?.roleTitle || 'your role';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden bg-black text-white rounded-[2rem] p-8 sm:p-10 border border-black shadow-2xl"
    >
      <div className="absolute top-0 right-0 w-56 h-56 bg-red rounded-full blur-[100px] opacity-25 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-40 h-40 bg-red rounded-full blur-[80px] opacity-15 pointer-events-none" />

      <div className="relative z-10 space-y-6">
        <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-red">
          <Sparkles size={12} /> AI voice interview
        </p>

        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            {hasPreviousAttempt ? 'Ready for another interview?' : 'Ready for your interview?'}
          </h1>
          <p className="text-gray-300 font-medium mt-3 leading-relaxed max-w-lg">
            You&apos;ll speak with our AI interviewer about the{' '}
            <span className="text-white font-bold">{jobRole}</span> position. It works like a phone
            call in your browser — no video required.
          </p>
        </div>

        <ul className="grid sm:grid-cols-2 gap-3 text-sm">
          {[
            { icon: Mic, text: 'Find a quiet place and allow microphone access' },
            { icon: Headphones, text: 'Use headphones to reduce echo' },
            { icon: Wifi, text: 'Stable internet connection recommended' },
            { icon: Sparkles, text: 'Speak clearly — one question at a time' },
          ].map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-2xl p-4"
            >
              <Icon size={16} className="text-red shrink-0 mt-0.5" />
              <span className="text-gray-200 font-medium leading-snug">{text}</span>
            </li>
          ))}
        </ul>

        {context?.assessed_skills?.length > 0 && (
          <p className="text-[11px] font-semibold text-gray-400">
            Skills verified: {context.assessed_skills.join(', ')}
          </p>
        )}

        {hasPreviousAttempt && (
          <p className="text-[11px] font-semibold text-gray-400">
            Your most recent score is saved — this attempt will create a new evaluation.
          </p>
        )}

        <button
          type="button"
          onClick={onStart}
          disabled={isLoading}
          className="w-full py-4 bg-red hover:bg-white hover:text-black disabled:opacity-50 text-white font-black text-sm uppercase tracking-widest rounded-2xl transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? 'Connecting…' : hasPreviousAttempt ? 'Retake voice interview' : 'Begin voice interview'}
        </button>
      </div>
    </motion.div>
  );
}
