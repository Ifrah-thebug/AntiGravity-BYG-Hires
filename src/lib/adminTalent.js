import { supabase } from './supabase';
import { normalizeProfileName } from './formatDisplayName';

export function mapProfileToAdminTalent(row) {
  const id = row.user_id || row.id;
  const name = row.name || '';
  return {
    id,
    userId: row.user_id,
    email: row.email || '',
    name,
    displayName: normalizeProfileName(name) || '—',
    role: row.job_title || '—',
    bio: row.about || '—',
    tags: Array.isArray(row.skills) ? row.skills : [],
    experienceYears: row.experience_years ?? 0,
    experience:
      row.experience_years != null && row.experience_years > 0
        ? `${row.experience_years} yrs`
        : '—',
    photo: row.photo_url || null,
    cvUrl: row.cv_url || '',
    hasResume: Boolean(row.cv_url?.trim()),
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

export async function fetchAllTalentsForAdmin() {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'user_id, email, name, job_title, about, skills, experience_years, photo_url, cv_url, created_at'
    )
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapProfileToAdminTalent);
}

export function downloadTalentResume(talent) {
  const url = talent?.cvUrl?.trim();
  if (!url) return false;

  const safeName = (talent.displayName || 'talent')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
  const suffix = ext && ext.length <= 5 ? `.${ext}` : '';

  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.download = `${safeName}-resume${suffix}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
}
