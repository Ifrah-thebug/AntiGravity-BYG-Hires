import React, { useState } from 'react';
import { Eye, EyeOff, FileDown, FileSignature, Pencil } from 'lucide-react';
import { openContractPdf } from '../../lib/openInvoicePdf';
import { clientTotalFromContractor, splitInclusiveTotal } from '../../lib/workforceFee';
import { BusyLabel, DocumentPreview, Money, SignatureSteps, StatusBadge, btn, formatDate, inputClass } from './WorkforceUi';

/**
 * Edit start date + contractor pay (and optional BYG fee) until fully signed.
 * Past start dates are allowed. Saving regenerates the contract document.
 */
export function ContractTermsEditor({
  contract,
  engagement,
  busy,
  onSave,
  canEditFee = false,
  label = 'Edit terms',
  /** When true (client portal), warn that saving re-emails the talent. */
  warnTalentEmail = false,
}) {
  const f = contract.filledFields || {};
  const salary = engagement?.salary || {};
  const storedFee = Number(f.byg_fee_percent ?? salary.bygFeePercent ?? 0);
  const storedContractor = Number(f.salary_amount || salary.amount || 0);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    startDate: f.start_date || engagement?.startDate || '',
    salaryAmount: String(clientTotalFromContractor(storedContractor, storedFee) || ''),
    bygFeePercent: String(storedFee),
    currency: f.currency || salary.currency || 'USD',
    cadence: f.cadence || salary.cadence || 'monthly',
  });
  const signedCount = (contract.signatures || []).filter((s) => s.signedAt).length;
  const liveSplit = splitInclusiveTotal(Number(form.salaryAmount) || 0, Number(form.bygFeePercent) || 0);

  if (['signed', 'void'].includes(contract.status)) return null;

  const openEditor = () => {
    const feePct = Number(f.byg_fee_percent ?? salary.bygFeePercent ?? 0);
    const contractor = Number(f.salary_amount || salary.amount || 0);
    setForm({
      startDate: f.start_date || engagement?.startDate || '',
      salaryAmount: String(clientTotalFromContractor(contractor, feePct) || ''),
      bygFeePercent: String(feePct),
      currency: f.currency || salary.currency || 'USD',
      cadence: f.cadence || salary.cadence || 'monthly',
    });
    setEditing(true);
  };

  if (!editing) {
    return (
      <button type="button" onClick={openEditor} className={btn.small}>
        <Pencil size={12} /> {label}
      </button>
    );
  }

  const set = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }));
  const amountOk = Number(form.salaryAmount) > 0;
  const feeOk = !canEditFee || (Number(form.bygFeePercent) >= 0 && Number(form.bygFeePercent) <= 100);
  const canSave = form.startDate && amountOk && feeOk && !busy;

  return (
    <div className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Update contract terms</p>
      <p className="mt-1 text-[11px] font-medium text-gray-500">
        Changes update the live contract document. Past start dates are allowed.
      </p>
      {warnTalentEmail ? (
        <p className="mt-3 rounded-xl border border-red/20 bg-red/5 px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-red">
          Saving these changes emails the talent again with a link to review and sign the updated contract.
          {signedCount > 0 ? ' Any signatures already collected will be cleared.' : ''}
        </p>
      ) : null}
      {liveSplit.total > 0 ? (
        <p className="mt-2 text-[11px] font-medium text-gray-500">
          Invoice split: contractor <Money value={liveSplit.contractor} currency={form.currency} /> + fee{' '}
          <Money value={liveSplit.fee} currency={form.currency} /> ({liveSplit.feePercent}%) ={' '}
          <Money value={liveSplit.total} currency={form.currency} />
        </p>
      ) : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500">
          Start date
          <input
            type="date"
            value={form.startDate}
            onChange={set('startDate')}
            className={`${inputClass} mt-1.5 normal-case tracking-normal`}
          />
        </label>
        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500">
          Client pays (fee included)
          <input
            inputMode="decimal"
            value={form.salaryAmount}
            onChange={set('salaryAmount')}
            className={`${inputClass} mt-1.5 normal-case tracking-normal`}
          />
        </label>
        {canEditFee ? (
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500">
            BYG platform fee %
            <input
              inputMode="decimal"
              value={form.bygFeePercent}
              onChange={set('bygFeePercent')}
              className={`${inputClass} mt-1.5 normal-case tracking-normal`}
            />
          </label>
        ) : null}
        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500">
          Currency
          <select value={form.currency} onChange={set('currency')} className={`${inputClass} mt-1.5 normal-case tracking-normal`}>
            {['USD', 'AED', 'EUR', 'GBP'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500">
          Cadence
          <select value={form.cadence} onChange={set('cadence')} className={`${inputClass} mt-1.5 normal-case tracking-normal`}>
            <option value="monthly">Month</option>
            <option value="biweekly">2 weeks</option>
            <option value="weekly">Week</option>
          </select>
        </label>
      </div>
      {signedCount > 0 && !warnTalentEmail ? (
        <p className="mt-3 text-[11px] font-semibold text-red">
          {signedCount} signature{signedCount > 1 ? 's' : ''} will be cleared — everyone signs the updated contract again. Talent is emailed the new version.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canSave}
          onClick={async () => {
            const payload = {
              startDate: form.startDate,
              salaryAmount: Number(form.salaryAmount),
              currency: form.currency,
              cadence: form.cadence,
            };
            if (canEditFee) payload.bygFeePercent = Number(form.bygFeePercent);
            const ok = await onSave(payload);
            if (ok !== false) setEditing(false);
          }}
          className={btn.smallDark}
        >
          <BusyLabel busy={busy} busyText="Saving…">
            {warnTalentEmail ? 'Save & email talent' : 'Save & refresh contract'}
          </BusyLabel>
        </button>
        <button type="button" onClick={() => setEditing(false)} className={btn.small}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/** @deprecated use ContractTermsEditor — kept for ContractSignCard compatibility */
export function StartDateEditor({ contract, busy, onSave }) {
  return (
    <ContractTermsEditor
      contract={contract}
      busy={busy}
      label="Change start date"
      onSave={async (terms) => onSave(terms.startDate)}
    />
  );
}

/** View + download any contract (any status). Optional terms editing. */
export default function ContractRow({
  contract,
  engagement,
  counterpartLabel,
  canEditDate = false,
  canEditFee = false,
  warnTalentEmail = false,
  busy = false,
  onChangeDate,
  onChangeTerms,
}) {
  const [open, setOpen] = useState(false);
  const f = contract.filledFields || {};
  const title = engagement?.roleTitle || f.role_title || 'BYG Hires contract';
  const saveTerms = onChangeTerms || (onChangeDate ? async (terms) => onChangeDate(terms.startDate) : null);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red/10 bg-red/5 text-red">
            <FileSignature size={16} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-black text-black">{title}</p>
              <StatusBadge status={contract.status} label={contract.status === 'signed' ? 'Fully signed' : undefined} />
            </div>
            <p className="mt-1 text-[11px] font-medium text-gray-500">
              {counterpartLabel} · <Money value={f.salary_amount} currency={f.currency} /> / {f.cadence}
              {f.byg_fee_percent != null ? ` · fee ${f.byg_fee_percent}%` : ''} · starts {formatDate(f.start_date)}
            </p>
          </div>
        </div>
        <SignatureSteps signatures={contract.signatures} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen((v) => !v)} className={btn.small}>
          {open ? <EyeOff size={12} /> : <Eye size={12} />} {open ? 'Hide contract' : 'View contract'}
        </button>
        <button
          type="button"
          disabled={!contract.renderedHtml}
          onClick={() => openContractPdf(contract.renderedHtml, `${title} — BYG Hires contract`)}
          className={btn.small}
        >
          <FileDown size={12} /> Download PDF
        </button>
        {canEditDate && saveTerms ? (
          <ContractTermsEditor
            contract={contract}
            engagement={engagement}
            busy={busy}
            canEditFee={canEditFee}
            warnTalentEmail={warnTalentEmail}
            onSave={saveTerms}
          />
        ) : null}
      </div>

      {open ? (
        <div className="mt-4">
          {contract.renderedHtml ? (
            <DocumentPreview html={contract.renderedHtml} maxHeight="max-h-[32rem]" />
          ) : (
            <p className="rounded-2xl bg-gray-50 px-4 py-5 text-sm font-medium text-gray-500">The contract document is still being prepared.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
