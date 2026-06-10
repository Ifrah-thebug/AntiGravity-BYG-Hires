import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Mail,
  MousePointerClick,
  Pencil,
  RefreshCw,
  Send,
  Upload,
  UserCheck,
  XCircle,
} from 'lucide-react';
import AdminPageShell from '../components/AdminPageShell';
import {
  uploadTalentCvs,
  fetchImportBatches,
  fetchImportBatch,
  updateInviteEmail,
  sendBatchInvites,
  sendSingleInvite,
} from '../lib/adminTalentImport';

const BATCH_STORAGE_KEY = 'admin_talent_import_batch_id';

function formatWhen(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusMeta(invite) {
  const map = {
    uploaded: { label: 'Needs email', className: 'bg-amber-50 text-amber-800 border-amber-200' },
    ready: { label: 'Ready to send', className: 'bg-sky-50 text-sky-800 border-sky-200' },
    invited: { label: 'Invite sent', className: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
    activated: { label: 'Activated', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    skipped: { label: 'Has profile', className: 'bg-gray-100 text-gray-600 border-gray-200' },
    expired: { label: 'Expired', className: 'bg-red-50 text-red-700 border-red-200' },
  };
  return map[invite.status] || { label: invite.status, className: 'bg-gray-50 text-gray-700 border-gray-200' };
}

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{label}</p>
          <p className="text-3xl font-black text-gray-900 tabular-nums">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function EngagementStep({ done, label, detail, icon: Icon }) {
  return (
    <div className={`flex items-start gap-2 ${done ? 'text-gray-800' : 'text-gray-300'}`}>
      <div
        className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${
          done ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-gray-50 border-gray-200'
        }`}
      >
        <Icon size={11} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider">{label}</p>
        <p className="text-[11px] font-semibold truncate">{detail || '—'}</p>
      </div>
    </div>
  );
}

export default function AdminTalentImportPage() {
  const [files, setFiles] = useState([]);
  const [batches, setBatches] = useState([]);
  const [batchId, setBatchId] = useState(null);
  const [invites, setInvites] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editEmail, setEditEmail] = useState('');
  const [editName, setEditName] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const batchStats = useMemo(() => {
    const sent = invites.filter((i) => i.invitedAt || ['invited', 'activated'].includes(i.status)).length;
    const clicked = invites.filter((i) => i.activationLinkClickedAt).length;
    const activated = invites.filter((i) => i.status === 'activated' || i.activatedAt).length;
    return { total: invites.length, sent, clicked, activated };
  }, [invites]);

  const sendableInvites = invites.filter(
    (i) => i.email && ['ready', 'uploaded', 'invited'].includes(i.status)
  );
  const readyCount = sendableInvites.length;
  const resendCount = sendableInvites.filter((i) => i.status === 'invited').length;

  const loadBatches = useCallback(async (selectId) => {
    const list = await fetchImportBatches();
    setBatches(list);
    return list;
  }, []);

  const refreshBatch = useCallback(async (id) => {
    if (!id) return;
    const list = await fetchImportBatch(id);
    setInvites(list);
  }, []);

  const refreshDashboard = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      const list = await loadBatches();
      const activeId = batchId || sessionStorage.getItem(BATCH_STORAGE_KEY);
      const targetId = activeId && list.some((b) => b.id === activeId) ? activeId : list[0]?.id;
      if (targetId) {
        setBatchId(targetId);
        sessionStorage.setItem(BATCH_STORAGE_KEY, targetId);
        await refreshBatch(targetId);
      }
    } catch (err) {
      setError(err.message || 'Could not refresh dashboard.');
    } finally {
      setRefreshing(false);
    }
  }, [batchId, loadBatches, refreshBatch]);

  useEffect(() => {
    (async () => {
      setLoadingBatches(true);
      try {
        const list = await loadBatches();
        const saved = sessionStorage.getItem(BATCH_STORAGE_KEY);
        const initialId = saved && list.some((b) => b.id === saved) ? saved : list[0]?.id;
        if (initialId) {
          setBatchId(initialId);
          await refreshBatch(initialId);
        }
      } catch (err) {
        setError(err.message || 'Could not load import history.');
      } finally {
        setLoadingBatches(false);
      }
    })();
  }, [loadBatches, refreshBatch]);

  const addPdfFiles = useCallback((incoming) => {
    const pdfs = incoming.filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (!pdfs.length) {
      setError('Only PDF files can be dropped here.');
      return;
    }
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      const merged = [...prev];
      for (const file of pdfs) {
        if (!names.has(file.name)) {
          merged.push(file);
          names.add(file.name);
        }
      }
      return merged;
    });
    setError('');
    setSuccess('');
  }, []);

  const handleFileChange = (e) => {
    addPdfFiles(Array.from(e.target.files || []));
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    addPdfFiles(Array.from(e.dataTransfer.files || []));
  };

  const handleConfirmUpload = async () => {
    if (!files.length) {
      setError('Select one or more PDF CVs first.');
      return;
    }
    setUploading(true);
    setError('');
    setSuccess('');
    try {
      const data = await uploadTalentCvs(files);
      setBatchId(data.batchId);
      sessionStorage.setItem(BATCH_STORAGE_KEY, data.batchId);
      await loadBatches();
      await refreshBatch(data.batchId);
      const okCount = (data.results || []).filter((r) => r.ok).length;
      setSuccess(`${okCount} CV(s) confirmed. Review extracted emails below, then send activation invites.`);
      setFiles([]);
    } catch (err) {
      setError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const selectBatch = async (id) => {
    setBatchId(id);
    sessionStorage.setItem(BATCH_STORAGE_KEY, id);
    setError('');
    setSuccess('');
    try {
      await refreshBatch(id);
    } catch (err) {
      setError(err.message || 'Could not load batch.');
    }
  };

  const startEdit = (invite) => {
    setEditingId(invite.id);
    setEditEmail(invite.email || '');
    setEditName(invite.name || '');
  };

  const saveEdit = async (inviteId) => {
    try {
      await updateInviteEmail(inviteId, { email: editEmail, name: editName });
      setEditingId(null);
      await refreshBatch(batchId);
      await loadBatches();
      setSuccess('Candidate details updated.');
    } catch (err) {
      setError(err.message || 'Could not update.');
    }
  };

  const handleSendAll = async () => {
    if (!batchId) return;
    setSending(true);
    setError('');
    setSuccess('');
    try {
      const { outcomes = [], eligible = 0 } = await sendBatchInvites(batchId);
      const sent = outcomes.filter((o) => o.sent).length;
      const resent = outcomes.filter((o) => o.sent && o.resent).length;
      const failed = outcomes.filter((o) => !o.sent);

      if (eligible === 0) {
        setError(
          'No invites can be sent in this batch — every row is already activated or skipped.'
        );
      } else if (sent === 0) {
        setError(
          failed[0]?.error ||
            'No activation emails were sent. Check each row or use Resend on individual invites.'
        );
      } else {
        const parts = [`Sent ${sent} activation email(s)`];
        if (resent > 0) parts.push(`${resent} resent with a fresh link`);
        if (failed.length > 0) parts.push(`${failed.length} could not be sent`);
        setSuccess(`${parts.join(' · ')}.`);
      }
      await refreshBatch(batchId);
      await loadBatches();
    } catch (err) {
      setError(err.message || 'Could not send invites.');
    } finally {
      setSending(false);
    }
  };

  const handleSendOne = async (inviteId) => {
    setError('');
    setSuccess('');
    try {
      const result = await sendSingleInvite(inviteId);
      setSuccess(result.resent ? 'Activation email resent with a new link.' : 'Activation email sent.');
      await refreshBatch(batchId);
      await loadBatches();
    } catch (err) {
      setError(err.message || 'Could not send invite.');
    }
  };

  const activeBatch = batches.find((b) => b.id === batchId);

  return (
    <AdminPageShell>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <p className="text-red font-black tracking-[0.2em] text-[10px] uppercase mb-2">Super Admin</p>
            <h1 className="text-3xl md:text-4xl font-black text-black tracking-tight">Bulk CV import</h1>
            <p className="text-gray-500 text-sm font-medium mt-2 max-w-2xl leading-relaxed">
              Import PDF resumes, confirm extracted details, send activation links, and track who opened
              the email and completed signup.
            </p>
          </div>
          <button
            type="button"
            onClick={refreshDashboard}
            disabled={refreshing}
            className="inline-flex items-center gap-2 self-start lg:self-auto px-5 py-2.5 rounded-full border border-gray-200 bg-white text-xs font-black uppercase tracking-widest text-gray-700 hover:border-red hover:text-red transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red/5 border border-red/20 text-red rounded-2xl flex items-start gap-3 text-sm font-semibold">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="p-4 bg-green-50 border border-green-200 text-green-800 rounded-2xl flex items-start gap-3 text-sm font-semibold">
            <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-1 space-y-6">
            <div className="bg-white border border-gray-200 rounded-[2rem] p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <span className="w-8 h-8 rounded-full bg-black text-white text-xs font-black flex items-center justify-center">1</span>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider">Add CVs</h2>
                  <p className="text-xs text-gray-500 font-medium">PDF only · up to 50 files</p>
                </div>
              </div>

              <label
                onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  if (e.currentTarget.contains(e.relatedTarget)) return;
                  setDragActive(false);
                }}
                onDrop={handleDrop}
                className={`block border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-red bg-red/5 scale-[1.01]'
                    : 'border-gray-200 hover:border-red/40 hover:bg-gray-50/80'
                }`}
              >
                <div className={`w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center ${dragActive ? 'bg-red/10' : 'bg-gray-100'}`}>
                  <Upload className={dragActive ? 'text-red' : 'text-gray-400'} size={22} />
                </div>
                <p className="font-bold text-gray-800 text-sm mb-1">
                  {dragActive ? 'Drop to add PDFs' : 'Drag & drop resumes'}
                </p>
                <p className="text-[11px] text-gray-500">or click to browse</p>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>

              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-black text-gray-700 uppercase tracking-wider">
                    {files.length} file(s) selected
                  </p>
                  <ul className="max-h-36 overflow-y-auto space-y-1.5">
                    {files.map((f) => (
                      <li
                        key={f.name}
                        className="flex items-center justify-between gap-2 text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2"
                      >
                        <span className="truncate flex items-center gap-2">
                          <FileText size={12} className="text-gray-400 shrink-0" />
                          {f.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setFiles((prev) => prev.filter((x) => x.name !== f.name))}
                          className="shrink-0 text-gray-400 hover:text-red font-black uppercase text-[10px]"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                type="button"
                onClick={handleConfirmUpload}
                disabled={uploading || !files.length}
                className="mt-5 w-full py-3.5 bg-black text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red transition-colors disabled:opacity-50"
              >
                {uploading ? 'Processing…' : 'Confirm'}
              </button>
            </div>

            {batches.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-[2rem] p-6 shadow-sm">
                <h2 className="text-sm font-black uppercase tracking-wider mb-4">Recent imports</h2>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {batches.map((batch) => (
                    <button
                      key={batch.id}
                      type="button"
                      onClick={() => selectBatch(batch.id)}
                      className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                        batch.id === batchId
                          ? 'border-red bg-red/5'
                          : 'border-gray-100 hover:border-gray-200 bg-gray-50/50'
                      }`}
                    >
                      <p className="text-xs font-black text-gray-900 truncate">
                        {batch.label || 'Import batch'}
                      </p>
                      <p className="text-[10px] text-gray-500 font-semibold mt-1">
                        {formatWhen(batch.createdAt)} · {batch.stats.total} CV(s)
                      </p>
                      <p className="text-[10px] text-gray-400 font-medium mt-1">
                        {batch.stats.sent} sent · {batch.stats.clicked} clicked · {batch.stats.activated} activated
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="xl:col-span-2 space-y-6">
            {batchId && invites.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={FileText} label="CVs" value={batchStats.total} accent="bg-gray-100 text-gray-600" />
                <StatCard icon={Mail} label="Emails sent" value={batchStats.sent} accent="bg-indigo-50 text-indigo-600" />
                <StatCard icon={MousePointerClick} label="Link clicked" value={batchStats.clicked} accent="bg-sky-50 text-sky-600" />
                <StatCard icon={UserCheck} label="Activated" value={batchStats.activated} accent="bg-emerald-50 text-emerald-600" />
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-[2rem] shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="w-8 h-8 rounded-full bg-red text-white text-xs font-black flex items-center justify-center">2</span>
                    <h2 className="text-lg font-black">Import dashboard</h2>
                  </div>
                  <p className="text-xs text-gray-500 font-semibold ml-11">
                    {loadingBatches
                      ? 'Loading…'
                      : activeBatch
                        ? `${activeBatch.label || 'Batch'} · ${formatWhen(activeBatch.createdAt)}`
                        : 'Confirm CVs to start a batch'}
                    {readyCount > 0
                      ? ` · ${readyCount} can be sent${resendCount > 0 ? ` (${resendCount} resend)` : ''}`
                      : invites.length > 0
                        ? ' · tracking engagement below'
                        : ''}
                  </p>
                </div>
                {invites.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSendAll}
                    disabled={sending || readyCount === 0}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-red text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-colors disabled:opacity-50"
                  >
                    <Send size={14} />
                    {sending
                      ? 'Sending…'
                      : resendCount > 0 && readyCount === resendCount
                        ? 'Resend all'
                        : 'Send activation emails'}
                  </button>
                )}
              </div>

              {invites.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <FileText size={24} className="text-gray-300" />
                  </div>
                  <p className="font-black text-gray-800 text-sm mb-1">No batch selected</p>
                  <p className="text-gray-500 text-sm font-medium max-w-sm mx-auto">
                    Add PDFs on the left and click Confirm, or pick a recent import to view engagement.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm min-w-[880px]">
                    <thead>
                      <tr className="bg-gray-50/80 text-[10px] font-black uppercase tracking-widest text-gray-400">
                        <th className="px-5 py-3">Candidate</th>
                        <th className="px-5 py-3">Email</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Engagement</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invites.map((invite) => {
                        const meta = statusMeta(invite);
                        const sent = Boolean(invite.invitedAt || ['invited', 'activated'].includes(invite.status));
                        const clicked = Boolean(invite.activationLinkClickedAt);
                        const activated = Boolean(invite.status === 'activated' || invite.activatedAt);

                        return (
                          <tr key={invite.id} className="border-t border-gray-100 hover:bg-gray-50/40">
                            <td className="px-5 py-4">
                              {editingId === invite.id ? (
                                <input
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm mb-2"
                                  placeholder="Name"
                                />
                              ) : (
                                <p className="font-bold text-gray-900">{invite.name || '—'}</p>
                              )}
                              <p className="text-[11px] text-gray-400 font-medium truncate max-w-[200px] mt-0.5">
                                {invite.originalFilename || '—'}
                              </p>
                            </td>
                            <td className="px-5 py-4">
                              {editingId === invite.id ? (
                                <input
                                  value={editEmail}
                                  onChange={(e) => setEditEmail(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                                  placeholder="email@example.com"
                                />
                              ) : invite.email ? (
                                <span className="flex items-center gap-1.5 font-semibold text-gray-800">
                                  <Mail size={12} className="text-gray-400 shrink-0" />
                                  {invite.email}
                                </span>
                              ) : (
                                <span className="text-red font-bold text-xs flex items-center gap-1">
                                  <XCircle size={12} /> Missing — edit to add
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${meta.className}`}>
                                {meta.label}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="space-y-2 min-w-[200px]">
                                <EngagementStep
                                  done={sent}
                                  label="Email sent"
                                  detail={formatWhen(invite.invitedAt)}
                                  icon={Mail}
                                />
                                <EngagementStep
                                  done={clicked}
                                  label="Link clicked"
                                  detail={
                                    clicked
                                      ? `${formatWhen(invite.activationLinkClickedAt)}${
                                          invite.activationLinkClickCount > 1
                                            ? ` · ${invite.activationLinkClickCount}×`
                                            : ''
                                        }`
                                      : null
                                  }
                                  icon={MousePointerClick}
                                />
                                <EngagementStep
                                  done={activated}
                                  label="Activated"
                                  detail={formatWhen(invite.activatedAt)}
                                  icon={UserCheck}
                                />
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center justify-end gap-2">
                                {editingId === invite.id ? (
                                  <button
                                    type="button"
                                    onClick={() => saveEdit(invite.id)}
                                    className="text-xs font-black text-red hover:underline"
                                  >
                                    Save
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => startEdit(invite)}
                                    className="p-2 text-gray-400 hover:text-red rounded-lg hover:bg-gray-100"
                                    title="Edit"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                )}
                                {invite.email && ['ready', 'uploaded', 'invited'].includes(invite.status) && (
                                  <button
                                    type="button"
                                    onClick={() => handleSendOne(invite.id)}
                                    className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-gray-900 text-white hover:bg-red transition-colors"
                                  >
                                    {invite.status === 'invited' ? 'Resend' : 'Send'}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AdminPageShell>
  );
}
