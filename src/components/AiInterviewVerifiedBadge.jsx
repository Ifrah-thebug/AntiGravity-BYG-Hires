import React from 'react';
import { Mic } from 'lucide-react';
import { isTalentAiInterviewVerified } from '../lib/talentVerification';

/** Profile badge when talent completed AI interview with score above threshold. */
export default function AiInterviewVerifiedBadge({ talent, variant = 'dark' }) {
  if (!isTalentAiInterviewVerified(talent)) return null;

  const onDark = variant === 'dark';

  return (
    <div className="flex items-center gap-2 mb-1">
      <Mic size={14} className={onDark ? 'text-violet-300' : 'text-violet-600'} />
      <span
        className={`text-[9px] font-black uppercase tracking-wider ${
          onDark ? 'text-violet-300' : 'text-violet-700'
        }`}
      >
        AI Interview verified
      </span>
    </div>
  );
}
