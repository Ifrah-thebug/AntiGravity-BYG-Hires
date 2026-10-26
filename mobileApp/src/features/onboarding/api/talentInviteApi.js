import { apiUrl, authHeaders, readJson } from '@/core/api/http';
import { toFileUri } from '@/core/storage/files';

export async function verifyTalentActivationToken(token) {
  const resp = await fetch(apiUrl(`/api/talent-invite/activate/verify?token=${encodeURIComponent(token)}`));
  const data = await readJson(resp);
  return { ok: resp.ok && data.ok, data, status: resp.status };
}

export async function completeTalentActivation({ token, password }) {
  const resp = await fetch(apiUrl('/api/talent-invite/activate/set-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  const data = await readJson(resp);
  if (!resp.ok) {
    const err = new Error(data.error || 'Activation failed.');
    err.code = data.code;
    throw err;
  }
  return data;
}

export async function fetchInviteSetupStatus() {
  const headers = await authHeaders('Not signed in.');
  const resp = await fetch(apiUrl('/api/talent-invite/setup/status'), { headers });
  const data = await readJson(resp);
  if (!resp.ok) throw new Error(data.error || 'Could not load setup status.');
  return data;
}

function cvApiError(data, resp) {
  const err = new Error(data.error || 'Could not parse CV.');
  err.retryable = data.retryable !== false;
  err.code = data.code;
  err.status = resp.status;
  return err;
}

export async function parseInviteCvOnSetup() {
  const headers = await authHeaders('Not signed in.');
  const resp = await fetch(apiUrl('/api/talent-invite/setup/parse-cv'), {
    method: 'POST',
    headers,
  });
  const data = await readJson(resp);
  if (!resp.ok) throw cvApiError(data, resp);
  return data;
}

/** @param {import('@/core/storage/files').LocalFile} file */
export async function reuploadInviteCvOnSetup(file) {
  const headers = await authHeaders('Not signed in.');
  const formData = new FormData();
  formData.append('cv', { uri: toFileUri(file.uri), name: file.name, type: file.type || 'application/pdf' });

  const resp = await fetch(apiUrl('/api/talent-invite/setup/reupload-cv'), {
    method: 'POST',
    headers,
    body: formData,
  });
  const data = await readJson(resp);
  if (!resp.ok) throw cvApiError(data, resp);
  return data;
}
