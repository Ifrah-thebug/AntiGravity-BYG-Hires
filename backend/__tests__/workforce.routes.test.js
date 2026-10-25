/**
 * HTTP-level checks for the Workforce routes on the in-memory store.
 * Auth is stubbed: `x-test-user` = signed-in email, `x-test-admin` = admin email.
 */
jest.mock('../src/middleware/requireUser', () => ({
  requireUser: (req, res, next) => {
    const email = req.headers['x-test-user'];
    if (!email) return res.status(401).json({ error: 'Authorization required.' });
    req.user = { id: `user-${email}`, email };
    return next();
  },
}));
jest.mock('../src/middleware/requireAdmin', () => ({
  supabaseAdmin: null,
  requireAdmin: (req, res, next) => {
    const email = req.headers['x-test-admin'];
    if (!email) return res.status(403).json({ error: 'Super admin access required.' });
    req.adminUser = { email };
    return next();
  },
}));
jest.mock('../src/services/workforce/notify');

const express = require('express');
const request = require('supertest');
const workforce = require('../src/services/workforceService');
const { createMemoryStore } = require('../src/services/workforce/engine');
const { addDays, addMonths, todayIso } = require('../src/services/workforce/periods');

const START = todayIso();
// One week before period 1 starts → exactly one new invoice is due.
const BILL_AS_OF = addDays(addMonths(START, 1), -7);

const CLIENT = 'ap@acme.com';
const TALENT = 'alex@example.com';
const OTHER = 'mallory@evil.com';

function app() {
  const a = express();
  a.use(express.json({ limit: '1mb' }));
  a.use('/api/workforce', require('../src/routes/workforce'));
  return a;
}

function seed() {
  const store = createMemoryStore();
  store.talentProfiles.push({ id: 'p-alex', userId: 'u-alex', email: TALENT, name: 'Alex', jobTitle: 'Support lead', suggestedSalary: 2500 });
  store.clients.push(
    { id: 'c-acme', userId: `user-${CLIENT}`, email: CLIENT, name: 'Acme', activated: true },
    { id: 'c-new', userId: 'user-new@co.com', email: 'new@co.com', name: 'NewCo', activated: false }
  );
  return store;
}

const as = (email) => ({ 'x-test-user': email });
const admin = { 'x-test-admin': 'ops@byghires.com' };

describe('Workforce routes', () => {
  let server;
  let store;

  beforeEach(() => {
    store = seed();
    workforce.resetMemoryStore(store);
    server = app();
  });

  async function clientHire(body = {}) {
    return request(server)
      .post('/api/workforce/me/hire')
      .set(as(CLIENT))
      .send({ talentId: 'p-alex', salaryAmount: 3000, startDate: START, roleTitle: 'Support lead', ...body });
  }

  async function contractId() {
    const res = await request(server).get('/api/workforce/me/engagements').set(as(CLIENT));
    return res.body.contracts[0].id;
  }

  const signBody = (role) => ({ role, signatureData: 'Full Name', consent: true });

  test('only activated clients reach client endpoints', async () => {
    expect((await request(server).get('/api/workforce/me/invoices')).status).toBe(401);
    expect((await request(server).get('/api/workforce/me/invoices').set(as(TALENT))).body.code).toBe('CLIENT_ACCOUNT_REQUIRED');
    expect((await request(server).get('/api/workforce/me/invoices').set(as('new@co.com'))).body.code).toBe('CLIENT_ACTIVATION_REQUIRED');
    expect((await request(server).get('/api/workforce/me/invoices').set(as(CLIENT))).status).toBe(200);
  });

  test('talent options for clients carry no contact details', async () => {
    const res = await request(server).get('/api/workforce/me/talent-options').set(as(CLIENT));
    expect(res.body.talent).toEqual([{ id: 'p-alex', name: 'Alex', jobTitle: 'Support lead', suggestedSalary: 2500 }]);
  });

  test('client hire resolves talent server-side and ignores a client-supplied fee', async () => {
    const res = await clientHire({ bygFeePercent: 0, talentEmail: OTHER });
    expect(res.status).toBe(201);
    expect(res.body.engagement.talentEmail).toBe(TALENT);
    expect(res.body.salary.bygFeePercent).toBe(10);
    expect((await clientHire({ talentId: 'nobody' })).body.code).toBe('TALENT_NOT_FOUND');
    expect((await clientHire({ startDate: addDays(START, -45) })).body.code).toBe('INVALID_DATE');
  });

  test('strangers and the wrong party cannot sign', async () => {
    await clientHire();
    const id = await contractId();
    expect((await request(server).post(`/api/workforce/contracts/${id}/sign`).set(as(OTHER)).send(signBody('client'))).status).toBe(403);
    expect((await request(server).post(`/api/workforce/contracts/${id}/sign`).set(as(TALENT)).send(signBody('client'))).status).toBe(403);
    expect((await request(server).post(`/api/workforce/contracts/${id}/sign`).set(as(CLIENT)).send(signBody('byg'))).status).toBe(400);
  });

  test('full flow: 3-party sign → invoice → wallet pay → payout released with reference', async () => {
    await clientHire();
    const id = await contractId();
    const c = await request(server).post(`/api/workforce/contracts/${id}/sign`).set(as(CLIENT)).send(signBody('client'));
    expect(c.status).toBe(200);
    const t = await request(server).post(`/api/workforce/contracts/${id}/sign`).set(as(TALENT)).send(signBody('talent'));
    expect(t.body.invoice).toBeNull();
    const b = await request(server).post(`/api/workforce/admin/contracts/${id}/sign`).set(admin).send({ signatureData: 'BYG Ops', consent: true });
    expect(b.body.contract.status).toBe('signed');
    const invoice = b.body.invoice;
    expect(invoice.total).toBe(3300);

    // Talent cannot see billing invoices.
    expect((await request(server).get(`/api/workforce/me/invoices/${invoice.id}`).set(as(TALENT))).status).toBe(403);

    expect((await request(server).post(`/api/workforce/me/invoices/${invoice.id}/pay-wallet`).set(as(CLIENT))).body.code).toBe('INSUFFICIENT_WALLET');
    const credit = await request(server)
      .post('/api/workforce/admin/wallets/credit')
      .set(admin)
      .send({ clientEmail: CLIENT, amount: 5000, currency: 'USD', reference: 'WIRE-77' });
    expect(credit.body.wallet.balance).toBe(5000);
    const paid = await request(server).post(`/api/workforce/me/invoices/${invoice.id}/pay-wallet`).set(as(CLIENT));
    expect(paid.body.invoice.status).toBe('paid');

    const payouts = await request(server).get('/api/workforce/admin/payouts').set(admin);
    const payout = payouts.body.payouts[0];
    expect(payout).toMatchObject({ status: 'pending', amount: 3000, talentEmail: TALENT });
    expect((await request(server).post(`/api/workforce/admin/payouts/${payout.id}/release`).set(admin).send({})).body.code).toBe('REFERENCE_REQUIRED');
    const released = await request(server).post(`/api/workforce/admin/payouts/${payout.id}/release`).set(admin).send({ reference: 'BANK-9' });
    expect(released.body.payout.status).toBe('sent');

    const mine = await request(server).get('/api/workforce/me/payouts').set(as(TALENT));
    expect(mine.body.payouts[0].providerRef).toBe('BANK-9');
  });

  test('client can move the start date until fully signed; signatures reset; signed contract stays visible', async () => {
    await clientHire();
    const id = await contractId();
    await request(server).post(`/api/workforce/contracts/${id}/sign`).set(as(TALENT)).send(signBody('talent'));

    const newDate = addDays(START, 14);
    expect((await request(server).patch(`/api/workforce/me/contracts/${id}/start-date`).set(as(TALENT)).send({ startDate: newDate })).status).toBe(403);
    const moved = await request(server).patch(`/api/workforce/me/contracts/${id}/start-date`).set(as(CLIENT)).send({ startDate: newDate });
    expect(moved.status).toBe(200);
    expect(moved.body.clearedRoles).toEqual(['talent']);
    expect(moved.body.engagement.startDate).toBe(newDate);
    expect(moved.body.contract).toMatchObject({ status: 'ready_to_sign', aiReviewStatus: 'pass' });
    expect(moved.body.contract.filledFields.start_date).toBe(newDate);

    await request(server).post(`/api/workforce/contracts/${id}/sign`).set(as(CLIENT)).send(signBody('client'));
    await request(server).post(`/api/workforce/contracts/${id}/sign`).set(as(TALENT)).send(signBody('talent'));
    const b = await request(server).post(`/api/workforce/admin/contracts/${id}/sign`).set(admin).send({ signatureData: 'BYG Ops', consent: true });
    expect(b.body.invoice.periodStart).toBe(newDate);

    expect((await request(server).patch(`/api/workforce/me/contracts/${id}/start-date`).set(as(CLIENT)).send({ startDate: START })).body.code).toBe('CONTRACT_LOCKED');
    for (const who of [CLIENT, TALENT]) {
      const mine = await request(server).get('/api/workforce/me/engagements').set(as(who));
      expect(mine.body.contracts[0]).toMatchObject({ status: 'signed' });
      expect(mine.body.contracts[0].renderedHtml).toContain('byg-signatures');
    }
  });

  test('auto-pay settles new invoices from the wallet during billing', async () => {
    await clientHire();
    const id = await contractId();
    await request(server).post('/api/workforce/admin/wallets/credit').set(admin).send({ clientEmail: CLIENT, amount: 20000, currency: 'USD', reference: 'WIRE-1' });
    await request(server).post('/api/workforce/me/wallet/auto-pay').set(as(CLIENT)).send({ currency: 'USD', autoPay: true });
    await request(server).post(`/api/workforce/contracts/${id}/sign`).set(as(CLIENT)).send(signBody('client'));
    await request(server).post(`/api/workforce/contracts/${id}/sign`).set(as(TALENT)).send(signBody('talent'));
    const b = await request(server).post(`/api/workforce/admin/contracts/${id}/sign`).set(admin).send({ signatureData: 'BYG Ops', consent: true });
    expect(b.body.invoice.status).toBe('paid');

    const run = await request(server).post('/api/workforce/admin/billing/run').set(admin).send({ asOf: BILL_AS_OF });
    expect(run.body).toMatchObject({ issued: 1, autoPaid: 1 });
    const again = await request(server).post('/api/workforce/admin/billing/run').set(admin).send({ asOf: BILL_AS_OF });
    expect(again.body.issued).toBe(0);
  });

  test('payout details: validated, masked, and only for talent with an engagement', async () => {
    const bad = await request(server).put('/api/workforce/me/payout-account').set(as(TALENT)).send({ method: 'bank', accountHolder: 'Alex' });
    expect(bad.body.code).toBe('FORBIDDEN');
    await clientHire();
    const missing = await request(server).put('/api/workforce/me/payout-account').set(as(TALENT)).send({ method: 'bank', accountHolder: 'Alex' });
    expect(missing.body.code).toBe('BANK_REQUIRED');
    const ok = await request(server)
      .put('/api/workforce/me/payout-account')
      .set(as(TALENT))
      .send({ method: 'bank', accountHolder: 'Alex', bankName: 'HBL', iban: 'PK36SCBL0000001123456702' });
    expect(ok.body.account).toMatchObject({ status: 'pending', maskedLabel: 'HBL •••• 6702' });
  });
});
