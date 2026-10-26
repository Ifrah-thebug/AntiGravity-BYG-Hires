import { supabase } from '@/core/api/supabase';

export const PORTFOLIO_COLUMNS = `
  id, profile_id, user_id, title, description, cover_image_url,
  project_url, tags, sort_order, published, created_at, updated_at
`;

function normalizeProject(row) {
  if (!row) return null;
  return {
    ...row,
    tags: Array.isArray(row.tags) ? row.tags : [],
    project_url: String(row.project_url || '').trim(),
    cover_image_url: String(row.cover_image_url || '').trim(),
  };
}

export function normalizeProjectUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

export function isValidProjectUrl(url) {
  const normalized = normalizeProjectUrl(url);
  if (!normalized) return true;
  try {
    const parsed = new URL(normalized);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

/** Owner view — includes unpublished drafts. */
export async function fetchOwnPortfolioProjects(profileId) {
  const { data, error } = await supabase
    .from('talent_portfolio_projects')
    .select(PORTFOLIO_COLUMNS)
    .eq('profile_id', profileId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(normalizeProject);
}

export async function createPortfolioProject({ profileId, userId, title, description, projectUrl, tags, coverImageUrl, published }) {
  const { data: maxRow } = await supabase
    .from('talent_portfolio_projects')
    .select('sort_order')
    .eq('profile_id', profileId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('talent_portfolio_projects')
    .insert({
      profile_id: profileId,
      user_id: userId,
      title: String(title || '').trim(),
      description: String(description || '').trim(),
      project_url: normalizeProjectUrl(projectUrl),
      tags: Array.isArray(tags) ? tags : [],
      cover_image_url: coverImageUrl || '',
      sort_order: sortOrder,
      published: published !== false,
      updated_at: new Date().toISOString(),
    })
    .select(PORTFOLIO_COLUMNS)
    .single();

  if (error) throw error;
  return normalizeProject(data);
}

export async function updatePortfolioProject(projectId, patch) {
  const payload = { updated_at: new Date().toISOString() };
  if (patch.title != null) payload.title = String(patch.title).trim();
  if (patch.description != null) payload.description = String(patch.description).trim();
  if (patch.project_url != null) payload.project_url = normalizeProjectUrl(patch.project_url);
  if (patch.tags != null) payload.tags = Array.isArray(patch.tags) ? patch.tags : [];
  if (patch.cover_image_url != null) payload.cover_image_url = patch.cover_image_url;
  if (patch.published != null) payload.published = Boolean(patch.published);
  if (patch.sort_order != null) payload.sort_order = patch.sort_order;

  const { data, error } = await supabase
    .from('talent_portfolio_projects')
    .update(payload)
    .eq('id', projectId)
    .select(PORTFOLIO_COLUMNS)
    .single();

  if (error) throw error;
  return normalizeProject(data);
}

export async function deletePortfolioProject(projectId) {
  const { error } = await supabase.from('talent_portfolio_projects').delete().eq('id', projectId);
  if (error) throw error;
}

export async function reorderPortfolioProjects(profileId, orderedIds) {
  const updates = orderedIds.map((id, index) =>
    supabase
      .from('talent_portfolio_projects')
      .update({ sort_order: index, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('profile_id', profileId)
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

/** Profile fields the storybook needs (owner view). */
export async function fetchPortfolioProfile(profileId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, user_id, name, job_title, about, skills, best_skill, experience_years, photo_url, department, directory_status, created_at, updated_at')
    .eq('id', profileId)
    .single();
  if (error) throw error;
  return data;
}
