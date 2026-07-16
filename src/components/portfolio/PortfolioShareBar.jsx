import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, Check } from 'lucide-react';
import { buildPortfolioShareUrl } from '../../lib/portfolioShareUrl';

export default function PortfolioShareBar({
  profileId,
  displayName,
  compact = false,
  className = '',
  portfolioPublicEnabled = true,
  shareToken = '',
}) {
  const [copied, setCopied] = useState(false);
  const url = buildPortfolioShareUrl({
    profileId,
    portfolioPublicEnabled,
    shareToken,
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* ignore */
    }
  };

  return (
    <motion.button
      type="button"
      onClick={handleCopy}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45 }}
      className={`inline-flex items-center justify-center gap-2 ${
        compact ? 'px-3 py-2' : 'px-4 py-2.5'
      } rounded-xl bg-black hover:bg-red text-white border border-black hover:border-red transition-all duration-300 group ${className}`}
      title={`Share ${displayName}'s portfolio`}
    >
      <AnimatePresence mode="wait">
        {copied ? (
          <motion.span
            key="check"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            className="flex items-center gap-2"
          >
            <Check size={14} className="text-green-400" />
            {!compact && <span className="text-[10px] font-black uppercase tracking-widest">Link copied</span>}
          </motion.span>
        ) : (
          <motion.span
            key="link"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            className="flex items-center gap-2"
          >
            <Link2 size={14} className="group-hover:rotate-12 transition-transform" />
            {!compact && <span className="text-[10px] font-black uppercase tracking-widest">Share Portfolio</span>}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
