import React, { useEffect, useState } from 'react';
import { Check, Link2, Loader2 } from 'lucide-react';
import { fetchTalentPortfolioSharing } from '../services/portfolioAccessService';
import { buildPortfolioShareUrl } from '../lib/portfolioShareUrl';

/** Compact "Share my portfolio" button for the portal header (copies share URL). */
export default function PortalPortfolioShareButton({ profileId, className = '' }) {
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState({ portfolioPublicEnabled: true, shareToken: '' });

  useEffect(() => {
    if (!profileId) return;
    fetchTalentPortfolioSharing()
      .then((data) => {
        setSettings({
          portfolioPublicEnabled: data.portfolioPublicEnabled !== false,
          shareToken: data.shareToken || '',
        });
      })
      .catch(() => setSettings({ portfolioPublicEnabled: true, shareToken: '' }))
      .finally(() => setLoading(false));
  }, [profileId]);

  const shareUrl = buildPortfolioShareUrl({
    profileId,
    portfolioPublicEnabled: settings.portfolioPublicEnabled,
    shareToken: settings.shareToken,
  });

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  if (!profileId) return null;

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={loading}
      title={shareUrl}
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-red hover:bg-white hover:text-black text-[10px] font-black text-white uppercase tracking-widest transition-colors border border-red flex-1 sm:flex-none min-h-[44px] sm:min-h-0 disabled:opacity-60 ${className}`}
    >
      {loading ? (
        <Loader2 size={11} className="animate-spin" />
      ) : copied ? (
        <Check size={11} />
      ) : (
        <Link2 size={11} />
      )}
      {copied ? 'Link copied' : 'Share my portfolio'}
    </button>
  );
}
