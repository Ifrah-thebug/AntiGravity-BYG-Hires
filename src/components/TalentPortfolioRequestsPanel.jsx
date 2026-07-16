import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, Layers, Loader2, RefreshCw, User, XCircle } from 'lucide-react';
import {
  approvePortfolioRequest,
  declinePortfolioRequest,
  fetchTalentPortfolioRequests,
} from '../services/portfolioAccessService';

function formatClient(row) {
  const name = String(row.client_name || '').trim();
  const company = String(row.company || '').trim();
  if (name && company) return `${name} · ${company}`;
  if (name) return name;
  if (company) return company;
  return row.client_email || 'Client';
}

function formatWhen(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function friendlyError(err) {
  const msg = String(err?.message || err || '');
  if (/failed to fetch|networkerror|load failed|network request failed|aborted/i.test(msg)) {
    return 'Connection issue talking to the server. Your last action may still have saved — tap Refresh.';
  }
  return msg || 'Something went wrong.';
}

export default function TalentPortfolioRequestsPanel({ onPendingChange }) {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [actingId, setActingId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const hasLoadedOnce = useRef(false);

  const applyRows = useCallback((rows, pendingOverride) => {
    const list = Array.isArray(rows) ? rows : [];
    const pending = pendingOverride ?? list.filter((r) => r.status === 'pending').length;
    setRequests(list);
    setPendingCount(pending);
    onPendingChange?.(pending);
  }, [onPendingChange]);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const data = await fetchTalentPortfolioRequests();
      const rows = data.requests || [];
      applyRows(rows, data.pendingCount);
      hasLoadedOnce.current = true;
      if (silent) setError('');
      return rows;
    } catch (err) {
      // Keep existing rows on transient errors so approve success isn't wiped to empty.
      if (!hasLoadedOnce.current || !silent) {
        setError(friendlyError(err));
      }
      if (!hasLoadedOnce.current) {
        applyRows([], 0);
      }
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, [applyRows]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDecision(requestId, decision) {
    setActingId(requestId);
    setError('');
    setMessage('');

    const previous = requests;
    const nextStatus = decision === 'approve' ? 'approved' : 'declined';
    const now = new Date().toISOString();

    // Optimistic update — don't wait for reload to show the result.
    applyRows(
      previous.map((row) =>
        row.id === requestId
          ? { ...row, status: nextStatus, responded_at: now }
          : row
      )
    );

    try {
      if (decision === 'approve') {
        await approvePortfolioRequest(requestId);
        setMessage('Portfolio access approved for this client.');
      } else {
        await declinePortfolioRequest(requestId);
        setMessage('Request declined.');
      }
      // Soft refresh — if it fails, keep optimistic rows (don't clear list).
      await load({ silent: true });
    } catch (err) {
      applyRows(previous);
      setMessage('');
      setError(friendlyError(err));
    } finally {
      setActingId('');
    }
  }

  const pending = requests.filter((r) => r.status === 'pending');
  const handled = requests.filter((r) => r.status !== 'pending');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-gray-200 rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-8 space-y-5 scroll-mt-28"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black text-red uppercase tracking-[0.2em] mb-1 flex items-center gap-1.5">
            <Layers size={11} /> Client requests
            {pendingCount > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-red text-white text-[9px]">
                {pendingCount}
              </span>
            )}
          </p>
          <h3 className="font-black text-lg text-gray-900 tracking-tight">Portfolio access requests</h3>
          <p className="text-xs text-gray-500 font-medium mt-2 leading-relaxed">
            Clients request to see your portfolio before you share it. Approve each client individually — you stay in control.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setMessage('');
            load();
          }}
          disabled={loading}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-[10px] font-black uppercase tracking-widest text-gray-600 hover:border-black hover:text-black transition-colors disabled:opacity-50"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && !message && (
        <div className="p-3 rounded-xl bg-red/5 border border-red/20 text-red text-xs font-semibold flex items-start justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              setError('');
              load();
            }}
            className="shrink-0 underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      )}
      {message && (
        <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-800 text-xs font-semibold">
          {message}
        </div>
      )}

      {loading && !hasLoadedOnce.current ? (
        <div className="flex justify-center py-8">
          <Loader2 size={22} className="animate-spin text-gray-300" />
        </div>
      ) : pending.length === 0 && handled.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center">
          <Layers size={24} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm font-bold text-gray-500">No portfolio requests yet</p>
          <p className="text-xs text-gray-400 mt-1">
            When a client asks to see your portfolio, it will show up here and in BGuides.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((row) => (
            <div
              key={row.id}
              className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 sm:p-5 space-y-3"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shrink-0">
                  <User size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-sm text-gray-900">{formatClient(row)}</p>
                  <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                    Requested {formatWhen(row.requested_at)}
                  </p>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-800 bg-amber-100 px-2 py-1 rounded-lg shrink-0">
                  Pending
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={actingId === row.id}
                  onClick={() => handleDecision(row.id, 'approve')}
                  className="flex-1 min-w-[120px] py-2.5 px-4 rounded-xl bg-red hover:bg-black text-white text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  {actingId === row.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                  Approve
                </button>
                <button
                  type="button"
                  disabled={actingId === row.id}
                  onClick={() => handleDecision(row.id, 'decline')}
                  className="flex-1 min-w-[120px] py-2.5 px-4 rounded-xl bg-white border border-gray-200 text-gray-700 text-[10px] font-black uppercase tracking-widest hover:border-gray-400 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  <XCircle size={12} /> Decline
                </button>
              </div>
            </div>
          ))}

          {handled.length > 0 && (
            <div className="pt-2 space-y-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Recent</p>
              {handled.slice(0, 8).map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-gray-800 truncate">{formatClient(row)}</p>
                    <p className="text-[10px] text-gray-400 font-medium">
                      {formatWhen(row.responded_at || row.requested_at)}
                    </p>
                  </div>
                  <span
                    className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg shrink-0 ${
                      row.status === 'approved'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {row.status === 'approved' ? (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 size={10} /> Approved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Clock size={10} /> Declined
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
