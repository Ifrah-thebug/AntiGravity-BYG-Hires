import { supabase } from './supabase';

export const PENDING_SETUP_KEY = 'byg_pending_talent_setup';

export function savePendingSetup(data) {
  sessionStorage.setItem(PENDING_SETUP_KEY, JSON.stringify(data));
}

export function loadPendingSetup() {
  try {
    const raw = sessionStorage.getItem(PENDING_SETUP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearPendingSetup() {
  sessionStorage.removeItem(PENDING_SETUP_KEY);
}

/** Upload CV or photo to Supabase Storage talent-files bucket */
export async function uploadTalentFile(userId, file, kind) {
  const ext = file.name.split('.').pop() || 'bin';
  const path = `${userId}/${kind}.${ext}`;
  const { error } = await supabase.storage
    .from('talent-files')
    .upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('talent-files').getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Upload both files; returns URLs and non-fatal warnings if one fails.
 * Lets signup continue so user can retry on setup / portal.
 */
export async function uploadSignupFiles(userId, cvFile, photoFile) {
  const warnings = [];
  let cvUrl = '';
  let photoUrl = '';

  if (cvFile) {
    try {
      cvUrl = await uploadTalentFile(userId, cvFile, 'cv');
    } catch (e) {
      warnings.push(`CV upload failed: ${e.message}. You can retry when saving your profile.`);
    }
  }

  if (photoFile) {
    try {
      photoUrl = await uploadTalentFile(userId, photoFile, 'photo');
    } catch (e) {
      warnings.push(`Photo upload failed: ${e.message}. You can retry when saving your profile.`);
    }
  }

  return { cvUrl, photoUrl, warnings };
}
