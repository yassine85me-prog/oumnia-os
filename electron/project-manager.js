// ═══════════════════════════════════════════
// OUMNIA OS — Project Manager (SQLite)
// Gere les projets dans la table projects
// ═══════════════════════════════════════════

const { getDb } = require("./database");
const { execSync } = require("child_process");
const path = require("path");

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

// ═══════════════════════════════════════════
// Git-based Project Activity Analysis
// ═══════════════════════════════════════════

function gitCmd(cwd, cmd) {
  try {
    return execSync(cmd, { cwd, encoding: "utf8", stdio: "pipe", timeout: 5000 }).trim();
  } catch { return ""; }
}

function analyzeProjectActivity(projectPath) {
  const result = {
    lastCommitDays: null,
    commitsLastWeek: 0,
    commitsLastMonth: 0,
    totalCommits: 0,
    linesChanged30d: 0,
    activeBranches: 0,
    momentum: "unknown", // rising, stable, declining, stalled
    activityLevel: "unknown", // active, moderate, slow, stalled
  };

  // Check if it's a git repo
  const branch = gitCmd(projectPath, "git branch --show-current");
  if (!branch) return result;

  // Last commit date
  const lastCommitDate = gitCmd(projectPath, "git log -1 --format=%ci");
  if (lastCommitDate) {
    const lastDate = new Date(lastCommitDate);
    result.lastCommitDays = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Commits last 7 days
  const weekLog = gitCmd(projectPath, "git rev-list --count --since='7 days ago' HEAD");
  result.commitsLastWeek = parseInt(weekLog) || 0;

  // Commits last 30 days
  const monthLog = gitCmd(projectPath, "git rev-list --count --since='30 days ago' HEAD");
  result.commitsLastMonth = parseInt(monthLog) || 0;

  // Total commits
  const totalLog = gitCmd(projectPath, "git rev-list --count HEAD");
  result.totalCommits = parseInt(totalLog) || 0;

  // Lines changed in last 30 days
  const diffStat = gitCmd(projectPath, "git diff --shortstat HEAD~20 HEAD 2>/dev/null || echo '0'");
  const insertions = (diffStat.match(/(\d+) insertion/) || [, "0"])[1];
  const deletions = (diffStat.match(/(\d+) deletion/) || [, "0"])[1];
  result.linesChanged30d = parseInt(insertions) + parseInt(deletions);

  // Active branches
  const branches = gitCmd(projectPath, "git branch --list");
  result.activeBranches = branches ? branches.split("\n").length : 0;

  // Momentum: compare last week vs previous week
  const prevWeekLog = gitCmd(projectPath, "git rev-list --count --since='14 days ago' --until='7 days ago' HEAD");
  const prevWeekCommits = parseInt(prevWeekLog) || 0;

  if (result.commitsLastWeek > prevWeekCommits + 2) {
    result.momentum = "rising";
  } else if (result.commitsLastWeek >= prevWeekCommits - 1) {
    result.momentum = "stable";
  } else if (result.commitsLastWeek > 0) {
    result.momentum = "declining";
  } else {
    result.momentum = "stalled";
  }

  // Activity level
  if (result.lastCommitDays === null || result.lastCommitDays > 14) {
    result.activityLevel = "stalled";
  } else if (result.commitsLastWeek >= 5) {
    result.activityLevel = "active";
  } else if (result.commitsLastWeek >= 2) {
    result.activityLevel = "moderate";
  } else {
    result.activityLevel = "slow";
  }

  return result;
}

function inferProgress(activity, currentProgress) {
  // Don't downgrade progress — only increase based on momentum
  if (!activity || activity.totalCommits === 0) return currentProgress;

  let newProgress = currentProgress;

  // Boost based on recent activity
  if (activity.activityLevel === "active" && activity.momentum === "rising") {
    newProgress = Math.min(currentProgress + 5, 95);
  } else if (activity.activityLevel === "active") {
    newProgress = Math.min(currentProgress + 2, 95);
  }

  return Math.max(newProgress, currentProgress); // Never decrease
}

function updateProjectFromScan(scanData) {
  if (!scanData || !scanData.path) return;

  const db = getDb();
  const projectName = scanData.name || path.basename(scanData.path);

  // Find matching project by name (case-insensitive) or path
  const existing = db.prepare(
    "SELECT * FROM projects WHERE LOWER(name) = LOWER(?) OR id = LOWER(?)"
  ).get(projectName, projectName.toLowerCase().replace(/\s+/g, "-"));

  if (!existing) return; // Unknown project, skip

  const activity = analyzeProjectActivity(scanData.path);
  const newProgress = inferProgress(activity, existing.progress);

  // Build next_steps hint from recent commits
  let nextSteps = existing.next_steps || "";
  if (scanData.recentCommits && scanData.recentCommits.length > 0) {
    const lastCommitMsg = scanData.recentCommits[0].message || "";
    if (lastCommitMsg && !nextSteps) {
      nextSteps = `Dernier commit: ${lastCommitMsg}`;
    }
  }

  db.prepare(`
    UPDATE projects SET
      progress = ?,
      last_activity = datetime('now','localtime'),
      next_steps = COALESCE(?, next_steps),
      updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(newProgress, nextSteps || null, existing.id);

  return { ...existing, progress: newProgress, activity };
}

function updateAllProjectsFromScans(scansArray) {
  const results = [];
  for (const scan of scansArray) {
    const result = updateProjectFromScan(scan);
    if (result) results.push(result);
  }
  return results;
}

function getProjectsForPromptDetailed() {
  const projects = getProjects().filter(p => p.status === "actif");
  if (projects.length === 0) return "Aucun projet actif.";
  return projects.map(p => {
    let line = `- ${p.name} (${p.progress}%)`;
    if (p.description) line += ` : ${p.description}`;
    if (p.next_steps) line += ` | ${p.next_steps}`;
    if (p.last_activity) {
      const lastAct = new Date(p.last_activity);
      const daysAgo = Math.floor((Date.now() - lastAct.getTime()) / (1000 * 60 * 60 * 24));
      if (daysAgo > 7) line += ` ⚠️ STAGNANT (${daysAgo}j sans activite)`;
      else if (daysAgo <= 1) line += ` 🔥 Actif aujourd'hui`;
    }
    return line;
  }).join("\n");
}

module.exports = {
  initDefaultProjects,
  getProjects,
  getProject,
  upsertProject,
  getProjectsForPrompt,
  getProjectsForPromptDetailed,
  analyzeProjectActivity,
  updateProjectFromScan,
  updateAllProjectsFromScans,
};
