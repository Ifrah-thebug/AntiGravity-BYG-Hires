import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Mail,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import AdminPageShell from '../components/AdminPageShell';
import { downloadTalentResume } from '../lib/adminTalent';
import {
  REVIEW_ISSUE_OPTIONS,
  STATUS_BADGE_CLASS,
  STATUS_LABELS,
  approveProfileReview,
  fetchAdminReviewQueue,
  requestProfileChanges,
} from '../lib/profileReview';

const QUEUE_TABS = [
  { id: 'pending_review', label: 'Pending' },
  { id: 'changes_requested', label: 'Changes sent' },
  { id: 'approved', label: 'Approved' },
  { id: 'draft', label: 'Draft' },
  { id: 'all', label: 'All' },
];

function mapRow(row) {
  const id = row.id || row.user_id;
  return {
    id,
    userId: row.user_id,
    email: row.email || '',
    name: row.name || '—',
    role: row.job_title || '—',
    bio: row.about || '—',
    tags: Array.isArray(row.skills) ? row.skills : [],
    photo: row.photo_url || null,
    cvUrl: row.cv_url || '',
    hasResume: Boolean(row.cv_url?.trim()),
    directoryStatus: row.directory_status || 'draft',
    reviewNotes: row.review_notes || '',
    reviewIssues: Array.isArray(row.review_issues) ? row.review_issues : [],
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    approvedAt: row.approved_at,
    raw: row,
  };
}

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const ReviewModal = ({ talent, onClose, onDone }) => {
  const [issues, setIssues] = useState([]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setIssues([]);
    setNotes('');
    setError('');
  }, [talent?.id]);

  if (!talent) return null;

  const toggleIssue = (code) => {
    setIssues((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const run = async (action) => {
    setError('');
    setNotice('');
    setBusy(action);
    try {
      let result;
      if (action === 'approve') {
        result = await approveProfileReview(talent.id);
      } else {
        result = await requestProfileChanges(talent.id, { issues, notes });
      }
      if (result.email?.sent === false) {
        setNotice(
          `Profile status updated, but the email was not sent${
            result.email.error ? `: ${result.email.error}` : ''
          }. Check backend logs / Resend settings.`
        );
      }
      onDone();
      if (result.email?.sent !== false) {
        onClose();
      }
    } catch (err) {
      if (err.message === 'Failed to fetch' || /failed to fetch/i.test(err.message)) {
        setError(
          'Could not reach the backend. Confirm it is running on port 5001 and VITE_BACKEND_URL=http://localhost:5001, then refresh and check if the profile status already changed.'
        );
      } else {
        setError(err.message || 'Action failed.');
      }
    } finally {
      setBusy('');
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="bg-white rounded-[2.5rem] max-w-3xl w-full shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-black text-white p-8 relative">
            <button
              type="button"
              onClick={onClose}
              className="absolute top-5 right-5 w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center"
            >
              <X size={16} />
            </button>
            <div className="flex flex-col sm:flex-row gap-6">
              {talent.photo ? (
                <img src={talent.photo} alt="" className="w-32 h-40 rounded-2xl object-cover border-2 border-white/20" />
              ) : (
                <div className="w-32 h-40 rounded-2xl bg-white/10 flex items-center justify-center text-3xl font-black">
                  {talent.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <span
                  className={`inline-block text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border mb-2 ${STATUS_BADGE_CLASS[talent.directoryStatus] || STATUS_BADGE_CLASS.draft}`}
                >
                  {STATUS_LABELS[talent.directoryStatus] || talent.directoryStatus}
                </span>
                <h2 className="text-2xl font-black tracking-tight">{talent.name}</h2>
                <p className="text-red font-bold text-sm mt-1">{talent.role}</p>
                <p className="text-gray-400 text-xs font-semibold mt-2 flex items-center gap-1">
                  <Mail size={10} /> {talent.email}
                </p>
                <p className="text-gray-500 text-[10px] font-bold mt-2 uppercase tracking-wider">
                  Submitted {formatWhen(talent.submittedAt)}
                </p>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-6">
            {talent.reviewNotes && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl text-sm text-orange-900">
                <p className="text-[10px] font-black uppercase tracking-widest mb-1">Previous feedback</p>
                <p className="font-medium">{talent.reviewNotes}</p>
              </div>
            )}

            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">About</p>
              <p className="text-sm text-gray-700 font-medium leading-relaxed">{talent.bio}</p>
            </div>

            {talent.tags.length > 0 && (
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Skills</p>
                <div className="flex flex-wrap gap-2">
                  {talent.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1.5 bg-red/5 border border-red/10 text-red font-bold text-[10px] uppercase rounded-xl"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {talent.hasResume && (
                <button
                  type="button"
                  onClick={() => downloadTalentResume(talent)}
                  className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                >
                  <Download size={12} /> CV
                </button>
              )}
              {talent.photo && (
                <a
                  href={talent.photo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                >
                  Photo <ExternalLink size={12} />
                </a>
              )}
              {talent.directoryStatus === 'approved' && (
                <Link
                  to={`/talent/${talent.id}`}
                  target="_blank"
                  className="px-4 py-2.5 bg-green-50 border border-green-200 text-green-800 rounded-xl text-[10px] font-black uppercase tracking-widest"
                >
                  Public profile
                </Link>
              )}
            </div>

            <div className="border-t border-gray-100 pt-6 space-y-4">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                {talent.directoryStatus === 'approved' ? 'Remove from directory — request changes' : 'Request changes'}
              </p>
              <div className="flex flex-wrap gap-2">
                {REVIEW_ISSUE_OPTIONS.map((opt) => (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => toggleIssue(opt.code)}
                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-colors ${
                      issues.includes(opt.code)
                        ? 'bg-red text-white border-red'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-red/40'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Additional notes for the candidate (included in email)…"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-medium focus:border-red outline-none resize-y"
              />
            </div>

            {notice && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-sm font-semibold rounded-xl">
                {notice}
              </div>
            )}

            {error && (
              <div className="p-3 bg-red/5 border border-red/20 text-red text-sm font-semibold rounded-xl">
                {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              {talent.directoryStatus !== 'approved' && (
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => run('approve')}
                  className="flex-1 py-4 bg-green-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {busy === 'approve' ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  Approve for directory
                </button>
              )}
              {talent.directoryStatus !== 'approved' && (
                <button
                  type="button"
                  disabled={Boolean(busy) || (!issues.length && !notes.trim())}
                  onClick={() => run('changes')}
                  className="flex-1 py-4 bg-black text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-red disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {busy === 'changes' ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <AlertTriangle size={14} />
                  )}
                  Request changes
                </button>
              )}
              {talent.directoryStatus === 'approved' && (
                <button
                  type="button"
                  disabled={Boolean(busy) || (!issues.length && !notes.trim())}
                  onClick={() => run('changes')}
                  className="flex-1 py-4 bg-black text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-red disabled:opacity-50"
                >
                  Pull from directory &amp; request changes
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default function AdminProfileReviewsPage() {
  const [tab, setTab] = useState('pending_review');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminReviewQueue(tab);
      setRows(data.map(mapRow));
    } catch (err) {
      setError(err.message || 'Failed to load queue.');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((t) =>
      [t.name, t.email, t.role, t.bio, ...t.tags].join(' ').toLowerCase().includes(q)
    );
  }, [rows, search]);

  const pendingCount = useMemo(
    () => rows.filter((r) => r.directoryStatus === 'pending_review').length,
    [rows]
  );

  return (
    <AdminPageShell>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">Profile reviews</h1>
            <p className="text-gray-500 text-sm font-medium mt-2">
              Approve profiles for the public talent directory or request changes by email.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-red"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUEUE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-colors ${
                tab === t.id
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-red/40'
              }`}
            >
              {t.label}
              {t.id === 'pending_review' && tab === 'all' && pendingCount > 0 && (
                <span className="ml-1 text-red">({pendingCount})</span>
              )}
            </button>
          ))}
        </div>

        <div className="relative max-w-md">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search queue…"
            className="w-full pl-11 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm font-bold focus:border-red outline-none"
          />
        </div>

        {error && (
          <div className="p-4 bg-red/5 border border-red/20 text-red rounded-2xl text-sm font-semibold">
            {error}
            <button type="button" onClick={load} className="block mt-2 text-xs font-black uppercase underline">
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-red/20 border-t-red rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
              {visible.length} profile{visible.length !== 1 ? 's' : ''}
            </p>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {visible.map((talent) => (
                <div
                  key={talent.id}
                  className="bg-white border border-gray-100 rounded-3xl overflow-hidden hover:border-red/30 hover:shadow-lg transition-all"
                >
                  <div
                    className="aspect-[4/5] bg-gray-50 relative cursor-pointer"
                    onClick={() => setSelected(talent)}
                  >
                    {talent.photo ? (
                      <img src={talent.photo} alt="" className="w-full h-full object-cover object-top" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl font-black text-gray-300">
                        {talent.name.charAt(0)}
                      </div>
                    )}
                    <span
                      className={`absolute top-3 left-3 text-[9px] font-black uppercase px-2 py-1 rounded-full border shadow-sm ${STATUS_BADGE_CLASS[talent.directoryStatus]}`}
                    >
                      {STATUS_LABELS[talent.directoryStatus]}
                    </span>
                    {talent.hasResume && (
                      <span className="absolute top-3 right-3 bg-white/95 text-[9px] font-black uppercase px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
                        <FileText size={10} className="text-red" /> CV
                      </span>
                    )}
                  </div>
                  <div className="p-5 space-y-3">
                    <div>
                      <p className="font-black text-sm">{talent.name}</p>
                      <p className="text-[11px] text-gray-500 line-clamp-1">{talent.role}</p>
                      <p className="text-[10px] text-gray-400 truncate mt-1">{talent.email}</p>
                      {talent.submittedAt && (
                        <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                          <Clock size={10} /> {formatWhen(talent.submittedAt)}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelected(talent)}
                      className="w-full py-2.5 bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red"
                    >
                      Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {visible.length === 0 && !error && (
              <p className="text-center text-gray-400 font-bold py-16 uppercase text-xs tracking-widest">
                No profiles in this queue
              </p>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <ReviewModal
            talent={selected}
            onClose={() => setSelected(null)}
            onDone={load}
          />
        )}
      </AnimatePresence>
    </AdminPageShell>
  );
}
