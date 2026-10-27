import React, { useEffect, useState } from 'react';
import { Banknote, Landmark, ShieldCheck } from 'lucide-react';
import { saveMyPayoutAccount } from '../../lib/workforceApi';
import { BusyLabel, Card, EmptyState, Field, Money, SectionTitle, StatusBadge, btn, formatDate, inputClass } from './WorkforceUi';

const METHODS = [
  { id: 'bank', label: 'Bank transfer' },
  { id: 'wise', label: 'Wise' },
  { id: 'payoneer', label: 'Payoneer' },
  { id: 'paypal', label: 'PayPal' },
];

const blank = { method: 'bank', accountHolder: '', country: '', bankName: '', iban: '', accountNumber: '', swift: '', email: '' };

export default function TalentPayoutsPanel({ account, payouts, engagements, hasEngagement, onSaved, onError, onSuccess }) {
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(!account);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEditing(!account);
    if (account?.details) setForm({ ...blank, ...account.details });
  }, [account]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const clientFor = (p) => engagements.find((e) => e.id === p.engagementId)?.clientName || 'Client';
  const totalPaid = payouts.filter((p) => p.status === 'sent').reduce((s, p) => s + p.amount, 0);
  const pending = payouts.filter((p) => p.status === 'pending');

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    onError('');
    try {
      const { account: saved } = await saveMyPayoutAccount(form);
      onSaved(saved);
      onSuccess('Payout details saved — BYG Hires will verify them before your next payment.');
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      <Card>
        <SectionTitle
          icon={Banknote}
          title="Payments"
          hint="BYG Hires pays you after the client funds each invoice. Every transfer comes with a reference you can trace."
        />
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Paid to you</p>
            <p className="mt-2 text-2xl font-black text-black">
              <Money value={totalPaid} currency={payouts[0]?.currency || 'USD'} />
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">On the way</p>
            <p className="mt-2 text-2xl font-black text-black">
              <Money value={pending.reduce((s, p) => s + p.amount, 0)} currency={pending[0]?.currency || 'USD'} />
            </p>
          </div>
        </div>
        {payouts.length === 0 ? (
          <EmptyState icon={Banknote} title="No payments yet">
            Payments appear here once your client pays their first invoice.
          </EmptyState>
        ) : (
          <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200">
            {payouts.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="text-sm font-black text-black">{clientFor(p)}</p>
                  <p className="text-[11px] font-medium text-gray-500">
                    {p.status === 'sent' ? `Sent ${formatDate(p.sentAt)} · ref ${p.providerRef}` : `Queued ${formatDate(p.createdAt)}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={p.status} label={p.status === 'sent' ? 'Paid' : 'Processing'} />
                  <p className="text-base font-black text-black">
                    <Money value={p.amount} currency={p.currency} />
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <aside className="h-fit rounded-[2rem] border border-gray-200 bg-white p-6 shadow-xl">
        <p className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-gray-900">
          <Landmark size={15} className="text-red" /> Payout details
        </p>
        {!hasEngagement ? (
          <p className="mt-3 text-sm font-medium text-gray-500">You can add payout details once a client hires you through BYG Hires.</p>
        ) : !editing && account ? (
          <div className="mt-4">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-black text-black">{account.maskedLabel}</p>
              <p className="mt-1 text-[11px] font-medium text-gray-500">{account.details?.accountHolder}</p>
              <div className="mt-3">
                {account.status === 'verified' ? (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                    <ShieldCheck size={13} /> Verified
                  </span>
                ) : (
                  <StatusBadge status="pending" label="Awaiting verification" />
                )}
              </div>
            </div>
            <button type="button" onClick={() => setEditing(true)} className={`${btn.secondary} mt-4 w-full`}>
              Update details
            </button>
            <p className="mt-3 text-[11px] font-medium text-gray-500">Changing details pauses payouts until BYG re-verifies them.</p>
          </div>
        ) : (
          <form onSubmit={save} className="mt-4 space-y-4">
            <Field label="Method">
              <select className={inputClass} value={form.method} onChange={set('method')}>
                {METHODS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Account holder name">
              <input className={inputClass} required value={form.accountHolder} onChange={set('accountHolder')} />
            </Field>
            {form.method === 'bank' ? (
              <>
                <Field label="Bank name">
                  <input className={inputClass} required value={form.bankName} onChange={set('bankName')} />
                </Field>
                <Field label="IBAN" hint="Or fill the account number below">
                  <input className={inputClass} value={form.iban} onChange={set('iban')} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Account no.">
                    <input className={inputClass} value={form.accountNumber} onChange={set('accountNumber')} />
                  </Field>
                  <Field label="SWIFT / BIC">
                    <input className={inputClass} value={form.swift} onChange={set('swift')} />
                  </Field>
                </div>
              </>
            ) : (
              <Field label={`${METHODS.find((m) => m.id === form.method)?.label} email`}>
                <input className={inputClass} type="email" required value={form.email} onChange={set('email')} />
              </Field>
            )}
            <Field label="Country">
              <input className={inputClass} value={form.country} onChange={set('country')} />
            </Field>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className={`${btn.accent} flex-1`}>
                <BusyLabel busy={busy} busyText="Saving…">
                  Save details
                </BusyLabel>
              </button>
              {account ? (
                <button type="button" onClick={() => setEditing(false)} className={btn.secondary}>
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        )}
      </aside>
    </div>
  );
}
