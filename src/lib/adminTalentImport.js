import { supabase } from './supabase';

const API_BASE = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001').replace(/\/$/, '');

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('You must be signed in as super admin.');
  }
  return {
    Authorization: `Bearer ${session.access_token}`,
  };
}

async function parseJson(resp) {
  const text = await resp.text();
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new Error('Invalid response from server.');
  }
}

export async function uploadTalentCvs(files, label) {
  const form = new FormData();
  for (const file of files) {
    form.append('cvs', file);
  }
  if (label) form.append('label', label);

  const headers = await getAuthHeaders();
  const resp = await fetch(`${API_BASE}/api/admin/talent-import/upload`, {
    method: 'POST',
    headers,
    body: form,
  });
  const data = await parseJson(resp);
  if (!resp.ok) throw new Error(data.error || 'Upload failed.');
  return data;
}

export async function fetchImportBatches() {
  const headers = await getAuthHeaders();
  const resp = await fetch(`${API_BASE}/api/admin/talent-import/batches`, { headers });
  const data = await parseJson(resp);
  if (!resp.ok) throw new Error(data.error || 'Could not load import history.');
  return data.batches || [];
}

export async function fetchImportBatch(batchId) {
  const headers = await getAuthHeaders();
  const resp = await fetch(`${API_BASE}/api/admin/talent-import/batches/${batchId}`, {
    headers,
  });
  const data = await parseJson(resp);
  if (!resp.ok) throw new Error(data.error || 'Could not load batch.');
  return data.invites || [];
}

export async function updateInviteEmail(inviteId, { email, name }) {
  const headers = await getAuthHeaders();
  const resp = await fetch(`${API_BASE}/api/admin/talent-import/invites/${inviteId}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name }),
  });
  const data = await parseJson(resp);
  if (!resp.ok) throw new Error(data.error || 'Could not update invite.');
  return data.invite;
}

export async function sendBatchInvites(batchId) {
  const headers = await getAuthHeaders();
  const resp = await fetch(`${API_BASE}/api/admin/talent-import/batches/${batchId}/send-invites`, {
    method: 'POST',
    headers,
  });
  const data = await parseJson(resp);
  if (!resp.ok) throw new Error(data.error || 'Could not send invites.');
  return { outcomes: data.outcomes || [], eligible: data.eligible ?? 0 };
}

export async function sendSingleInvite(inviteId) {
  const headers = await getAuthHeaders();
  const resp = await fetch(`${API_BASE}/api/admin/talent-import/invites/${inviteId}/send`, {
    method: 'POST',
    headers,
  });
  const data = await parseJson(resp);
  if (!resp.ok) throw new Error(data.error || 'Could not send invite.');
  return data;
}
