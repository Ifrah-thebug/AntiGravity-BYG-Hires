const { supabaseAdmin } = require('../middleware/requireAdmin');
const { enrichInvitesWithLifecycle } = require('./inviteLifecycle');

function mapInviteRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    batchId: row.batch_id,
    email: row.email ? row.email.toLowerCase() : null,
    name: row.name || null,
    originalFilename: row.original_filename || null,
    cvStoragePath: row.cv_storage_path,
    cvMimeType: row.cv_mime_type || null,
    parsedJson: row.parsed_json || null,
    parseStatus: row.parse_status,
    parseError: row.parse_error || null,
    emailExtractStatus: row.email_extract_status,
    inviteToken: row.invite_token || null,
    tokenExpiresAt: row.token_expires_at || null,
    invitedAt: row.invited_at || null,
    firstInvitedAt: row.first_invited_at || null,
    activationLinkClickedAt: row.activation_link_clicked_at || null,
    activationLinkClickCount: row.activation_link_click_count ?? 0,
    activatedAt: row.activated_at || null,
    activationReminderSentAt: row.activation_reminder_sent_at || null,
    activationReminderCount: row.activation_reminder_count ?? 0,
    assessmentReminderSentAt: row.assessment_reminder_sent_at || null,
    profileReminderSentAt: row.profile_reminder_sent_at || null,
    userId: row.user_id || null,
    invitedBy: row.invited_by || null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function createBatch({ invitedBy, label }) {
  const { data, error } = await supabaseAdmin
    .from('talent_invite_batches')
    .insert({
      invited_by: invitedBy || null,
      label: label || null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function insertInvite(row) {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('talent_invites')
    .insert({
      ...row,
      updated_at: now,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapInviteRow(data);
}

async function getInviteById(id) {
  const { data, error } = await supabaseAdmin
    .from('talent_invites')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return mapInviteRow(data);
}

async function getInviteByToken(token) {
  const { data, error } = await supabaseAdmin
    .from('talent_invites')
    .select('*')
    .eq('invite_token', String(token || '').trim())
    .maybeSingle();
  if (error) throw error;
  return mapInviteRow(data);
}

async function getInviteByUserId(userId) {
  const { data, error } = await supabaseAdmin
    .from('talent_invites')
    .select('*')
    .eq('user_id', userId)
    .order('activated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return mapInviteRow(data);
}

async function listRecentBatches(limit = 20) {
  const { data: batches, error } = await supabaseAdmin
    .from('talent_invite_batches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!batches?.length) return [];

  const batchIds = batches.map((b) => b.id);
  const { data: inviteRows, error: invErr } = await supabaseAdmin
    .from('talent_invites')
    .select('*')
    .in('batch_id', batchIds);
  if (invErr) throw invErr;

  const mapped = (inviteRows || []).map(mapInviteRow);
  const enriched = await enrichInvitesWithLifecycle(mapped);

  const statsByBatch = {};
  for (const inv of enriched) {
    if (!statsByBatch[inv.batchId]) {
      statsByBatch[inv.batchId] = {
        total: 0,
        sent: 0,
        clicked: 0,
        activated: 0,
        profileComplete: 0,
        assessmentDone: 0,
      };
    }
    const s = statsByBatch[inv.batchId];
    s.total += 1;
    if (inv.invitedAt || inv.status === 'invited' || inv.status === 'activated') s.sent += 1;
    if (inv.activationLinkClickedAt) s.clicked += 1;
    if (inv.status === 'activated' || inv.activatedAt) s.activated += 1;
    if (inv.lifecycle?.profileComplete) s.profileComplete += 1;
    if (inv.lifecycle?.assessmentDone) s.assessmentDone += 1;
  }

  return batches.map((b) => ({
    id: b.id,
    label: b.label,
    createdAt: b.created_at,
    stats: statsByBatch[b.id] || {
      total: 0,
      sent: 0,
      clicked: 0,
      activated: 0,
      profileComplete: 0,
      assessmentDone: 0,
    },
  }));
}

async function recordActivationLinkClick(inviteId) {
  const invite = await getInviteById(inviteId);
  if (!invite) return null;

  const now = new Date().toISOString();
  return updateInvite(inviteId, {
    activation_link_clicked_at: now,
    activation_link_click_count: (invite.activationLinkClickCount || 0) + 1,
  });
}

async function listInvitesByBatch(batchId) {
  const { data, error } = await supabaseAdmin
    .from('talent_invites')
    .select('*')
    .eq('batch_id', batchId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapInviteRow);
}

async function listInvitesByBatchWithLifecycle(batchId) {
  const invites = await listInvitesByBatch(batchId);
  return enrichInvitesWithLifecycle(invites);
}

async function updateInvite(id, patch) {
  const { data, error } = await supabaseAdmin
    .from('talent_invites')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapInviteRow(data);
}

async function findProfileByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('user_id, email, name')
    .ilike('email', normalized)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findPendingInviteByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  const { data, error } = await supabaseAdmin
    .from('talent_invites')
    .select('*')
    .ilike('email', normalized)
    .in('status', ['uploaded', 'ready', 'invited'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return mapInviteRow(data);
}

module.exports = {
  createBatch,
  insertInvite,
  getInviteById,
  getInviteByToken,
  getInviteByUserId,
  listRecentBatches,
  listInvitesByBatch,
  listInvitesByBatchWithLifecycle,
  recordActivationLinkClick,
  updateInvite,
  findProfileByEmail,
  findPendingInviteByEmail,
  mapInviteRow,
};
