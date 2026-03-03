// ═══════════════════════════════════════════
// OUMNIA OS — Profile Manager (SQLite)
// Gere le profil utilisateur dans la table profile
// ═══════════════════════════════════════════

const { getDb } = require("./database");

const DEFAULT_PROFILE = {
  name: "Yassine",
  role: "Directeur General - Oumnia Restaurant",
  city: "Marrakech",
  expertise: "Restaurant management + Self-taught developer",
  restaurants: "Semlalia, Medina, Gueliz (depuis 2011)",
  partner: "Oussama",
  machines: "MacBook M5 + Lenovo Windows",
  stack: "Google Apps Script, Python, Streamlit, React, Claude API, Google Sheets, Electron",
};

function initDefaultProfile() {
  const db = getDb();
  const count = db.prepare("SELECT COUNT(*) AS c FROM profile").get().c;
  if (count > 0) return;

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO profile (key, value, updated_at)
    VALUES (?, ?, datetime('now','localtime'))
  `);
  const tx = db.transaction(() => {
    for (const [k, v] of Object.entries(DEFAULT_PROFILE)) {
      stmt.run(k, v);
    }
  });
  tx();
}

function getProfile() {
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM profile").all();
  const profile = {};
  for (const row of rows) profile[row.key] = row.value;
  return profile;
}

function setProfileField(key, value) {
  const db = getDb();
  db.prepare(`
    INSERT INTO profile (key, value, updated_at)
    VALUES (?, ?, datetime('now','localtime'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, String(value));
}

module.exports = { initDefaultProfile, getProfile, setProfileField };
