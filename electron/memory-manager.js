// ═══════════════════════════════════════════
// OUMNIA OS — Memory Manager (SQLite)
// Remplace memory.js — meme API, backend SQLite
// ═══════════════════════════════════════════

const { getDb } = require("./database");
const crypto = require("crypto");

const MAX_CONVERSATIONS = 50;

// ── Session ID unique par lancement ──
const SESSION_ID = crypto.randomUUID();

// ── Stats helpers ──
function getStat(key) {
  const db = getDb();
  const row = db.prepare("SELECT value FROM stats WHERE key = ?").get(key);
  return row ? row.value : 0;
}

function setStat(key, value) {
  const db = getDb();
  db.prepare(`
    INSERT INTO stats (key, value, updated_at)
    VALUES (?, ?, datetime('now','localtime'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, value);
}

// ── API publique (compatible main.js) ──

function addConversation(summary) {
  const db = getDb();
  db.prepare(`
    INSERT INTO conversations (session_id, role, content)
    VALUES (?, 'user', ?)
  `).run(SESSION_ID, summary);

  // Purge au-dela de MAX_CONVERSATIONS
  db.prepare(`
    DELETE FROM conversations WHERE id NOT IN (
      SELECT id FROM conversations ORDER BY timestamp DESC LIMIT ?
    )
  `).run(MAX_CONVERSATIONS);

  setStat("totalInteractions", getStat("totalInteractions") + 1);
}

function addFact(fact, category = "general", importance = 5) {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO memories (content, category, importance, source_session_id)
    VALUES (?, ?, ?, ?)
  `).run(fact, category, importance, SESSION_ID);
}

function incrementSession() {
  setStat("sessionsCount", getStat("sessionsCount") + 1);
  setStat("lastSessionDate", Date.now());
}

function getContext() {
  const db = getDb();
  const lines = [];

  // Profil utilisateur
  const profile = db.prepare("SELECT key, value FROM profile").all();
  const p = {};
  for (const row of profile) p[row.key] = row.value;
  if (p.name) {
    lines.push(`Utilisateur : ${p.name} — ${p.role || ""} (${p.city || ""})`);
    lines.push(`Expertise : ${p.expertise || ""}`);
  }

  // Faits / memories importants
  const facts = db.prepare(
    "SELECT content FROM memories ORDER BY importance DESC, created_at DESC LIMIT 20"
  ).all();
  if (facts.length > 0) {
    lines.push("\nFaits connus :");
    for (const f of facts) lines.push(`- ${f.content}`);
  }

  // Dernieres conversations
  const convos = db.prepare(
    "SELECT content, timestamp FROM conversations ORDER BY timestamp DESC LIMIT 5"
  ).all();
  if (convos.length > 0) {
    lines.push("\nDernieres conversations :");
    for (const c of convos) {
      const d = new Date(c.timestamp).toLocaleDateString("fr-FR");
      lines.push(`- [${d}] ${c.content}`);
    }
  }

  // Stats
  const total = getStat("totalInteractions");
  const sessions = getStat("sessionsCount");
  lines.push(`\nStats : ${total} interactions, ${sessions} sessions`);

  // Preferences
  const prefs = db.prepare(
    "SELECT content FROM memories WHERE category = 'preference' ORDER BY importance DESC"
  ).all();
  if (prefs.length > 0) {
    lines.push("\nPreferences :");
    for (const pref of prefs) lines.push(`- ${pref.content}`);
  }

  return lines.join("\n");
}

function loadMemory() {
  const db = getDb();
  const profile = {};
  for (const row of db.prepare("SELECT key, value FROM profile").all()) {
    profile[row.key] = row.value;
  }
  const memories = db.prepare(
    "SELECT id, content, category, importance, created_at FROM memories ORDER BY importance DESC"
  ).all();
  const conversations = db.prepare(
    "SELECT id, content, timestamp FROM conversations ORDER BY timestamp DESC LIMIT ?"
  ).all(MAX_CONVERSATIONS);
  const stats = {
    totalInteractions: getStat("totalInteractions"),
    sessionsCount: getStat("sessionsCount"),
    lastSessionDate: getStat("lastSessionDate"),
  };
  return { profile, memories, conversations, stats };
}

function saveMemory(data) {
  const db = getDb();
  const tx = db.transaction(() => {
    // Profil
    if (data.profile) {
      const stmt = db.prepare(`
        INSERT INTO profile (key, value, updated_at)
        VALUES (?, ?, datetime('now','localtime'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `);
      for (const [k, v] of Object.entries(data.profile)) {
        stmt.run(k, String(v));
      }
    }
    // Memories / facts
    if (data.facts && Array.isArray(data.facts)) {
      const stmt = db.prepare("INSERT OR IGNORE INTO memories (content) VALUES (?)");
      for (const f of data.facts) stmt.run(f);
    }
    // Stats
    if (data.stats) {
      for (const [k, v] of Object.entries(data.stats)) {
        setStat(k, v);
      }
    }
  });
  tx();
}

module.exports = {
  addConversation,
  addFact,
  incrementSession,
  getContext,
  loadMemory,
  saveMemory,
  getStat,
  setStat,
  SESSION_ID,
};
