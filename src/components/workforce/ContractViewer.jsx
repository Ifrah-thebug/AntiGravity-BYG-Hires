import React, { useState } from 'react';
import { CalendarClock, Eye, EyeOff, FileDown, FileSignature } from 'lucide-react';
import { openContractPdf } from '../../lib/openInvoicePdf';
import { BusyLabel, DocumentPreview, Money, SignatureSteps, StatusBadge, btn, formatDate } from './WorkforceUi';

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Inline start-date editor. Allowed until the contract is fully signed;
 * changing it clears signatures already given (the backend enforces this).
 */
export function StartDateEditor({ contract, busy, onSave }) {
  const current = contract.filledFields?.start_date || '';
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current);
  const signedCount = (contract.signatures || []).filter((s) => s.signedAt).length;

  if (['signed', 'void'].includes(contract.status)) return null;

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(current);
          setEditing(true);
        }}
        className={btn.small}
      >
        <CalendarClock size={12} /> Change start date
      </button>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500">
        New start date
        <input
          type="date"
          min={todayIso()}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1.5 block rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold normal-case tracking-normal outline-none focus:border-red"
        />
      </label>
      {signedCount > 0 ? (
        <p className="mt-3 text-[11px] font-semibold text-red">
          {signedCount} signature{signedCount > 1 ? 's' : ''} will be cleared — everyone signs the updated contract again.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!value || value === current || busy}
          onClick={async () => {
            const ok = await onSave(value);
            if (ok !== false) setEditing(false);
          }}
          className={btn.smallDark}
        >
          <BusyLabel busy={busy} busyText="Saving…">
            Save date
          </BusyLabel>
        </button>
        <button type="button" onClick={() => setEditing(false)} className={btn.small}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/** View + download any contract (any status). Optional start-date editing. */
export default function ContractRow({ contract, engagement, counterpartLabel, canEditDate = false, busy = false, onChangeDate }) {
  const [open, setOpen] = useState(false);
  const f = contract.filledFields || {};
  const title = engagement?.roleTitle || f.role_title || 'BYG Hires contract';

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
              {counterpartLabel} · <Money value={f.salary_amount} currency={f.currency} /> / {f.cadence} · starts {formatDate(f.start_date)}
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
        {canEditDate ? <StartDateEditor contract={contract} busy={busy} onSave={onChangeDate} /> : null}
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
