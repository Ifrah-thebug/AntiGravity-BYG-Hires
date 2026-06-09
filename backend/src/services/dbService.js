/**
 * dbService.js — Local JSON fallback (no Supabase required)
 * When SUPABASE_URL is configured, swap this out for the real client.
 */
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '../../data.json');

// Ensure the data file exists
function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(
      DB_PATH,
      JSON.stringify({ talents: [], assessments: [], decisions: [], calConnections: [], introBookings: [], introSlots: [], clients: [], discoveryBookings: [] }, null, 2)
    );
  }
  const parsed = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  if (!Array.isArray(parsed.calConnections)) parsed.calConnections = [];
  if (!Array.isArray(parsed.introBookings)) parsed.introBookings = [];
  if (!Array.isArray(parsed.introSlots)) parsed.introSlots = [];
  if (!Array.isArray(parsed.clients)) parsed.clients = [];
  if (!Array.isArray(parsed.discoveryBookings)) parsed.discoveryBookings = [];
  if (Array.isArray(parsed.nylasConnections) && parsed.nylasConnections.length) {
    parsed.calConnections = parsed.nylasConnections.map((c) => ({
      id: c.id,
      talentId: c.talentId,
      email: c.email,
      username: c.username || null,
      userId: c.userId || c.grantId || null,
      updatedAt: c.updatedAt,
    }));
    delete parsed.nylasConnections;
  }
  return parsed;
}

function writeDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

module.exports = {
  // Talent CRUD
  async createTalent(talent) {
    const db = readDB();
    const record = { id: uuidv4(), createdAt: new Date().toISOString(), ...talent };
    db.talents.push(record);
    writeDB(db);
    return record;
  },
  async getTalentById(id) {
    const db = readDB();
    const record = db.talents.find(t => t.id === id);
    if (!record) throw new Error(`Talent ${id} not found`);
    return record;
  },

  // Assessment CRUD
  async createAssessment(assessment) {
    const db = readDB();
    const record = { id: uuidv4(), createdAt: new Date().toISOString(), status: 'pending', ...assessment };
    db.assessments.push(record);
    writeDB(db);
    return record;
  },
  async getAssessmentById(id) {
    const db = readDB();
    const record = db.assessments.find(a => a.id === id);
    if (!record) throw new Error(`Assessment ${id} not found`);
    return record;
  },

  // Decision CRUD
  async createDecision(decision) {
    const db = readDB();
    const record = { id: uuidv4(), createdAt: new Date().toISOString(), ...decision };
    db.decisions.push(record);
    writeDB(db);
    return record;
  },
  async getPendingAssessments() {
    const db = readDB();
    return db.assessments.filter(a => a.status === 'pending');
  },

  // Cal.com connection persistence (local fallback)
  async saveCalConnection({ talentId, email, username, userId }) {
    const db = readDB();
    const idx = db.calConnections.findIndex(c => c.talentId === talentId);
    const record = {
      id: idx >= 0 ? db.calConnections[idx].id : uuidv4(),
      talentId,
      email: (email || '').toLowerCase(),
      username: (username || '').toLowerCase(),
      userId: userId ? String(userId) : null,
      updatedAt: new Date().toISOString(),
    };
    if (idx >= 0) db.calConnections[idx] = record;
    else db.calConnections.push(record);
    writeDB(db);
    return record;
  },

  async getCalConnectionByTalentId(talentId) {
    const db = readDB();
    return db.calConnections.find(c => c.talentId === talentId) || null;
  },

  async saveIntroBooking(record) {
    const db = readDB();
    const idx = db.introBookings.findIndex((b) => b.talentId === record.talentId);
    const row = {
      id: idx >= 0 ? db.introBookings[idx].id : uuidv4(),
      createdAt: idx >= 0 ? db.introBookings[idx].createdAt : new Date().toISOString(),
      ...record,
    };
    if (idx >= 0) db.introBookings[idx] = row;
    else db.introBookings.push(row);
    writeDB(db);
    return row;
  },

  async getActiveIntroBooking(talentId) {
    const db = readDB();
    const now = Date.now();
    const inactive = new Set(['cancelled', 'rejected', 'canceled']);
    return db.introBookings.find((b) => {
      if (b.talentId !== talentId) return false;
      if (inactive.has(String(b.status || '').toLowerCase())) return false;
      return new Date(b.start).getTime() >= now;
    }) || null;
  },

  async getIntroBookingByTalentId(talentId) {
    const db = readDB();
    return db.introBookings.find((b) => b.talentId === talentId) || null;
  },

  async deleteIntroBooking(talentId) {
    const db = readDB();
    const before = db.introBookings.length;
    db.introBookings = db.introBookings.filter((b) => b.talentId !== talentId);
    if (db.introBookings.length !== before) writeDB(db);
  },

  async listIntroSlots(talentId, { statuses = [] } = {}) {
    const db = readDB();
    const now = Date.now();
    const inactiveHold = (s) =>
      s.status === 'held' && s.heldUntil && new Date(s.heldUntil).getTime() < now;
    return db.introSlots
      .filter((s) => {
        if (s.talentId !== talentId && s.talent_id !== talentId) return false;
        if (statuses.length && !statuses.includes(s.status)) return false;
        if (inactiveHold(s)) return false;
        return new Date(s.start_at || s.start).getTime() >= now;
      })
      .map((s) => ({
        id: s.id,
        talent_id: s.talentId || s.talent_id,
        start_at: s.start_at || s.start,
        end_at: s.end_at || s.end,
        day_key: s.day_key || s.dayKey,
        status: inactiveHold(s) ? 'open' : s.status,
        held_until: s.held_until || s.heldUntil,
        held_by_email: s.held_by_email || s.heldByEmail,
      }));
  },

  async replaceOpenIntroSlots(talentId, rows) {
    const db = readDB();
    db.introSlots = db.introSlots.filter(
      (s) =>
        (s.talentId || s.talent_id) !== talentId || !['open', 'held'].includes(s.status)
    );
    for (const row of rows) {
      const startKey = new Date(row.start_at).toISOString();
      const existing = db.introSlots.find((s) => {
        if ((s.talentId || s.talent_id) !== talentId) return false;
        return new Date(s.start_at || s.start).toISOString() === startKey;
      });
      if (existing) {
        if (existing.status === 'booked') {
          throw new Error(
            `You already have a booked intro on ${existing.day_key || existing.dayKey}. Only one interview per day is allowed.`
          );
        }
        existing.end_at = row.end_at;
        existing.end = row.end_at;
        existing.day_key = row.day_key;
        existing.dayKey = row.day_key;
        existing.timezone = row.timezone;
        existing.status = 'open';
        existing.held_until = null;
        existing.held_by_email = null;
        existing.updated_at = row.updated_at;
        continue;
      }
      db.introSlots.push({
        id: uuidv4(),
        talentId,
        talent_id: talentId,
        start_at: row.start_at,
        end_at: row.end_at,
        day_key: row.day_key,
        timezone: row.timezone,
        status: 'open',
        held_until: null,
        held_by_email: null,
        createdAt: new Date().toISOString(),
        updated_at: row.updated_at,
      });
    }
    writeDB(db);
    return db.introSlots.filter((s) => (s.talentId || s.talent_id) === talentId && s.status === 'open');
  },

  async releaseExpiredIntroHolds(talentId, nowIso) {
    const db = readDB();
    let changed = false;
    for (const s of db.introSlots) {
      if (s.status !== 'held') continue;
      if (talentId && (s.talentId || s.talent_id) !== talentId) continue;
      if (s.held_until && new Date(s.held_until).getTime() < new Date(nowIso).getTime()) {
        s.status = 'open';
        s.held_until = null;
        s.held_by_email = null;
        changed = true;
      }
    }
    if (changed) writeDB(db);
  },

  async holdIntroSlot(slotId, email, heldUntil) {
    const db = readDB();
    const slot = db.introSlots.find((s) => s.id === slotId && s.status === 'open');
    if (!slot) return null;
    slot.status = 'held';
    slot.held_by_email = email;
    slot.held_until = heldUntil;
    writeDB(db);
    return slot;
  },

  async markIntroSlotBooked(slotId, nowIso) {
    const db = readDB();
    const slot = db.introSlots.find((s) => s.id === slotId);
    if (!slot) return null;
    const talentId = slot.talentId || slot.talent_id;
    const dayKey = slot.day_key || slot.dayKey;
    slot.status = 'booked';
    slot.held_until = null;
    slot.held_by_email = null;
    for (const s of db.introSlots) {
      if ((s.talentId || s.talent_id) !== talentId) continue;
      if ((s.day_key || s.dayKey) !== dayKey) continue;
      if (s.id === slotId) continue;
      if (s.status === 'open' || s.status === 'held') s.status = 'expired';
    }
    writeDB(db);
    return slot;
  },

  async getIntroBookingByClientTalent(talentId, clientEmail) {
    const db = readDB();
    const now = Date.now();
    const inactive = new Set(['cancelled', 'rejected', 'canceled']);
    return (
      db.introBookings.find((b) => {
        if (b.talentId !== talentId) return false;
        const em = (b.clientEmail || b.client_email || b.guestEmail || b.guest_email || '').toLowerCase();
        if (em !== clientEmail) return false;
        if (inactive.has(String(b.status || '').toLowerCase())) return false;
        return new Date(b.start_at || b.start).getTime() >= now;
      }) || null
    );
  },

  async getLatestIntroBookingByClientTalent(talentId, clientEmail) {
    const db = readDB();
    const matches = db.introBookings.filter((b) => {
      if (b.talentId !== talentId) return false;
      const em = (b.clientEmail || b.client_email || b.guestEmail || b.guest_email || '').toLowerCase();
      return em === clientEmail;
    });
    if (!matches.length) return null;
    matches.sort(
      (a, b) =>
        new Date(b.start_at || b.start).getTime() - new Date(a.start_at || a.start).getTime()
    );
    return matches[0];
  },

  async upsertClient({ email, name, company, now }) {
    const db = readDB();
    const idx = db.clients.findIndex((c) => (c.email || '').toLowerCase() === email);
    if (idx >= 0) {
      const c = db.clients[idx];
      if (name && !c.name) c.name = name;
      if (company && !c.company) c.company = company;
      c.updatedAt = now;
      writeDB(db);
      return c.id;
    }
    const id = uuidv4();
    db.clients.push({
      id,
      email,
      name: name || null,
      company: company || null,
      userId: null,
      accountConfirmedAt: null,
      confirmationToken: null,
      confirmationTokenExpiresAt: null,
      createdAt: now,
      updatedAt: now,
    });
    writeDB(db);
    return id;
  },

  async getClientById(id) {
    const db = readDB();
    return db.clients.find((c) => c.id === id) || null;
  },

  async getClientByToken(token) {
    const db = readDB();
    return db.clients.find((c) => c.confirmationToken === token) || null;
  },

  async updateClient(id, patch) {
    const db = readDB();
    const idx = db.clients.findIndex((c) => c.id === id);
    if (idx < 0) throw new Error(`Client ${id} not found`);

    const row = db.clients[idx];
    const map = {
      user_id: 'userId',
      account_confirmed_at: 'accountConfirmedAt',
      confirmation_token: 'confirmationToken',
      confirmation_token_expires_at: 'confirmationTokenExpiresAt',
      updated_at: 'updatedAt',
    };

    for (const [key, value] of Object.entries(patch)) {
      const localKey = map[key] || key;
      row[localKey] = value;
    }
    row.updatedAt = patch.updated_at || new Date().toISOString();
    writeDB(db);
    return row;
  },

  async getClientByUserId(userId) {
    const db = readDB();
    const uid = String(userId || '').trim();
    if (!uid) return null;
    return (
      db.clients.find(
        (c) =>
          String(c.userId || c.user_id || '') === uid
      ) || null
    );
  },

  async getClientByEmail(email) {
    const db = readDB();
    const em = String(email || '').trim().toLowerCase();
    if (!em) return null;
    return db.clients.find((c) => (c.email || '').toLowerCase() === em) || null;
  },

  async upsertDiscoveryBooking(payload) {
    const db = readDB();
    const idx = db.discoveryBookings.findIndex((b) => b.cal_uid === payload.cal_uid || b.calUid === payload.cal_uid);
    const row = {
      id: idx >= 0 ? db.discoveryBookings[idx].id : uuidv4(),
      clientId: payload.client_id,
      calUid: payload.cal_uid,
      title: payload.title,
      start_at: payload.start_at,
      end_at: payload.end_at,
      meeting_url: payload.meeting_url,
      guest_name: payload.guest_name,
      guest_email: payload.guest_email,
      status: payload.status || 'confirmed',
      createdAt: idx >= 0 ? db.discoveryBookings[idx].createdAt : payload.updated_at,
      updatedAt: payload.updated_at,
    };
    if (idx >= 0) db.discoveryBookings[idx] = row;
    else db.discoveryBookings.push(row);
    writeDB(db);
    return row;
  },

  async updateDiscoveryBookingByCalUid(calUid, patch) {
    const db = readDB();
    const idx = db.discoveryBookings.findIndex((b) => (b.calUid || b.cal_uid) === calUid);
    if (idx < 0) return null;
    const row = db.discoveryBookings[idx];
    if (patch.status) row.status = patch.status;
    if (patch.start_at) row.start_at = patch.start_at;
    if (patch.end_at !== undefined) row.end_at = patch.end_at;
    if (patch.meeting_url !== undefined) row.meeting_url = patch.meeting_url;
    if (patch.title) row.title = patch.title;
    row.updatedAt = patch.updated_at || new Date().toISOString();
    writeDB(db);
    return row;
  },

  async listUpcomingDiscoveryBookingsForClientId(clientId) {
    const db = readDB();
    const now = Date.now();
    const inactive = new Set(['cancelled', 'canceled', 'rejected']);

    return db.discoveryBookings
      .filter((b) => {
        if ((b.clientId || b.client_id) !== clientId) return false;
        if (inactive.has(String(b.status || '').toLowerCase())) return false;
        return new Date(b.start_at || b.start).getTime() >= now;
      })
      .map((b) => ({
        id: b.id,
        clientId: b.clientId || b.client_id,
        calUid: b.calUid || b.cal_uid,
        title: b.title || 'Discovery Call',
        start: b.start_at || b.start,
        end: b.end_at || b.end,
        meetingUrl: b.meeting_url || b.meetingUrl || null,
        guestName: b.guest_name || b.guestName || null,
        guestEmail: b.guest_email || b.guestEmail || null,
        status: b.status,
      }))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  },

  async listUpcomingIntroBookingsForClientUserId(userId) {
    const db = readDB();
    const client = db.clients.find((c) => String(c.userId || c.user_id || '') === String(userId || '').trim());
    if (!client) return [];

    const now = Date.now();
    const inactive = new Set(['cancelled', 'rejected', 'canceled']);

    const talentById = new Map((db.talents || []).map((t) => [t.id, t]));

    return db.introBookings
      .filter((b) => {
        const bookingClientId = b.clientId || b.client_id || null;
        const bookingClientEmail = (b.clientEmail || b.client_email || '').toLowerCase();
        const matchesClient =
          bookingClientId === client.id ||
          (bookingClientEmail && bookingClientEmail === String(client.email || '').toLowerCase());

        if (!matchesClient) return false;
        if (inactive.has(String(b.status || '').toLowerCase())) return false;
        const startMs = new Date(b.start_at || b.start).getTime();
        return startMs >= now;
      })
      .map((b) => {
        const talent = talentById.get(b.talentId || b.talent_id) || null;
        return {
          id: b.id,
          talentId: b.talentId || b.talent_id,
          talentName: talent?.name || null,
          title: b.title,
          start: b.start_at || b.start,
          end: b.end_at || b.end,
          meetingUrl: b.meetingUrl || b.meeting_url || null,
          status: b.status,
          company: b.company || null,
        };
      })
      .sort((a, c) => new Date(a.start).getTime() - new Date(c.start).getTime());
  },

  async getIntroBookingById(id) {
    const db = readDB();
    return db.introBookings.find((b) => b.id === id) || null;
  },

  async listActiveIntroBookingsForTalent(talentId) {
    const db = readDB();
    const now = Date.now();
    const active = new Set(['pending', 'confirmed', 'accepted']);
    const inactive = new Set(['cancelled', 'rejected', 'canceled']);
    return db.introBookings.filter((b) => {
      if (b.talentId !== talentId) return false;
      if (inactive.has(String(b.status || '').toLowerCase())) return false;
      if (!active.has(String(b.status || '').toLowerCase())) return false;
      return new Date(b.start_at || b.start).getTime() >= now;
    });
  },

  async getLatestIntroBookingBySlotId(slotId) {
    const db = readDB();
    const matches = db.introBookings.filter((b) => (b.slotId || b.slot_id) === slotId);
    if (!matches.length) return null;
    matches.sort(
      (a, b) =>
        new Date(b.createdAt || b.created_at || 0).getTime() -
        new Date(a.createdAt || a.created_at || 0).getTime()
    );
    return matches[0];
  },

  async reopenIntroSlotById(slotId, now) {
    const db = readDB();
    const slot = db.introSlots.find((s) => s.id === slotId);
    if (!slot || slot.status !== 'booked') return false;
    slot.status = 'open';
    slot.held_until = null;
    slot.held_by_email = null;
    slot.updated_at = now;
    writeDB(db);
    return true;
  },

  async expireIntroSlotsByIds(ids, now) {
    const db = readDB();
    const idSet = new Set(ids || []);
    let count = 0;
    for (const slot of db.introSlots) {
      if (!idSet.has(slot.id)) continue;
      slot.status = 'expired';
      slot.held_until = null;
      slot.held_by_email = null;
      slot.updated_at = now;
      count += 1;
    }
    if (count) writeDB(db);
    return ids;
  },

  async reactivateExpiredIntroSlotById(slotId, now) {
    const db = readDB();
    const slot = db.introSlots.find((s) => s.id === slotId);
    if (!slot || slot.status !== 'expired') return false;
    slot.status = 'open';
    slot.held_until = null;
    slot.held_by_email = null;
    slot.updated_at = now;
    writeDB(db);
    return true;
  },

  async listExpiredIntroSlotsAtStart(startIso, excludeTalentId) {
    const db = readDB();
    const startKey = new Date(startIso).toISOString();
    return db.introSlots.filter((s) => {
      if ((s.talentId || s.talent_id) === excludeTalentId) return false;
      if (s.status !== 'expired') return false;
      return new Date(s.start_at || s.start).toISOString() === startKey;
    });
  },

  async cancelIntroBookingAndReopenSlot({ bookingId, slotId, now }) {
    const db = readDB();
    const booking = db.introBookings.find((b) => b.id === bookingId);
    if (booking) booking.status = 'cancelled';
    if (slotId) {
      const slot = db.introSlots.find((s) => s.id === slotId);
      if (slot && slot.status === 'booked') {
        slot.status = 'open';
        slot.held_until = null;
        slot.held_by_email = null;
        slot.updated_at = now;
      }
    }
    writeDB(db);
  },

  async updateIntroBookingAndSlotFromCal({ bookingId, slotId, cal, startIso, endIso, dayKey, now }) {
    const db = readDB();
    const booking = db.introBookings.find((b) => b.id === bookingId);
    if (booking) {
      booking.calUid = cal.uid;
      booking.title = cal.title;
      booking.start = startIso;
      booking.start_at = startIso;
      booking.end = endIso;
      booking.end_at = endIso;
      booking.meetingUrl = cal.meetingUrl;
      booking.meeting_url = cal.meetingUrl;
      booking.status = 'confirmed';
    }
    if (slotId) {
      const slot = db.introSlots.find((s) => s.id === slotId);
      if (slot) {
        slot.start_at = startIso;
        slot.start = startIso;
        slot.end_at = endIso;
        slot.end = endIso;
        slot.day_key = dayKey;
        slot.dayKey = dayKey;
        slot.status = 'booked';
      }
    }
    writeDB(db);
  },

  async saveIntroBookingV2(record) {
    const db = readDB();
    const row = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      talentId: record.talentId,
      slotId: record.slotId,
      clientId: record.clientId || null,
      clientEmail: record.clientEmail,
      guestName: record.clientName,
      guestEmail: record.clientEmail,
      company: record.company,
      calUid: record.calUid,
      title: record.title,
      start: record.start,
      start_at: record.start,
      end: record.end,
      end_at: record.end,
      meetingUrl: record.meetingUrl,
      meeting_url: record.meetingUrl,
      status: record.status || 'confirmed',
    };
    db.introBookings.push(row);
    writeDB(db);
    return row;
  },
};
