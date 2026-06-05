import React from 'react';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { isTalentVerified } from '../lib/talentVerification';

/** Header badge: Verified (phase 2+) or Unverified (phase 1 default). */
export default function ProfileVerificationBadge({ talent, variant = 'dark' }) {
  const verified = isTalentVerified(talent);
  const onDark = variant === 'dark';

  if (verified) {
    return (
      <div className="flex items-center gap-2 mb-1">
        <CheckCircle2 size={14} className="text-green-400" />
        <span className="text-green-400 text-[9px] font-black uppercase tracking-wider">Verified</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 mb-1">
      <ShieldAlert size={14} className={onDark ? 'text-gray-400' : 'text-gray-400'} />
      <span
        className={`text-[9px] font-black uppercase tracking-wider ${
          onDark ? 'text-gray-400' : 'text-gray-500'
        }`}
      >
        Unverified
      </span>
    </div>
  );
}
