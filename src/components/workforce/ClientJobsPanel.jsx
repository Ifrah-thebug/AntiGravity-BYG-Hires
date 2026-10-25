import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, ChevronRight, MapPin, Plus, UserPlus, Users, X } from 'lucide-react';
import { addMyJobCandidate, createMyJob, updateMyJob, updateMyJobCandidate } from '../../lib/workforceApi';
import { BusyLabel, EmptyState, Field, Money, SectionTitle, StatusBadge, btn, formatDate, inputClass } from './WorkforceUi';

export const PIPELINE_STAGES = [
  { id: 'shortlisted', label: 'Shortlisted' },
  { id: 'intro', label: 'Intro call' },
  { id: 'interview', label: 'Interview' },
  { id: 'offer', label: 'Offer' },
  { id: 'hired', label: 'Hired' },
  { id: 'rejected', label: 'Not a fit' },
];
const CLIENT_STAGES = ['shortlisted', 'intro', 'interview', 'offer', 'rejected'];
const TYPE_LABEL = { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract' };

const emptyJob = {
  title: '',
  employmentType: 'full_time',
  headcount: '1',
  budgetMin: '',
  budgetMax: '',
  currency: 'USD',
  location: 'Remote',
  skills: '',
  description: '',
};

function JobForm({ currencies, onCreated, onCancel, onError }) {
  const [form, setForm] = useState(emptyJob);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    onError('');
    try {
      const { job } = await createMyJob({ ...form, headcount: Number(form.headcount) || 1 });
      onCreated(job);
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-xl md:p-8">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm font-black uppercase tracking-widest text-gray-900">Post a role</p>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-black" aria-label="Close">
          <X size={18} />
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Job title" className="sm:col-span-2">
          <input className={inputClass} required maxLength={140} value={form.title} onChange={set('title')} placeholder="e.g. Customer support lead" />
        </Field>
        <Field label="Type">
          <select className={inputClass} value={form.employmentType} onChange={set('employmentType')}>
            <option value="full_time">Full-time</option>
            <option value="part_time">Part-time</option>
            <option value="contract">Contract</option>
          </select>
        </Field>
        <Field label="Openings">
          <input className={inputClass} type="number" min="1" max="100" value={form.headcount} onChange={set('headcount')} />
        </Field>
        <Field label="Budget from (per month)">
          <input className={inputClass} inputMode="decimal" value={form.budgetMin} onChange={set('budgetMin')} placeholder="Optional" />
        </Field>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <Field label="Budget to">
            <input className={inputClass} inputMode="decimal" value={form.budgetMax} onChange={set('budgetMax')} placeholder="Optional" />
          </Field>
          <Field label="Currency">
            <select className={inputClass} value={form.currency} onChange={set('currency')}>
              {currencies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Location / timezone">
          <input className={inputClass} value={form.location} onChange={set('location')} />
        </Field>
        <Field label="Key skills" hint="Comma separated">
          <input className={inputClass} value={form.skills} onChange={set('skills')} placeholder="Zendesk, CRM, English C1" />
        </Field>
        <Field label="What will they do?" className="sm:col-span-2">
          <textarea className={`${inputClass} min-h-[7rem]`} maxLength={5000} value={form.description} onChange={set('description')} />
        </Field>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="submit" disabled={busy || !form.title.trim()} className={btn.accent}>
          <BusyLabel busy={busy} busyText="Posting…">
            <Plus size={14} /> Post role
          </BusyLabel>
        </button>
        <p className="self-center text-[11px] font-medium text-gray-500">BYG Hires will shortlist matching talent for you.</p>
      </div>
    </form>
  );
}

function JobCard({ job, talent, onHire, onChanged, onError }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState('');
  const [busy, setBusy] = useState(null);
  const counts = useMemo(() => {
    const m = {};
    for (const c of job.candidates) m[c.stage] = (m[c.stage] || 0) + 1;
    return m;
  }, [job.candidates]);
  const inPipeline = new Set(job.candidates.map((c) => String(c.talentProfileId)));
  const addable = talent.filter((t) => !inPipeline.has(String(t.id)));
  const hired = counts.hired || 0;

  const act = async (key, fn) => {
    setBusy(key);
    onError('');
    try {
      const res = await fn();
      if (res?.job) onChanged(res.job);
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-[2rem] border border-gray-200 bg-white shadow-sm">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full flex-wrap items-start justify-between gap-4 p-6 text-left">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-red/10 bg-red/5 text-red">
            <Briefcase size={18} />
          </div>
          <div>
            <p className="text-base font-black text-black">{job.title}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-gray-500">
              <span>{TYPE_LABEL[job.employmentType]}</span>
              <span className="inline-flex items-center gap-1">
                <MapPin size={11} /> {job.location}
              </span>
              <span>
                {hired}/{job.headcount} hired
              </span>
              {job.budgetMin || job.budgetMax ? (
                <span>
                  {job.budgetMin ? <Money value={job.budgetMin} currency={job.currency} /> : '…'} –{' '}
                  {job.budgetMax ? <Money value={job.budgetMax} currency={job.currency} /> : '…'}
                </span>
              ) : null}
              <span>Posted {formatDate(job.createdAt)}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500">
            <Users size={13} /> {job.candidates.length}
          </span>
          <StatusBadge status={job.status} />
          <ChevronRight size={16} className={`text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {open ? (
        <div className="border-t border-gray-100 p-6">
          <div className="mb-5 flex flex-wrap gap-2">
            {PIPELINE_STAGES.map((s) => (
              <span key={s.id} className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-gray-500">
                {s.label} · {counts[s.id] || 0}
              </span>
            ))}
          </div>

          {job.candidates.length === 0 ? (
            <p className="mb-5 rounded-2xl bg-gray-50 px-4 py-5 text-center text-sm font-medium text-gray-500">
              BYG Hires is shortlisting for this role. You can also add talent you found in the directory.
            </p>
          ) : (
            <div className="mb-5 divide-y divide-gray-100 rounded-2xl border border-gray-200">
              {job.candidates.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-black text-black">{c.talentName || 'Candidate'}</p>
                    <p className="text-[11px] font-medium text-gray-500">
                      {c.talentTitle || 'BYG talent'} · {c.source === 'byg' ? 'Shortlisted by BYG' : 'Added by you'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {c.talentProfileId ? (
                      <Link to={`/talent/${c.talentProfileId}`} className={btn.small}>
                        Profile
                      </Link>
                    ) : null}
                    {c.stage === 'hired' ? (
                      <StatusBadge status="hired" />
                    ) : (
                      <>
                        <select
                          aria-label="Pipeline stage"
                          value={c.stage}
                          disabled={busy === c.id || c.stage === 'withdrawn'}
                          onChange={(e) => act(c.id, () => updateMyJobCandidate(job.id, c.id, { stage: e.target.value }))}
                          className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-[10px] font-black uppercase tracking-widest text-gray-700 outline-none focus:border-red"
                        >
                          {PIPELINE_STAGES.filter((s) => CLIENT_STAGES.includes(s.id) || s.id === c.stage).map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        {c.talentProfileId && c.stage !== 'rejected' && !c.engagementId ? (
                          <button type="button" onClick={() => onHire(c.talentProfileId, job.id)} className={btn.smallDark}>
                            <UserPlus size={12} /> Hire
                          </button>
                        ) : null}
                        {c.engagementId ? <StatusBadge status="offer" label="Contract out" /> : null}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <Field label="Add from directory" className="min-w-[14rem] flex-1">
              <select className={inputClass} value={adding} onChange={(e) => setAdding(e.target.value)}>
                <option value="">Choose talent…</option>
                {addable.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.jobTitle || 'Talent'}
                  </option>
                ))}
              </select>
            </Field>
            <button
              type="button"
              disabled={!adding || busy === 'add'}
              onClick={() =>
                act('add', async () => {
                  const res = await addMyJobCandidate(job.id, adding);
                  setAdding('');
                  return res;
                })
              }
              className={btn.primary}
            >
              <BusyLabel busy={busy === 'add'} busyText="Adding…">
                <Plus size={14} /> Add
              </BusyLabel>
            </button>
            <div className="ml-auto flex flex-wrap gap-2">
              {job.status === 'open' ? (
                <button type="button" disabled={!!busy} onClick={() => act('status', () => updateMyJob(job.id, { status: 'on_hold' }))} className={btn.small}>
                  Pause
                </button>
              ) : null}
              {job.status === 'on_hold' || job.status === 'closed' ? (
                <button type="button" disabled={!!busy} onClick={() => act('status', () => updateMyJob(job.id, { status: 'open' }))} className={btn.small}>
                  Reopen
                </button>
              ) : null}
              {job.status !== 'closed' ? (
                <button type="button" disabled={!!busy} onClick={() => act('status', () => updateMyJob(job.id, { status: 'closed' }))} className={btn.small}>
                  Close role
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ClientJobsPanel({ jobs, talent, currencies, onJobsChange, onHire, onError, onSuccess }) {
  const [showForm, setShowForm] = useState(false);
  const replace = (job) => onJobsChange(jobs.map((j) => (j.id === job.id ? job : j)));

  return (
    <div className="space-y-4">
      <SectionTitle
        icon={Briefcase}
        title="Open roles"
        hint="Post what you're hiring for — BYG shortlists talent, you run intros and interviews, then hire in one click."
        action={
          !showForm ? (
            <button type="button" onClick={() => setShowForm(true)} className={btn.accent}>
              <Plus size={14} /> Post a role
            </button>
          ) : null
        }
      />
      {showForm ? (
        <JobForm
          currencies={currencies}
          onError={onError}
          onCancel={() => setShowForm(false)}
          onCreated={(job) => {
            onJobsChange([job, ...jobs]);
            setShowForm(false);
            onSuccess(`“${job.title}” is live. We'll email you when candidates are shortlisted.`);
          }}
        />
      ) : null}
      {jobs.length === 0 && !showForm ? (
        <EmptyState icon={Briefcase} title="No roles yet">
          Tell us what you&apos;re hiring for and track every candidate from shortlist to signed contract here.
        </EmptyState>
      ) : (
        jobs.map((job) => <JobCard key={job.id} job={job} talent={talent} onHire={onHire} onChanged={replace} onError={onError} />)
      )}
    </div>
  );
}
