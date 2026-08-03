const crypto = require('crypto');
const { supabaseAdmin } = require('../middleware/requireAdmin');
const store = require('./talentInviteStore');
const { sendTalentActivationEmail, sendTalentActivationReminderEmail } = require('./resendEmailService');
const { findAuthUserIdByEmail } = require('./clientActivationService');

const BUCKET = 'talent-files';

function getTokenTtlHours() {
  const n = parseInt(process.env.TALENT_ACTIVATION_TOKEN_HOURS, 10);
  return Number.isFinite(n) && n > 0 && n <= 168 ? n : 72;
}

function isActivated(invite) {
  return Boolean(invite?.activatedAt) || invite?.status === 'activated';
}

function getPublicCvUrl(storagePath) {
  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);
  return data?.publicUrl || '';
}

async function uploadCvToStorage(path, buffer, mimeType) {
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: true });
  if (error) throw error;
}

async function copyCvToUserFolder(invite, userId) {
  const ext = (invite.cvStoragePath || '').split('.').pop() || 'pdf';
  const userPath = `${userId}/cv.${ext}`;

  const { data: fileData, error: dlErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .download(invite.cvStoragePath);
  if (dlErr) throw dlErr;

  const buffer = Buffer.from(await fileData.arrayBuffer());
  await uploadCvToStorage(userPath, buffer, invite.cvMimeType || 'application/pdf');
  return userPath;
}

async function issueInviteToken(inviteId, { setFirstInvitedAt = false } = {}) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + getTokenTtlHours() * 3600000).toISOString();
  const now = new Date().toISOString();
  const patch = {
    invite_token: token,
    token_expires_at: expiresAt,
    status: 'invited',
    invited_at: now,
    activation_link_clicked_at: null,
    activation_link_click_count: 0,
  };
  if (setFirstInvitedAt) {
    patch.first_invited_at = now;
  }
  await store.updateInvite(inviteId, patch);
  return token;
}

async function verifyActivationToken(token) {
  const invite = await store.getInviteByToken(token);
  if (!invite) {
    return { ok: false, code: 'INVALID_TOKEN', message: 'This activation link is invalid.' };
  }

  try {
    await store.recordActivationLinkClick(invite.id);
  } catch (err) {
    console.warn('[talent-invite] click tracking failed:', err?.message || err);
  }

  if (isActivated(invite)) {
    return {
      ok: false,
      code: 'ALREADY_ACTIVE',
      message: 'This account is already activated. Please log in.',
      email: invite.email,
      name: invite.name,
    };
  }

  const expires = invite.tokenExpiresAt ? new Date(invite.tokenExpiresAt).getTime() : 0;
  if (!expires || Date.now() > expires) {
    return {
      ok: false,
      code: 'TOKEN_EXPIRED',
      message: 'This activation link has expired. Contact BYG Hires for a new invite.',
    };
  }

  if (invite.inviteToken !== String(token || '').trim()) {
    return { ok: false, code: 'INVALID_TOKEN', message: 'This activation link is invalid.' };
  }

  return {
    ok: true,
    invite: { email: invite.email, name: invite.name },
  };
}

async function ensureSupabaseAuthUser({ email, password, name, existingUserId }) {
  const metadata = { role: 'talent', full_name: name || undefined };

  if (existingUserId) {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(existingUserId, {
      password,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error) throw error;
    return data.user?.id || existingUserId;
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });

  if (!error) return data.user?.id;

  const msg = String(error.message || '');
  if (/already registered|already exists|duplicate/i.test(msg)) {
    const existingId = await findAuthUserIdByEmail(email);
    if (!existingId) throw error;
    const { data: updated, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
      existingId,
      { password, email_confirm: true, user_metadata: metadata }
    );
    if (updateErr) throw updateErr;
    return updated.user?.id || existingId;
  }

  throw error;
}

async function completeTalentActivation({ token, password }) {
  const pwd = String(password || '');
  if (pwd.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }

  const verification = await verifyActivationToken(token);
  if (!verification.ok) {
    const err = new Error(verification.message);
    err.code = verification.code;
    throw err;
  }

  const invite = await store.getInviteByToken(token);
  if (!invite?.email) {
    const err = new Error('This activation link is invalid.');
    err.code = 'INVALID_TOKEN';
    throw err;
  }

  const existingProfile = await store.findProfileByEmail(invite.email);
  if (existingProfile?.user_id) {
    const err = new Error('This email already has a talent profile. Please log in.');
    err.code = 'ALREADY_ACTIVE';
    throw err;
  }

  const existingUserId = await findAuthUserIdByEmail(invite.email);
  const userId = await ensureSupabaseAuthUser({
    email: invite.email,
    password: pwd,
    name: invite.name,
    existingUserId,
  });

  let cvUrl = '';
  let userCvPath = invite.cvStoragePath || null;
  if (invite.cvStoragePath) {
    userCvPath = await copyCvToUserFolder(invite, userId);
    cvUrl = getPublicCvUrl(userCvPath);
  }

  const now = new Date().toISOString();
  const invitePatch = {
    user_id: userId,
    activated_at: now,
    status: 'activated',
    invite_token: null,
    token_expires_at: null,
  };
  if (userCvPath) invitePatch.cv_storage_path = userCvPath;

  await store.updateInvite(invite.id, invitePatch);

  // Attribute talent profile to ambassador when present.
  if (invite.ambassadorId) {
    try {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();
      if (profile) {
        await supabaseAdmin
          .from('profiles')
          .update({ ambassador_id: invite.ambassadorId, updated_at: now })
          .eq('user_id', userId);
      }
    } catch (attrErr) {
      console.warn('[talent-invite] ambassador attribution:', attrErr?.message || attrErr);
    }
  }

  return {
    email: invite.email,
    name: invite.name,
    userId,
    cvUrl,
    inviteId: invite.id,
    ambassadorId: invite.ambassadorId || null,
  };
}

function inviteNameForEmail(invite) {
  return String(invite?.name || '').trim();
}

async function resolveAmbassadorEmailContext(invite) {
  if (!invite?.ambassadorId) return { ambassadorCode: null, ambassadorName: null };
  try {
    const ambassadorStore = require('./ambassadorStore');
    const ambassador = await ambassadorStore.getById(invite.ambassadorId);
    if (!ambassador) return { ambassadorCode: null, ambassadorName: null };
    return {
      ambassadorCode: ambassador.code || null,
      ambassadorName: ambassador.name || null,
    };
  } catch (err) {
    console.warn('[talent-invite] ambassador email context:', err?.message || err);
    return { ambassadorCode: null, ambassadorName: null };
  }
}

async function sendInviteEmail(invite) {
  if (!invite?.email) {
    return { sent: false, reason: 'no_email' };
  }

  const existingProfile = await store.findProfileByEmail(invite.email);
  if (existingProfile) {
    await store.updateInvite(invite.id, { status: 'skipped' });
    return { sent: false, reason: 'already_registered' };
  }

  const displayName = inviteNameForEmail(invite);
  const token = await issueInviteToken(invite.id, { setFirstInvitedAt: !invite.firstInvitedAt });
  const tokenHours = getTokenTtlHours();
  const { ambassadorCode, ambassadorName } = await resolveAmbassadorEmailContext(invite);
  const mailResult = await sendTalentActivationEmail({
    to: invite.email,
    name: displayName,
    token,
    tokenHours,
    ambassadorCode,
    ambassadorName,
  });

  return {
    sent: true,
    emailId: mailResult.id,
    devActivationUrl:
      process.env.NODE_ENV !== 'production' ? mailResult.activationUrl : undefined,
  };
}

async function sendActivationReminderEmail(invite) {
  if (!invite?.email) {
    return { sent: false, reason: 'no_email' };
  }

  if (isActivated(invite)) {
    return { sent: false, reason: 'already_activated' };
  }

  if (invite.status !== 'invited') {
    return { sent: false, reason: 'not_invited' };
  }

  const existingProfile = await store.findProfileByEmail(invite.email);
  if (existingProfile) {
    await store.updateInvite(invite.id, { status: 'skipped' });
    return { sent: false, reason: 'already_registered' };
  }

  const displayName = inviteNameForEmail(invite);
  const token = await issueInviteToken(invite.id);
  const tokenHours = getTokenTtlHours();
  const { ambassadorCode, ambassadorName } = await resolveAmbassadorEmailContext(invite);
  const mailResult = await sendTalentActivationReminderEmail({
    to: invite.email,
    name: displayName,
    token,
    tokenHours,
    secondReminder: (invite.activationReminderCount || 0) >= 1,
    ambassadorCode,
    ambassadorName,
  });

  const now = new Date().toISOString();
  await store.updateInvite(invite.id, {
    activation_reminder_sent_at: now,
    activation_reminder_count: (invite.activationReminderCount || 0) + 1,
  });

  return {
    sent: true,
    emailId: mailResult.id,
    devActivationUrl:
      process.env.NODE_ENV !== 'production' ? mailResult.activationUrl : undefined,
  };
}

async function sendActivationFullResendEmail(invite) {
  if (!invite?.email) {
    return { sent: false, reason: 'no_email' };
  }

  if (isActivated(invite)) {
    return { sent: false, reason: 'already_activated' };
  }

  if (invite.status !== 'invited') {
    return { sent: false, reason: 'not_invited' };
  }

  const existingProfile = await store.findProfileByEmail(invite.email);
  if (existingProfile) {
    await store.updateInvite(invite.id, { status: 'skipped' });
    return { sent: false, reason: 'already_registered' };
  }

  const displayName = inviteNameForEmail(invite);
  const token = await issueInviteToken(invite.id);
  const tokenHours = getTokenTtlHours();
  const { ambassadorCode, ambassadorName } = await resolveAmbassadorEmailContext(invite);
  const mailResult = await sendTalentActivationEmail({
    to: invite.email,
    name: displayName,
    token,
    tokenHours,
    ambassadorCode,
    ambassadorName,
  });

  const now = new Date().toISOString();
  await store.updateInvite(invite.id, {
    activation_reminder_sent_at: now,
    activation_reminder_count: (invite.activationReminderCount || 0) + 1,
  });

  return {
    sent: true,
    emailId: mailResult.id,
    devActivationUrl:
      process.env.NODE_ENV !== 'production' ? mailResult.activationUrl : undefined,
  };
}

async function getSetupStatusForUser(userId) {
  const invite = await store.getInviteByUserId(userId);
  if (!invite) return { hasInvite: false };

  const hasCv = Boolean(invite.cvStoragePath);
  const cvUrl = hasCv ? getPublicCvUrl(invite.cvStoragePath) : '';
  return {
    hasInvite: true,
    inviteId: invite.id,
    name: invite.name,
    email: invite.email,
    hasCv,
    cvUrl,
    originalFilename: invite.originalFilename,
    parseStatus: invite.parseStatus,
    parsed: invite.parsedJson,
    parseError: invite.parseError,
    ambassadorId: invite.ambassadorId || null,
  };
}

async function parseInviteCvForUser(userId) {
  const invite = await store.getInviteByUserId(userId);
  if (!invite) {
    return { ok: false, error: 'No invite found for this account.' };
  }

  if (!invite.cvStoragePath) {
    return {
      ok: true,
      parsed: null,
      cvUrl: '',
      name: invite.name,
      skipped: true,
      reason: 'no_cv',
    };
  }

  if (invite.parseStatus === 'parsed' && invite.parsedJson) {
    return {
      ok: true,
      parsed: invite.parsedJson,
      cvUrl: getPublicCvUrl(invite.cvStoragePath),
      name: invite.name,
      cached: true,
    };
  }

  await store.updateInvite(invite.id, { parse_status: 'parsing', parse_error: null });

  try {
    const { data: fileData, error: dlErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .download(invite.cvStoragePath);
    if (dlErr) throw dlErr;

    const buffer = Buffer.from(await fileData.arrayBuffer());
    return parseInviteCvBuffer(invite, buffer, invite.cvMimeType || 'application/pdf');
  } catch (err) {
    await store.updateInvite(invite.id, {
      parse_status: 'failed',
      parse_error: err?.message || 'Parse failed',
    });
    return {
      ok: false,
      error: err?.message || 'Could not parse CV.',
      retryable: true,
      code: 'CV_PARSE_EXCEPTION',
      status: 503,
    };
  }
}

async function parseInviteCvBuffer(invite, buffer, mimeType) {
  const { parseCVBuffer } = require('./geminiCVService');
  const parseResult = await parseCVBuffer(buffer, mimeType);

  if (!parseResult.ok) {
    await store.updateInvite(invite.id, {
      parse_status: 'failed',
      parse_error: parseResult.message || parseResult.error,
    });
    return {
      ok: false,
      error: parseResult.message || parseResult.error || 'Could not parse CV.',
      retryable: parseResult.retryable !== false,
      code: parseResult.code || 'CV_PARSE_FAILED',
      status: parseResult.status || 503,
    };
  }

  const parsed = parseResult.parsed;

  if (parsed.name && !invite.name) {
    await store.updateInvite(invite.id, { name: parsed.name });
  }

  await store.updateInvite(invite.id, {
    parsed_json: parsed,
    parse_status: 'parsed',
    parse_error: null,
  });

  return {
    ok: true,
    parsed,
    cvUrl: getPublicCvUrl(invite.cvStoragePath),
    name: invite.name || parsed.name,
    cached: false,
    source: parseResult.source,
  };
}

async function reuploadInviteCvForUser(userId, buffer, mimeType, originalFilename) {
  const invite = await store.getInviteByUserId(userId);
  if (!invite) {
    return { ok: false, error: 'No invite found for this account.', retryable: false };
  }

  const ext = String(originalFilename || invite.originalFilename || 'cv.pdf')
    .split('.')
    .pop()
    ?.toLowerCase() || 'pdf';
  const storagePath = invite.cvStoragePath || `invites/${invite.id}/cv.${ext}`;

  await uploadCvToStorage(storagePath, buffer, mimeType || 'application/pdf');
  await store.updateInvite(invite.id, {
    cv_storage_path: storagePath,
    cv_mime_type: mimeType || 'application/pdf',
    original_filename: originalFilename || invite.originalFilename,
    parsed_json: null,
    parse_status: 'parsing',
    parse_error: null,
  });

  return parseInviteCvBuffer(
    { ...invite, cvStoragePath: storagePath, cvMimeType: mimeType },
    buffer,
    mimeType || 'application/pdf'
  );
}

module.exports = {
  uploadCvToStorage,
  verifyActivationToken,
  completeTalentActivation,
  sendInviteEmail,
  sendActivationReminderEmail,
  sendActivationFullResendEmail,
  getTokenTtlHours,
  getSetupStatusForUser,
  parseInviteCvForUser,
  reuploadInviteCvForUser,
  getPublicCvUrl,
  issueInviteToken,
};
