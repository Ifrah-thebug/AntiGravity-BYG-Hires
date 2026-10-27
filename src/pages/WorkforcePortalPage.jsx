import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Banknote,
  Briefcase,
  FileSignature,
  LayoutDashboard,
  Receipt,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  updateContractTerms,
  fetchMyClient,
  fetchMyJobs,
  fetchMyPayoutAccount,
  fetchMyPayouts,
  fetchMyTalentOptions,
  fetchMyWallet,
  fetchMyWorkforceEngagements,
  fetchMyWorkforceInvoices,
  signWorkforceContract,
} from '../lib/workforceApi';
import ContractSignCard from '../components/workforce/ContractSignCard';
import ContractRow from '../components/workforce/ContractViewer';
import ClientHireWizard from '../components/workforce/ClientHireWizard';
import ClientJobsPanel from '../components/workforce/ClientJobsPanel';
import { InvoicesPanel, WalletPanel } from '../components/workforce/ClientBillingPanels';
import TalentPayoutsPanel from '../components/workforce/TalentPayoutsPanel';
import {
  Card,
  EmptyState,
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
  useAsyncRunner,
} from '../components/workforce/WorkforceUi';

const TAP_MESSAGES = {
  success: ['success', 'Payment received — thank you. Your balance and invoices are up to date.'],
  pending: ['success', 'Your payment is still processing. Refresh in a minute to see it here.'],
  failed: ['error', 'The payment did not go through. No money was taken — please try again.'],
  missing: ['error', 'We could not match that payment. If you were charged, contact BYG Hires.'],
};

function readParams() {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function clearParams(keys) {
  const params = readParams();
  keys.forEach((k) => params.delete(k));
  const qs = params.toString();
  window.history.replaceState({}, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
}

/** Sums each currency separately so mixed-currency teams stay honest. */
function sumByCurrency(rows, amountOf) {
  const m = new Map();
  for (const r of rows) {
    const cur = r.currency || r.salary?.currency || 'USD';
    m.set(cur, (m.get(cur) || 0) + amountOf(r));
  }
  return [...m.entries()];
}

function MoneyList({ entries }) {
  if (!entries.length) return <Money value={0} />;
  return entries.map(([cur, v], i) => (
    <span key={cur}>
      {i ? ' · ' : ''}
      <Money value={v} currency={cur} />
    </span>
  ));
}

export default function WorkforcePortalPage({ roleHint = 'talent' }) {
  const isClient = roleHint === 'client';
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState(() => readParams().get('tab'));
  const [loaded, setLoaded] = useState(false);
  const [accessError, setAccessError] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [engagements, setEngagements] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [client, setClient] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [walletTxns, setWalletTxns] = useState([]);
  const [talent, setTalent] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [payoutAccount, setPayoutAccount] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [hireTarget, setHireTarget] = useState(() => {
    const p = readParams();
    return p.get('hire') ? { talentId: p.get('hire'), jobId: p.get('job') || null, nonce: Date.now() } : null;
  });

  const reload = useCallback(async () => {
    try {
      const mine = await fetchMyWorkforceEngagements();
      setEngagements(mine.engagements || []);
      setContracts(mine.contracts || []);
      if (isClient) {
        const me = await fetchMyClient();
        setClient(me);
        const [inv, wal, tal, jb] = await Promise.all([
          fetchMyWorkforceInvoices(),
          fetchMyWallet(),
          fetchMyTalentOptions().catch(() => ({ talent: [] })),
          fetchMyJobs().catch(() => ({ jobs: [] })),
        ]);
        setInvoices(inv.invoices || []);
        setWallets(wal.wallets || []);
        setWalletTxns(wal.transactions || []);
        setTalent(tal.talent || []);
        setJobs(jb.jobs || []);
      } else {
        const [acct, pay] = await Promise.all([fetchMyPayoutAccount(), fetchMyPayouts()]);
        setPayoutAccount(acct.account || null);
        setPayouts(pay.payouts || []);
      }
      setAccessError(null);
    } catch (err) {
      if (['CLIENT_ACCOUNT_REQUIRED', 'CLIENT_ACTIVATION_REQUIRED', 'SIGN_IN_REQUIRED'].includes(err.code)) {
        setAccessError(err);
      } else {
        setError(err.message || 'Could not load your workspace.');
      }
    } finally {
      setLoaded(true);
    }
  }, [isClient]);

  const { busy, run } = useAsyncRunner({ onError: setError, onSuccess: setSuccess, reload });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoaded(true);
      return;
    }
    reload();
  }, [authLoading, user, reload]);

  // Tap redirect return + deep-link cleanup.
  useEffect(() => {
    const params = readParams();
    const tap = params.get('tap');
    if (tap && TAP_MESSAGES[tap]) {
      const [kind, msg] = TAP_MESSAGES[tap];
      (kind === 'error' ? setError : setSuccess)(msg);
    }
    if (params.get('hire')) setTab('hire');
    clearParams(['tap', 'purpose', 'status', 'msg', 'hire', 'job', 'name', 'email', 'tab']);
  }, []);

  const needsMySig = useMemo(
    () =>
      contracts.filter((c) => {
        if (!['ready_to_sign', 'partially_signed'].includes(c.status)) return false;
        const eng = engagements.find((e) => e.id === c.engagementId);
        if (!eng) return false;
        const myRole = isClient ? 'client' : 'talent';
        const isMine = isClient
          ? String(eng.clientEmail || '').toLowerCase() === String(user?.email || '').toLowerCase()
          : String(eng.talentEmail || '').toLowerCase() === String(user?.email || '').toLowerCase();
        return isMine && !(c.signatures || []).some((s) => s.role === myRole && s.signedAt);
      }),
    [contracts, engagements, isClient, user?.email]
  );

  const myEngagements = useMemo(() => {
    const email = String(user?.email || '').toLowerCase();
    return engagements.filter((e) => String(isClient ? e.clientEmail : e.talentEmail).toLowerCase() === email);
  }, [engagements, isClient, user?.email]);

  const unpaid = invoices.filter((i) => i.status === 'sent');
  const active = myEngagements.filter((e) => e.status === 'active');
  const openJobs = jobs.filter((j) => j.status === 'open');

  const tabs = isClient
    ? [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'jobs', label: 'Jobs', icon: Briefcase, count: openJobs.length },
        { id: 'hire', label: 'Hire', icon: UserPlus },
        { id: 'contracts', label: 'Contracts', icon: FileSignature, count: needsMySig.length },
        { id: 'invoices', label: 'Invoices', icon: Receipt, count: unpaid.length },
        { id: 'wallet', label: 'Wallet', icon: Wallet },
      ]
    : [
        { id: 'contracts', label: 'Contracts', icon: FileSignature, count: needsMySig.length },
        { id: 'roles', label: 'My roles', icon: Briefcase },
        { id: 'payouts', label: 'Payments', icon: Banknote },
      ];
  const activeTab = tabs.some((t) => t.id === tab) ? tab : isClient ? (needsMySig.length ? 'contracts' : 'overview') : 'contracts';

  const startHire = (talentId, jobId = null) => {
    setHireTarget({ talentId, jobId, nonce: Date.now() });
    setTab('hire');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sign = (contract) => (payload) =>
    run(
      `sign-${contract.id}`,
      () => signWorkforceContract(contract.id, { role: isClient ? 'client' : 'talent', ...payload }),
      (res) =>
        res.contract?.status === 'signed'
          ? 'Contract fully signed — welcome aboard!'
          : 'Signed. We’ll notify you when the other parties have signed.'
    );

  const changeTerms = (contract) => async (terms) => {
    const res = await run(
      `date-${contract.id}`,
      () => updateContractTerms(contract.id, terms),
      (r) =>
        r.clearedRoles?.length
          ? 'Contract updated and talent emailed. Earlier signatures were cleared — they must sign again.'
          : 'Contract updated — talent has been emailed to review and sign.'
    );
    return Boolean(res);
  };

  const myContracts = contracts.filter((c) => myEngagements.some((e) => e.id === c.engagementId) && c.status !== 'void');

  // ── Gates ──
  if (authLoading || (!loaded && user)) {
    return (
      <div className="min-h-screen bg-white px-4 pt-20 font-sans">
        <Spinner />
      </div>
    );
  }

  if (!user || accessError) {
    const code = accessError?.code;
    return (
      <div className="min-h-screen bg-white px-4 pb-24 pt-28 font-sans">
        <div className="mx-auto max-w-lg">
          <EmptyState
            icon={FileSignature}
            title={
              code === 'CLIENT_ACTIVATION_REQUIRED'
                ? 'Activate your client account'
                : code === 'CLIENT_ACCOUNT_REQUIRED'
                  ? 'This workspace is for hiring clients'
                  : 'Sign in to continue'
            }
            action={
              code === 'CLIENT_ACCOUNT_REQUIRED' ? (
                <Link to="/talent" className={btn.primary}>
                  Browse talent <ArrowRight size={14} />
                </Link>
              ) : code === 'CLIENT_ACTIVATION_REQUIRED' ? null : (
                <button type="button" onClick={() => navigate('/login')} className={btn.primary}>
                  Sign in <ArrowRight size={14} />
                </button>
              )
            }
          >
            {accessError?.message ||
              (isClient
                ? 'Sign in with your client account to hire talent, sign contracts and manage invoices.'
                : 'Sign in with the email your contract was sent to.')}
          </EmptyState>
        </div>
      </div>
    );
  }

  const contractCards = (list) =>
    list.map((c) => {
      const eng = engagements.find((e) => e.id === c.engagementId);
      return (
        <ContractSignCard
          key={c.id}
          contract={c}
          engagement={eng}
          role={isClient ? 'client' : 'talent'}
          busy={busy === `sign-${c.id}`}
          onSign={sign(c)}
          counterpartLabel={isClient ? eng?.talentName || 'Your hire' : eng?.clientName || 'Client'}
          onChangeTerms={isClient ? changeTerms(c) : undefined}
          warnTalentEmail={isClient}
          dateBusy={busy === `date-${c.id}`}
        />
      );
    });

  const teamList = (
    <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200">
      {myEngagements.map((e) => {
        const c = contracts.find((x) => x.engagementId === e.id);
        return (
          <div key={e.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-black text-black">{isClient ? e.talentName || 'Talent' : e.clientName}</p>
                <StatusBadge status={e.status} />
              </div>
              <p className="mt-1 text-[11px] font-medium text-gray-500">
                {e.roleTitle} · started {formatDate(e.startDate)}
                {e.endDate ? ` · ends ${formatDate(e.endDate)}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {c && c.status !== 'signed' ? <SignatureSteps signatures={c.signatures} /> : null}
              <p className="text-sm font-black text-black">
                <Money value={e.salary?.amount} currency={e.salary?.currency} />
                <span className="text-[11px] font-medium text-gray-400"> / {e.salary?.cadence}</span>
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-white px-4 pb-24 pt-20 font-sans">
      <div className="mx-auto max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <PageHeader
            eyebrow={isClient ? 'Client workspace' : 'Talent workspace'}
            title={isClient ? 'Hire, sign & pay' : 'Your contracts & payments'}
            subtitle={
              isClient
                ? 'Post roles, hire the talent you interviewed, sign contracts and keep billing on autopilot.'
                : 'Sign your BYG Hires contracts, see your roles and track every payment.'
            }
            actions={
              isClient ? (
                <>
                  <Link to="/client" className={btn.secondary}>
                    Calls & intros
                  </Link>
                  <button type="button" onClick={() => setTab('hire')} className={btn.accent}>
                    <UserPlus size={14} /> Hire talent
                  </button>
                </>
              ) : (
                <Link to="/portal" className={btn.secondary}>
                  My portal
                </Link>
              )
            }
          />
        </motion.div>

        {needsMySig.length > 0 && activeTab !== 'contracts' ? (
          <button
            type="button"
            onClick={() => setTab('contracts')}
            className="mb-6 flex w-full items-center justify-between gap-3 rounded-2xl border border-red/20 bg-red/5 px-5 py-4 text-left transition-colors hover:border-red/40"
          >
            <span>
              <span className="block text-[10px] font-black uppercase tracking-widest text-red">Action needed</span>
              <span className="mt-1 block text-sm font-black text-black">
                {needsMySig.length} contract{needsMySig.length > 1 ? 's' : ''} waiting for your signature
              </span>
            </span>
            <ArrowRight size={16} className="text-red" />
          </button>
        ) : null}

        <Notice kind="error" onDismiss={() => setError('')}>
          {error}
        </Notice>
        <Notice kind="success" onDismiss={() => setSuccess('')}>
          {success}
        </Notice>

        <Tabs tabs={tabs} active={activeTab} onChange={setTab} />

        {/* ── Client: overview ── */}
        {isClient && activeTab === 'overview' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Active hires" value={active.length} icon={Users} onClick={() => setTab('contracts')} />
              <StatTile
                label="Recurring cost"
                value={<MoneyList entries={sumByCurrency(active, (e) => (e.salary?.amount || 0) * (1 + (e.salary?.bygFeePercent || 0) / 100))} />}
                hint="Per billing period, incl. fee"
              />
              <StatTile
                label="Unpaid"
                value={<MoneyList entries={sumByCurrency(unpaid, (i) => i.total)} />}
                hint={`${unpaid.length} invoice${unpaid.length === 1 ? '' : 's'}`}
                tone={unpaid.length ? 'alert' : 'default'}
                icon={Receipt}
                onClick={() => setTab('invoices')}
              />
              <StatTile
                label="Wallet"
                value={<MoneyList entries={wallets.map((w) => [w.currency, w.balance])} />}
                hint={wallets.some((w) => w.autoPay) ? 'Auto-pay on' : 'Auto-pay off'}
                icon={Wallet}
                onClick={() => setTab('wallet')}
              />
            </div>
            <Card>
              <SectionTitle
                icon={Users}
                title="Your team"
                action={
                  <button type="button" onClick={() => setTab('hire')} className={btn.small}>
                    <UserPlus size={12} /> Hire
                  </button>
                }
              />
              {myEngagements.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No hires yet"
                  action={
                    <button type="button" onClick={() => setTab('hire')} className={btn.primary}>
                      Hire your first talent <ArrowRight size={14} />
                    </button>
                  }
                >
                  After your intro calls, hire the talent you liked — we prepare the contract, invoicing and payouts.
                </EmptyState>
              ) : (
                teamList
              )}
            </Card>
          </div>
        ) : null}

        {/* ── Client: jobs ── */}
        {isClient && activeTab === 'jobs' ? (
          <ClientJobsPanel
            jobs={jobs}
            talent={talent}
            currencies={client?.currencies || ['USD']}
            onJobsChange={setJobs}
            onHire={startHire}
            onError={setError}
            onSuccess={setSuccess}
          />
        ) : null}

        {/* ── Client: hire ── */}
        {isClient && activeTab === 'hire' ? (
          <Card>
            <SectionTitle
              icon={UserPlus}
              title="Hire talent"
              hint="Choose who you want to hire and agree their pay. We prepare a three-party contract for you, the talent and BYG Hires."
            />
            <ClientHireWizard
              key={hireTarget?.nonce || 'hire'}
              talent={talent}
              jobs={jobs}
              defaultFeePercent={client?.defaultFeePercent ?? 0}
              currencies={client?.currencies || ['USD']}
              initialTalentId={hireTarget?.talentId || null}
              initialJobId={hireTarget?.jobId || null}
              onError={setError}
              onHired={async (res, picked) => {
                setHireTarget(null);
                setSuccess(
                  res.created
                    ? `Contract created for ${picked?.name || 'your hire'}. Sign it below — we've emailed them too.`
                    : `You already have an open engagement with ${picked?.name || 'this talent'}.`
                );
                await reload();
                setTab('contracts');
              }}
            />
          </Card>
        ) : null}

        {/* ── Contracts (both) ── */}
        {activeTab === 'contracts' ? (
          <div className="space-y-6">
            {needsMySig.length ? (
              contractCards(needsMySig)
            ) : (
              <EmptyState icon={FileSignature} title="Nothing to sign right now">
                {isClient
                  ? 'Contracts for new hires appear here for your signature.'
                  : 'When a client hires you through BYG Hires, your contract appears here.'}
              </EmptyState>
            )}
            {myContracts.length ? (
              <Card>
                <SectionTitle
                  icon={FileSignature}
                  title="All contracts"
                  hint="View or download any contract at any time — including fully signed ones."
                />
                <div className="space-y-3">
                  {myContracts.map((c) => {
                    const eng = engagements.find((e) => e.id === c.engagementId);
                    return (
                      <ContractRow
                        key={c.id}
                        contract={c}
                        engagement={eng}
                        counterpartLabel={isClient ? eng?.talentName || 'Your hire' : eng?.clientName || 'Client'}
                        canEditDate={isClient}
                        warnTalentEmail={isClient}
                        busy={busy === `date-${c.id}`}
                        onChangeTerms={changeTerms(c)}
                      />
                    );
                  })}
                </div>
              </Card>
            ) : null}
          </div>
        ) : null}

        {/* ── Talent: roles ── */}
        {!isClient && activeTab === 'roles' ? (
          <Card>
            <SectionTitle icon={Briefcase} title="My roles" />
            {myEngagements.length === 0 ? (
              <EmptyState icon={Briefcase} title="No roles yet">
                Keep your profile and availability up to date — clients hire straight from the directory.
              </EmptyState>
            ) : (
              teamList
            )}
          </Card>
        ) : null}

        {/* ── Talent: payouts ── */}
        {!isClient && activeTab === 'payouts' ? (
          <TalentPayoutsPanel
            account={payoutAccount}
            payouts={payouts}
            engagements={engagements}
            hasEngagement={myEngagements.length > 0}
            onSaved={setPayoutAccount}
            onError={setError}
            onSuccess={setSuccess}
          />
        ) : null}

        {/* ── Client: billing ── */}
        {isClient && activeTab === 'invoices' ? (
          <InvoicesPanel
            invoices={invoices}
            wallets={wallets}
            engagements={engagements}
            tapConfigured={Boolean(client?.tapConfigured)}
            billingClient={client?.client}
            onBillingClientSaved={(updated) =>
              setClient((prev) => (prev ? { ...prev, client: { ...prev.client, ...updated } } : prev))
            }
            run={run}
            busy={busy}
          />
        ) : null}
        {isClient && activeTab === 'wallet' ? (
          <WalletPanel
            wallets={wallets}
            transactions={walletTxns}
            currencies={client?.currencies || ['USD']}
            tapConfigured={Boolean(client?.tapConfigured)}
            run={run}
            busy={busy}
          />
        ) : null}
      </div>
    </div>
  );
}
