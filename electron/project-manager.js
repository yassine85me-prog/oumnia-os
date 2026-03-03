// ═══════════════════════════════════════════
// OUMNIA OS — Project Manager (SQLite)
// Gere les projets dans la table projects
// ═══════════════════════════════════════════

const { getDb } = require("./database");

const DEFAULT_PROJECTS = [
  {
    id: "gastroflow",
    name: "GASTROFLOW",
    description: "ERP restaurant, Google Apps Script + Sheets, 2000+ lignes, 286+ articles, 9 fournisseurs",
    status: "actif",
    progress: 70,
    category: "business",
  },
  {
    id: "oumnia-digital-agency",
    name: "Oumnia Digital Agency",
    description: "SaaS video AI, 12 agents, 5 departements, Streamlit, video_engine.py (ImagineArt + Runway)",
    status: "actif",
    progress: 40,
    category: "saas",
  },
  {
    id: "ocr-bons",
    name: "OCR_BONS_SYSTEM",
    description: "Scan bons livraison via Claude Vision API, 9 fournisseurs",
    status: "actif",
    progress: 60,
    category: "business",
  },
  {
    id: "oumnia-studio",
    name: "Oumnia Studio v2.0",
    description: "Learning system + feedback + Google Reviews + Liquid Glass",
    status: "actif",
    progress: 30,
    category: "saas",
  },
  {
    id: "oumnia-os",
    name: "OUMNIA OS",
    description: "Personal Command Center Electron + React, agent IA integre",
    status: "actif",
    progress: 20,
    category: "tools",
  },
  {
    id: "catalogue-digital",
    name: "Catalogue Digital",
    description: "gastroflow-by-oumnia.netlify.app",
    status: "termine",
    progress: 100,
    category: "business",
  },
];

function initDefaultProjects() {
  const db = getDb();
  const count = db.prepare("SELECT COUNT(*) AS c FROM projects").get().c;
  if (count > 0) return;

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO projects (id, name, description, status, progress, category, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))
  `);
  const tx = db.transaction(() => {
    for (const p of DEFAULT_PROJECTS) {
      stmt.run(p.id, p.name, p.description, p.status, p.progress, p.category);
    }
  });
  tx();
}

function getProjects() {
  const db = getDb();
  return db.prepare("SELECT * FROM projects ORDER BY status ASC, name ASC").all();
}

function getProject(id) {
  const db = getDb();
  return db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
}

function upsertProject({ id, name, description, status, progress, category, next_steps }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO projects (id, name, description, status, progress, category, next_steps, last_activity, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))
    ON CONFLICT(id) DO UPDATE SET
      name = COALESCE(excluded.name, name),
      description = COALESCE(excluded.description, description),
      status = COALESCE(excluded.status, status),
      progress = COALESCE(excluded.progress, progress),
      category = COALESCE(excluded.category, category),
      next_steps = COALESCE(excluded.next_steps, next_steps),
      last_activity = datetime('now','localtime'),
      updated_at = datetime('now','localtime')
  `).run(id, name, description || null, status || "actif", progress || 0, category || null, next_steps || null);
}

function getProjectsForPrompt() {
  const projects = getProjects().filter(p => p.status === "actif");
  if (projects.length === 0) return "Aucun projet actif.";
  return projects.map(p => {
    let line = `- ${p.name} (${p.progress}%)`;
    if (p.description) line += ` : ${p.description}`;
    if (p.next_steps) line += ` | Next: ${p.next_steps}`;
    return line;
  }).join("\n");
}

module.exports = {
  initDefaultProjects,
  getProjects,
  getProject,
  upsertProject,
  getProjectsForPrompt,
};
