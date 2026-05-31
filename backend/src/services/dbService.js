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
    fs.writeFileSync(DB_PATH, JSON.stringify({ talents: [], assessments: [], decisions: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
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
};
