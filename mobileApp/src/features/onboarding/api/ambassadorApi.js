import { apiUrl, parseJsonOrThrow } from '@/core/api/http';

/** Optional referral code on signup — never blocks signup. */
export async function verifyAmbassadorCode(code) {
  const res = await fetch(apiUrl('/api/ambassador/verify-code'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  return parseJsonOrThrow(res, 'Request failed');
}
