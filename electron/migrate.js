// ═══════════════════════════════════════════
// OUMNIA OS — Migration JSON → SQLite
// Lit ~/.oumnia-os/memory.json et importe dans SQLite
// S'execute une seule fois (flag dans stats)
// ═══════════════════════════════════════════

const fs = require("fs");
const path = require("path");
const os = require("os");
const { getDb, DB_DIR } = require("./database");

const MEMORY_FILE = path.join(DB_DIR, "memory.json");

function migrate() {
  const db = getDb();

  // Deja migre ?
  const done = db.prepare("SELECT value FROM stats WHERE key = 'json_migrated'").get();
  if (done) return;

  if (!fs.existsSync(MEMORY_FILE)) {
    markDone(db);
    return;
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
  } catch (err) {
    console.warn("[MIGRATE] Impossible de lire memory.json:", err.message);
    markDone(db);
    return;
  }

  console.log("[MIGRATE] Migration JSON → SQLite...");

  const tx = db.transaction(() => {
    // ── Profil utilisateur ──
    if (data.user) {
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO profile (key, value, updated_at)
        VALUES (?, ?, datetime('now','localtime'))
      `);
      for (const [k, v] of Object.entries(data.user)) {
        if (k === "preferences") continue;
        stmt.run(k, String(v));
      }
      // Preferences en tant que memories
      if (data.user.preferences) {
        const memStmt = db.prepare(
          "INSERT OR IGNORE INTO memories (content, category, importance) VALUES (?, 'preference', 7)"
        );
        for (const [k, v] of Object.entries(data.user.preferences)) {
          memStmt.run(`${k}: ${v}`);
        }
      }
    }

    // ── Projets ──
    if (data.projects) {
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO projects (id, name, status, last_activity, created_at, updated_at)
        VALUES (?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))
      `);
      for (const [id, proj] of Object.entries(data.projects)) {
        stmt.run(id, id, proj.status || "actif", proj.lastActivity || null);
      }
    }

    // ── Conversations ──
    if (data.conversations && Array.isArray(data.conversations)) {
      const stmt = db.prepare(`
        INSERT INTO conversations (session_id, role, content, timestamp)
        VALUES ('migrated', 'user', ?, ?)
      `);
      for (const c of data.conversations) {
        stmt.run(c.summary, c.date || new Date().toISOString());
      }
    }

    // ── Facts → memories ──
    if (data.facts && Array.isArray(data.facts)) {
      const stmt = db.prepare(
        "INSERT OR IGNORE INTO memories (content, category, importance) VALUES (?, 'general', 5)"
      );
      for (const f of data.facts) stmt.run(f);
    }

    // ── Suggestions → memories ──
    if (data.suggestions && Array.isArray(data.suggestions)) {
      const stmt = db.prepare(
        "INSERT OR IGNORE INTO memories (content, category, importance) VALUES (?, 'general', 3)"
      );
      for (const s of data.suggestions) stmt.run(typeof s === "string" ? s : JSON.stringify(s));
    }

    // ── Stats ──
    if (data.stats) {
      const stmt = db.prepare(`
        INSERT INTO stats (key, value, updated_at)
        VALUES (?, ?, datetime('now','localtime'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `);
      if (data.stats.totalInteractions) stmt.run("totalInteractions", data.stats.totalInteractions);
      if (data.stats.sessionsCount) stmt.run("sessionsCount", data.stats.sessionsCount);
      if (data.stats.lastSessionDate) stmt.run("lastSessionDate", new Date(data.stats.lastSessionDate).getTime());
    }

    markDone(db);
  });

  tx();

  // Renommer l'ancien fichier
  const backupPath = MEMORY_FILE + ".bak";
  if (!fs.existsSync(backupPath)) {
    fs.renameSync(MEMORY_FILE, backupPath);
    console.log("[MIGRATE] memory.json → memory.json.bak");
  }

  console.log("[MIGRATE] Migration terminee.");
}

function markDone(db) {
  db.prepare(`
    INSERT INTO stats (key, value, updated_at)
    VALUES ('json_migrated', 1, datetime('now','localtime'))
    ON CONFLICT(key) DO UPDATE SET value = 1, updated_at = datetime('now','localtime')
  `).run();
}

module.exports = { migrate };
