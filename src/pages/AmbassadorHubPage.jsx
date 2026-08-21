// Ambassador hub — sectioned: Invite · Candidates · Rewards · Share
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Send, Loader2, Users, UserPlus, CheckCircle2, Clock, Mail,
  Copy, Check, Upload, FileText, X, DollarSign, Linkedin, Download, Link2, ExternalLink, Pencil, Calendar,
  ChevronRight, Search, HelpCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  fetchAmbassadorDashboard,
  inviteTalentAsAmbassador,
  uploadTalentCvsAsAmbassador,
  updateAmbassadorProfile,
  updateAmbassadorInvite,
  fetchAmbassadorReviews,
  approveAmbassadorReview,
  requestAmbassadorReviewChanges,
  nudgeAmbassadorTalentSlots,
  fetchAmbassadorScreens,
  fetchAmbassadorScreenSlots,
  bookAmbassadorScreen,
} from '../lib/ambassadorApi';
import DirectoryTalentModal from '../components/DirectoryTalentModal';
import { formatDisplayName } from '../lib/formatDisplayName';
import { photoUrlForDisplay } from '../lib/talentStorage';
import { DEFAULT_MONTHLY_FEE_USD } from '../lib/profileContentPolicy';

const BASE_SECTIONS = [
  { id: 'invite', label: 'Invite' },
  { id: 'candidates', label: 'Candidates' },
  { id: 'rewards', label: 'Rewards' },
  { id: 'share', label: 'Share' },
  { id: 'help', label: 'Help' },
];

const INTERNAL_SECTIONS = [
  { id: 'invite', label: 'Invite' },
  { id: 'candidates', label: 'Candidates' },
  { id: 'review', label: 'Review' },
  { id: 'screens', label: 'Screens' },
  { id: 'rewards', label: 'Rewards' },
  { id: 'share', label: 'Share' },
  { id: 'help', label: 'Help' },
];

const statusStyles = {
  ready: 'bg-amber-50 text-amber-800 border-amber-200',
  invited: 'bg-blue-50 text-blue-800 border-blue-200',
  activated: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  skipped: 'bg-gray-100 text-gray-600 border-gray-200',
  expired: 'bg-red/5 text-red border-red/20',
  uploaded: 'bg-amber-50 text-amber-800 border-amber-200',
};

function sectionFromHash(hash, isInternal) {
  const raw = String(hash || '').replace(/^#/, '');
  const sections = isInternal ? INTERNAL_SECTIONS : BASE_SECTIONS;
  if (sections.some((s) => s.id === raw)) return raw;
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

/** Snapshot strip filters → Candidates list */
const CANDIDATE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'invited', label: 'Invited' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'activated', label: 'Activated' },
];

function normalizeCandidateFilter(raw) {
  const v = String(raw || '').toLowerCase();
  if (CANDIDATE_FILTERS.some((f) => f.id === v)) return v;
  return 'all';
}

function inviteMatchesFilter(inv, filter) {
  const status = inv?.status;
  const activated =
    (status === 'activated' || Boolean(inv?.activatedAt)) && Boolean(inv?.userId);
  if (filter === 'waiting') {
    return ['ready', 'invited', 'uploaded'].includes(status) && !activated;
  }
  if (filter === 'activated') return activated;
  if (filter === 'invited') return !['skipped', 'expired'].includes(status);
  return true;
}

function filterEmptyCopy(filter) {
  const map = {
    waiting: 'No one is waiting on activation right now.',
    activated: 'No activated candidates yet.',
    invited: 'No invites sent yet.',
    all: 'No candidates yet',
  };
  return map[filter] || map.all;
}

function canEditInviteEmail(status) {
  return !['activated', 'skipped', 'expired'].includes(status);
}

function mapInviteProfileToModalTalent(profile) {
  if (!profile) return null;
  const skills = profile.skills || [];
  const fee =
    Number(profile.directoryFeeUsd) ||
    Math.round((Number(profile.monthlyFeeUsd) || DEFAULT_MONTHLY_FEE_USD) * 1.1);
  return {
    id: profile.id,
    name: formatDisplayName(profile.name) || 'Candidate',
    photo: photoUrlForDisplay(profile.photoUrl, profile.updatedAt || profile.createdAt) || null,
    score: 0,
    verified: false,
    aiInterviewVerified: false,
    ambassadorReferred: Boolean(profile.ambassadorReferred),
    role: profile.jobTitle || 'Professional',
    experience: profile.experienceYears != null ? `${profile.experienceYears} yrs` : 'Flexible',
    tags: skills,
    bestSkill: skills[0] || '',
    skillScores: {},
    fee,
    availability: profile.availability || 'immediate',
    roleType: profile.roleType || 'flexible',
    bio: profile.about || 'No bio provided yet.',
    period: '/mo',
  };
}

function mapReviewRowToModalTalent(row) {
  if (!row) return null;
  const skills = row.skills || [];
  const fee = Math.round((Number(row.monthlyFeeUsd) || DEFAULT_MONTHLY_FEE_USD) * 1.1);
  return {
    id: row.id,
    name: formatDisplayName(row.name) || 'Talent',
    photo: photoUrlForDisplay(row.photoUrl) || null,
    score: 0,
    verified: false,
    aiInterviewVerified: false,
    ambassadorReferred: true,
    role: row.jobTitle || 'Professional',
    experience: row.experienceYears != null ? `${row.experienceYears} yrs` : 'Flexible',
    tags: skills,
    bestSkill: skills[0] || '',
    skillScores: {},
    fee,
    availability: row.availability || 'immediate',
    roleType: 'flexible',
    bio: row.about || 'No bio provided yet.',
    period: '/mo',
  };
}

function directoryStatusLabel(status) {
  const map = {
    draft: 'Draft',
    pending_review: 'Pending review',
    changes_requested: 'Changes requested',
    approved: 'Approved',
    rejected: 'Rejected',
  };
  return map[status] || String(status || 'unknown').replace(/_/g, ' ');
}

function PendingApproveNudge({ status, className = '' }) {
  if (status !== 'pending_review') return null;
  return (
    <p
      className={`text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200/80 rounded-xl px-3 py-2 leading-snug ${className}`}
    >
      This profile is still pending approval — you can book a screen now, then approve when ready.
    </p>
  );
}

function TalentPhoto({ name, photoUrl, size = 56 }) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        className="rounded-2xl object-cover object-top shrink-0 border border-black/10"
        style={{ width: size, height: size }}
      />
    );
  }
  const initial = String(name || 'T').charAt(0).toUpperCase();
  return (
    <div
      className="rounded-2xl bg-black text-white font-black flex items-center justify-center shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initial}
    </div>
  );
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
  const [searchParams] = useSearchParams();

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
  const [reviewTab, setReviewTab] = useState('pending_review');
  const [reviewRows, setReviewRows] = useState([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewActingId, setReviewActingId] = useState('');
  const [changesNotes, setChangesNotes] = useState('');
  const [changesForId, setChangesForId] = useState('');
  const [screenTalent, setScreenTalent] = useState(null);
  const [screenSlots, setScreenSlots] = useState([]);
  const [screenLoading, setScreenLoading] = useState(false);
  const [bookingSlotId, setBookingSlotId] = useState('');
  const [profileModalTalent, setProfileModalTalent] = useState(null);
  const [candidateQuery, setCandidateQuery] = useState('');
  const [talentQuery, setTalentQuery] = useState('');

  const candidateFilter = normalizeCandidateFilter(searchParams.get('filter'));

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

  const setSection = (id, opts = {}) => {
    const next = new URLSearchParams(searchParams);
    if (id === 'candidates' && opts.filter) {
      next.set('filter', normalizeCandidateFilter(opts.filter));
    } else if (id !== 'candidates') {
      next.delete('filter');
    }
    const qs = next.toString();
    navigate(`/ambassador/hub${qs ? `?${qs}` : ''}#${id}`, { replace: true });
  };

  const setCandidateFilter = (filter) => {
    setSection('candidates', { filter: normalizeCandidateFilter(filter) });
  };

  const isInternal = Boolean(data?.ambassador?.isInternal || data?.ambassador?.kind === 'internal');
  const sections = isInternal ? INTERNAL_SECTIONS : BASE_SECTIONS;
  const section = sectionFromHash(location.hash, isInternal);

  const filteredInvites = useMemo(() => {
    const list = data?.invites || [];
    const q = candidateQuery.trim().toLowerCase();
    return list.filter((inv) => {
      if (!inviteMatchesFilter(inv, candidateFilter)) return false;
      if (!q) return true;
      const hay = [
        inv.name,
        inv.email,
        inv.originalFilename,
        inv.profile?.name,
        inv.profile?.email,
        inv.profile?.jobTitle,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data?.invites, candidateFilter, candidateQuery]);

  const filteredReviewRows = useMemo(() => {
    const q = talentQuery.trim().toLowerCase();
    if (!q) return reviewRows;
    return reviewRows.filter((row) => {
      const hay = [row.name, row.email, row.jobTitle, ...(row.skills || [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [reviewRows, talentQuery]);

  const loadReviews = useCallback(async (status) => {
    if (!isInternal) return;
    setReviewLoading(true);
    try {
      const result = await fetchAmbassadorReviews(status || reviewTab);
      setReviewRows(result.profiles || []);
    } catch (err) {
      setToast(err.message || 'Could not load reviews.');
    } finally {
      setReviewLoading(false);
    }
  }, [isInternal, reviewTab]);

  const loadScreens = useCallback(async () => {
    if (!isInternal) return;
    setReviewLoading(true);
    try {
      const result = await fetchAmbassadorScreens();
      setReviewRows(result.profiles || []);
    } catch (err) {
      setToast(err.message || 'Could not load screens.');
    } finally {
      setReviewLoading(false);
    }
  }, [isInternal]);

  useEffect(() => {
    if (!isInternal) return;
    if (section === 'review') loadReviews(reviewTab);
    if (section === 'screens') loadScreens();
  }, [isInternal, section, reviewTab, loadReviews, loadScreens]);

  const formatSlotWhen = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return iso;
    }
  };

  const refreshTalentLists = async () => {
    if (section === 'screens') await loadScreens();
    else await loadReviews(reviewTab);
  };

  const handleApprove = async (row) => {
    setReviewActingId(row.userId || row.id);
    setToast('');
    try {
      const result = await approveAmbassadorReview(row.userId || row.id);
      setToast(result.alreadyApproved ? 'Already approved.' : `Approved ${row.name || 'talent'}.`);
      await loadReviews(reviewTab);
    } catch (err) {
      setToast(err.message || 'Could not approve.');
    } finally {
      setReviewActingId('');
    }
  };

  const handleRequestChanges = async (row) => {
    if (!changesNotes.trim()) {
      setToast('Add a short note before requesting changes.');
      return;
    }
    setReviewActingId(row.userId || row.id);
    setToast('');
    try {
      await requestAmbassadorReviewChanges(row.userId || row.id, {
        issues: ['other'],
        notes: changesNotes.trim(),
      });
      setChangesForId('');
      setChangesNotes('');
      setToast('Change request sent.');
      await loadReviews(reviewTab);
    } catch (err) {
      setToast(err.message || 'Could not request changes.');
    } finally {
      setReviewActingId('');
    }
  };

  const handleNudgeSlots = async (row) => {
    setReviewActingId(row.userId || row.id);
    setToast('');
    try {
      const result = await nudgeAmbassadorTalentSlots(row.userId || row.id);
      const mode = result?.mode || (row.calConnected ? 'slots' : 'calendar');
      setToast(
        mode === 'calendar'
          ? `Asked ${row.name || 'talent'} to connect their calendar.`
          : `Asked ${row.name || 'talent'} to publish intro slots.`
      );
      await refreshTalentLists();
    } catch (err) {
      setToast(err.message || 'Could not send email.');
    } finally {
      setReviewActingId('');
    }
  };

  const openScreenSlots = async (row) => {
    setScreenTalent(row);
    setScreenSlots(Array.isArray(row.openSlots) ? row.openSlots : []);
    setScreenLoading(true);
    setToast('');
    try {
      const result = await fetchAmbassadorScreenSlots(row.userId || row.id);
      setScreenSlots(result.slots || []);
      if (result.upcomingScreen) {
        setToast('A screening is already booked with this talent.');
      }
    } catch (err) {
      setToast(err.message || 'Could not load slots.');
    } finally {
      setScreenLoading(false);
    }
  };

  const handleBookScreen = async (slotId) => {
    if (!screenTalent) return;
    setBookingSlotId(slotId);
    setToast('');
    try {
      const result = await bookAmbassadorScreen(screenTalent.userId || screenTalent.id, slotId);
      setToast(result.alreadyBooked ? 'Screening already booked.' : 'Screening booked — calendar invite sent.');
      setScreenTalent(null);
      setScreenSlots([]);
      await refreshTalentLists();
    } catch (err) {
      setToast(err.message || 'Could not book screening.');
    } finally {
      setBookingSlotId('');
    }
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
              {isInternal ? 'Internal ambassador' : 'Ambassador'}
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
              {isInternal
                ? 'Invite your network, review their profiles, and book screening calls on published slots. Rewards still apply.'
                : 'Invite people from your network — BYG handles the rest. This name appears on invite emails.'}
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

        {/* Snapshot strip — clickable into Candidates / Rewards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            {
              icon: Mail,
              label: 'Invited',
              value: data?.stats?.invited ?? 0,
              hint: 'View list',
              onClick: () => setSection('candidates', { filter: 'invited' }),
            },
            {
              icon: Clock,
              label: 'Waiting',
              value: data?.stats?.pending ?? 0,
              hint: 'Awaiting activation',
              onClick: () => setSection('candidates', { filter: 'waiting' }),
            },
            {
              icon: Users,
              label: 'Activated',
              value: data?.stats?.activated ?? 0,
              hint: 'Joined BYG',
              onClick: () => setSection('candidates', { filter: 'activated' }),
            },
            {
              icon: DollarSign,
              label: 'Total rewards',
              value: money(earnings?.totals?.lifetimeEarnedUsd),
              hint: 'Open rewards',
              onClick: () => setSection('rewards'),
            },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className="group text-left bg-white/80 border border-black/5 rounded-2xl px-4 py-3 hover:border-red/40 hover:bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red/40"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5 text-gray-400">
                  <item.icon size={12} className="text-red" />
                  <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
                </div>
                <ChevronRight
                  size={14}
                  className="text-gray-300 group-hover:text-red shrink-0 transition-colors"
                  aria-hidden
                />
              </div>
              <p className="text-xl font-black tabular-nums text-black group-hover:text-red transition-colors">
                {item.value}
              </p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mt-1 group-hover:text-gray-600">
                {item.hint}
              </p>
            </button>
          ))}
        </div>

        {/* Mobile section switcher (desktop uses navbar) */}
        <div className="md:hidden flex gap-1 p-1 mb-5 bg-white border border-black/5 rounded-2xl overflow-x-auto">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={`flex-1 min-w-[4.5rem] py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors ${
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
              subtitle="Tap a number above or use the filters to see who is waiting vs activated. Search by name or email. Approve / request changes stay under Review so this list stays clear."
            >
              <div className="relative mb-3 max-w-md">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={candidateQuery}
                  onChange={(e) => setCandidateQuery(e.target.value)}
                  placeholder="Search by name or email…"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold outline-none focus:border-red placeholder:text-gray-400 placeholder:font-medium"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {CANDIDATE_FILTERS.map((f) => {
                  const count =
                    f.id === 'all'
                      ? (data?.invites || []).length
                      : (data?.invites || []).filter((inv) => inviteMatchesFilter(inv, f.id)).length;
                  const active = candidateFilter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setCandidateFilter(f.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-colors ${
                        active
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-gray-600 border-black/10 hover:border-red hover:text-red'
                      }`}
                    >
                      {f.label}
                      <span className={`tabular-nums ${active ? 'text-white/70' : 'text-gray-400'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

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
              ) : !filteredInvites.length ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center">
                  <p className="text-xs font-medium text-gray-500">
                    {candidateQuery.trim()
                      ? `No candidates match “${candidateQuery.trim()}”.`
                      : filterEmptyCopy(candidateFilter)}
                  </p>
                  {candidateQuery.trim() ? (
                    <button
                      type="button"
                      onClick={() => setCandidateQuery('')}
                      className="mt-3 text-[10px] font-black uppercase tracking-widest text-red"
                    >
                      Clear search
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCandidateFilter('all')}
                      className="mt-3 text-[10px] font-black uppercase tracking-widest text-red"
                    >
                      Show all candidates
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2 max-h-[36rem] overflow-y-auto pr-1">
                  {filteredInvites.map((inv) => {
                    const profile = inv.profile;
                    const modalTalent = mapInviteProfileToModalTalent(profile);
                    return (
                    <div
                      key={inv.id}
                      className="flex items-start justify-between gap-3 p-3.5 rounded-2xl border border-gray-100 bg-[#fafafa]"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {profile ? (
                          <TalentPhoto name={profile.name || inv.name} photoUrl={profile.photoUrl} size={56} />
                        ) : null}
                        <div className="min-w-0 flex-1">
                        <p className="font-black text-sm text-black truncate">
                          {profile?.name || inv.name || inv.email || inv.originalFilename || 'Candidate'}
                        </p>
                        {profile?.jobTitle ? (
                          <p className="text-[11px] text-red font-bold uppercase tracking-wide truncate">
                            {profile.jobTitle}
                          </p>
                        ) : null}
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
                            {inv.email || profile?.email ? (
                              <span className="text-emerald-700">{inv.email || profile.email}</span>
                            ) : (
                              <span className="text-amber-700">No email extracted</span>
                            )}
                          </p>
                        )}
                        {profile ? (
                          <p className="text-[11px] text-gray-500 font-medium mt-0.5 truncate">
                            {directoryStatusLabel(profile.directoryStatus)}
                            {profile.experienceYears != null ? ` · ${profile.experienceYears} yrs` : ''}
                            {profile.monthlyFeeUsd != null ? ` · $${profile.monthlyFeeUsd}/mo` : ''}
                            {profile.calConnected ? ' · Calendar connected' : ''}
                          </p>
                        ) : null}
                        {profile?.about ? (
                          <p className="text-[12px] text-gray-600 font-medium mt-1.5 leading-relaxed line-clamp-2">
                            {profile.about}
                          </p>
                        ) : null}
                        {(profile?.skills || []).length ? (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {profile.skills.slice(0, 6).map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 rounded-lg bg-red/5 border border-red/10 text-red text-[9px] font-black uppercase"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {inv.originalFilename ? (
                          <p className="text-[10px] text-gray-400 font-medium truncate mt-0.5">
                            PDF: {inv.originalFilename}
                          </p>
                        ) : null}
                        </div>
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
                        {modalTalent ? (
                          <button
                            type="button"
                            onClick={() => setProfileModalTalent(modalTalent)}
                            className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-black hover:text-red"
                          >
                            <ExternalLink size={10} /> View profile
                          </button>
                        ) : null}
                        {isInternal && profile?.directoryStatus === 'pending_review' ? (
                          <button
                            type="button"
                            onClick={() => setSection('review')}
                            className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-amber-800 hover:text-black"
                          >
                            Needs review →
                          </button>
                        ) : null}
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
                    );
                  })}
                </div>
              )}
            </SectionShell>
          )}

          {section === 'review' && isInternal && (
            <SectionShell
              title="Review your talent"
              subtitle="Approve profiles and book screens here — candidate slot times show on each card. Ask to connect calendar when Cal is missing; ask to publish when calendar is connected but no open times."
            >
              <div className="relative mb-3 max-w-md">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={talentQuery}
                  onChange={(e) => setTalentQuery(e.target.value)}
                  placeholder="Search by name or email…"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold outline-none focus:border-red placeholder:text-gray-400 placeholder:font-medium"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {[
                  { id: 'pending_review', label: 'Pending' },
                  { id: 'changes_requested', label: 'Changes sent' },
                  { id: 'approved', label: 'Approved' },
                  { id: 'draft', label: 'Draft' },
                  { id: 'all', label: 'All' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setReviewTab(tab.id)}
                    className={`px-3 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-wider ${
                      reviewTab === tab.id
                        ? 'bg-black text-white border-black'
                        : 'border-gray-200 text-gray-500'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {reviewLoading ? (
                <Loader2 className="animate-spin text-gray-300" size={22} />
              ) : !filteredReviewRows.length ? (
                <p className="text-sm text-gray-400 font-medium">
                  {talentQuery.trim()
                    ? `No talent match “${talentQuery.trim()}”.`
                    : 'No talent in this tab yet. They appear after they activate and submit a profile.'}
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredReviewRows.map((row) => (
                    <div key={row.userId || row.id} className="rounded-2xl border border-gray-100 bg-[#fafafa] p-4">
                      <div className="flex items-start gap-3">
                        <TalentPhoto name={row.name} photoUrl={row.photoUrl} size={64} />
                        <div className="min-w-0 flex-1">
                          <p className="font-black text-sm text-black truncate">{row.name || 'Talent'}</p>
                          <p className="text-[11px] text-red font-bold uppercase tracking-wide truncate">
                            {row.jobTitle || 'Role not set'}
                          </p>
                          <p className="text-[11px] text-gray-500 font-medium truncate mt-0.5">
                            {row.email}
                            {row.experienceYears != null && row.experienceYears !== ''
                              ? ` · ${row.experienceYears} yrs`
                              : ''}
                            {row.monthlyFeeUsd != null ? ` · $${row.monthlyFeeUsd}/mo` : ''}
                          </p>
                          {row.availability ? (
                            <p className="text-[11px] text-gray-400 font-medium mt-0.5">{row.availability}</p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-wider bg-white text-gray-600">
                              {directoryStatusLabel(row.directoryStatus)}
                            </span>
                            {row.upcomingScreen ? (
                              <span className="px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border-emerald-200">
                                Screen booked
                              </span>
                            ) : row.openSlotCount > 0 ? (
                              <span className="px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border-emerald-200">
                                {row.openSlotCount} open slot{row.openSlotCount === 1 ? '' : 's'}
                              </span>
                            ) : row.slotsPublished ? (
                              <span className="px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-wider bg-blue-50 text-blue-800 border-blue-200">
                                Slots were published
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border-amber-200">
                                {row.calConnected ? 'No slots published' : 'Calendar not connected'}
                              </span>
                            )}
                          </div>
                          <PendingApproveNudge status={row.directoryStatus} className="mt-2" />
                          {row.upcomingScreen?.start ? (
                            <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                              Screen · {formatSlotWhen(row.upcomingScreen.start)}
                            </p>
                          ) : null}
                          {(row.openSlots || []).length > 0 ? (
                            <div className="mt-2 space-y-1">
                              <p className="text-[9px] font-black uppercase tracking-wider text-gray-400">
                                Candidate times
                              </p>
                              <ul className="space-y-1">
                                {(row.openSlots || []).slice(0, 5).map((slot) => (
                                  <li
                                    key={slot.id || slot.start}
                                    className="text-[11px] font-semibold text-black tabular-nums"
                                  >
                                    {formatSlotWhen(slot.start)}
                                    {slot.status && slot.status !== 'open' ? (
                                      <span className="ml-1.5 text-[9px] font-black uppercase tracking-wider text-gray-400">
                                        {slot.status}
                                      </span>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                              {(row.openSlots || []).length > 5 ? (
                                <p className="text-[10px] text-gray-400 font-medium">
                                  +{(row.openSlots || []).length - 5} more
                                </p>
                              ) : null}
                            </div>
                          ) : (row.recentPastSlots || []).length > 0 ? (
                            <div className="mt-2 space-y-1">
                              <p className="text-[9px] font-black uppercase tracking-wider text-amber-700/80">
                                Last published (no longer bookable)
                              </p>
                              <ul className="space-y-1">
                                {(row.recentPastSlots || []).slice(0, 4).map((slot) => (
                                  <li
                                    key={slot.id || slot.start}
                                    className="text-[11px] font-semibold text-gray-600 tabular-nums"
                                  >
                                    {formatSlotWhen(slot.start)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : row.nextSlotStart && !row.upcomingScreen ? (
                            <p className="text-[11px] text-emerald-700 font-medium mt-1">
                              Next open: {formatSlotWhen(row.nextSlotStart)}
                            </p>
                          ) : null}
                          {row.about ? (
                            <p className="text-[12px] text-gray-600 font-medium mt-2 leading-relaxed line-clamp-3">
                              {row.about}
                            </p>
                          ) : null}
                          {(row.skills || []).length ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {row.skills.slice(0, 8).map((tag) => (
                                <span
                                  key={tag}
                                  className="px-2 py-0.5 rounded-lg bg-red/5 border border-red/10 text-red text-[9px] font-black uppercase"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          {row.cvUrl ? (
                            <a
                              href={row.cvUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-2 text-[10px] font-black uppercase tracking-wider text-gray-600 hover:text-red"
                            >
                              <FileText size={11} /> View CV
                            </a>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setProfileModalTalent(mapReviewRowToModalTalent(row))}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-200 text-[9px] font-black uppercase tracking-wider text-gray-700"
                        >
                          <ExternalLink size={11} /> View profile
                        </button>
                        {row.directoryStatus === 'pending_review' ? (
                          <button
                            type="button"
                            disabled={Boolean(reviewActingId)}
                            onClick={() => handleApprove(row)}
                            className="px-3 py-2 rounded-xl bg-black text-white text-[9px] font-black uppercase tracking-wider disabled:opacity-40"
                          >
                            {reviewActingId === (row.userId || row.id) ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : (
                              'Approve'
                            )}
                          </button>
                        ) : null}
                        {['pending_review', 'approved'].includes(row.directoryStatus) ? (
                          <button
                            type="button"
                            onClick={() => {
                              setChangesForId(row.userId || row.id);
                              setChangesNotes('');
                            }}
                            className="px-3 py-2 rounded-xl border border-gray-200 text-[9px] font-black uppercase tracking-wider text-gray-600"
                          >
                            Request changes
                          </button>
                        ) : null}
                        {row.canNudgeSlots ? (
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              disabled={Boolean(reviewActingId)}
                              onClick={() => handleNudgeSlots(row)}
                              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-amber-200 text-[9px] font-black uppercase tracking-wider text-amber-800"
                            >
                              <Mail size={11} />{' '}
                              {row.calConnected ? 'Ask to publish slots' : 'Ask to connect calendar'}
                            </button>
                            {!row.calConnected ? (
                              <p className="text-[9px] text-gray-400 font-medium max-w-[11rem]">
                                Publish slots unlocks after they connect Cal.
                              </p>
                            ) : null}
                          </div>
                        ) : row.canBookScreen ? (
                          <button
                            type="button"
                            onClick={() => openScreenSlots(row)}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-200 text-[9px] font-black uppercase tracking-wider text-gray-700"
                          >
                            <Calendar size={11} /> Book screen
                          </button>
                        ) : null}
                      </div>
                      {screenTalent && (screenTalent.userId || screenTalent.id) === (row.userId || row.id) ? (
                        <div className="mt-3 border-t border-gray-100 pt-3">
                          <p className="text-[9px] font-black uppercase tracking-wider text-gray-400 mb-2">
                            Pick a screening time
                          </p>
                          {screenLoading ? (
                            <Loader2 className="animate-spin text-gray-300" size={18} />
                          ) : !screenSlots.length ? (
                            <p className="text-xs text-gray-400">No open slots right now.</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {screenSlots.map((slot) => (
                                <li
                                  key={slot.id}
                                  className="flex items-center justify-between gap-2 rounded-xl bg-white border border-gray-100 px-3 py-2"
                                >
                                  <span className="text-xs font-semibold text-black">{formatSlotWhen(slot.start)}</span>
                                  <button
                                    type="button"
                                    disabled={Boolean(bookingSlotId)}
                                    onClick={() => handleBookScreen(slot.id)}
                                    className="px-2.5 py-1.5 rounded-lg bg-black text-white text-[9px] font-black uppercase tracking-wider disabled:opacity-40"
                                  >
                                    {bookingSlotId === slot.id ? (
                                      <Loader2 size={10} className="animate-spin" />
                                    ) : (
                                      'Book'
                                    )}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                          <button
                            type="button"
                            onClick={() => { setScreenTalent(null); setScreenSlots([]); }}
                            className="mt-2 text-[9px] font-black uppercase tracking-wider text-gray-400"
                          >
                            Close
                          </button>
                        </div>
                      ) : null}
                      {changesForId === (row.userId || row.id) ? (
                        <div className="mt-3 space-y-2">
                          <textarea
                            value={changesNotes}
                            onChange={(e) => setChangesNotes(e.target.value)}
                            placeholder="What should they fix?"
                            rows={2}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium outline-none focus:border-red resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={Boolean(reviewActingId) || !changesNotes.trim()}
                              onClick={() => handleRequestChanges(row)}
                              className="px-3 py-2 rounded-xl bg-black text-white text-[9px] font-black uppercase tracking-wider disabled:opacity-40"
                            >
                              Send request
                            </button>
                            <button
                              type="button"
                              onClick={() => setChangesForId('')}
                              className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider text-gray-400"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </SectionShell>
          )}

          {section === 'screens' && isInternal && (
            <SectionShell
              title="Screening calls"
              subtitle={`${filteredReviewRows.length} shown · ${reviewRows.length} invited talent with profiles. Search by name. Past times appear when nothing is still open.`}
            >
              <div className="relative mb-4 max-w-md">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={talentQuery}
                  onChange={(e) => setTalentQuery(e.target.value)}
                  placeholder="Search by name or email…"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold outline-none focus:border-red placeholder:text-gray-400 placeholder:font-medium"
                />
              </div>
              {reviewLoading ? (
                <Loader2 className="animate-spin text-gray-300" size={22} />
              ) : !filteredReviewRows.length ? (
                <p className="text-sm text-gray-400 font-medium">
                  {talentQuery.trim()
                    ? `No talent match “${talentQuery.trim()}”.`
                    : 'No invited talent with profiles yet.'}
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredReviewRows.map((row) => (
                    <div key={row.userId || row.id} className="rounded-2xl border border-gray-100 bg-[#fafafa] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <TalentPhoto name={row.name} photoUrl={row.photoUrl} size={48} />
                          <div className="min-w-0">
                          <p className="font-black text-sm text-black truncate">{row.name || 'Talent'}</p>
                          <p className="text-[11px] text-gray-500 font-medium truncate">{row.email}</p>
                          <PendingApproveNudge status={row.directoryStatus} className="mt-1.5" />
                          {row.upcomingScreen?.start ? (
                            <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                              Screen booked · {formatSlotWhen(row.upcomingScreen.start)}
                            </p>
                          ) : (row.openSlots || []).length > 0 ? (
                            <div className="mt-1.5 space-y-1">
                              <p className="text-[9px] font-black uppercase tracking-wider text-gray-400">
                                {row.openSlotCount} open slot{row.openSlotCount === 1 ? '' : 's'}
                              </p>
                              {(row.openSlots || []).slice(0, 4).map((slot) => (
                                <p key={slot.id || slot.start} className="text-[11px] font-semibold text-black">
                                  {formatSlotWhen(slot.start)}
                                </p>
                              ))}
                              {(row.openSlots || []).length > 4 ? (
                                <p className="text-[10px] text-gray-400">+{(row.openSlots || []).length - 4} more</p>
                              ) : null}
                            </div>
                          ) : (row.recentPastSlots || []).length > 0 ? (
                            <div className="mt-1.5 space-y-1">
                              <p className="text-[9px] font-black uppercase tracking-wider text-amber-700/80">
                                Last published (expired)
                              </p>
                              {(row.recentPastSlots || []).slice(0, 3).map((slot) => (
                                <p key={slot.id || slot.start} className="text-[11px] font-semibold text-gray-600">
                                  {formatSlotWhen(slot.start)}
                                </p>
                              ))}
                            </div>
                          ) : row.slotsPublished ? (
                            <p className="text-[11px] text-blue-700 font-medium mt-1">
                              Slots were published — none open right now
                            </p>
                          ) : (
                            <p className="text-[11px] text-amber-700 font-medium mt-1">
                              {row.calConnected ? 'No slots published yet' : 'Calendar not connected'}
                            </p>
                          )}
                          </div>
                        </div>
                        <div className="shrink-0 flex flex-col gap-2 items-end">
                        <button
                          type="button"
                          onClick={() => setProfileModalTalent(mapReviewRowToModalTalent(row))}
                          className="px-3 py-2 rounded-xl border border-gray-200 text-[9px] font-black uppercase tracking-wider text-gray-700"
                        >
                          Profile
                        </button>
                        {row.canBookScreen ? (
                          <button
                            type="button"
                            onClick={() => openScreenSlots(row)}
                            className="shrink-0 px-3 py-2 rounded-xl bg-black text-white text-[9px] font-black uppercase tracking-wider"
                          >
                            Pick slot
                          </button>
                        ) : row.canNudgeSlots ? (
                          <button
                            type="button"
                            disabled={Boolean(reviewActingId)}
                            onClick={() => handleNudgeSlots(row)}
                            className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-amber-200 text-[9px] font-black uppercase tracking-wider text-amber-800"
                          >
                            <Mail size={11} />{' '}
                            {row.calConnected ? 'Ask to publish' : 'Ask to connect calendar'}
                          </button>
                        ) : null}
                      </div>
                      </div>
                      {screenTalent && (screenTalent.userId || screenTalent.id) === (row.userId || row.id) ? (
                        <div className="mt-3 border-t border-gray-100 pt-3">
                          {screenLoading ? (
                            <Loader2 className="animate-spin text-gray-300" size={18} />
                          ) : !screenSlots.length ? (
                            <p className="text-xs text-gray-400">No open slots right now.</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {screenSlots.map((slot) => (
                                <li
                                  key={slot.id}
                                  className="flex items-center justify-between gap-2 rounded-xl bg-white border border-gray-100 px-3 py-2"
                                >
                                  <span className="text-xs font-semibold text-black">{formatSlotWhen(slot.start)}</span>
                                  <button
                                    type="button"
                                    disabled={Boolean(bookingSlotId)}
                                    onClick={() => handleBookScreen(slot.id)}
                                    className="px-2.5 py-1.5 rounded-lg bg-black text-white text-[9px] font-black uppercase tracking-wider disabled:opacity-40"
                                  >
                                    {bookingSlotId === slot.id ? (
                                      <Loader2 size={10} className="animate-spin" />
                                    ) : (
                                      'Book'
                                    )}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                          <button
                            type="button"
                            onClick={() => { setScreenTalent(null); setScreenSlots([]); }}
                            className="mt-2 text-[9px] font-black uppercase tracking-wider text-gray-400"
                          >
                            Close
                          </button>
                        </div>
                      ) : null}
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

          {section === 'help' && (
            <SectionShell
              title="Help"
              subtitle="Short guide to the ambassador hub — what each area is for, and what the status numbers mean."
            >
              <div className="space-y-4">
                {[
                  {
                    title: 'Invite',
                    body: 'Send an email invite or upload a CV. That creates a candidate in your pipeline. Screening and client intros stay with BYG.',
                  },
                  {
                    title: 'The numbers (Invited / Waiting / Activated)',
                    body: 'Click any number to open Candidates with that filter. Invited = everyone in your pipeline. Waiting = not activated yet. Activated = they joined. Total rewards opens Rewards.',
                  },
                  {
                    title: 'Candidates',
                    body: 'Your full invite list with search. Open a profile when they have one. Approve and request-changes live under Review (keeps this list uncluttered). Pending profiles show a “Needs review” shortcut.',
                  },
                  ...(isInternal
                    ? [
                        {
                          title: 'Review',
                          body: 'Approve waitlist profiles or request changes. See published slot times, book a screen inline, or email them to connect calendar / publish slots.',
                        },
                        {
                          title: 'Screens',
                          body: 'Focus list for booking BYG screening calls on times the talent published. If calendar is not connected, use Ask to connect calendar instead of Ask to publish.',
                        },
                      ]
                    : []),
                  {
                    title: 'Rewards & Share',
                    body: 'Rewards appear when BYG marks a hire. Share has your badge, signup link, and LinkedIn about copy.',
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-gray-100 bg-[#fafafa] px-4 py-4"
                  >
                    <p className="text-[10px] font-black uppercase tracking-widest text-red mb-1.5 flex items-center gap-1.5">
                      <HelpCircle size={11} /> {item.title}
                    </p>
                    <p className="text-sm text-gray-600 font-medium leading-relaxed">{item.body}</p>
                  </div>
                ))}
              </div>
            </SectionShell>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {profileModalTalent ? (
            <DirectoryTalentModal
              talent={profileModalTalent}
              onClose={() => setProfileModalTalent(null)}
              canRequestIntro={false}
            />
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
