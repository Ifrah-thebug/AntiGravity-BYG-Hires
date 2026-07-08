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

export async function fetchAdminClients(search = '') {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  const qs = params.toString();
  const resp = await fetch(`${API_BASE}/api/admin/clients${qs ? `?${qs}` : ''}`, { headers });
  const data = await parseJson(resp);
  if (!resp.ok) throw new Error(data.error || 'Could not load clients.');
  return data.clients || [];
}

export async function fetchAdminClientDetail(clientId) {
  const headers = await getAuthHeaders();
  const resp = await fetch(`${API_BASE}/api/admin/clients/${clientId}`, { headers });
  const data = await parseJson(resp);
  if (!resp.ok) throw new Error(data.error || 'Could not load client.');
  return data;
}
