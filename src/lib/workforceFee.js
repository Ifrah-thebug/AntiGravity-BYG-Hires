/** Client totals are fee-inclusive: 650 @ 10% → fee 65, contractor 585. */

export function roundMoney(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export function splitInclusiveTotal(gross, feePercent) {
  const total = roundMoney(gross);
  const p = Number(feePercent) || 0;
  if (!(total > 0)) return { total: 0, fee: 0, contractor: 0, feePercent: p };
  if (p <= 0) return { total, fee: 0, contractor: total, feePercent: 0 };
  const fee = roundMoney((total * p) / 100);
  const contractor = roundMoney(total - fee);
  return { total, fee, contractor, feePercent: p };
}

/** Rebuild all-in total from stored contractor net + fee %. */
export function clientTotalFromContractor(contractorAmount, feePercent) {
  const amount = roundMoney(contractorAmount);
  const p = Number(feePercent) || 0;
  if (p <= 0) return amount;
  const fee = roundMoney((amount * p) / (100 - p));
  return roundMoney(amount + fee);
}
