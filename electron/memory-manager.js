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
  // Check if fact already exists (exact match)
  const existing = db.prepare("SELECT id, importance FROM memories WHERE content = ?").get(fact);
  if (existing) {
    // Bump importance if new importance is higher, and track access
    if (importance > existing.importance) {
      db.prepare("UPDATE memories SET importance = ?, last_accessed = datetime('now','localtime'), access_count = access_count + 1 WHERE id = ?")
        .run(importance, existing.id);
    } else {
      db.prepare("UPDATE memories SET last_accessed = datetime('now','localtime'), access_count = access_count + 1 WHERE id = ?")
        .run(existing.id);
    }
    return;
  }
  db.prepare(`
    INSERT INTO memories (content, category, importance, source_session_id)
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

function saveSessionSummary(sessionId, summary, topics, decisions, messageCount) {
  const db = getDb();
  db.prepare(`
    INSERT INTO session_summaries (session_id, summary, topics, decisions, message_count)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      summary = excluded.summary,
      topics = excluded.topics,
      decisions = excluded.decisions,
      message_count = excluded.message_count
  `).run(sessionId, summary, topics || "", decisions || "", messageCount);
}

function getRecentSummaries(limit = 5) {
  const db = getDb();
  return db.prepare(
    "SELECT summary, topics, decisions, message_count, created_at FROM session_summaries ORDER BY created_at DESC LIMIT ?"
  ).all(limit);
}

// ── Daily Journal ──

function getTodayDate() {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
}

function saveDailyJournal(date, summary, highlights, mood, productivityScore, sessionsCount, topics) {
  const db = getDb();
  db.prepare(`
    INSERT INTO daily_journal (date, summary, highlights, mood, productivity_score, sessions_count, topics)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      summary = excluded.summary,
      highlights = excluded.highlights,
      mood = excluded.mood,
      productivity_score = excluded.productivity_score,
      sessions_count = excluded.sessions_count,
      topics = excluded.topics
  `).run(date, summary, highlights || "", mood || "neutre", productivityScore || 5, sessionsCount || 0, topics || "");
}

function getTodayJournal() {
  const db = getDb();
  return db.prepare("SELECT * FROM daily_journal WHERE date = ?").get(getTodayDate());
}

function getRecentJournals(limit = 7) {
  const db = getDb();
  return db.prepare(
    "SELECT date, summary, highlights, mood, productivity_score, sessions_count, topics FROM daily_journal ORDER BY date DESC LIMIT ?"
  ).all(limit);
}

async function generateDailyDigest() {
  const db = getDb();
  const today = getTodayDate();

  // Get all session summaries from today
  const todaySummaries = db.prepare(
    "SELECT summary, topics, decisions, message_count FROM session_summaries WHERE date(created_at) = ?"
  ).all(today);

  if (todaySummaries.length === 0) return;

  // Get today's conversations count
  const convCount = db.prepare(
    "SELECT COUNT(*) as c FROM conversations WHERE date(timestamp) = ?"
  ).get(today)?.c || 0;

  // Get new facts learned today
  const newFacts = db.prepare(
    "SELECT content FROM memories WHERE date(created_at) = ? ORDER BY importance DESC LIMIT 5"
  ).all(today);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  try {
    const Anthropic = require("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const sessionsDigest = todaySummaries.map((s, i) =>
      `Session ${i + 1}: ${s.summary} [Sujets: ${s.topics || "N/A"}] [Decisions: ${s.decisions || "N/A"}]`
    ).join("\n");

    const factsDigest = newFacts.length > 0
      ? `Faits appris: ${newFacts.map(f => f.content).join("; ")}`
      : "";

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: `Tu es un archiviste personnel. Genere un journal quotidien concis a partir des sessions de la journee.
Reponds en JSON sans markdown :
{
  "summary": "Resume de la journee en 2-3 phrases",
  "highlights": "Les 2-3 moments cles ou avancees majeures",
  "mood": "un mot: productif/creatif/frustre/detendu/intense/neutre",
  "productivity_score": 1-10,
  "topics": "sujet1, sujet2, sujet3"
}`,
      messages: [{
        role: "user",
        content: `JOURNEE DU ${today}\n${convCount} interactions, ${todaySummaries.length} sessions\n\nSESSIONS:\n${sessionsDigest}\n\n${factsDigest}`
      }],
    });

    const text = response.content[0]?.text?.trim();
    if (!text) return;

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else return;
    }

    if (parsed.summary) {
      saveDailyJournal(
        today,
        parsed.summary,
        parsed.highlights || "",
        parsed.mood || "neutre",
        parsed.productivity_score || 5,
        todaySummaries.length,
        parsed.topics || ""
      );
      console.log(`[DAILY-JOURNAL] Saved: ${parsed.summary.substring(0, 80)}...`);
    }
  } catch (err) {
    console.error("[DAILY-JOURNAL] Error:", err.message);
  }
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
  saveSessionSummary,
  getRecentSummaries,
  saveDailyJournal,
  getTodayJournal,
  getRecentJournals,
  generateDailyDigest,
  SESSION_ID,
};
