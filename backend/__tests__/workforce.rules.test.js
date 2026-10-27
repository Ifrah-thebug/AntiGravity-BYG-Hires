const { addMonths, periodBounds, duePeriodIndexes, isIsoDate } = require('../src/services/workforce/periods');
const { normalizeJobInput, assertStageChange } = require('../src/services/workforce/jobRules');

describe('billing periods', () => {
  test('monthly periods clamp like Postgres and stay anchored', () => {
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2024-01-31', 2)).toBe('2024-03-31');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    expect(periodBounds('2026-01-31', 'monthly', 0)).toEqual({ index: 0, start: '2026-01-31', end: '2026-02-27' });
    expect(periodBounds('2026-01-01', 'weekly', 1)).toEqual({ index: 1, start: '2026-01-08', end: '2026-01-14' });
    expect(periodBounds('2026-01-01', 'biweekly', 0).end).toBe('2026-01-14');
  });

  test('due periods respect lead time, end date and cap', () => {
    expect(duePeriodIndexes({ anchor: '2026-01-01', cadence: 'monthly', nextIndex: 1, asOf: '2026-01-24', leadDays: 7 })).toEqual([]);
    expect(duePeriodIndexes({ anchor: '2026-01-01', cadence: 'monthly', nextIndex: 1, asOf: '2026-01-25', leadDays: 7 })).toEqual([1]);
    expect(
      duePeriodIndexes({ anchor: '2026-01-01', cadence: 'monthly', nextIndex: 1, asOf: '2026-12-31', endDate: '2026-03-15' })
    ).toEqual([1, 2]);
    expect(duePeriodIndexes({ anchor: '2020-01-01', cadence: 'weekly', nextIndex: 0, asOf: '2026-01-01' })).toHaveLength(12);
  });

  test('isIsoDate rejects impossible dates', () => {
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2026-1-1')).toBe(false);
  });
});

describe('job rules', () => {
  test('normalizes and validates job input', () => {
    const job = normalizeJobInput({ title: '  Support lead ', skills: 'Zendesk, CRM, Zendesk', headcount: '2', budgetMin: '1000', budgetMax: 2000 });
    expect(job).toMatchObject({ title: 'Support lead', skills: ['Zendesk', 'CRM'], employmentType: 'full_time', currency: 'USD' });
    expect(() => normalizeJobInput({ title: 'x', headcount: 2 })).not.toThrow();
    expect(() => normalizeJobInput({})).toThrow(/title/);
    expect(() => normalizeJobInput({ title: 'x', budgetMin: 5, budgetMax: 1 })).toThrow(/Minimum budget/);
    expect(() => normalizeJobInput({ title: 'x', currency: 'BTC' })).toThrow(/currency/);
    expect(normalizeJobInput({ status: 'closed' }, { partial: true })).toEqual({ status: 'closed' });
  });

  test('hired is system-only and final', () => {
    expect(() => assertStageChange({ from: 'interview', to: 'offer', actor: 'client' })).not.toThrow();
    expect(() => assertStageChange({ from: 'offer', to: 'hired', actor: 'client' })).toThrow(/automatically/);
    expect(() => assertStageChange({ from: 'offer', to: 'withdrawn', actor: 'client' })).toThrow(/automatically/);
    expect(() => assertStageChange({ from: 'offer', to: 'withdrawn', actor: 'admin' })).not.toThrow();
    expect(() => assertStageChange({ from: 'hired', to: 'rejected', actor: 'admin' })).toThrow(/cannot be moved/);
  });
});
