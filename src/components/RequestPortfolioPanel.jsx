import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, Layers, Loader2 } from 'lucide-react';
import {
  fetchClientPortfolioAccessStatus,
  requestPortfolioAccess,
} from '../services/portfolioAccessService';

const PENDING_POLL_MS = 8000;

function statusLabel(status) {
  if (status === 'approved') return 'Access granted';
  if (status === 'pending') return 'Request pending';
  return null;
}

function isNetworkError(err) {
  const msg = String(err?.message || err || '');
  return /failed to fetch|networkerror|load failed|network request failed|aborted/i.test(msg);
}

export default function RequestPortfolioPanel({
  talent,
  clientEmail,
  canRequestPortfolio,
}) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState('none');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [justApproved, setJustApproved] = useState(false);
  const prevStatusRef = useRef('none');

  const email = String(clientEmail || '').trim();
  const portfolioHref = talent?.id ? `/talent/${talent.id}/portfolio` : '';

  const loadStatus = useCallback(async ({ silent = false } = {}) => {
    if (!talent?.id || !email || !canRequestPortfolio) {
      setLoading(false);
      setStatus('none');
      return;
    }

    if (!silent) setLoading(true);
    try {
      const data = await fetchClientPortfolioAccessStatus({ talentId: talent.id, email });
      const next = data?.status || 'none';
      setStatus((prev) => {
        if (prev === 'pending' && next === 'approved') {
          setJustApproved(true);
          setSuccess('Approved — you can open their portfolio now.');
        }
        return next;
      });
      prevStatusRef.current = next;
    } catch {
      if (!silent) setStatus('none');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [talent?.id, email, canRequestPortfolio]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // While pending, poll so approval shows without the client reopening the page.
  useEffect(() => {
    if (status !== 'pending' || !canRequestPortfolio) return undefined;
    const timer = setInterval(() => {
      loadStatus({ silent: true });
    }, PENDING_POLL_MS);
    return () => clearInterval(timer);
  }, [status, canRequestPortfolio, loadStatus]);

  // Refresh when tab becomes visible again (e.g. client waited in another tab).
  useEffect(() => {
    if (!canRequestPortfolio) return undefined;
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadStatus({ silent: true });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [canRequestPortfolio, loadStatus]);

  async function handleRequest() {
    if (!talent?.id || !canRequestPortfolio) return;

    setSubmitting(true);
    setError('');
    setSuccess('');
    setJustApproved(false);

    try {
      const data = await requestPortfolioAccess({ talentId: talent.id });
      setStatus(data.alreadyApproved ? 'approved' : 'pending');
      setSuccess(
        data.alreadyApproved
          ? 'You already have access to this portfolio.'
          : data.duplicate
            ? 'Request was already sent — the talent should see it in their portal. If they did not get an email, ask them to check Portfolio access requests in My Portal.'
            : 'Portfolio request sent. The talent will be notified by email and in BGuides shortly.'
      );
    } catch (err) {
      const msg = isNetworkError(err)
        ? 'Connection issue — your request may still have been saved. Refresh this page to check status.'
        : (err.message || 'Could not send request.');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (!talent?.id) return null;

  const label = statusLabel(status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-[1.5rem] sm:rounded-[2.5rem] border border-gray-200 shadow-sm overflow-hidden mb-6"
    >
      <div className={`px-4 py-4 sm:px-8 sm:py-6 ${canRequestPortfolio ? 'border-b border-gray-100' : ''}`}>
        <p className="text-[10px] font-black text-red uppercase tracking-[0.2em] mb-1 flex items-center gap-1.5">
          <Layers size={12} /> Portfolio
        </p>
        <h3 className="font-black text-base sm:text-lg uppercase tracking-wide text-gray-900">
          Request portfolio access
        </h3>
        <p className="text-gray-500 text-sm font-medium mt-1 leading-relaxed">
          See this talent&apos;s project showcase. They approve each client individually before sharing.
        </p>
      </div>

      {canRequestPortfolio && (
        <div className="p-4 sm:p-8">
          {loading ? (
            <div className="w-full h-14 rounded-2xl bg-gray-100 animate-pulse" aria-label="Loading" />
          ) : (
            <div className="space-y-4">
              {error && (
                <div className="p-4 rounded-2xl bg-red/5 border border-red/20 text-red text-sm font-semibold flex items-start gap-2">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="p-4 rounded-2xl bg-green-50 border border-green-200 text-green-800 text-sm font-semibold flex items-start gap-2">
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                  <span>{success}</span>
                </div>
              )}

              {status === 'approved' ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-green-50 border border-green-200 flex items-start gap-3">
                    <CheckCircle2 size={18} className="text-green-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-black text-sm text-green-900">
                        {justApproved ? 'Just approved' : label}
                      </p>
                      <p className="text-sm text-green-800 mt-1">
                        You can view their full portfolio storybook now.
                      </p>
                    </div>
                  </div>
                  {portfolioHref && (
                    <Link
                      to={portfolioHref}
                      className="w-full min-h-[56px] py-4 bg-red hover:bg-black text-white font-black text-sm uppercase tracking-widest rounded-2xl transition-colors flex items-center justify-center gap-2"
                    >
                      View portfolio <ArrowRight size={16} />
                    </Link>
                  )}
                </div>
              ) : status === 'pending' ? (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                  <Clock size={18} className="text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-black text-sm text-amber-900">{label}</p>
                    <p className="text-sm text-amber-800 mt-1">
                      Waiting for the talent to approve. This screen updates automatically — you do not need to reopen the page.
                    </p>
                    <button
                      type="button"
                      onClick={() => loadStatus({ silent: true })}
                      className="mt-3 text-[10px] font-black uppercase tracking-widest text-amber-900/70 hover:text-amber-950 underline-offset-2 hover:underline"
                    >
                      Check now
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleRequest}
                  disabled={submitting}
                  className="w-full min-h-[56px] py-4 bg-black hover:bg-red disabled:opacity-70 text-white font-black text-sm uppercase tracking-widest rounded-2xl transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin shrink-0" />
                      <span>Sending request…</span>
                    </>
                  ) : (
                    <>
                      <Layers size={16} className="shrink-0" />
                      <span>Request portfolio</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
