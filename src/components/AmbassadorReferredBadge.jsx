import React from 'react';
import { BadgeCheck } from 'lucide-react';

/**
 * Shown for talent attributed to a BYG ambassador (invite or signup code).
 * Distinct from skills / AI interview verification.
 */
export default function AmbassadorReferredBadge({
  variant = 'light',
  className = '',
  compact = false,
}) {
  const onDark = variant === 'dark';

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border ${
          onDark
            ? 'bg-white/10 border-white/20 text-[#C9A227]'
            : 'bg-[#0B1B3A]/5 border-[#C9A227]/40 text-[#0B1B3A]'
        } ${className}`}
        title="Referred by a Byghires Circle ambassador"
      >
        <BadgeCheck size={10} className="text-[#C9A227]" />
        Circle
      </span>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 border ${
        onDark
          ? 'bg-white/10 border-white/15'
          : 'bg-[#0B1B3A]/[0.04] border-[#C9A227]/35'
      } ${className}`}
      title="Referred by a Byghires Circle ambassador"
    >
      <img
        src="/byghires-circle-badge.png"
        alt=""
        className="w-5 h-5 object-contain"
        width={20}
        height={20}
      />
      <span
        className={`text-[9px] font-black uppercase tracking-wider ${
          onDark ? 'text-[#C9A227]' : 'text-[#0B1B3A]'
        }`}
      >
        Ambassador verified
      </span>
    </div>
  );
}
