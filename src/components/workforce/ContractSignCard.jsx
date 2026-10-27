import React, { useState } from 'react';
import { FileSignature, Eye, EyeOff, FileDown } from 'lucide-react';
import SignatureCapture, { signatureReady } from '../SignatureCapture';
import { openContractPdf } from '../../lib/openInvoicePdf';
import { ContractTermsEditor } from './ContractViewer';
import { BusyLabel, DocumentPreview, Money, SignatureSteps, StatusBadge, btn, formatDate } from './WorkforceUi';

const ROLE_LABEL = { client: 'client', talent: 'contractor', byg: 'BYG Hires' };

/**
 * One contract awaiting the viewer's signature.
 * `onSign({ signatureData, consent })` performs the API call (and reload).
 */
export default function ContractSignCard({
  contract,
  engagement,
  role,
  busy,
  onSign,
  counterpartLabel,
  onChangeDate,
  onChangeTerms,
  dateBusy,
  canEditFee = false,
  warnTalentEmail = false,
}) {
  const [signatureData, setSignatureData] = useState('');
  const [consent, setConsent] = useState(false);
  const [showDoc, setShowDoc] = useState(true);
  const title = engagement?.roleTitle || contract.filledFields?.role_title || 'BYG Hires engagement';
  const f = contract.filledFields || {};
  const ready = signatureReady(signatureData) && consent;
  const saveTerms =
    onChangeTerms ||
    (onChangeDate
      ? async (terms) => onChangeDate(terms.startDate)
      : null);

  return (
    <div className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-xl md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-red/10 bg-red/5 text-red">
            <FileSignature size={18} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Independent Contractor Agreement</p>
            <p className="mt-1 text-lg font-black text-black">{title}</p>
            <p className="mt-1 text-sm font-medium text-gray-500">
              {counterpartLabel} · <Money value={f.salary_amount} currency={f.currency} /> / {f.cadence}
              {f.byg_fee_percent != null ? ` · fee ${f.byg_fee_percent}%` : ''} · starts {formatDate(f.start_date)}
            </p>
          </div>
        </div>
        <StatusBadge status={contract.status} />
      </div>

      <div className="mt-5">
        <SignatureSteps signatures={contract.signatures} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setShowDoc((v) => !v)} className={btn.small}>
          {showDoc ? <EyeOff size={12} /> : <Eye size={12} />} {showDoc ? 'Hide contract' : 'Read the full contract'}
        </button>
        <button
          type="button"
          disabled={!contract.renderedHtml}
          onClick={() => openContractPdf(contract.renderedHtml, `${title} — BYG Hires contract`)}
          className={btn.small}
        >
          <FileDown size={12} /> Download PDF
        </button>
        {saveTerms ? (
          <ContractTermsEditor
            contract={contract}
            engagement={engagement}
            busy={dateBusy}
            canEditFee={canEditFee}
            warnTalentEmail={warnTalentEmail}
            onSave={saveTerms}
          />
        ) : null}
      </div>
      {showDoc ? (
        <div className="mt-3">
          {contract.renderedHtml ? (
            <DocumentPreview html={contract.renderedHtml} maxHeight="max-h-[28rem]" />
          ) : (
            <p className="rounded-2xl bg-gray-50 px-4 py-5 text-sm font-medium text-gray-500">The contract document is still being prepared.</p>
          )}
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-gray-500">Sign as {ROLE_LABEL[role]}</p>
        <SignatureCapture value={signatureData} onChange={setSignatureData} />
        <label className="mt-4 flex items-start gap-3 text-xs font-semibold text-gray-700">
          <input type="checkbox" className="mt-0.5 accent-[#ff3d3d]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            I have read and agree to this BYG Hires Independent Contractor Agreement, and I accept that my electronic signature is
            legally binding.
          </span>
        </label>
        <button
          type="button"
          disabled={!ready || busy}
          onClick={() => onSign({ signatureData, consent: true })}
          className={`${btn.accent} mt-5 w-full sm:w-auto`}
        >
          <BusyLabel busy={busy} busyText="Signing…">
            <FileSignature size={14} /> Sign contract
          </BusyLabel>
        </button>
      </div>
    </div>
  );
}
