import ReactNativeBlobUtil from 'react-native-blob-util';
import { getJson, removeKey, setJson } from '@/core/storage/keyValue';
import { toFsPath } from '@/core/storage/files';

/** Parsed signup draft kept until the user confirms email + logs in (web: sessionStorage). */
export const PENDING_SETUP_KEY = 'byg_pending_talent_setup';

const sameEmail = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

/** Cached picker copies can be purged by the OS; drop file refs that no longer exist. */
async function existingFile(file) {
  if (!file?.uri) return null;
  try {
    return (await ReactNativeBlobUtil.fs.exists(toFsPath(file.uri))) ? file : null;
  } catch {
    return null;
  }
}

export function savePendingSetup(data) {
  return setJson(PENDING_SETUP_KEY, data);
}

/**
 * The draft saved on this device. With `email` (a signed-in user) it is only returned when it
 * belongs to that account; a draft from another signup is discarded so it can never prefill
 * or overwrite someone else's profile.
 */
export async function loadPendingSetup(email) {
  const pending = await getJson(PENDING_SETUP_KEY);
  if (!pending) return null;
  if (email && !sameEmail(pending.email, email)) {
    await removeKey(PENDING_SETUP_KEY);
    return null;
  }
  return {
    ...pending,
    cvFile: await existingFile(pending.cvFile),
    photoFile: await existingFile(pending.photoFile),
  };
}

export function clearPendingSetup() {
  return removeKey(PENDING_SETUP_KEY);
}
