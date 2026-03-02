// ═══════════════════════════════════════════
// OUMNIA OS — Memory System (Persistent JSON)
// Stocke dans ~/.oumnia-os/memory.json
// ═══════════════════════════════════════════

const fs = require("fs");
const path = require("path");
const os = require("os");

const MEMORY_DIR = path.join(os.homedir(), ".oumnia-os");
const MEMORY_FILE = path.join(MEMORY_DIR, "memory.json");

const MAX_CONVERSATIONS = 50;

const DEFAULT_MEMORY = {
  user: {
    name: "Yassine",
    role: "Directeur General - Oumnia Restaurant",
    city: "Marrakech",
    expertise: "Restaurant management + Self-taught developer",
    preferences: {},
  },
  projects: {
    "oumnia-os": { status: "active", lastActivity: null, notes: [] },
    "content-generator": { status: "active", lastActivity: null, notes: [] },
    "gastroflow": { status: "active", lastActivity: null, notes: [] },
    "ocr-bons": { status: "active", lastActivity: null, notes: [] },
  },
  conversations: [],
  facts: [],
  suggestions: [],
  stats: {
    totalInteractions: 0,
    sessionsCount: 0,
    lastSessionDate: null,
  },
};

function ensureDir() {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }
}

function loadMemory() {
  ensureDir();
  if (!fs.existsSync(MEMORY_FILE)) {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(DEFAULT_MEMORY, null, 2), "utf8");
    return { ...DEFAULT_MEMORY };
  }
  try {
    const raw = fs.readFileSync(MEMORY_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return { ...DEFAULT_MEMORY };
  }
}

function saveMemory(data) {
  ensureDir();
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2), "utf8");
}

function addConversation(summary) {
  const mem = loadMemory();
  mem.conversations.unshift({
    summary,
    date: new Date().toISOString(),
  });
  if (mem.conversations.length > MAX_CONVERSATIONS) {
    mem.conversations = mem.conversations.slice(0, MAX_CONVERSATIONS);
  }
  mem.stats.totalInteractions++;
  saveMemory(mem);
  return mem;
}

function addFact(fact) {
  const mem = loadMemory();
  if (!mem.facts.includes(fact)) {
    mem.facts.push(fact);
  }
  saveMemory(mem);
  return mem;
}

function incrementSession() {
  const mem = loadMemory();
  mem.stats.sessionsCount++;
  mem.stats.lastSessionDate = new Date().toISOString();
  saveMemory(mem);
  return mem;
}

function getContext() {
  const mem = loadMemory();
  const lines = [];

  lines.push(`Utilisateur : ${mem.user.name} — ${mem.user.role} (${mem.user.city})`);
  lines.push(`Expertise : ${mem.user.expertise}`);

  if (mem.facts.length > 0) {
    lines.push(`\nFaits connus :`);
    mem.facts.forEach((f) => lines.push(`- ${f}`));
  }

  if (mem.conversations.length > 0) {
    lines.push(`\nDernieres conversations :`);
    mem.conversations.slice(0, 5).forEach((c) => {
      lines.push(`- [${new Date(c.date).toLocaleDateString("fr-FR")}] ${c.summary}`);
    });
  }

  lines.push(`\nStats : ${mem.stats.totalInteractions} interactions, ${mem.stats.sessionsCount} sessions`);

  if (Object.keys(mem.user.preferences).length > 0) {
    lines.push(`\nPreferences :`);
    Object.entries(mem.user.preferences).forEach(([k, v]) => lines.push(`- ${k}: ${v}`));
  }

  return lines.join("\n");
}

module.exports = {
  loadMemory,
  saveMemory,
  addConversation,
  addFact,
  incrementSession,
  getContext,
};
