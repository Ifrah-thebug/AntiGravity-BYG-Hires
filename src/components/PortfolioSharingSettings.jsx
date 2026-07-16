import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Globe, Link2, Loader2, RefreshCw, Shield } from 'lucide-react';
import {
  fetchTalentPortfolioSharing,
  rotateTalentPortfolioShareToken,
  updateTalentPortfolioSharing,
} from '../services/portfolioAccessService';
import { buildPortfolioPrivateShareUrl, buildPortfolioShareUrl } from '../lib/portfolioShareUrl';

export default function PortfolioSharingSettings({ profileId }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [settings, setSettings] = useState({
    portfolioPublicEnabled: true,
    shareToken: '',
    directoryStatus: null,
  });

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchTalentPortfolioSharing();
      setSettings({
        portfolioPublicEnabled: data.portfolioPublicEnabled !== false,
        shareToken: data.shareToken || '',
        directoryStatus: data.directoryStatus || null,
      });
    } catch (err) {
      setError(err.message || 'Could not load sharing settings.');
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    load();
  }, [load]);

  const shareUrl = buildPortfolioShareUrl({
    profileId,
    portfolioPublicEnabled: settings.portfolioPublicEnabled,
    shareToken: settings.shareToken,
  });

  const privateShareUrl = buildPortfolioPrivateShareUrl({
    profileId,
    shareToken: settings.shareToken,
  });

  async function handleToggle() {
    setSaving(true);
    setError('');
    try {
      const data = await updateTalentPortfolioSharing({
        portfolioPublicEnabled: !settings.portfolioPublicEnabled,
      });
      setSettings({
        portfolioPublicEnabled: data.portfolioPublicEnabled !== false,
        shareToken: data.shareToken || settings.shareToken,
        directoryStatus: data.directoryStatus || settings.directoryStatus,
      });
    } catch (err) {
      setError(err.message || 'Could not update setting.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRotate() {
    if (!window.confirm('Generate a new private link? Old private links will stop working.')) return;
    setRotating(true);
    setError('');
    try {
      const data = await rotateTalentPortfolioShareToken();
      setSettings((prev) => ({
        ...prev,
        shareToken: data.shareToken || prev.shareToken,
        portfolioPublicEnabled: data.portfolioPublicEnabled !== false,
      }));
    } catch (err) {
      setError(err.message || 'Could not rotate link.');
    } finally {
      setRotating(false);
    }
  }

  async function copyText(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      /* ignore */
    }
  }

  if (!profileId) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-8 space-y-5">
      <div>
        <p className="text-[10px] font-black text-red uppercase tracking-[0.2em] mb-1 flex items-center gap-1.5">
          <Globe size={11} /> Share your work
        </p>
        <h3 className="font-black text-lg text-gray-900 tracking-tight">Public portfolio link</h3>
        <p className="text-xs text-gray-500 font-medium mt-2 leading-relaxed">
          Share your storybook on LinkedIn, GitHub, or your email signature — separate from BYG client requests.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red/5 border border-red/20 text-red text-xs font-semibold">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 size={22} className="animate-spin text-gray-300" />
        </div>
      ) : (
        <>
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={settings.portfolioPublicEnabled}
              disabled={saving}
              onChange={handleToggle}
              className="mt-1 w-4 h-4 rounded border-gray-300 text-red focus:ring-red"
            />
            <span>
              <span className="font-black text-sm text-gray-900 block">Anyone with my link can view</span>
              <span className="text-xs text-gray-500 font-medium leading-relaxed">
                When on, your portfolio URL works like a public LinkedIn-style link. When off, only your private share link or approved BYG clients can view.
              </span>
            </span>
          </label>

          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Link2 size={10} />
              {settings.portfolioPublicEnabled ? 'Public share link' : 'Private share link (use this when public is off)'}
            </p>
            <p className="text-[11px] font-semibold text-gray-600 break-all">{shareUrl}</p>
            <button
              type="button"
              onClick={() => copyText(shareUrl, 'main')}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-black hover:bg-red text-white text-[10px] font-black uppercase tracking-widest transition-colors"
            >
              {copied === 'main' ? <Check size={12} /> : <Copy size={12} />}
              {copied === 'main' ? 'Copied' : 'Copy link'}
            </button>
          </div>

          {settings.portfolioPublicEnabled && privateShareUrl && (
            <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                <Shield size={10} /> Unlisted private link
              </p>
              <p className="text-[11px] text-gray-500 font-medium">
                Optional — works even if you turn off public sharing later.
              </p>
              <p className="text-[11px] font-semibold text-gray-600 break-all">{privateShareUrl}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copyText(privateShareUrl, 'private')}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:border-black text-[10px] font-black uppercase tracking-widest transition-colors"
                >
                  {copied === 'private' ? <Check size={12} /> : <Copy size={12} />}
                  Copy private link
                </button>
                <button
                  type="button"
                  disabled={rotating}
                  onClick={handleRotate}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:border-black text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-50"
                >
                  {rotating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  New private link
                </button>
              </div>
            </div>
          )}

          {!settings.portfolioPublicEnabled && privateShareUrl && (
            <button
              type="button"
              disabled={rotating}
              onClick={handleRotate}
              className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-black transition-colors disabled:opacity-50"
            >
              {rotating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Generate new private link
            </button>
          )}
        </>
      )}
    </div>
  );
}
