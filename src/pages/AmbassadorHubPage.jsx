// Ambassador hub — sectioned: Invite · Candidates · Rewards · Share
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Send, Loader2, Users, UserPlus, CheckCircle2, Clock, Mail,
  Copy, Check, Upload, FileText, X, DollarSign, Linkedin, Download, Link2, ExternalLink, Pencil,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  fetchAmbassadorDashboard,
  inviteTalentAsAmbassador,
  uploadTalentCvsAsAmbassador,
  updateAmbassadorProfile,
  updateAmbassadorInvite,
} from '../lib/ambassadorApi';

const SECTIONS = [
  { id: 'invite', label: 'Invite' },
  { id: 'candidates', label: 'Candidates' },
  { id: 'rewards', label: 'Rewards' },
  { id: 'share', label: 'Share' },
];

const statusStyles = {
  ready: 'bg-amber-50 text-amber-800 border-amber-200',
  invited: 'bg-blue-50 text-blue-800 border-blue-200',
  activated: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  skipped: 'bg-gray-100 text-gray-600 border-gray-200',
  expired: 'bg-red/5 text-red border-red/20',
  uploaded: 'bg-amber-50 text-amber-800 border-amber-200',
};

function sectionFromHash(hash) {
  const raw = String(hash || '').replace(/^#/, '');
  if (SECTIONS.some((s) => s.id === raw)) return raw;
  return 'invite';
}

function money(n) {
  const v = Number(n) || 0;
  return `$${v.toFixed(v % 1 ? 2 : 0)}`;
}

function statusLabel(status) {
  const map = {
    ready: 'Ready',
    invited: 'Waiting',
    activated: 'Activated',
    skipped: 'Skipped',
    expired: 'Expired',
    uploaded: 'No email',
  };
  return map[status] || status || 'Unknown';
}

function canEditInviteEmail(status) {
  return !['activated', 'skipped', 'expired'].includes(status);
}

function CopyButton({ text, label = 'Copy', className = '' }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${className}`}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : label}
    </button>
  );
}

function buildLocalLinkedInAbout({ code, name, signupUrl }) {
  const inviteCode = String(code || '').trim().toUpperCase();
  const displayName = String(name || 'Ambassador').trim() || 'Ambassador';
  return [
    'Get Placed in Premium Remote Roles (Exclusive Access)',
    '',
    `I am a Verified Ambassador for Byghires (${displayName}), unlocking direct access to premium, budget-friendly remote opportunities worldwide.`,
    '',
    'Use my private invitation code below to fast-track your application to top global firms:',
    '',
    `My Invite Code: ${inviteCode}`,
    `Register Here: ${signupUrl}`,
  ].join('\n');
}

function SectionShell({ title, subtitle, children }) {
  return (
    <motion.div
      key={title}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22 }}
      className="bg-white border border-black/5 rounded-[1.75rem] p-6 sm:p-8 shadow-[0_12px_40px_-28px_rgba(0,0,0,0.35)]"
    >
      <div className="mb-6 max-w-2xl">
        <h2 className="text-2xl font-black tracking-tight text-black">{title}</h2>
        {subtitle ? (
          <p className="text-sm text-gray-500 font-medium mt-1.5 leading-relaxed">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </motion.div>
  );
}

export default function AmbassadorHubPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const section = sectionFromHash(location.hash);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState('');
  const [inviteMode, setInviteMode] = useState('email');
  const [cvFiles, setCvFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [uploadResults, setUploadResults] = useState([]);
  const [editingInviteId, setEditingInviteId] = useState(null);
  const [editEmailDraft, setEditEmailDraft] = useState('');
  const [editNameDraft, setEditNameDraft] = useState('');
  const [savingInviteId, setSavingInviteId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const dash = await fetchAmbassadorDashboard();
      setData(dash);
    } catch (err) {
      setError(err.message || 'Could not load ambassador hub.');
      if (err.code === 'NOT_AMBASSADOR') {
        setTimeout(() => navigate('/ambassador'), 1200);
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/ambassador');
      return;
    }
    load();
  }, [authLoading, user, load, navigate]);

  useEffect(() => {
    if (!location.hash) {
      navigate('/ambassador/hub#invite', { replace: true });
    }
  }, [location.hash, navigate]);

  const setSection = (id) => {
    navigate(`/ambassador/hub#${id}`, { replace: true });
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    setSending(true);
    setToast('');
    try {
      const result = await inviteTalentAsAmbassador({ email, name });
      setEmail('');
      setName('');
      setToast(
        result.sendResult?.sent
          ? `Invite sent to ${result.invite.email}`
          : result.sendResult?.reason === 'already_registered'
            ? 'That email is already registered as talent.'
            : `Invite saved (${result.invite.status})`
      );
      await load();
      setSection('candidates');
    } catch (err) {
      setToast(err.message || 'Invite failed.');
    } finally {
      setSending(false);
    }
  };

  const addCvFiles = (fileList) => {
    const next = Array.from(fileList || []).filter((f) =>
      String(f.name || '').toLowerCase().endsWith('.pdf') || f.type === 'application/pdf'
    );
    if (!next.length) {
      setToast('Please choose PDF files only.');
      return;
    }
    setCvFiles((prev) => {
      const names = new Set(prev.map((f) => f.name + f.size));
      const merged = [...prev];
      for (const f of next) {
        const key = f.name + f.size;
        if (!names.has(key)) merged.push(f);
      }
      return merged.slice(0, 20);
    });
  };

  const handleUploadCvs = async (e) => {
    e.preventDefault();
    if (!cvFiles.length) {
      setToast('Add at least one PDF first.');
      return;
    }
    setUploading(true);
    setToast('');
    setUploadResults([]);
    try {
      const result = await uploadTalentCvsAsAmbassador(cvFiles, { autoSend: true });
      const rows = (result.results || []).map((r) => {
        if (!r.ok) {
          return {
            ok: false,
            filename: r.filename || 'PDF',
            email: null,
            status: 'failed',
            detail: r.error || 'Upload failed',
          };
        }
        const email = r.invite?.email || null;
        const filename = r.invite?.originalFilename || 'PDF';
        let status = r.invite?.status || 'uploaded';
        let detail = '';
        if (r.skipReason === 'already_registered') {
          detail = 'Already registered — invite not sent';
        } else if (r.sendResult?.sent) {
          detail = 'Invite sent';
        } else if (!email) {
          detail = 'No email found in PDF — invite not sent';
          status = 'no_email';
        } else {
          detail = r.sendResult?.reason
            ? `Saved · ${r.sendResult.reason}`
            : 'Saved';
        }
        return {
          ok: true,
          inviteId: r.invite?.id || null,
          filename,
          email,
          name: r.invite?.name || null,
          status,
          detail,
        };
      });

      const sent = rows.filter((r) => r.detail === 'Invite sent').length;
      const noEmail = rows.filter((r) => r.status === 'no_email').length;
      const skipped = rows.filter((r) => /already registered/i.test(r.detail)).length;
      const failed = rows.filter((r) => !r.ok).length;

      setCvFiles([]);
      setUploadResults(rows);
      setToast(
        `Processed ${rows.length} PDF${rows.length === 1 ? '' : 's'}` +
          (sent ? ` · ${sent} invite${sent === 1 ? '' : 's'} sent` : '') +
          (noEmail ? ` · ${noEmail} missing email` : '') +
          (skipped ? ` · ${skipped} already registered` : '') +
          (failed ? ` · ${failed} failed` : '')
      );
      await load();
    } catch (err) {
      setToast(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const startEditInvite = (inv) => {
    setEditingInviteId(inv.id);
    setEditEmailDraft(inv.email || '');
    setEditNameDraft(inv.name || '');
  };

  const cancelEditInvite = () => {
    setEditingInviteId(null);
    setEditEmailDraft('');
    setEditNameDraft('');
  };

  const saveInviteDetails = async (inviteId, { send = true } = {}) => {
    const email = editEmailDraft.trim();
    const name = editNameDraft.trim();
    if (send && !email) {
      setToast('Enter an email address before sending.');
      return;
    }
    if (!email && !name) {
      setToast('Enter a name or email to save.');
      return;
    }
    setSavingInviteId(inviteId);
    setToast('');
    try {
      const payload = { send };
      if (email) payload.email = email;
      payload.name = name;
      const result = await updateAmbassadorInvite(inviteId, payload);
      cancelEditInvite();
      setUploadResults((prev) =>
        prev.map((row) =>
          row.inviteId === inviteId
            ? {
                ...row,
                email: result.invite?.email || email || row.email,
                name: result.invite?.name ?? name,
                status: result.invite?.status || row.status,
                detail: result.sendResult?.sent
                  ? 'Invite sent'
                  : result.sendResult?.reason === 'already_registered'
                    ? 'Already registered — invite not sent'
                    : 'Details updated',
              }
            : row
        )
      );
      setToast(
        result.sendResult?.sent
          ? `Invite sent to ${result.invite?.email || email}`
          : result.sendResult?.reason === 'already_registered'
            ? 'That email is already registered as talent.'
            : 'Candidate details updated.'
      );
      await load();
      if (send) setSection('candidates');
    } catch (err) {
      setToast(err.message || 'Could not update candidate.');
    } finally {
      setSavingInviteId(null);
    }
  };

  const branding = data?.branding;
  const earnings = data?.earnings;
  const badgeHref = useMemo(
    () => `${branding?.badgePath || '/byghires-circle-badge.png'}?v=hd-2048b`,
    [branding?.badgePath]
  );
  const badgeSvgHref = `${branding?.badgeSvgPath || '/byghires-circle-badge.svg'}?v=hd-2048b`;
  const badgePreviewHref = badgeSvgHref;

  const signupUrl = useMemo(() => {
    const code = data?.ambassador?.code || '';
    if (typeof window !== 'undefined' && code) {
      return `${window.location.origin}/talent/signup?code=${encodeURIComponent(code)}`;
    }
    return branding?.signupUrl || '';
  }, [data?.ambassador?.code, branding?.signupUrl]);

  const linkedInAbout = useMemo(
    () =>
      buildLocalLinkedInAbout({
        code: data?.ambassador?.code,
        name: data?.ambassador?.name,
        signupUrl,
      }),
    [data?.ambassador?.code, data?.ambassador?.name, signupUrl]
  );

  const linkedInShareUrl = useMemo(() => {
    if (!signupUrl) return 'https://www.linkedin.com/';
    return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(signupUrl)}`;
  }, [signupUrl]);

  const handleDownloadPng = () => {
    const a = document.createElement('a');
    a.href = badgeHref;
    a.download = `byghires-circle-${data?.ambassador?.code || 'badge'}.png`;
    a.click();
    setToast('Badge PNG downloaded — add it to LinkedIn Featured.');
  };

  const startEditName = () => {
    setNameDraft(data?.ambassador?.name || '');
    setEditingName(true);
    setToast('');
  };

  const saveName = async () => {
    setSavingName(true);
    setToast('');
    try {
      await updateAmbassadorProfile({ name: nameDraft });
      setEditingName(false);
      setToast('Display name updated.');
      await load();
    } catch (err) {
      setToast(err.message || 'Could not update name.');
    } finally {
      setSavingName(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#f7f2ee] pt-28 flex items-center justify-center">
        <Loader2 className="animate-spin text-red" size={28} />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-[#f7f2ee] pt-28 px-4 text-center">
        <p className="text-red font-bold">{error}</p>
        <Link to="/ambassador" className="mt-4 inline-block text-xs font-black uppercase tracking-widest text-black hover:text-red">
          Back to code entry
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans bg-[#f7f2ee]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem]"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 20% 0%, rgba(255,61,61,0.1), transparent 60%), linear-gradient(180deg, #fff8f4 0%, #f7f2ee 100%)',
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-20">
        {/* Compact header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red mb-1">
              Ambassador
            </p>
            {editingName ? (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-black/10 bg-white text-xl font-black outline-none focus:border-red min-w-[12rem]"
                  placeholder="Your display name"
                  autoFocus
                />
                <button
                  type="button"
                  disabled={savingName || !nameDraft.trim()}
                  onClick={saveName}
                  className="px-3 py-2 rounded-xl bg-black text-white text-[10px] font-black uppercase tracking-widest hover:bg-red disabled:opacity-40"
                >
                  {savingName ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingName(false)}
                  className="px-3 py-2 rounded-xl border border-black/10 text-[10px] font-black uppercase tracking-widest text-gray-500"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-black tracking-tight text-black">
                  {data?.ambassador?.name || 'Ambassador'}
                </h1>
                <button
                  type="button"
                  onClick={startEditName}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-black/10 text-[9px] font-black uppercase tracking-widest text-gray-500 hover:border-red hover:text-red"
                >
                  <Pencil size={11} /> Edit name
                </button>
              </div>
            )}
            <p className="text-sm text-gray-500 font-medium mt-1">
              Invite people from your network — BYG handles the rest. This name appears on invite emails.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CopyButton
              text={data?.ambassador?.code}
              label={data?.ambassador?.code}
              className="bg-black text-white hover:bg-red"
            />
            <CopyButton
              text={branding?.signupUrl}
              label="Signup link"
              className="bg-white border border-black/10 text-black hover:border-red hover:text-red"
            />
          </div>
        </div>

        {/* Snapshot strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { icon: Mail, label: 'Invited', value: data?.stats?.invited ?? 0 },
            { icon: Clock, label: 'Waiting', value: data?.stats?.pending ?? 0 },
            { icon: Users, label: 'Activated', value: data?.stats?.activated ?? 0 },
            { icon: DollarSign, label: 'Total rewards', value: money(earnings?.totals?.lifetimeEarnedUsd) },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-white/80 border border-black/5 rounded-2xl px-4 py-3"
            >
              <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                <item.icon size={12} className="text-red" />
                <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
              </div>
              <p className="text-xl font-black tabular-nums text-black">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Mobile section switcher (desktop uses navbar) */}
        <div className="md:hidden flex gap-1 p-1 mb-5 bg-white border border-black/5 rounded-2xl">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors ${
                section === s.id ? 'bg-black text-white' : 'text-gray-500'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {toast ? (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 text-xs font-semibold text-gray-700 bg-white border border-black/5 rounded-xl px-4 py-3"
            >
              {toast}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {section === 'invite' && (
            <SectionShell
              title="Invite candidates"
              subtitle="Email someone from your network, or upload their CV. That’s your only job — screening stays with BYG."
            >
              <div className="flex gap-2 mb-5 p-1 bg-gray-50 rounded-xl border border-gray-100 max-w-md">
                <button
                  type="button"
                  onClick={() => setInviteMode('email')}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                    inviteMode === 'email' ? 'bg-black text-white' : 'text-gray-500'
                  }`}
                >
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => setInviteMode('pdf')}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                    inviteMode === 'pdf' ? 'bg-black text-white' : 'text-gray-500'
                  }`}
                >
                  Upload PDF
                </button>
              </div>

              {inviteMode === 'email' ? (
                <form onSubmit={handleInvite} className="max-w-md space-y-3">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name (optional)"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold outline-none focus:border-red"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold outline-none focus:border-red"
                  />
                  <button
                    type="submit"
                    disabled={sending || !email.trim()}
                    className="w-full py-3.5 rounded-xl bg-black hover:bg-red text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    {sending ? <Loader2 size={14} className="animate-spin" /> : <><Send size={14} /> Send invite</>}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleUploadCvs} className="max-w-lg space-y-3">
                  <label
                    onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      addCvFiles(e.dataTransfer.files);
                    }}
                    className={`flex flex-col items-center justify-center gap-2 px-4 py-10 rounded-2xl border-2 border-dashed cursor-pointer ${
                      dragActive ? 'border-red bg-red/5' : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <Upload size={22} className="text-red" />
                    <span className="text-xs font-black uppercase tracking-widest text-gray-700">
                      Drop PDFs or browse
                    </span>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        addCvFiles(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {cvFiles.length > 0 && (
                    <ul className="space-y-1.5">
                      {cvFiles.map((f) => (
                        <li
                          key={`${f.name}-${f.size}`}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-xs font-semibold"
                        >
                          <FileText size={14} className="text-red shrink-0" />
                          <span className="truncate flex-1">{f.name}</span>
                          <button type="button" onClick={() => setCvFiles((prev) => prev.filter((x) => x !== f))}>
                            <X size={14} className="text-gray-400 hover:text-red" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="submit"
                    disabled={uploading || !cvFiles.length}
                    className="w-full py-3.5 rounded-xl bg-black hover:bg-red text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <><UserPlus size={14} /> Upload & invite</>}
                  </button>

                  {uploadResults.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                          Extracted from PDFs
                        </p>
                        <button
                          type="button"
                          onClick={() => setSection('candidates')}
                          className="text-[10px] font-black uppercase tracking-widest text-red"
                        >
                          View candidates
                        </button>
                      </div>
                      <ul className="space-y-1.5 max-h-56 overflow-y-auto">
                        {uploadResults.map((row, i) => (
                          <li
                            key={`${row.filename}-${i}`}
                            className={`rounded-xl border px-3 py-2.5 text-xs ${
                              row.status === 'no_email' || !row.ok
                                ? 'border-amber-200 bg-amber-50'
                                : 'border-gray-100 bg-gray-50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-black text-black truncate">
                                  {row.name || row.filename}
                                </p>
                                {row.inviteId && editingInviteId === row.inviteId ? (
                                  <div className="mt-2 space-y-2">
                                    <input
                                      type="text"
                                      value={editNameDraft}
                                      onChange={(e) => setEditNameDraft(e.target.value)}
                                      placeholder="Candidate name"
                                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs font-semibold outline-none focus:border-red"
                                    />
                                    <input
                                      type="email"
                                      value={editEmailDraft}
                                      onChange={(e) => setEditEmailDraft(e.target.value)}
                                      placeholder="name@example.com"
                                      autoFocus
                                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs font-semibold outline-none focus:border-red"
                                    />
                                    <div className="flex flex-wrap gap-1.5">
                                      <button
                                        type="button"
                                        disabled={savingInviteId === row.inviteId || !editEmailDraft.trim()}
                                        onClick={() => saveInviteDetails(row.inviteId, { send: true })}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-black text-white text-[9px] font-black uppercase tracking-wider disabled:opacity-40"
                                      >
                                        {savingInviteId === row.inviteId ? (
                                          <Loader2 size={10} className="animate-spin" />
                                        ) : (
                                          <Send size={10} />
                                        )}
                                        Save & send
                                      </button>
                                      <button
                                        type="button"
                                        disabled={savingInviteId === row.inviteId}
                                        onClick={cancelEditInvite}
                                        className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-[9px] font-black uppercase tracking-wider text-gray-500"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-[11px] font-semibold mt-0.5 truncate">
                                    {row.email ? (
                                      <span className="text-emerald-700">{row.email}</span>
                                    ) : (
                                      <span className="text-amber-800">No email extracted</span>
                                    )}
                                  </p>
                                )}
                                {row.filename && row.name ? (
                                  <p className="text-[10px] text-gray-400 font-medium truncate mt-0.5">
                                    {row.filename}
                                  </p>
                                ) : null}
                              </div>
                              <div className="shrink-0 flex flex-col items-end gap-1">
                                {row.inviteId &&
                                row.ok &&
                                canEditInviteEmail(row.status === 'no_email' ? 'uploaded' : row.status) &&
                                editingInviteId !== row.inviteId ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      startEditInvite({
                                        id: row.inviteId,
                                        email: row.email,
                                        name: row.name,
                                      })
                                    }
                                    className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-red"
                                  >
                                    <Pencil size={10} />
                                    Edit
                                  </button>
                                ) : null}
                                <span className="text-[9px] font-black uppercase tracking-wider text-gray-500 text-right max-w-[7rem]">
                                  {row.detail}
                                </span>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </form>
              )}
            </SectionShell>
          )}

          {section === 'candidates' && (
            <SectionShell
              title="Candidate status"
              subtitle="See invite progress for people you referred. Successful hires are recorded by BYG — rewards then appear under Rewards."
            >
              {!(data?.invites || []).length ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-12 text-center">
                  <Mail size={22} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-xs font-black uppercase tracking-widest text-gray-400">No candidates yet</p>
                  <button
                    type="button"
                    onClick={() => setSection('invite')}
                    className="mt-3 text-[10px] font-black uppercase tracking-widest text-red"
                  >
                    Invite someone
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
                  {data.invites.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-start justify-between gap-3 p-3.5 rounded-2xl border border-gray-100 bg-[#fafafa]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-black text-sm text-black truncate">
                          {inv.name || inv.email || inv.originalFilename || 'Candidate'}
                        </p>
                        {editingInviteId === inv.id ? (
                          <div className="mt-2 space-y-2 max-w-sm">
                            <input
                              type="text"
                              value={editNameDraft}
                              onChange={(e) => setEditNameDraft(e.target.value)}
                              placeholder="Candidate name"
                              className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold outline-none focus:border-red"
                            />
                            <input
                              type="email"
                              value={editEmailDraft}
                              onChange={(e) => setEditEmailDraft(e.target.value)}
                              placeholder="name@example.com"
                              autoFocus
                              className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold outline-none focus:border-red"
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={savingInviteId === inv.id || !editEmailDraft.trim()}
                                onClick={() => saveInviteDetails(inv.id, { send: true })}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black text-white text-[9px] font-black uppercase tracking-wider disabled:opacity-40"
                              >
                                {savingInviteId === inv.id ? (
                                  <Loader2 size={11} className="animate-spin" />
                                ) : (
                                  <Send size={11} />
                                )}
                                {inv.status === 'invited' ? 'Save & resend' : 'Save & send'}
                              </button>
                              <button
                                type="button"
                                disabled={savingInviteId === inv.id}
                                onClick={() => saveInviteDetails(inv.id, { send: false })}
                                className="px-3 py-2 rounded-xl border border-gray-200 text-[9px] font-black uppercase tracking-wider text-gray-600 disabled:opacity-40"
                              >
                                Save only
                              </button>
                              <button
                                type="button"
                                disabled={savingInviteId === inv.id}
                                onClick={cancelEditInvite}
                                className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider text-gray-400"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[11px] font-medium truncate mt-0.5">
                            {inv.email ? (
                              <span className="text-emerald-700">{inv.email}</span>
                            ) : (
                              <span className="text-amber-700">No email extracted</span>
                            )}
                          </p>
                        )}
                        {inv.originalFilename ? (
                          <p className="text-[10px] text-gray-400 font-medium truncate mt-0.5">
                            PDF: {inv.originalFilename}
                          </p>
                        ) : null}
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-wider ${
                            statusStyles[inv.status] || statusStyles.ready
                          }`}
                        >
                          {inv.status === 'activated' ? <CheckCircle2 size={10} /> : null}
                          {statusLabel(inv.status)}
                        </span>
                        {canEditInviteEmail(inv.status) && editingInviteId !== inv.id ? (
                          <button
                            type="button"
                            onClick={() => startEditInvite(inv)}
                            className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-red hover:text-black"
                          >
                            <Pencil size={10} />
                            {inv.email ? 'Edit' : 'Add details'}
                          </button>
                        ) : null}
                        {inv.status === 'invited' &&
                        inv.email &&
                        editingInviteId !== inv.id ? (
                          <button
                            type="button"
                            disabled={savingInviteId === inv.id}
                            onClick={async () => {
                              setSavingInviteId(inv.id);
                              setToast('');
                              try {
                                const result = await updateAmbassadorInvite(inv.id, {
                                  email: inv.email,
                                  name: inv.name || undefined,
                                  send: true,
                                });
                                setToast(
                                  result.sendResult?.sent
                                    ? `Invite resent to ${inv.email}`
                                    : result.sendResult?.reason || 'Could not resend.'
                                );
                                await load();
                              } catch (err) {
                                setToast(err.message || 'Could not resend invite.');
                              } finally {
                                setSavingInviteId(null);
                              }
                            }}
                            className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-gray-500 hover:text-black"
                          >
                            {savingInviteId === inv.id ? (
                              <Loader2 size={10} className="animate-spin" />
                            ) : (
                              <Send size={10} />
                            )}
                            Resend
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionShell>
          )}

          {section === 'rewards' && (
            <SectionShell
              title="Rewards"
              subtitle="When BYG marks one of your referred talents as hired, your decaying reward appears here automatically. Payouts are not connected yet."
            >
              <div className="grid sm:grid-cols-3 gap-3 mb-8">
                <div className="rounded-2xl bg-black text-white p-5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Total rewards</p>
                  <p className="text-3xl font-black tabular-nums">{money(earnings?.totals?.lifetimeEarnedUsd)}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 border border-gray-100 p-5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Pending</p>
                  <p className="text-3xl font-black tabular-nums text-black">
                    {money((earnings?.totals?.demoUsd || 0) + (earnings?.totals?.pendingUsd || 0))}
                  </p>
                </div>
                <div className="rounded-2xl bg-gray-50 border border-gray-100 p-5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Paid out</p>
                  <p className="text-3xl font-black tabular-nums text-black">{money(earnings?.totals?.paidUsd)}</p>
                </div>
              </div>

              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
                Payout schedule
              </p>
              <div className="grid sm:grid-cols-2 gap-2 mb-8">
                {(earnings?.schedule || []).map((row) => (
                  <div
                    key={row.cycle}
                    className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
                  >
                    <p className="text-sm font-bold text-black">{row.label}</p>
                    <p className="text-lg font-black text-red tabular-nums">{money(row.amountUsd)}</p>
                  </div>
                ))}
              </div>

              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
                Placement history
              </p>
              {!(earnings?.placements || []).length ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center">
                  <p className="text-xs font-medium text-gray-400">
                    No hires yet. When BYG confirms a successful hire for your referred talent, rewards show up here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {earnings.placements.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-black truncate">
                          {p.talentName || p.talentEmail || 'Talent'}
                        </p>
                        <p className="text-[11px] text-gray-400 font-medium">
                          Cycle {p.placementCycle} · {p.status}
                        </p>
                      </div>
                      <p className="font-black tabular-nums text-black">{money(p.rewardUsd)}</p>
                    </div>
                  ))}
                </div>
              )}
            </SectionShell>
          )}

          {section === 'share' && (
            <SectionShell
              title="Share your code"
              subtitle="LinkedIn does not let apps auto-pin a custom badge to your profile. Download the B badge, then add it under Featured in about 30 seconds."
            >
              <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900 leading-relaxed">
                <strong className="font-black">How to attach:</strong> Download PNG → LinkedIn profile →{' '}
                <em>Add profile section → Featured → Add media</em> → upload the badge → paste your signup link.
                There is no official one-click “attach badge” API for custom ambassador marks.
              </div>

              <div className="grid lg:grid-cols-2 gap-8">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-red mb-3 flex items-center gap-1.5">
                    <Linkedin size={12} /> Byghires Circle badge
                  </p>
                  <div className="rounded-2xl bg-[#f3f1ec] border border-black/5 p-8 mb-4 flex items-center justify-center">
                    <img
                      src={badgePreviewHref}
                      alt="Byghires Circle Verified Ambassador badge"
                      className="w-44 h-44 sm:w-56 sm:h-56 object-contain"
                      width={224}
                      height={224}
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 font-medium mb-3">
                    Preview is vector (sharp). Download is a 2048×2048 PNG for LinkedIn Featured.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadPng}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black text-white text-[10px] font-black uppercase tracking-widest hover:bg-red"
                    >
                      <Download size={12} /> Download PNG
                    </button>
                    <a
                      href={badgeSvgHref}
                      download={`byghires-circle-${data?.ambassador?.code || 'badge'}.svg`}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 text-[10px] font-black uppercase tracking-widest hover:border-red hover:text-red"
                    >
                      SVG
                    </a>
                    <a
                      href="https://www.linkedin.com/in/me/"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0a66c2] text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90"
                    >
                      <ExternalLink size={12} /> Open LinkedIn profile
                    </a>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-red mb-3 flex items-center gap-1.5">
                    <Link2 size={12} /> LinkedIn About
                  </p>
                  <pre className="whitespace-pre-wrap text-[12px] leading-relaxed font-medium text-gray-700 bg-gray-50 border border-gray-100 rounded-2xl p-4 max-h-64 overflow-y-auto mb-4">
                    {linkedInAbout}
                  </pre>
                  <div className="flex flex-wrap gap-2">
                    <CopyButton
                      text={linkedInAbout}
                      label="Copy About"
                      className="bg-black text-white hover:bg-red"
                    />
                    <CopyButton
                      text={signupUrl}
                      label="Signup link"
                      className="bg-gray-50 border border-gray-200 text-gray-700 hover:border-red"
                    />
                    <a
                      href={linkedInShareUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0a66c2] text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90"
                    >
                      <Linkedin size={12} /> Share signup link
                    </a>
                  </div>
                </div>
              </div>
            </SectionShell>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
