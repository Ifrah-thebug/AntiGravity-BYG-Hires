import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Eye, Search, UserPlus } from 'lucide-react';
import { clientHireTalent, previewWorkforceContract } from '../../lib/workforceApi';
import { BusyLabel, DocumentPreview, Field, Money, btn, inputClass } from './WorkforceUi';
import TalentHrDetailsCard from './TalentHrDetailsCard';

const today = () => new Date().toISOString().slice(0, 10);
const CADENCE_LABEL = { monthly: 'month', biweekly: '2 weeks', weekly: 'week' };

/**
 * Client hires a specific directory talent. The fee is set by BYG (server-side);
 * the client sees the all-in cost before confirming.
 */
export default function ClientHireWizard({
  talent,
  jobs = [],
  defaultFeePercent = 0,
  currencies = ['USD'],
  initialTalentId = null,
  initialJobId = null,
  onHired,
  onError,
}) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(initialTalentId);
  const [step, setStep] = useState(initialTalentId ? 2 : 1);
  const [terms, setTerms] = useState({
    jobId: initialJobId || '',
    roleTitle: '',
    salaryAmount: '',
    currency: 'USD',
    cadence: 'monthly',
    startDate: today(),
  });
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(null);

  const selected = useMemo(() => talent.find((t) => String(t.id) === String(selectedId)) || null, [talent, selectedId]);
  const openJobs = jobs.filter((j) => j.status === 'open' || j.status === 'on_hold');

  useEffect(() => {
    if (!initialTalentId) return;
    setSelectedId(initialTalentId);
    setStep(2);
  }, [initialTalentId]);

  useEffect(() => {
    if (initialJobId) setTerms((t) => ({ ...t, jobId: initialJobId }));
  }, [initialJobId]);

  // Prefill terms from the talent profile / linked job.
  useEffect(() => {
    if (!selected) return;
    const job = openJobs.find((j) => j.id === terms.jobId);
    setTerms((t) => ({
      ...t,
      roleTitle: t.roleTitle || job?.title || selected.jobTitle || 'Remote contractor',
      salaryAmount: t.salaryAmount || (selected.suggestedSalary ? String(selected.suggestedSalary) : ''),
      currency: job?.currency || t.currency,
    }));
  }, [selected?.id, terms.jobId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? talent.filter((t) => t.name?.toLowerCase().includes(q) || t.jobTitle?.toLowerCase().includes(q))
      : talent;
    return list.slice(0, 40);
  }, [talent, query]);

  const salary = Number(terms.salaryAmount) || 0;
  const fee = Math.round(salary * defaultFeePercent) / 100;
  const total = Math.round((salary + fee) * 100) / 100;
  const canSubmit = selected && salary > 0 && terms.roleTitle.trim() && terms.startDate;

  const body = () => ({
    talentId: selected.id,
    jobId: terms.jobId || undefined,
    roleTitle: terms.roleTitle.trim(),
    salaryAmount: salary,
    currency: terms.currency,
    cadence: terms.cadence,
    startDate: terms.startDate,
  });

  const set = (k) => (e) => {
    setTerms((t) => ({ ...t, [k]: e.target.value }));
    setPreview('');
  };

  const loadPreview = async () => {
    setBusy('preview');
    onError('');
    try {
      setPreview((await previewWorkforceContract(body())).renderedHtml || '');
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const confirm = async () => {
    setBusy('hire');
    onError('');
    try {
      const res = await clientHireTalent(body());
      onHired(res, selected);
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(null);
    }
  };

  if (step === 1) {
    return (
      <div>
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-4 top-1/2 mt-[3px] -translate-y-1/2 text-gray-400" />
          <input
            className={`${inputClass} pl-10`}
            placeholder="Search the talent directory by name or role…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="mt-4 grid max-h-[26rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {filtered.length === 0 ? (
            <p className="p-4 text-sm font-medium text-gray-500">No talent matches that search.</p>
          ) : (
            filtered.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  if (String(t.id) !== String(selectedId)) {
                    setTerms((prev) => ({ ...prev, roleTitle: '', salaryAmount: '' }));
                    setPreview('');
                  }
                  setSelectedId(t.id);
                  setStep(2);
                }}
                className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:border-black"
              >
                <span>
                  <span className="block text-sm font-black text-black">{t.name || 'BYG talent'}</span>
                  <span className="block text-[11px] font-medium text-gray-500">{t.jobTitle || 'Remote professional'}</span>
                </span>
                {t.suggestedSalary ? (
                  <span className="whitespace-nowrap text-[11px] font-black text-gray-700">
                    <Money value={t.suggestedSalary} />
                    <span className="font-medium text-gray-400">/mo</span>
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div>
        <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Hiring</p>
            <p className="text-sm font-black text-black">{selected?.name || 'Selected talent'}</p>
          </div>
          <button type="button" onClick={() => setStep(1)} className={btn.small}>
            Change
          </button>
        </div>

        {selected?.id ? (
          <div className="mb-5">
            <TalentHrDetailsCard
              variant="client"
              talentId={selected.id}
              talentName={selected.name}
            />
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {openJobs.length ? (
            <Field label="For job (optional)" className="sm:col-span-2">
              <select className={inputClass} value={terms.jobId} onChange={set('jobId')}>
                <option value="">Not linked to a job</option>
                {openJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label="Role title" className="sm:col-span-2">
            <input className={inputClass} value={terms.roleTitle} maxLength={140} onChange={set('roleTitle')} />
          </Field>
          <Field label="Contractor pay">
            <input className={inputClass} inputMode="decimal" value={terms.salaryAmount} onChange={set('salaryAmount')} placeholder="e.g. 2500" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Currency">
              <select className={inputClass} value={terms.currency} onChange={set('currency')}>
                {currencies.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Per">
              <select className={inputClass} value={terms.cadence} onChange={set('cadence')}>
                <option value="monthly">Month</option>
                <option value="biweekly">2 weeks</option>
                <option value="weekly">Week</option>
              </select>
            </Field>
          </div>
          <Field label="Start date">
            <input type="date" className={inputClass} value={terms.startDate} onChange={set('startDate')} />
          </Field>
        </div>

        <button type="button" disabled={!canSubmit || busy} onClick={loadPreview} className={`${btn.secondary} mt-6`}>
          <BusyLabel busy={busy === 'preview'} busyText="Preparing…">
            <Eye size={14} /> Preview contract
          </BusyLabel>
        </button>
        {preview ? (
          <div className="mt-4">
            <DocumentPreview html={preview} />
          </div>
        ) : null}
      </div>

      <aside className="h-fit rounded-[2rem] border border-gray-200 bg-white p-6 shadow-xl">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">You pay per {CADENCE_LABEL[terms.cadence]}</p>
        <p className="mt-2 text-3xl font-black tracking-tight text-black">
          <Money value={total} currency={terms.currency} />
        </p>
        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between font-medium text-gray-600">
            <dt>Contractor pay</dt>
            <dd className="font-black text-black">
              <Money value={salary} currency={terms.currency} />
            </dd>
          </div>
          <div className="flex justify-between font-medium text-gray-600">
            <dt>BYG Hires fee ({defaultFeePercent}%)</dt>
            <dd className="font-black text-black">
              <Money value={fee} currency={terms.currency} />
            </dd>
          </div>
        </dl>
        <ol className="mt-6 space-y-2 border-t border-gray-100 pt-5 text-[11px] font-medium text-gray-500">
          <li>1. Clicking Hire emails the talent (and you) a link to review &amp; sign the contract.</li>
          <li>2. BYG Hires countersigns after you and the talent have signed.</li>
          <li>3. First invoice is issued once all three have signed — pay by card, wallet, or manually.</li>
        </ol>
        <p className="mt-4 rounded-xl border border-red/15 bg-red/5 px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-red">
          An email will be sent to the talent as soon as you click Hire.
        </p>
        <button type="button" disabled={!canSubmit || busy} onClick={confirm} className={`${btn.accent} mt-4 w-full`}>
          <BusyLabel busy={busy === 'hire'} busyText="Creating contract…">
            <UserPlus size={14} /> Hire {selected?.name?.split(' ')[0] || 'talent'} <ArrowRight size={14} />
          </BusyLabel>
        </button>
      </aside>
    </div>
  );
}
