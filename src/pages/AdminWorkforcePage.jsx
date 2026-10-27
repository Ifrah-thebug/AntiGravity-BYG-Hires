import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  Banknote,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  FileDown,
  FileSignature,
  Inbox,
  Landmark,
  Pause,
  Play,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import AdminPageShell from '../components/AdminPageShell';
import SignatureCapture, { signatureReady } from '../components/SignatureCapture';
import { PIPELINE_STAGES } from '../components/workforce/ClientJobsPanel';
import ContractRow from '../components/workforce/ContractViewer';
import TalentHrDetailsCard from '../components/workforce/TalentHrDetailsCard';
import {
  BusyLabel,
  Card,
  DocumentPreview,
  EmptyState,
  Field,
  Money,
  Notice,
  PageHeader,
  SectionTitle,
  SignatureSteps,
  Spinner,
  StatTile,
  StatusBadge,
  Tabs,
  btn,
  formatDate,
  inputClass,
  useAsyncRunner,
} from '../components/workforce/WorkforceUi';
import {
  adminChangeContractStartDate,
  adminShortlist,
  adminSignWorkforceContract,
  adminUpdateCandidate,
  adminUpdateJob,
  createWorkforceEngagement,
  creditClientWallet,
  fetchAdminInvoiceDocument,
  fetchAdminJobs,
  fetchAdminPayouts,
  fetchWorkforceClientOptions,
  fetchWorkforceSnapshot,
  fetchWorkforceTalentOptions,
  markInvoicePaid,
  releasePayout,
  reviewWorkforceContract,
  runBilling,
  setEngagementStatus,
  verifyPaymentAccount,
  voidInvoice,
  workforceStatus,
} from '../lib/workforceApi';
import { openContractPdf, openInvoicePdf } from '../lib/openInvoicePdf';

const CURRENCIES = ['USD', 'AED', 'SAR', 'KWD', 'BHD', 'QAR', 'OMR', 'EGP', 'EUR', 'GBP'];
const ADMIN_STAGES = ['shortlisted', 'intro', 'interview', 'offer', 'rejected', 'withdrawn'];

const emptyHire = {
  talentEmail: '',
  talentName: '',
  talentUserId: '',
  talentProfileId: '',
  clientId: '',
  clientName: '',
  clientEmail: '',
  jobId: '',
  roleTitle: '',
  salaryAmount: '',
  currency: 'USD',
  cadence: 'monthly',
  bygFeePercent: '',
  startDate: new Date().toISOString().slice(0, 10),
};

/** Inline "type a reference, then confirm" control used for payments and payouts. */
function ReferenceAction({ label, placeholder, busy, onSubmit, dark = false }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={dark ? btn.smallDark : btn.small}>
        {label}
      </button>
    );
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value.trim());
      }}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-44 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-red"
      />
      <button type="submit" disabled={!value.trim() || busy} className={btn.smallDark}>
        <BusyLabel busy={busy} busyText="Saving…">
          Confirm
        </BusyLabel>
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-black">
        Cancel
      </button>
    </form>
  );
}

function CountersignCard({ row, busy, onSign, onReview }) {
  const [signatureData, setSignatureData] = useState('');
  const [consent, setConsent] = useState(false);
  const [showDoc, setShowDoc] = useState(false);
  const { e, c, needsByg, needsReview } = row;
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-black">
            {e.talentName || e.talentEmail} → {e.clientName}
          </p>
          <p className="mt-1 text-[11px] font-medium text-gray-500">
            {e.roleTitle} · <Money value={e.salary?.amount} currency={e.salary?.currency} /> / {e.salary?.cadence} · fee {e.salary?.bygFeePercent}%
          </p>
        </div>
        <SignatureSteps signatures={c?.signatures} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setShowDoc((v) => !v)} className={btn.small}>
          {showDoc ? <EyeOff size={12} /> : <Eye size={12} />} {showDoc ? 'Hide contract' : 'Read contract'}
        </button>
        <button
          type="button"
          disabled={!c?.renderedHtml}
          onClick={() => openContractPdf(c.renderedHtml, `${e.roleTitle} — BYG Hires contract`)}
          className={btn.small}
        >
          <FileDown size={12} /> Download PDF
        </button>
      </div>
      {showDoc ? (
        <div className="mt-3">
          <DocumentPreview html={c?.renderedHtml} maxHeight="max-h-[28rem]" />
        </div>
      ) : null}
      {needsReview ? (
        <div className="mt-4 rounded-xl border border-red/20 bg-red/5 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-red">Contract review: {c.aiReviewStatus || 'not run'}</p>
          <ul className="mt-2 list-disc pl-5 text-xs font-medium text-gray-700">
            {(c.aiFindings || []).slice(0, 6).map((f, i) => (
              <li key={i}>{f.message}</li>
            ))}
          </ul>
          <button type="button" disabled={busy} onClick={onReview} className={`${btn.smallDark} mt-3`}>
            <RefreshCw size={12} /> Re-run review
          </button>
        </div>
      ) : null}
      {needsByg ? (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-gray-500">Countersign for BYG Hires</p>
          <SignatureCapture value={signatureData} onChange={setSignatureData} placeholder="Your full name" />
          <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-gray-700">
            <input type="checkbox" className="accent-[#ff3d3d]" checked={consent} onChange={(ev) => setConsent(ev.target.checked)} />I am authorised to sign for BYG
            Hires
          </label>
          <button
            type="button"
            disabled={busy || !signatureReady(signatureData) || !consent}
            onClick={() => onSign({ signatureData, consent: true })}
            className={`${btn.accent} mt-4`}
          >
            <BusyLabel busy={busy} busyText="Signing…">
              <FileSignature size={14} /> Countersign
            </BusyLabel>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AdminHireForm({ talent, clients, jobs, defaultFee, onCreated, onError }) {
  const [form, setForm] = useState({ ...emptyHire, bygFeePercent: String(defaultFee) });
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (s ? talent.filter((t) => t.email.includes(s) || t.name?.toLowerCase().includes(s) || t.jobTitle?.toLowerCase().includes(s)) : talent).slice(0, 30);
  }, [talent, q]);
  const clientJobs = jobs.filter((j) => j.clientEmail === form.clientEmail && ['open', 'on_hold'].includes(j.status));
  const salary = Number(form.salaryAmount) || 0;
  const fee = Number(form.bygFeePercent) || 0;
  const total = Math.round((salary + (salary * fee) / 100) * 100) / 100;
  const ready = form.talentEmail && form.clientEmail && salary > 0 && form.roleTitle.trim();

  const submit = async () => {
    setBusy(true);
    onError('');
    try {
      const res = await createWorkforceEngagement({
        ...form,
        jobId: form.jobId || undefined,
        salaryAmount: salary,
        bygFeePercent: fee,
      });
      onCreated(res);
      setForm({ ...emptyHire, bygFeePercent: String(defaultFee) });
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <Card>
        <SectionTitle icon={UserPlus} title="Start a hire" hint="Creates the engagement and contract, and emails the client and talent to sign." />
        <Field label="Talent">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-4 top-1/2 mt-[3px] -translate-y-1/2 text-gray-400" />
            <input className={`${inputClass} pl-10`} placeholder="Search name, email or role…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </Field>
        <div className="mt-3 max-h-48 divide-y divide-gray-100 overflow-y-auto rounded-2xl border border-gray-200">
          {filtered.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  talentEmail: t.email,
                  talentName: t.name || '',
                  talentUserId: t.userId || '',
                  talentProfileId: t.id,
                  roleTitle: f.roleTitle || t.jobTitle || '',
                  salaryAmount: f.salaryAmount || (t.suggestedSalary ? String(t.suggestedSalary) : ''),
                }))
              }
              className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm ${form.talentEmail === t.email ? 'bg-red/5' : 'hover:bg-gray-50'}`}
            >
              <span>
                <span className="block font-black text-black">{t.name || t.email}</span>
                <span className="block text-[11px] font-medium text-gray-500">
                  {t.email}
                  {t.jobTitle ? ` · ${t.jobTitle}` : ''}
                </span>
              </span>
              {form.talentEmail === t.email ? <CheckCircle2 size={15} className="text-red" /> : null}
            </button>
          ))}
        </div>

        {form.talentProfileId || form.talentEmail ? (
          <TalentHrDetailsCard
            variant="admin"
            talentId={form.talentProfileId || null}
            talentEmail={form.talentEmail || null}
            talentName={form.talentName}
            className="mt-4"
          />
        ) : null}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Client" className="sm:col-span-2">
            <select
              className={inputClass}
              value={form.clientEmail}
              onChange={(e) => {
                const c = clients.find((x) => x.email === e.target.value);
                setForm((f) => ({ ...f, clientEmail: c?.email || '', clientName: c?.name || '', clientId: c?.id || '', jobId: '' }));
              }}
            >
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id || c.email} value={c.email}>
                  {c.name} ({c.email})
                </option>
              ))}
            </select>
          </Field>
          {clientJobs.length ? (
            <Field label="For job (optional)" className="sm:col-span-2">
              <select className={inputClass} value={form.jobId} onChange={set('jobId')}>
                <option value="">Not linked</option>
                {clientJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label="Role title" className="sm:col-span-2">
            <input className={inputClass} value={form.roleTitle} onChange={set('roleTitle')} />
          </Field>
          <Field label="Contractor pay">
            <input className={inputClass} inputMode="decimal" value={form.salaryAmount} onChange={set('salaryAmount')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Currency">
              <select className={inputClass} value={form.currency} onChange={set('currency')}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Per">
              <select className={inputClass} value={form.cadence} onChange={set('cadence')}>
                <option value="monthly">Month</option>
                <option value="biweekly">2 weeks</option>
                <option value="weekly">Week</option>
              </select>
            </Field>
          </div>
          <Field label="BYG fee %">
            <input className={inputClass} inputMode="decimal" value={form.bygFeePercent} onChange={set('bygFeePercent')} />
          </Field>
          <Field label="Start date">
            <input type="date" className={inputClass} value={form.startDate} onChange={set('startDate')} />
          </Field>
        </div>
      </Card>
      <aside className="h-fit rounded-[2rem] border border-gray-200 bg-white p-6 shadow-xl">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Client pays per period</p>
        <p className="mt-2 text-3xl font-black text-black">
          <Money value={total} currency={form.currency} />
        </p>
        <p className="mt-4 text-sm font-medium text-gray-500">
          {form.talentName || 'Talent'} → {form.clientName || 'client'}
        </p>
        <button type="button" disabled={!ready || busy} onClick={submit} className={`${btn.accent} mt-6 w-full`}>
          <BusyLabel busy={busy} busyText="Creating…">
            <UserPlus size={14} /> Create engagement
          </BusyLabel>
        </button>
      </aside>
    </div>
  );
}

function AdminJobCard({ job, talent, busy, run }) {
  const [picks, setPicks] = useState([]);
  const [q, setQ] = useState('');
  const inPipeline = new Set(job.candidates.map((c) => c.talentEmail));
  const options = talent
    .filter((t) => !inPipeline.has(t.email))
    .filter((t) => {
      const s = q.trim().toLowerCase();
      return !s || t.name?.toLowerCase().includes(s) || t.jobTitle?.toLowerCase().includes(s) || t.email.includes(s);
    })
    .slice(0, 12);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-black text-black">{job.title}</p>
            <StatusBadge status={job.status} />
          </div>
          <p className="mt-1 text-[11px] font-medium text-gray-500">
            {job.clientName || job.clientEmail} · {job.headcount} opening{job.headcount > 1 ? 's' : ''} · {job.location}
            {job.budgetMax ? (
              <>
                {' '}
                · up to <Money value={job.budgetMax} currency={job.currency} />
              </>
            ) : null}{' '}
            · posted {formatDate(job.createdAt)}
          </p>
          {job.skills?.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {job.skills.map((s) => (
                <span key={s} className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold text-gray-600">
                  {s}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <select
          aria-label="Job status"
          value={job.status}
          disabled={!!busy}
          onChange={(e) => run(`job-${job.id}`, () => adminUpdateJob(job.id, { status: e.target.value }))}
          className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-[10px] font-black uppercase tracking-widest outline-none focus:border-red"
        >
          {['open', 'on_hold', 'filled', 'closed'].map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>
      {job.description ? <p className="mt-4 whitespace-pre-line text-sm font-medium text-gray-600">{job.description}</p> : null}

      {job.candidates.length ? (
        <div className="mt-5 divide-y divide-gray-100 rounded-2xl border border-gray-200">
          {job.candidates.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-black text-black">{c.talentName || c.talentEmail}</p>
                <p className="text-[11px] font-medium text-gray-500">
                  {c.talentEmail} · {c.source === 'byg' ? 'BYG shortlist' : 'Client added'}
                </p>
              </div>
              {c.stage === 'hired' ? (
                <StatusBadge status="hired" />
              ) : (
                <select
                  aria-label="Stage"
                  value={c.stage}
                  disabled={!!busy}
                  onChange={(e) => run(`cand-${c.id}`, () => adminUpdateCandidate(job.id, c.id, { stage: e.target.value }))}
                  className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-[10px] font-black uppercase tracking-widest outline-none focus:border-red"
                >
                  {[...PIPELINE_STAGES, { id: 'withdrawn', label: 'Withdrawn' }]
                    .filter((s) => ADMIN_STAGES.includes(s.id) || s.id === c.stage)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                </select>
              )}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-5 rounded-2xl border border-dashed border-gray-200 p-4">
        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-500">Shortlist talent</p>
        <input className={inputClass} placeholder="Search directory…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="mt-3 flex flex-wrap gap-2">
          {options.map((t) => {
            const on = picks.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setPicks((p) => (on ? p.filter((x) => x !== t.id) : [...p, t.id]))}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors ${
                  on ? 'border-black bg-black text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-black'
                }`}
              >
                {t.name || t.email}
                {t.jobTitle ? <span className={on ? 'text-white/60' : 'text-gray-400'}> · {t.jobTitle}</span> : null}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          disabled={!picks.length || !!busy}
          onClick={() =>
            run(
              `short-${job.id}`,
              async () => {
                const res = await adminShortlist(job.id, picks);
                setPicks([]);
                return res;
              },
              (res) => `Shortlisted ${res.added.length} — client notified.`
            )
          }
          className={`${btn.primary} mt-4`}
        >
          <BusyLabel busy={busy === `short-${job.id}`} busyText="Adding…">
            <Plus size={14} /> Add {picks.length || ''} to pipeline
          </BusyLabel>
        </button>
      </div>
    </Card>
  );
}

function WalletCreditForm({ clients, busy, run }) {
  const [form, setForm] = useState({ clientEmail: '', amount: '', currency: 'USD', reference: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Card>
      <SectionTitle icon={Landmark} title="Record a bank transfer" hint="Credits the client's BYG wallet. Auto-pay then settles their invoices." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client" className="sm:col-span-2">
          <select className={inputClass} value={form.clientEmail} onChange={set('clientEmail')}>
            <option value="">Select client…</option>
            {clients.map((c) => (
              <option key={c.email} value={c.email}>
                {c.name} ({c.email})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Amount received">
          <input className={inputClass} inputMode="decimal" value={form.amount} onChange={set('amount')} />
        </Field>
        <Field label="Currency">
          <select className={inputClass} value={form.currency} onChange={set('currency')}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Bank reference" className="sm:col-span-2">
          <input className={inputClass} value={form.reference} onChange={set('reference')} placeholder="e.g. FT2610…" />
        </Field>
      </div>
      <button
        type="button"
        disabled={!form.clientEmail || !(Number(form.amount) > 0) || !form.reference.trim() || !!busy}
        onClick={() =>
          run(
            'credit',
            async () => {
              const res = await creditClientWallet({ ...form, amount: Number(form.amount) });
              setForm({ clientEmail: '', amount: '', currency: form.currency, reference: '' });
              return res;
            },
            (res) => `Wallet credited — new balance ${res.wallet.balance} ${res.wallet.currency}.`
          )
        }
        className={`${btn.accent} mt-6`}
      >
        <BusyLabel busy={busy === 'credit'} busyText="Crediting…">
          <Wallet size={14} /> Credit wallet
        </BusyLabel>
      </button>
    </Card>
  );
}

const AdminWorkforcePage = () => {
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get('tab') || 'action');
  const [status, setStatus] = useState(null);
  const [snap, setSnap] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [talent, setTalent] = useState([]);
  const [clients, setClients] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openContract, setOpenContract] = useState(null);

  const reload = useCallback(async () => {
    try {
      const info = await workforceStatus();
      setStatus(info);
      if (info.schemaReady === false) {
        setError(info.note || 'Run the Workforce SQL migrations first.');
        return;
      }
      const [snapshot, j, p, t, c] = await Promise.all([
        fetchWorkforceSnapshot(),
        fetchAdminJobs().catch(() => ({ jobs: [] })),
        fetchAdminPayouts(),
        fetchWorkforceTalentOptions().catch(() => ({ talent: [] })),
        fetchWorkforceClientOptions().catch(() => ({ clients: [] })),
      ]);
      setSnap(snapshot);
      setJobs(j.jobs || []);
      setPayouts(p.payouts || []);
      setTalent(t.talent || []);
      setClients(c.clients || []);
    } catch (err) {
      setError(err.message || 'Could not load Workforce.');
    } finally {
      setLoaded(true);
    }
  }, []);

  const { busy, run } = useAsyncRunner({ onError: setError, onSuccess: setSuccess, reload });

  useEffect(() => {
    reload();
  }, [reload]);

  const rows = useMemo(() => {
    const contracts = snap?.contracts || [];
    return (snap?.engagements || []).map((e) => {
      const c = contracts.find((x) => x.engagementId === e.id && x.status !== 'void') || null;
      const has = (role) => (c?.signatures || []).some((s) => s.role === role && s.signedAt);
      return {
        e,
        c,
        needsByg: Boolean(c && ['ready_to_sign', 'partially_signed'].includes(c.status) && c.aiReviewStatus === 'pass' && !has('byg')),
        needsReview: Boolean(c && !['signed', 'void'].includes(c.status) && c.aiReviewStatus !== 'pass'),
        waiting: Boolean(c && c.status !== 'signed' && (!has('client') || !has('talent'))),
        bothSigned: has('client') && has('talent'),
      };
    });
  }, [snap]);

  const invoices = snap?.invoices || [];
  const unpaid = invoices.filter((i) => i.status === 'sent');
  const overdue = unpaid.filter((i) => i.dueDate && i.dueDate < new Date().toISOString().slice(0, 10));
  const pendingPayouts = payouts.filter((p) => p.status === 'pending');
  const accountsToVerify = (snap?.paymentAccounts || []).filter((a) => a.status === 'pending');
  const signQueue = rows.filter((r) => r.needsReview || (r.needsByg && r.bothSigned));
  const earlyByg = rows.filter((r) => r.needsByg && !r.bothSigned);
  const openJobs = jobs.filter((j) => j.status === 'open');
  const newJobs = openJobs.filter((j) => j.candidates.length === 0);
  const inboxCount = signQueue.length + pendingPayouts.length + accountsToVerify.length + newJobs.length + overdue.length;
  const ledger = snap?.ledger || {};

  const tabs = [
    { id: 'action', label: 'Needs action', icon: Inbox, count: inboxCount },
    { id: 'hire', label: 'Start a hire', icon: UserPlus },
    { id: 'engagements', label: 'Engagements', icon: Users, count: rows.length },
    { id: 'jobs', label: 'Jobs', icon: Briefcase, count: openJobs.length },
    { id: 'invoices', label: 'Invoices', icon: Receipt, count: unpaid.length },
    { id: 'payouts', label: 'Payouts', icon: Banknote, count: pendingPayouts.length },
    { id: 'wallets', label: 'Wallets', icon: Wallet },
  ];

  const pdf = (invoiceId) => run(`pdf-${invoiceId}`, async () => openInvoicePdf((await fetchAdminInvoiceDocument(invoiceId)).printHtml));

  const payoutRow = (p) => (
    <div key={p.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-black text-black">{p.talentName || p.talentEmail}</p>
          <StatusBadge status={p.status} />
        </div>
        <p className="mt-1 text-[11px] font-medium text-gray-500">
          from {p.clientName} · queued {formatDate(p.createdAt)}
          {p.status === 'sent' ? ` · sent ${formatDate(p.sentAt)} · ref ${p.providerRef}` : ''}
        </p>
        {p.status === 'pending' ? (
          p.account ? (
            <p className="mt-1.5 text-[11px] font-bold text-gray-700">
              {p.account.maskedLabel} · {p.account.details?.accountHolder}
              {p.account.details?.iban ? ` · IBAN ${p.account.details.iban}` : ''}
              {p.account.details?.accountNumber ? ` · Acct ${p.account.details.accountNumber}` : ''}
              {p.account.details?.swift ? ` · SWIFT ${p.account.details.swift}` : ''}
              {p.account.details?.email ? ` · ${p.account.details.email}` : ''}{' '}
              {p.account.status === 'verified' ? (
                <span className="text-emerald-700">✓ verified</span>
              ) : (
                <span className="text-red">unverified</span>
              )}
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] font-bold text-red">No payout details yet — ask the talent to add them.</p>
          )
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-base font-black text-black">
          <Money value={p.amount} currency={p.currency} />
        </p>
        {p.status === 'pending' && p.account?.status === 'verified' ? (
          <ReferenceAction
            dark
            label="Mark sent"
            placeholder="Transfer reference"
            busy={busy === `rel-${p.id}`}
            onSubmit={(ref) => run(`rel-${p.id}`, () => releasePayout(p.id, ref), 'Payout recorded — talent notified.')}
          />
        ) : null}
      </div>
    </div>
  );

  const accountRow = (a) => (
    <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div>
        <p className="text-sm font-black text-black">{a.ownerEmail}</p>
        <p className="mt-1 text-[11px] font-medium text-gray-500">
          {a.details?.method} · {a.details?.accountHolder} · {a.maskedLabel}
          {a.details?.country ? ` · ${a.details.country}` : ''}
        </p>
      </div>
      <button
        type="button"
        disabled={!!busy}
        onClick={() => run(`ver-${a.id}`, () => verifyPaymentAccount(a.id), 'Payout details verified.')}
        className={btn.smallDark}
      >
        <ShieldCheck size={12} /> Verify
      </button>
    </div>
  );

  return (
    <AdminPageShell>
      <PageHeader
        eyebrow="Workforce"
        title="Ops dashboard"
        subtitle="Jobs, hires, three-party contracts, billing and talent payouts — all in one place."
        actions={
          <>
            <span
              className={`inline-flex items-center gap-2 self-center rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${
                status?.schemaReady ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red/20 bg-red/5 text-red'
              }`}
            >
              {status?.schemaReady ? 'Connected' : 'Not migrated'} · {status?.payments === 'tap' ? 'Tap live' : 'Manual payments'}
            </span>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run('billing', () => runBilling(), (r) => `Billing run: ${r.issued} invoice(s) issued, ${r.autoPaid} auto-paid.`)}
              className={btn.primary}
            >
              <BusyLabel busy={busy === 'billing'} busyText="Running…">
                <CalendarClock size={14} /> Run billing
              </BusyLabel>
            </button>
          </>
        }
      />

      <Notice kind="error" onDismiss={() => setError('')}>
        {error}
      </Notice>
      <Notice kind="success" onDismiss={() => setSuccess('')}>
        {success}
      </Notice>

      {!loaded ? (
        <Spinner />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Platform cash" value={<Money value={ledger.cash} />} icon={Landmark} />
            <StatTile
              label="Owed to talent"
              value={<Money value={ledger.talentPayable} />}
              hint={`${pendingPayouts.length} payout(s) pending`}
              icon={Banknote}
              tone={pendingPayouts.length ? 'alert' : 'default'}
              onClick={() => setTab('payouts')}
            />
            <StatTile label="Fee revenue" value={<Money value={ledger.feeRevenue} />} icon={Receipt} />
            <StatTile label="Client wallets" value={<Money value={ledger.clientPrepaid} />} hint="Prepaid balances" icon={Wallet} onClick={() => setTab('wallets')} />
          </div>

          <Tabs tabs={tabs} active={tab} onChange={setTab} />

          {tab === 'action' ? (
            <div className="space-y-6">
              {inboxCount === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="Inbox clear"
                  action={
                    <button type="button" onClick={() => setTab('hire')} className={btn.primary}>
                      <UserPlus size={14} /> Start a hire
                    </button>
                  }
                >
                  New jobs, countersignatures, payout details and payouts to send will show up here.
                </EmptyState>
              ) : null}
              {signQueue.length ? (
                <Card>
                  <SectionTitle icon={FileSignature} title="Contracts" hint="Client and talent have signed — countersign to activate and issue the first invoice." />
                  <div className="space-y-3">
                    {signQueue.map((r) => (
                      <CountersignCard
                        key={r.e.id}
                        row={r}
                        busy={busy === `sign-${r.c.id}` || busy === `rev-${r.c.id}`}
                        onReview={() => run(`rev-${r.c.id}`, () => reviewWorkforceContract(r.c.id), 'Review re-run.')}
                        onSign={(payload) =>
                          run(`sign-${r.c.id}`, () => adminSignWorkforceContract(r.c.id, payload), (res) =>
                            res.invoice ? `Engagement active — invoice ${res.invoice.invoiceNumber} issued.` : 'BYG signature saved.'
                          )
                        }
                      />
                    ))}
                  </div>
                </Card>
              ) : null}
              {newJobs.length ? (
                <Card>
                  <SectionTitle icon={Briefcase} title="New jobs to shortlist" />
                  <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200">
                    {newJobs.map((j) => (
                      <div key={j.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                        <div>
                          <p className="text-sm font-black text-black">{j.title}</p>
                          <p className="text-[11px] font-medium text-gray-500">
                            {j.clientName || j.clientEmail} · posted {formatDate(j.createdAt)}
                          </p>
                        </div>
                        <button type="button" onClick={() => setTab('jobs')} className={btn.small}>
                          Shortlist
                        </button>
                      </div>
                    ))}
                  </div>
                </Card>
              ) : null}
              {accountsToVerify.length ? (
                <Card>
                  <SectionTitle icon={ShieldCheck} title="Payout details to verify" hint="Confirm the details with the talent before the first transfer." />
                  <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200">{accountsToVerify.map(accountRow)}</div>
                </Card>
              ) : null}
              {pendingPayouts.length ? (
                <Card>
                  <SectionTitle icon={Banknote} title="Payouts to send" hint="Client has paid. Transfer to the talent, then record the reference." />
                  <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200">{pendingPayouts.map(payoutRow)}</div>
                </Card>
              ) : null}
              {overdue.length ? (
                <Card>
                  <SectionTitle icon={Receipt} title="Overdue invoices" />
                  <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200">
                    {overdue.map((inv) => (
                      <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                        <div>
                          <p className="text-sm font-black text-black">
                            {inv.invoiceNumber} · {inv.clientName}
                          </p>
                          <p className="text-[11px] font-medium text-red">Due {formatDate(inv.dueDate)}</p>
                        </div>
                        <p className="text-base font-black">
                          <Money value={inv.total} currency={inv.currency} />
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              ) : null}
              {earlyByg.length ? (
                <p className="text-[11px] font-medium text-gray-500">
                  {earlyByg.length} contract(s) still waiting on client or talent signatures — see Engagements.
                </p>
              ) : null}
            </div>
          ) : null}

          {tab === 'hire' ? (
            <AdminHireForm
              talent={talent}
              clients={clients}
              jobs={jobs}
              defaultFee={status?.defaultFeePercent ?? 10}
              onError={setError}
              onCreated={async (res) => {
                setSuccess(res.created ? 'Engagement created — client and talent have been emailed to sign.' : 'An open engagement already exists for this pair.');
                await reload();
                setTab('engagements');
              }}
            />
          ) : null}

          {tab === 'engagements' ? (
            <Card>
              <SectionTitle icon={Users} title="Engagements" />
              {rows.length === 0 ? (
                <EmptyState icon={Users} title="No engagements yet" />
              ) : (
                <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200">
                  {rows.map(({ e, c }) => (
                    <div key={e.id} className="px-5 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-black text-black">
                            {e.talentName || e.talentEmail} → {e.clientName}
                          </p>
                          <StatusBadge status={e.status} />
                        </div>
                        <p className="mt-1 text-[11px] font-medium text-gray-500">
                          {e.roleTitle} · <Money value={e.salary?.amount} currency={e.salary?.currency} /> / {e.salary?.cadence} · fee {e.salary?.bygFeePercent}% · from{' '}
                          {formatDate(e.startDate)}
                          {e.endDate ? ` to ${formatDate(e.endDate)}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {c && c.status !== 'signed' ? <SignatureSteps signatures={c.signatures} /> : null}
                        {c ? (
                          <button type="button" onClick={() => setOpenContract(openContract === c.id ? null : c.id)} className={btn.small}>
                            <FileSignature size={12} /> Contract
                          </button>
                        ) : null}
                        {e.status === 'active' ? (
                          <button
                            type="button"
                            disabled={!!busy}
                            onClick={() => run(`st-${e.id}`, () => setEngagementStatus(e.id, { status: 'paused' }), 'Engagement paused — billing stops.')}
                            className={btn.small}
                          >
                            <Pause size={12} /> Pause
                          </button>
                        ) : null}
                        {e.status === 'paused' ? (
                          <button
                            type="button"
                            disabled={!!busy}
                            onClick={() => run(`st-${e.id}`, () => setEngagementStatus(e.id, { status: 'active' }), 'Engagement resumed.')}
                            className={btn.small}
                          >
                            <Play size={12} /> Resume
                          </button>
                        ) : null}
                        {e.status !== 'ended' ? (
                          <ReferenceAction
                            label="End"
                            placeholder="Reason"
                            busy={busy === `end-${e.id}`}
                            onSubmit={(reason) => run(`end-${e.id}`, () => setEngagementStatus(e.id, { status: 'ended', reason }), 'Engagement ended.')}
                          />
                        ) : null}
                      </div>
                    </div>
                    {c && openContract === c.id ? (
                      <div className="mt-4">
                        <ContractRow
                          contract={c}
                          engagement={e}
                          counterpartLabel={`${e.talentName || e.talentEmail} → ${e.clientName}`}
                          canEditDate
                          busy={busy === `date-${c.id}`}
                          onChangeDate={async (startDate) =>
                            Boolean(
                              await run(`date-${c.id}`, () => adminChangeContractStartDate(c.id, startDate), (r) =>
                                r.clearedRoles?.length ? 'Start date changed — signatures cleared, parties notified to re-sign.' : 'Start date changed.'
                              )
                            )
                          }
                        />
                      </div>
                    ) : null}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ) : null}

          {tab === 'jobs' ? (
            <div className="space-y-4">
              {jobs.length === 0 ? (
                <EmptyState icon={Briefcase} title="No jobs posted yet">
                  Clients post roles from their workspace — they land here for shortlisting.
                </EmptyState>
              ) : (
                jobs.map((j) => <AdminJobCard key={j.id} job={j} talent={talent} busy={busy} run={run} />)
              )}
            </div>
          ) : null}

          {tab === 'invoices' ? (
            <Card>
              <SectionTitle icon={Receipt} title="Invoices" hint="Card and wallet payments are applied automatically. Record bank transfers here." />
              {invoices.length === 0 ? (
                <EmptyState icon={Receipt} title="No invoices yet" />
              ) : (
                <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200">
                  {invoices.map((inv) => (
                    <div key={inv.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-black text-black">{inv.invoiceNumber}</p>
                          <StatusBadge status={inv.status} />
                        </div>
                        <p className="mt-1 text-[11px] font-medium text-gray-500">
                          {inv.clientName} · {inv.periodStart ? `${formatDate(inv.periodStart)} – ${formatDate(inv.periodEnd)}` : formatDate(inv.createdAt)}
                          {inv.status === 'paid' ? ` · paid via ${inv.paymentProvider} (${inv.providerRef})` : ` · due ${formatDate(inv.dueDate)}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="mr-2 text-base font-black text-black">
                          <Money value={inv.total} currency={inv.currency} />
                        </p>
                        <button type="button" disabled={!!busy} onClick={() => pdf(inv.id)} className={btn.small}>
                          <FileDown size={12} /> PDF
                        </button>
                        {inv.status === 'sent' ? (
                          <>
                            <ReferenceAction
                              dark
                              label="Mark paid"
                              placeholder="Bank reference"
                              busy={busy === `paid-${inv.id}`}
                              onSubmit={(ref) => run(`paid-${inv.id}`, () => markInvoicePaid(inv.id, ref), 'Payment recorded — talent payout queued.')}
                            />
                            <button
                              type="button"
                              disabled={!!busy}
                              onClick={() => {
                                if (window.confirm(`Void ${inv.invoiceNumber}? Billing will re-issue this period on the next run.`)) {
                                  run(`void-${inv.id}`, () => voidInvoice(inv.id), 'Invoice voided.');
                                }
                              }}
                              className={btn.small}
                            >
                              Void
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ) : null}

          {tab === 'payouts' ? (
            <div className="space-y-6">
              {accountsToVerify.length ? (
                <Card>
                  <SectionTitle icon={ShieldCheck} title="Payout details to verify" />
                  <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200">{accountsToVerify.map(accountRow)}</div>
                </Card>
              ) : null}
              <Card>
                <SectionTitle icon={Banknote} title="Talent payouts" hint="Created automatically when a client invoice is paid." />
                {payouts.length === 0 ? (
                  <EmptyState icon={Banknote} title="No payouts yet" />
                ) : (
                  <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200">{payouts.map(payoutRow)}</div>
                )}
              </Card>
            </div>
          ) : null}

          {tab === 'wallets' ? <WalletCreditForm clients={clients} busy={busy} run={run} /> : null}

          <p className="mt-10 text-[11px] font-medium text-gray-400">
            Client workspace:{' '}
            <Link className="font-bold text-red" to="/client/workforce">
              /client/workforce
            </Link>{' '}
            · Talent workspace:{' '}
            <Link className="font-bold text-red" to="/talent/workforce">
              /talent/workforce
            </Link>
          </p>
        </>
      )}
    </AdminPageShell>
  );
};

export default AdminWorkforcePage;
