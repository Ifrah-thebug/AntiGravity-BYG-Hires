const { createWorkforceEngine } = require('../src/services/workforce/engine');

const CLIENT = 'ap@acme.com';
const TALENT = 'alex@example.com';

function hireAndSign(engine, overrides = {}) {
  const { engagement, contract } = engine.createEngagement({
    talentEmail: TALENT,
    talentName: 'Alex',
    clientName: 'Acme',
    clientEmail: CLIENT,
    salaryAmount: 4000,
    bygFeePercent: 10,
    startDate: '2026-01-31',
    ...overrides,
  });
  expect(contract.aiReviewStatus).toBe('pass');
  engine.signContract(contract.id, 'client', { signatureData: 'Client Signer', consent: true, signerEmail: overrides.clientEmail || CLIENT });
  engine.signContract(contract.id, 'talent', { signatureData: 'Talent Signer', consent: true, signerEmail: overrides.talentEmail || TALENT });
  const signed = engine.signContract(contract.id, 'byg', { signatureData: 'BYG Ops', consent: true, signerEmail: 'ops@byghires.com' });
  return { engagement, contract: signed, invoice: signed.invoice };
}

describe('Workforce HRIS engine', () => {
  let engine;

  beforeEach(() => {
    engine = createWorkforceEngine();
  });

  describe('engagements', () => {
    test('creates engagement with salary schedule and a reviewed contract', () => {
      const { engagement, salary, contract, created } = engine.createEngagement({
        talentEmail: TALENT,
        clientName: 'Acme',
        clientEmail: CLIENT,
        salaryAmount: 4200,
      });
      expect(created).toBe(true);
      expect(engagement.status).toBe('contracted');
      expect(salary.amount).toBe(4200);
      expect(contract.status).toBe('ready_to_sign');
    });

    test('idempotent for the same talent + client email', () => {
      const a = engine.createEngagement({ talentEmail: TALENT, clientName: 'Acme', clientEmail: CLIENT, salaryAmount: 1000 });
      const b = engine.createEngagement({ talentEmail: 'ALEX@example.com', clientName: 'Acme Inc', clientEmail: CLIENT, salaryAmount: 2000 });
      expect(b.created).toBe(false);
      expect(b.engagement.id).toBe(a.engagement.id);
    });

    test('rejects invalid email, salary and dates', () => {
      expect(() => engine.createEngagement({ talentEmail: 'nope', clientName: 'Acme', salaryAmount: 1 })).toThrow(/Valid talent email/);
      expect(() => engine.createEngagement({ talentEmail: 'a@b.com', clientName: 'Acme', salaryAmount: -1 })).toThrow(/greater than 0/i);
      expect(() =>
        engine.createEngagement({ talentEmail: 'a@b.com', clientName: 'Acme', salaryAmount: 1, startDate: '2026-02-30' })
      ).toThrow(/YYYY-MM-DD/);
    });

    test('cannot activate without signed contract; can pause and end', () => {
      const { engagement } = engine.createEngagement({ talentEmail: 'a@b.com', clientName: 'Acme', clientEmail: CLIENT, salaryAmount: 500 });
      expect(() => engine.updateEngagementStatus(engagement.id, 'active')).toThrow(/signed contract/);
      const { engagement: e2 } = hireAndSign(engine);
      expect(engine.updateEngagementStatus(e2.id, 'paused').status).toBe('paused');
      const ended = engine.updateEngagementStatus(e2.id, 'ended', { reason: 'Project done', endDate: '2026-06-30' });
      expect(ended.endDate).toBe('2026-06-30');
      expect(() => engine.updateEngagementStatus(e2.id, 'active')).toThrow(/already ended/);
    });
  });

  describe('contracts + signing', () => {
    test('flags salary mismatch as needs_fixes', () => {
      const { contract } = engine.createEngagement({ talentEmail: TALENT, clientName: 'Acme', clientEmail: CLIENT, salaryAmount: 4200 });
      engine.fillContract(contract.id, { salary_amount: '999' });
      expect(engine.reviewContract(contract.id).aiReviewStatus).toBe('needs_fixes');
    });

    test('only the engagement parties can sign for their role', () => {
      const { contract } = engine.createEngagement({ talentEmail: TALENT, clientName: 'Acme', clientEmail: CLIENT, salaryAmount: 3000 });
      const sig = { signatureData: 'Mallory', consent: true };
      expect(() => engine.signContract(contract.id, 'client', { ...sig, signerEmail: 'mallory@evil.com' })).toThrow(/Only the client/);
      expect(() => engine.signContract(contract.id, 'client', { ...sig, signerEmail: TALENT })).toThrow(/Only the client/);
      expect(() => engine.signContract(contract.id, 'talent', { ...sig, signerEmail: CLIENT })).toThrow(/Only the talent/);
    });

    test('blocks sign without consent or with a malformed signature image', () => {
      const { contract } = engine.createEngagement({ talentEmail: TALENT, clientName: 'Acme', clientEmail: CLIENT, salaryAmount: 3000 });
      expect(() => engine.signContract(contract.id, 'talent', { signatureData: 'Alex', consent: false, signerEmail: TALENT })).toThrow(/Consent/);
      expect(() =>
        engine.signContract(contract.id, 'talent', { signatureData: 'data:image/png" onerror="x', consent: true, signerEmail: TALENT })
      ).toThrow(/signature/i);
    });

    test('contract fields are HTML-escaped', () => {
      const { contract } = engine.createEngagement({
        talentEmail: TALENT,
        clientName: 'Acme',
        clientEmail: CLIENT,
        salaryAmount: 3000,
        roleTitle: '<img src=x onerror=alert(1)>',
      });
      expect(contract.renderedHtml).not.toContain('<img src=x');
      expect(contract.renderedHtml).toContain('&lt;img src=x');
    });

    test('three signatures activate the engagement and issue period 0', () => {
      const { engagement, contract, invoice } = hireAndSign(engine);
      expect(contract.status).toBe('signed');
      expect(engine.getEngagement(engagement.id).status).toBe('active');
      expect(invoice).toMatchObject({ periodIndex: 0, periodStart: '2026-01-31', periodEnd: '2026-02-27', total: 4400 });
    });
  });

  describe('billing', () => {
    test('recurring billing is anchored, in advance, and never duplicates', () => {
      const { engagement } = hireAndSign(engine);
      const first = engine.issueDueInvoices({ asOf: '2026-03-25', leadDays: 7 });
      expect(first.issued.map((i) => [i.periodStart, i.periodEnd])).toEqual([
        ['2026-02-28', '2026-03-30'],
        ['2026-03-31', '2026-04-29'],
      ]);
      expect(engine.issueDueInvoices({ asOf: '2026-03-25', leadDays: 7 }).issued).toHaveLength(0);
      expect(engine.listInvoices({ engagementId: engagement.id })).toHaveLength(3);
    });

    test('paused and ended engagements stop billing', () => {
      const { engagement } = hireAndSign(engine);
      engine.updateEngagementStatus(engagement.id, 'paused');
      expect(engine.issueDueInvoices({ asOf: '2026-12-31' }).issued).toHaveLength(0);
    });

    test('paid invoices cannot be voided', () => {
      const { invoice } = hireAndSign(engine);
      engine.payInvoice(invoice.id, { method: 'manual' });
      expect(() => engine.voidInvoice(invoice.id)).toThrow(/cannot be voided/);
    });
  });

  describe('payments, wallet, payouts, ledger', () => {
    test('manual pay → payout → release balances the ledger', () => {
      const { invoice } = hireAndSign(engine);
      const { payoutId } = engine.payInvoice(invoice.id, { method: 'manual', providerRef: 'WIRE-1' });
      expect(engine.ledgerBalance('cash')).toBe(4400);
      expect(engine.ledgerBalance('talent_payable')).toBe(4000);
      expect(engine.ledgerBalance('byg_fee_revenue')).toBe(400);
      expect(() => engine.payInvoice(invoice.id, { method: 'manual' })).toThrow(/already paid/i);

      const payout = engine.releasePayout(payoutId, { reference: 'BANK-123' });
      expect(payout).toMatchObject({ status: 'sent', providerRef: 'BANK-123' });
      expect(() => engine.releasePayout(payoutId, { reference: 'again' })).toThrow(/not pending/);
      expect(engine.ledgerBalance('talent_payable')).toBe(0);
      expect(engine.ledgerBalance('cash')).toBe(400);
    });

    test('wallet pay requires balance and ownership; zero fee posts no fee line', () => {
      const { invoice } = hireAndSign(engine, { bygFeePercent: 0 });
      expect(() => engine.payInvoice(invoice.id, { method: 'wallet', payerEmail: CLIENT })).toThrow(/top up/);
      engine.walletCredit({ ownerEmail: CLIENT, currency: 'USD', amount: 5000, memo: 'wire' });
      expect(() => engine.payInvoice(invoice.id, { method: 'wallet', payerEmail: 'evil@x.com' })).toThrow(/Not your invoice/);
      engine.payInvoice(invoice.id, { method: 'wallet', payerEmail: CLIENT });
      expect(engine.listWallets(CLIENT)[0].balance).toBe(1000);
      expect(engine.ledgerBalance('client_prepaid')).toBe(1000);
      expect(engine.db.ledgerEntries.some((e) => e.accountCode === 'byg_fee_revenue')).toBe(false);
    });

    test('Tap: amount must match, capture applies once, late capture credits wallet', () => {
      const { invoice } = hireAndSign(engine);
      engine.recordTapCharge({ id: 'chg_1', purpose: 'invoice_pay', ownerEmail: CLIENT, invoiceId: invoice.id, amount: 4400, currency: 'USD' });
      expect(() => engine.fulfillTapCharge('chg_1', 1, 'USD')).toThrow(/mismatch/);
      expect(engine.fulfillTapCharge('chg_1', 4400, 'usd').invoice.status).toBe('paid');
      expect(engine.fulfillTapCharge('chg_1', 4400, 'USD').duplicate).toBe(true);

      engine.recordTapCharge({ id: 'chg_2', purpose: 'invoice_pay', ownerEmail: CLIENT, invoiceId: invoice.id, amount: 4400, currency: 'USD' });
      expect(engine.fulfillTapCharge('chg_2', 4400, 'USD').creditedToWallet).toBe(true);
      expect(engine.listWallets(CLIENT)[0].balance).toBe(4400);
    });

    test('verifying payout details attaches them to pending payouts', () => {
      const { invoice } = hireAndSign(engine);
      const { payoutId } = engine.payInvoice(invoice.id, { method: 'manual' });
      const acct = engine.savePayoutAccount(TALENT, { details: { method: 'wise', email: 'a@wise.com' }, maskedLabel: 'Wise' });
      expect(acct.status).toBe('pending');
      engine.verifyPaymentAccount(acct.id);
      expect(engine.db.payouts.find((p) => p.id === payoutId).paymentAccountId).toBe(acct.id);
    });
  });

  describe('hire bridge soft behavior', () => {
    test('workforceService.tryCreateEngagementFromHire never throws', async () => {
      const workforceService = require('../src/services/workforceService');
      const ok = await workforceService.tryCreateEngagementFromHire(
        { id: 'p1', talentEmail: 'bridge@example.com', talentName: 'Bridge' },
        { clientName: 'Client Co', salaryAmount: 2500 }
      );
      expect(ok?.engagement?.talentEmail).toBe('bridge@example.com');
      const bad = await workforceService.tryCreateEngagementFromHire({ id: 'p2', talentEmail: 'bad' }, { clientName: 'X', salaryAmount: 100 });
      expect(bad).toBeNull();
    });
  });
});
