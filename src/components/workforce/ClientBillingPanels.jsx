import React, { useState } from 'react';
import { CreditCard, FileDown, Landmark, Receipt, Wallet, Zap } from 'lucide-react';
import {
  fetchMyInvoiceDocument,
  payInvoiceManually,
  payInvoiceWithTap,
  payInvoiceWithWallet,
  setWalletAutoPay,
  topUpWallet,
} from '../../lib/workforceApi';
import { openInvoicePdf } from '../../lib/openInvoicePdf';
import { BusyLabel, Card, EmptyState, Field, Money, SectionTitle, StatusBadge, btn, formatDate, inputClass } from './WorkforceUi';

const BILLING_EMAIL = import.meta.env.VITE_WORKFORCE_BILLING_EMAIL || '';

export function InvoicesPanel({ invoices, wallets, engagements, tapConfigured, run, busy }) {
  const balance = (currency) => wallets.find((w) => w.currency === currency)?.balance || 0;
  const talentFor = (inv) => engagements.find((e) => e.id === inv.engagementId)?.talentName;
  const sorted = [...invoices].sort((a, b) => {
    const rank = (i) => (i.status === 'sent' ? 0 : i.status === 'paid' ? 1 : 2);
    return rank(a) - rank(b) || (a.createdAt < b.createdAt ? 1 : -1);
  });

  const payManual = (inv) => {
    const reference = window.prompt(
      'Optional payment reference (bank transfer ID, cheque no., or leave blank for test):',
      ''
    );
    if (reference === null) return; // cancelled
    run(
      `manual-${inv.id}`,
      () => payInvoiceManually(inv.id, { reference: reference.trim() || undefined, note: 'Client manual / test payment' }),
      'Manual payment recorded — BYG Hires will release the talent payout.'
    );
  };

  return (
    <Card>
      <SectionTitle
        icon={Receipt}
        title="Invoices"
        hint="Pay by card, wallet, or mark a manual/offline payment (BYG confirms and pays the talent)."
      />
      {sorted.length === 0 ? (
        <EmptyState icon={Receipt} title="No invoices yet">
          Your first invoice is issued as soon as you, the talent and BYG Hires have all signed the contract.
        </EmptyState>
      ) : (
        <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200">
          {sorted.map((inv) => {
            const unpaid = inv.status === 'sent';
            const canWallet = balance(inv.currency) >= inv.total;
            return (
              <div key={inv.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-black text-black">{inv.invoiceNumber}</p>
                    <StatusBadge status={inv.status} />
                  </div>
                  <p className="mt-1 text-[11px] font-medium text-gray-500">
                    {talentFor(inv) ? `${talentFor(inv)} · ` : ''}
                    {inv.periodStart ? `${formatDate(inv.periodStart)} – ${formatDate(inv.periodEnd)}` : formatDate(inv.createdAt)}
                    {unpaid ? ` · due ${formatDate(inv.dueDate)}` : inv.paidAt ? ` · paid ${formatDate(inv.paidAt)} via ${inv.paymentProvider}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <p className="mr-2 text-base font-black text-black">
                    <Money value={inv.total} currency={inv.currency} />
                  </p>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => run(`pdf-${inv.id}`, async () => openInvoicePdf((await fetchMyInvoiceDocument(inv.id)).printHtml))}
                    className={btn.small}
                  >
                    <FileDown size={12} /> PDF
                  </button>
                  {unpaid && tapConfigured ? (
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() =>
                        run(`tap-${inv.id}`, async () => {
                          const res = await payInvoiceWithTap(inv.id);
                          window.location.assign(res.redirectUrl);
                        })
                      }
                      className={btn.smallDark}
                    >
                      <BusyLabel busy={busy === `tap-${inv.id}`} busyText="Opening…">
                        <CreditCard size={12} /> Pay by card
                      </BusyLabel>
                    </button>
                  ) : null}
                  {unpaid ? (
                    <button
                      type="button"
                      disabled={!!busy || !canWallet}
                      title={canWallet ? 'Pay from wallet balance' : 'Top up your wallet first'}
                      onClick={() => run(`wallet-${inv.id}`, () => payInvoiceWithWallet(inv.id), 'Invoice paid from your wallet.')}
                      className={btn.small}
                    >
                      <BusyLabel busy={busy === `wallet-${inv.id}`} busyText="Paying…">
                        <Wallet size={12} /> Pay from wallet
                      </BusyLabel>
                    </button>
                  ) : null}
                  {unpaid ? (
                    <button
                      type="button"
                      disabled={!!busy}
                      title="Mark as paid offline / for testing — notifies BYG Hires"
                      onClick={() => payManual(inv)}
                      className={btn.small}
                    >
                      <BusyLabel busy={busy === `manual-${inv.id}`} busyText="Recording…">
                        <Landmark size={12} /> Pay manually
                      </BusyLabel>
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export function WalletPanel({ wallets, transactions, currencies, tapConfigured, run, busy }) {
  const [amount, setAmount] = useState('1000');
  const [currency, setCurrency] = useState(wallets[0]?.currency || 'USD');
  const list = wallets.length ? wallets : [{ id: 'empty', currency: 'USD', balance: 0, autoPay: false }];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <Card>
        <SectionTitle
          icon={Wallet}
          title="BYG wallet"
          hint="Prepay into your BYG Hires wallet. With auto-pay on, each new invoice is settled from your balance and the talent is paid on time."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((w) => (
            <div key={w.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{w.currency} balance</p>
              <p className="mt-2 text-3xl font-black tracking-tight text-black">
                <Money value={w.balance} currency={w.currency} />
              </p>
              <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-700">
                  <Zap size={13} className={w.autoPay ? 'text-red' : 'text-gray-300'} /> Auto-pay invoices
                </span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#ff3d3d]"
                  checked={Boolean(w.autoPay)}
                  disabled={!!busy}
                  onChange={(e) =>
                    run(
                      `auto-${w.currency}`,
                      () => setWalletAutoPay(w.currency, e.target.checked),
                      e.target.checked ? `Auto-pay is on for ${w.currency} invoices.` : 'Auto-pay turned off.'
                    )
                  }
                />
              </label>
            </div>
          ))}
        </div>

        <p className="mb-3 mt-8 text-[10px] font-black uppercase tracking-widest text-gray-400">Recent activity</p>
        {transactions.length === 0 ? (
          <p className="text-sm font-medium text-gray-500">No wallet activity yet.</p>
        ) : (
          <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-black">{t.memo || (t.kind === 'topup' ? 'Top-up' : 'Invoice payment')}</p>
                  <p className="text-[11px] font-medium text-gray-500">{formatDate(t.createdAt)}</p>
                </div>
                <p className={`text-sm font-black ${t.kind === 'topup' ? 'text-emerald-700' : 'text-black'}`}>
                  {t.kind === 'topup' ? '+' : '−'}
                  <Money value={t.amount} currency={t.currency} />
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <aside className="h-fit space-y-4">
        <div className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-xl">
          <p className="text-sm font-black uppercase tracking-widest text-gray-900">Add funds</p>
          {tapConfigured ? (
            <>
              <div className="mt-4 grid grid-cols-[1fr_6.5rem] gap-3">
                <Field label="Amount">
                  <input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </Field>
                <Field label="Currency">
                  <select className={inputClass} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    {currencies.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <button
                type="button"
                disabled={!!busy || !(Number(amount) > 0)}
                onClick={() =>
                  run('topup', async () => {
                    const res = await topUpWallet(Number(amount), currency);
                    window.location.assign(res.redirectUrl);
                  })
                }
                className={`${btn.accent} mt-5 w-full`}
              >
                <BusyLabel busy={busy === 'topup'} busyText="Opening checkout…">
                  <CreditCard size={14} /> Top up by card
                </BusyLabel>
              </button>
              <p className="mt-3 text-[11px] font-medium text-gray-500">Secure checkout by Tap Payments. Funds appear instantly.</p>
            </>
          ) : (
            <p className="mt-3 text-sm font-medium text-gray-500">Card top-ups are being enabled. Use a bank transfer in the meantime.</p>
          )}
        </div>
        {BILLING_EMAIL ? (
          <div className="rounded-[2rem] border border-gray-200 bg-white p-6">
            <p className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-gray-900">
              <Landmark size={15} className="text-red" /> Bank transfer
            </p>
            <p className="mt-3 text-sm font-medium text-gray-500">
              For larger amounts, wire funds to BYG Hires and we&apos;ll credit your wallet. Email{' '}
              <a className="font-bold text-red hover:underline" href={`mailto:${BILLING_EMAIL}`}>
                {BILLING_EMAIL}
              </a>{' '}
              for bank details.
            </p>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
