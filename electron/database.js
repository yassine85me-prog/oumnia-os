// ═══════════════════════════════════════════
// OUMNIA OS — SQLite Database (better-sqlite3)
// Stocke dans ~/.oumnia-os/oumnia.db
// ═══════════════════════════════════════════

const path = require("path");
const os = require("os");
const fs = require("fs");

const DB_DIR = path.join(os.homedir(), ".oumnia-os");
const DB_FILE = path.join(DB_DIR, "oumnia.db");

let db = null;

function ensureDir() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
}

function getDb() {
  if (db) return db;
  ensureDir();
  const Database = require("better-sqlite3");
  db = new Database(DB_FILE);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  initTables();
  return db;
}

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL DEFAULT 'general'
        CHECK(category IN ('business','projet','preference','personnel','technique','general')),
      importance INTEGER NOT NULL DEFAULT 5 CHECK(importance BETWEEN 1 AND 10),
      source_session_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      last_accessed TEXT,
      access_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS profile (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'actif'
        CHECK(status IN ('actif','pause','termine')),
      progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
      category TEXT,
      last_activity TEXT,
      next_steps TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS stats (
      key TEXT PRIMARY KEY,
      value INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_conversations_session
      ON conversations(session_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_timestamp
      ON conversations(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_memories_category
      ON memories(category);
    CREATE INDEX IF NOT EXISTS idx_memories_importance
      ON memories(importance DESC);
  `);
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, close, DB_DIR, DB_FILE };
