import { apiUrl, authHeaders, fetchWithRetry, readJson } from '@/core/api/http';

export async function fetchTalentChatSession(currentPath = '') {
  const headers = await authHeaders('Sign in to use BYG Guide.');
  const params = new URLSearchParams();
  if (currentPath) params.set('path', currentPath);
  const qs = params.toString();
  const resp = await fetch(apiUrl(`/api/talent/chat/session${qs ? `?${qs}` : ''}`), { headers });
  const data = await readJson(resp);
  if (!resp.ok) throw new Error(data.error || 'Could not load chat.');
  return data;
}

export async function sendTalentChatMessage(message, currentPath = '') {
  const headers = await authHeaders('Sign in to use BYG Guide.');
  const resp = await fetchWithRetry(
    apiUrl('/api/talent/chat/message'),
    {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, path: currentPath }),
    },
    { retries: 1 }
  );
  const data = await readJson(resp);
  if (!resp.ok) throw new Error(data.error || 'Could not send message.');
  return data;
}

export const QUICK_PROMPTS = [
  'What should I do next?',
  'Suggest pricing for my profile',
  'Why am I not in the directory yet?',
  'How do I get more client intros?',
];
