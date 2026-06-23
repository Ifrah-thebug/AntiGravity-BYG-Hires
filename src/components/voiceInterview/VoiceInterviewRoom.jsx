import React from 'react';
import { motion } from 'framer-motion';
import { Mic, PhoneOff, Radio } from 'lucide-react';

export default function VoiceInterviewSubtitle({ caption }) {
  return (
    <div className="min-h-[120px] flex items-center justify-center rounded-2xl bg-gray-50 border border-gray-100 p-6">
      {caption ? (
        <motion.p
          key={`${caption.role}-${caption.text.slice(0, 24)}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-base sm:text-lg font-semibold leading-relaxed text-center max-w-2xl ${
            caption.role === 'assistant' ? 'text-black' : 'text-gray-600'
          }`}
        >
          {caption.role === 'assistant' && (
            <span className="block text-[10px] font-black uppercase tracking-widest text-red mb-2">
              Interviewer
            </span>
          )}
          {caption.role === 'user' && (
            <span className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
              You
            </span>
          )}
          {caption.text}
        </motion.p>
      ) : (
        <p className="text-sm font-medium text-gray-400 text-center">
          Live captions will appear here as you speak…
        </p>
      )}
    </div>
  );
}

export function VoiceInterviewRoom({ isSpeaking, isConnecting, liveCaption, jobRole, onEnd }) {
  const statusLabel = isConnecting
    ? 'Connecting…'
    : isSpeaking
      ? 'Interviewer speaking'
      : 'Listening…';

  const pulse = isConnecting || isSpeaking;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black text-red uppercase tracking-widest">{jobRole}</p>
          <p className="text-xs font-bold text-gray-400 mt-0.5">AI voice interview in progress</p>
        </div>
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black ${
            isConnecting
              ? 'bg-amber-50 text-amber-800 border border-amber-200'
              : isSpeaking
                ? 'bg-red/10 text-red border border-red/20'
                : 'bg-green-50 text-green-700 border border-green-200'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              pulse ? 'bg-current animate-pulse' : 'bg-current'
            }`}
          />
          {statusLabel}
        </div>
      </div>

      <div className="relative bg-black rounded-[2rem] p-10 sm:p-14 flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-red rounded-full blur-[90px] opacity-30 pointer-events-none" />
        <motion.div
          animate={pulse ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={{ duration: 1.6, repeat: pulse ? Infinity : 0, ease: 'easeInOut' }}
          className={`relative z-10 w-28 h-28 rounded-full flex items-center justify-center ${
            isSpeaking ? 'bg-red text-white' : 'bg-white/10 text-white border border-white/20'
          }`}
        >
          {isConnecting ? (
            <Radio size={36} className="animate-pulse" />
          ) : (
            <Mic size={36} />
          )}
        </motion.div>
        <p className="relative z-10 text-white/70 text-sm font-semibold mt-6 text-center">
          {isConnecting
            ? 'Setting up your secure voice session…'
            : isSpeaking
              ? 'The interviewer is asking a question'
              : 'Your turn — answer when ready'}
        </p>
      </div>

      <VoiceInterviewSubtitle caption={liveCaption} />

      <button
        type="button"
        onClick={onEnd}
        className="w-full py-4 bg-black hover:bg-red text-white font-black text-sm uppercase tracking-widest rounded-2xl transition-colors flex items-center justify-center gap-2"
      >
        <PhoneOff size={16} />
        End interview
      </button>
    </motion.div>
  );
}
