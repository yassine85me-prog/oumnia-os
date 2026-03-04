// ═══════════════════════════════════════════
// OUMNIA OS — Agent Core (Multi-Agent Engine)
// Moteur partagé : streaming, tools, mémoire, confirmation
// ═══════════════════════════════════════════

const memory = require("./memory-manager");
const { getProfile } = require("./profile-manager");
const { getProjectsForPromptDetailed, getProjects, updateAllProjectsFromScans } = require("./project-manager");
const { getAgent } = require("./agents/registry");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ── Per-agent session histories ──
const MAX_HISTORY = 40;
const sessionHistories = new Map(); // agentId -> []

function getHistory(agentId) {
  if (!sessionHistories.has(agentId)) sessionHistories.set(agentId, []);
  return sessionHistories.get(agentId);
}

// ── Per-agent prompt caches ──
const promptCaches = new Map(); // agentId -> { prompt, timestamp, extraContext, voiceMode }
const CACHE_TTL = 5 * 60 * 1000;

// ── Deep project knowledge ──
let currentProjectData = null;
let allProjectScans = new Map();

// ── Tool confirmation ──
const pendingConfirmations = new Map();
let confirmIdCounter = 0;

function resolveToolConfirmation(requestId, approved) {
  const pending = pendingConfirmations.get(requestId);
  if (pending) {
    pending.resolve(approved);
    pendingConfirmations.delete(requestId);
  }
}

const DESTRUCTIVE_TOOLS = new Set(["write_file", "run_command", "delegate_to_claude_code"]);

// ═══════════════════════════════════════════
// Deep Project Knowledge
// ═══════════════════════════════════════════

function setCurrentProject(scanData) {
  currentProjectData = scanData;
  invalidatePromptCache();
}

function getCurrentProject() {
  return currentProjectData;
}

function setAllProjectScans(scansMap) {
  allProjectScans = scansMap;
  try {
    const scansArray = Array.from(scansMap.values());
    updateAllProjectsFromScans(scansArray);
    console.log("[PROJECTS] Auto-updated progress from git data");
  } catch (err) {
    console.error("[PROJECTS] Auto-update error:", err.message);
  }
  invalidatePromptCache();
}

function buildDeepProjectContext() {
  if (!currentProjectData) return "";
  const p = currentProjectData;
  const lines = [`PROJET EN COURS : ${p.name} (${p.path})`];
  if (p.techStack && p.techStack.length > 0) lines.push(`TECH STACK : ${p.techStack.join(", ")}`);
  if (p.fileCount) lines.push(`CODE : ${p.fileCount} fichiers, ${p.totalLines} lignes`);
  if (p.gitBranch) lines.push(`GIT : branche ${p.gitBranch}${p.gitStatus ? " (modifications en cours)" : " (clean)"}`);
  if (p.recentCommits && p.recentCommits.length > 0) {
    lines.push("DERNIERS COMMITS :");
    for (const c of p.recentCommits.slice(0, 10)) lines.push(`  ${c.hash} ${c.message} (${c.time})`);
  }
  if (p.scripts && Object.keys(p.scripts).length > 0) {
    lines.push("SCRIPTS NPM :");
    lines.push(...Object.entries(p.scripts).map(([k, v]) => `  ${k}: ${v}`).slice(0, 8));
  }
  if (p.fileTree && p.fileTree.length > 0) {
    lines.push("STRUCTURE (3 niveaux) :");
    lines.push(...p.fileTree.slice(0, 40));
  }
  if (p.description) lines.push(`DESCRIPTION : ${p.description}`);
  if (p.readme) lines.push(`README (extrait) :\n${p.readme.substring(0, 500)}`);
  return lines.join("\n");
}

function buildAllProjectsSummary() {
  if (allProjectScans.size === 0) return "";
  const lines = ["TOUS LES PROJETS SCANNES :"];
  for (const [, scan] of allProjectScans) {
    const stack = scan.techStack?.length > 0 ? ` [${scan.techStack.join(", ")}]` : "";
    const git = scan.gitBranch ? ` (${scan.gitBranch})` : "";
    const size = scan.fileCount ? ` — ${scan.fileCount} fichiers, ${scan.totalLines} lignes` : "";
    lines.push(`  - ${scan.name}${stack}${git}${size}`);
  }
  return lines.join("\n");
}

// ═══════════════════════════════════════════
// Temporal Context
// ═══════════════════════════════════════════

function getTimeContext() {
  const now = new Date();
  const hour = now.getHours();
  const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const monthNames = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
  let period;
  if (hour < 6) period = "nuit";
  else if (hour < 12) period = "matin";
  else if (hour < 14) period = "midi";
  else if (hour < 18) period = "apres-midi";
  else if (hour < 22) period = "soiree";
  else period = "nuit";
  return {
    hour, period,
    dayOfWeek: dayNames[now.getDay()],
    dayNum: now.getDate(),
    month: monthNames[now.getMonth()],
    year: now.getFullYear(),
    dateStr: `${dayNames[now.getDay()]} ${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`,
    timeStr: `${String(hour).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    isWeekend: now.getDay() === 0 || now.getDay() === 6,
  };
}

// ═══════════════════════════════════════════
// Shared Context Builder — used by all agents
// ═══════════════════════════════════════════

function getSharedContext() {
  const profile = getProfile();
  const memoryContext = memory.getContext();
  const time = getTimeContext();
  const projectsPrompt = getProjectsForPromptDetailed();
  const deepProjectCtx = buildDeepProjectContext();
  const allProjectsCtx = buildAllProjectsSummary();

  // Mood hint
  let moodHint = "";
  if (time.period === "matin") moodHint = "Yassine commence sa journee — sois energique et motive.";
  else if (time.period === "midi") moodHint = "C'est l'heure du dejeuner — sois decontracte.";
  else if (time.period === "apres-midi") moodHint = "Plein regime de travail — sois efficace et concentre.";
  else if (time.period === "soiree") moodHint = "Fin de journee — sois relax, reconnais le travail accompli.";
  else if (time.period === "nuit") moodHint = "Il est tard — sois bienveillant, suggere de se reposer si ca dure.";

  // Session summaries
  const recentSummaries = memory.getRecentSummaries(5);
  let sessionsCtx = "";
  if (recentSummaries.length > 0) {
    const lines = recentSummaries.map((s) => {
      const date = new Date(s.created_at).toLocaleDateString("fr-FR");
      const topics = s.topics ? ` [${s.topics}]` : "";
      return `- [${date}]${topics} ${s.summary}`;
    });
    sessionsCtx = `SESSIONS PRECEDENTES (tu te souviens de tout) :\n${lines.join("\n")}`;
  }

  // Daily journal
  const recentJournals = memory.getRecentJournals(5);
  let journalCtx = "";
  if (recentJournals.length > 0) {
    const lines = recentJournals.map((j) => {
      const mood = j.mood ? ` (${j.mood})` : "";
      const score = j.productivity_score ? ` [${j.productivity_score}/10]` : "";
      return `- ${j.date}${mood}${score}: ${j.summary}${j.highlights ? ` | ${j.highlights}` : ""}`;
    });
    journalCtx = `JOURNAL DES DERNIERS JOURS (ta memoire long-terme) :\n${lines.join("\n")}`;
  }

  return {
    profile, memoryContext, time, projectsPrompt,
    deepProjectCtx, allProjectsCtx,
    moodHint, sessionsCtx, journalCtx,
  };
}

// ═══════════════════════════════════════════
// Context Analysis — Intelligence proactive
// ═══════════════════════════════════════════

function analyzeContext() {
  const time = getTimeContext();
  const profile = getProfile();
  const projects = getProjects();
  const activeProjects = projects.filter((p) => p.status === "actif");
  const stats = {
    totalInteractions: memory.getStat("totalInteractions"),
    sessionsCount: memory.getStat("sessionsCount"),
    lastSessionDate: memory.getStat("lastSessionDate"),
  };
  const now = Date.now();
  const stalledProjects = activeProjects.filter((p) => {
    if (!p.last_activity) return false;
    return now - new Date(p.last_activity).getTime() > 7 * 24 * 60 * 60 * 1000;
  });
  const lowProgressProjects = activeProjects.filter((p) => p.progress < 30);
  const nearCompletionProjects = activeProjects.filter((p) => p.progress >= 80);
  let timeSuggestion = "";
  if (time.period === "matin") timeSuggestion = "Debut de journee — bon moment pour planifier et attaquer les taches difficiles.";
  else if (time.period === "apres-midi") timeSuggestion = "Apres-midi — ideal pour le code et les taches techniques.";
  else if (time.period === "soiree") timeSuggestion = "Soiree — bon pour les reviews, documentation et planification de demain.";
  else if (time.period === "nuit") timeSuggestion = "Il est tard — pense a te reposer si ce n'est pas urgent.";
  let sessionGap = null;
  if (stats.lastSessionDate) {
    const gapMs = now - Number(stats.lastSessionDate);
    sessionGap = { hours: Math.floor(gapMs / (1000 * 60 * 60)), days: Math.floor(gapMs / (1000 * 60 * 60 * 24)) };
  }
  return {
    time, profile,
    projects: {
      active: activeProjects, stalled: stalledProjects,
      lowProgress: lowProgressProjects, nearCompletion: nearCompletionProjects,
      totalCount: projects.length, activeCount: activeProjects.length,
      averageProgress: activeProjects.length > 0 ? Math.round(activeProjects.reduce((a, p) => a + p.progress, 0) / activeProjects.length) : 0,
    },
    stats, sessionGap, timeSuggestion,
  };
}

// ═══════════════════════════════════════════
// Prompt Cache (per-agent)
// ═══════════════════════════════════════════

function getCachedSystemPrompt(agentId, extraContext, { voiceMode = false } = {}) {
  const now = Date.now();
  const cache = promptCaches.get(agentId);

  if (cache && (now - cache.timestamp < CACHE_TTL) && cache.extraContext === extraContext && cache.voiceMode === voiceMode) {
    return cache.prompt;
  }

  const agent = getAgent(agentId);
  const sharedCtx = getSharedContext();
  const prompt = agent.buildSystemPrompt(sharedCtx, { voiceMode, extraContext });

  promptCaches.set(agentId, { prompt, timestamp: now, extraContext, voiceMode });
  return prompt;
}

function invalidatePromptCache() {
  promptCaches.clear();
}

// ═══════════════════════════════════════════
// Session History (per-agent)
// ═══════════════════════════════════════════

function addToHistory(agentId, role, content) {
  const history = getHistory(agentId);
  history.push({ role, content });
  if (history.length > MAX_HISTORY * 2) {
    const trimmed = history.slice(-MAX_HISTORY * 2);
    sessionHistories.set(agentId, trimmed);
  }
}

function getSessionHistory(agentId = "general") {
  return [...getHistory(agentId)];
}

function clearSessionHistory(agentId) {
  if (agentId) {
    sessionHistories.set(agentId, []);
  } else {
    sessionHistories.clear();
  }
}

// ═══════════════════════════════════════════
// Greeting Context — pour le frontend
// ═══════════════════════════════════════════

function getGreetingContext() {
  const ctx = analyzeContext();
  const alerts = [];
  if (ctx.sessionGap && ctx.sessionGap.days >= 2) alerts.push(`Absence de ${ctx.sessionGap.days} jours — faire un point complet.`);
  if (ctx.projects.stalled.length > 0) alerts.push(`Projets sans activite recente : ${ctx.projects.stalled.map((p) => p.name).join(", ")}`);
  if (ctx.projects.nearCompletion.length > 0) alerts.push(`Presque termines (>80%) : ${ctx.projects.nearCompletion.map((p) => `${p.name} (${p.progress}%)`).join(", ")}`);
  if (ctx.projects.lowProgress.length > 0) alerts.push(`Progression basse (<30%) : ${ctx.projects.lowProgress.map((p) => `${p.name} (${p.progress}%)`).join(", ")}`);
  return {
    profile: ctx.profile, time: ctx.time, projects: ctx.projects,
    stats: ctx.stats, sessionGap: ctx.sessionGap, timeSuggestion: ctx.timeSuggestion, alerts,
  };
}

// ═══════════════════════════════════════════
// Tool Execution — shared across all agents
// ═══════════════════════════════════════════

const ALLOWED_COMMANDS = ["npm", "npx", "node", "git", "python", "python3", "pip", "pip3", "ls", "cat", "echo", "mkdir", "touch", "cp", "mv"];
const IGNORE_DIRS_TOOL = new Set(["node_modules", ".git", ".next", "dist", "build", "__pycache__", ".venv", "venv", ".cache", "coverage"]);
const BINARY_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2", ".ttf", ".eot", ".mp3", ".mp4", ".zip", ".tar", ".gz", ".pdf", ".exe", ".dmg", ".icns"]);

function searchFilesRecursive(dir, regex, results, maxResults = 100, depth = 0) {
  if (depth > 8 || results.length >= maxResults) return;
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      if (results.length >= maxResults) return;
      if (IGNORE_DIRS_TOOL.has(item.name) || item.name.startsWith(".")) continue;
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        searchFilesRecursive(fullPath, regex, results, maxResults, depth + 1);
      } else {
        if (BINARY_EXTS.has(path.extname(item.name).toLowerCase())) continue;
        try {
          const content = fs.readFileSync(fullPath, "utf8");
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              results.push(`${fullPath}:${i + 1}: ${lines[i].trim().substring(0, 200)}`);
              if (results.length >= maxResults) return;
            }
          }
        } catch {}
      }
    }
  } catch {}
}

function executeToolCall(name, input) {
  const projectPath = currentProjectData?.path || "";

  try {
    switch (name) {
      case "read_file": {
        const filePath = input.path;
        if (filePath.includes("..")) return { error: "Path traversal blocked" };
        if (!fs.existsSync(filePath)) return { error: `File not found: ${filePath}` };
        const content = fs.readFileSync(filePath, "utf8");
        return { content: content.substring(0, 50000) };
      }

      case "write_file": {
        const filePath = input.path;
        if (filePath.includes("..")) return { error: "Path traversal blocked" };
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, input.content, "utf8");
        return { success: true, message: `Fichier ecrit: ${filePath} (${input.content.length} caracteres)` };
      }

      case "list_files": {
        const dirPath = input.directory;
        if (dirPath.includes("..")) return { error: "Path traversal blocked" };
        if (!fs.existsSync(dirPath)) return { error: `Directory not found: ${dirPath}` };
        const items = fs.readdirSync(dirPath, { withFileTypes: true });
        const files = items
          .filter(i => !IGNORE_DIRS_TOOL.has(i.name) && !i.name.startsWith("."))
          .map(i => `${i.isDirectory() ? "[DIR] " : ""}${i.name}`)
          .join("\n");
        return { files };
      }

      case "run_command": {
        const cwd = input.cwd || projectPath;
        if (!cwd) return { error: "No cwd specified and no current project set" };
        const cmdBase = input.command.trim().split(/\s+/)[0];
        if (!ALLOWED_COMMANDS.includes(cmdBase)) return { error: `Commande non autorisee: ${cmdBase}` };
        const output = execSync(input.command, { cwd, encoding: "utf8", stdio: "pipe", timeout: 30000 });
        return { output: output.substring(0, 20000) };
      }

      case "search_files": {
        const dirPath = input.directory;
        if (dirPath.includes("..")) return { error: "Path traversal blocked" };
        if (!fs.existsSync(dirPath)) return { error: `Directory not found: ${dirPath}` };
        let regex;
        try { regex = new RegExp(input.query, "i"); } catch { regex = new RegExp(input.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); }
        const results = [];
        searchFilesRecursive(dirPath, regex, results);
        if (results.length === 0) return { message: "Aucun resultat trouve.", matches: [] };
        return { message: `${results.length} resultat(s) trouve(s)`, matches: results };
      }

      case "delegate_to_claude_code": {
        const cwd = input.cwd || projectPath;
        if (!cwd) return { error: "No cwd specified and no current project set" };
        if (!fs.existsSync(cwd)) return { error: `Directory not found: ${cwd}` };
        try {
          const output = execSync(
            `claude -p ${JSON.stringify(input.instruction)} --no-input`,
            { cwd, encoding: "utf8", stdio: "pipe", timeout: 120000, maxBuffer: 1024 * 1024 }
          );
          return { success: true, output: output.substring(0, 30000) };
        } catch (err) {
          return { error: err.message?.substring(0, 500), stderr: err.stderr?.substring(0, 5000) || "", stdout: err.stdout?.substring(0, 10000) || "" };
        }
      }

      case "read_gastroflow_script": {
        // GastroBot specialized tool
        const { GASTROFLOW_SCRIPT_PATH } = require("./agents/gastrobot");
        if (!fs.existsSync(GASTROFLOW_SCRIPT_PATH)) {
          return { error: `GastroFlow script not found at: ${GASTROFLOW_SCRIPT_PATH}` };
        }
        const content = fs.readFileSync(GASTROFLOW_SCRIPT_PATH, "utf8");
        const section = (input.section || "all").toLowerCase();

        if (section === "all") {
          return { content: content.substring(0, 50000), lines: content.split("\n").length };
        }

        // Filter by section keyword — find blocks starting with // === or // --- headers
        const lines = content.split("\n");
        const filtered = [];
        let inSection = false;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const isHeader = /^\/\/\s*[═━─=]{3,}/.test(line) || /^\/\/\s*(function|SECTION|MENU|STOCK|COMMANDE|PRODUCTION|TRESORERIE|PDF|ANALYSE)/i.test(line);
          if (isHeader) {
            inSection = line.toLowerCase().includes(section);
          }
          if (inSection) filtered.push(`${i + 1}: ${line}`);
        }

        if (filtered.length === 0) {
          // Fallback: search for the keyword in the file
          const matches = [];
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(section)) {
              const start = Math.max(0, i - 2);
              const end = Math.min(lines.length, i + 20);
              for (let j = start; j < end; j++) {
                matches.push(`${j + 1}: ${lines[j]}`);
              }
              matches.push("---");
              if (matches.length > 200) break;
            }
          }
          return { content: matches.join("\n").substring(0, 30000), matchCount: matches.length };
        }

        return { content: filtered.join("\n").substring(0, 30000), lines: filtered.length };
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { error: err.message?.substring(0, 2000) || "Unknown error" };
  }
}

// ═══════════════════════════════════════════
// Session Summary — Periodic conversation digest
// ═══════════════════════════════════════════

let messageCountSinceLastSummary = 0;
const SUMMARY_INTERVAL = 10;

async function generateSessionSummary() {
  // Gather all histories for summary
  const allMessages = [];
  for (const [, hist] of sessionHistories) {
    allMessages.push(...hist);
  }
  if (allMessages.length < 4) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  try {
    const Anthropic = require("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const digest = allMessages
      .slice(-20)
      .map((m) => `${m.role === "user" ? "Yassine" : "AGENT"}: ${String(m.content).substring(0, 300)}`)
      .join("\n");

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: `Resume cette conversation en 3-5 phrases. Extrais aussi :
- SUJETS : les themes abordes (liste courte)
- DECISIONS : les choix faits ou actions lancees

Reponds en JSON sans markdown :
{"summary":"...", "topics":"sujet1, sujet2", "decisions":"decision1, decision2"}`,
      messages: [{ role: "user", content: digest }],
    });

    const text = response.content[0]?.text?.trim();
    if (!text) return;

    let parsed;
    try { parsed = JSON.parse(text); } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else return;
    }

    if (parsed.summary) {
      memory.saveSessionSummary(memory.SESSION_ID, parsed.summary, parsed.topics || "", parsed.decisions || "", allMessages.length);
      console.log(`[SESSION-SUMMARY] Saved: ${parsed.summary.substring(0, 80)}...`);
      invalidatePromptCache();
    }
  } catch (err) {
    console.error("[SESSION-SUMMARY] Error:", err.message);
  }
}

// ═══════════════════════════════════════════
// Auto-Learning — Extract facts from conversations
// ═══════════════════════════════════════════

let lastLearnTime = 0;
const LEARN_COOLDOWN = 10000;

async function extractAndStoreFacts(userMessage, assistantResponse) {
  const now = Date.now();
  if (now - lastLearnTime < LEARN_COOLDOWN) return;
  lastLearnTime = now;
  if (userMessage.length < 15 && assistantResponse.length < 50) return;
  const cleanResponse = assistantResponse.replace(/>\s*(🔍|✏️|📁|⚡|🔎|✅|❌|📦).*\n/g, "").trim();
  if (cleanResponse.length < 30) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  try {
    const Anthropic = require("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });
    const existingFacts = memory.getContext();

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: `Tu es un extracteur de faits. Analyse cette conversation et extrais UNIQUEMENT les informations nouvelles et importantes a retenir sur l'utilisateur Yassine.

CATEGORIES : business, projet, preference, personnel, technique, objectif
IMPORTANCE : 1-10 (10 = critique, 7-9 = important, 4-6 = utile, 1-3 = anecdotique)

REGLES :
- Extrais SEULEMENT des faits concrets et factuels
- Maximum 3 faits par conversation
- Ne repete PAS les faits deja connus
- Si rien de nouveau, reponds avec un tableau vide

FAITS DEJA CONNUS :
${existingFacts.substring(0, 2000)}

Reponds UNIQUEMENT en JSON valide, sans markdown :
[{"fact":"...", "category":"...", "importance": N}]
ou [] si rien de nouveau.`,
      messages: [{ role: "user", content: `UTILISATEUR: ${userMessage.substring(0, 500)}\n\nASSISTANT: ${cleanResponse.substring(0, 1000)}` }],
    });

    const text = response.content[0]?.text?.trim();
    if (!text) return;
    let facts;
    try { facts = JSON.parse(text); } catch {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) facts = JSON.parse(match[0]);
      else return;
    }
    if (!Array.isArray(facts) || facts.length === 0) return;
    for (const f of facts) {
      if (f.fact && f.fact.length > 5) {
        memory.addFact(f.fact, f.category || "general", f.importance || 5);
        console.log(`[AUTO-LEARN] +${f.importance || 5} "${f.fact}" [${f.category}]`);
      }
    }
  } catch (err) {
    console.error("[AUTO-LEARN] Error:", err.message);
  }
}

// ═══════════════════════════════════════════
// Streaming Chat — Multi-Agent (with tool-use)
// ═══════════════════════════════════════════

async function handleChat(message, context, mainWindow, { voiceMode = false, agentId = "general" } = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.length < 50 || apiKey.includes("...")) {
    mainWindow.webContents.send("stream-error", "Cle API invalide. Verifie .env");
    return;
  }

  const safeSend = (channel, data) => {
    try {
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send(channel, data);
      }
    } catch {}
  };

  const agent = getAgent(agentId);
  console.log(`[AGENT] ${agent.name} processing message (voice=${voiceMode})`);

  try {
    const Anthropic = require("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    addToHistory(agentId, "user", message);

    const systemPrompt = getCachedSystemPrompt(agentId, context, { voiceMode });
    const maxTokens = voiceMode ? agent.maxTokens.voice : agent.maxTokens.text;

    let messages = getHistory(agentId).map((m) => ({ role: m.role, content: m.content }));

    const MAX_TOOL_ROUNDS = 8;
    let fullText = "";

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await client.messages.create({
        model: agent.model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
        tools: agent.tools,
      });

      const toolUseBlocks = [];
      let textContent = "";
      for (const block of response.content) {
        if (block.type === "text") textContent += block.text;
        else if (block.type === "tool_use") toolUseBlocks.push(block);
      }

      if (textContent) {
        fullText += textContent;
        safeSend("stream-chunk", textContent);
      }

      if (toolUseBlocks.length === 0 || response.stop_reason === "end_turn") break;

      messages.push({ role: "assistant", content: response.content });

      const toolResults = [];
      for (const toolBlock of toolUseBlocks) {
        console.log(`[${agent.name}] Tool: ${toolBlock.name}`);
        const toolNotif = `\n\n> ${formatToolNotification(toolBlock.name, toolBlock.input, "start")}\n`;
        fullText += toolNotif;
        safeSend("stream-chunk", toolNotif);

        let result;
        if (DESTRUCTIVE_TOOLS.has(toolBlock.name)) {
          const requestId = String(++confirmIdCounter);
          const preview = toolBlock.name === "write_file"
            ? (toolBlock.input.content || "").substring(0, 500)
            : toolBlock.name === "delegate_to_claude_code"
            ? (toolBlock.input.instruction || "").substring(0, 500)
            : null;

          safeSend("tool-confirm-request", { requestId, toolName: toolBlock.name, input: toolBlock.input, preview });
          const approved = await new Promise((resolve) => { pendingConfirmations.set(requestId, { resolve }); });

          if (approved) {
            result = executeToolCall(toolBlock.name, toolBlock.input);
            const doneNotif = `\n\n> ${formatToolNotification(toolBlock.name, toolBlock.input, "done")}\n`;
            fullText += doneNotif;
            safeSend("stream-chunk", doneNotif);
          } else {
            result = { error: "Action refusee par l'utilisateur." };
            fullText += `\n\n> ❌ Action refusee par l'utilisateur.\n`;
            safeSend("stream-chunk", `\n\n> ❌ Action refusee par l'utilisateur.\n`);
          }
        } else {
          result = executeToolCall(toolBlock.name, toolBlock.input);
          const doneNotif = `\n\n> ${formatToolNotification(toolBlock.name, toolBlock.input, "done")}\n`;
          fullText += doneNotif;
          safeSend("stream-chunk", doneNotif);
        }

        toolResults.push({ type: "tool_result", tool_use_id: toolBlock.id, content: JSON.stringify(result).substring(0, 10000) });
      }

      messages.push({ role: "user", content: toolResults });
    }

    // Finalize
    addToHistory(agentId, "assistant", fullText);
    memory.addConversation(message.substring(0, 200));
    safeSend("stream-end", fullText);

    extractAndStoreFacts(message, fullText).catch((err) => console.error("[AGENT] Auto-learn error:", err.message));

    messageCountSinceLastSummary++;
    if (messageCountSinceLastSummary >= SUMMARY_INTERVAL) {
      messageCountSinceLastSummary = 0;
      generateSessionSummary().then(() => memory.generateDailyDigest()).catch((err) => console.error("[AGENT] Summary/digest error:", err.message));
    }
  } catch (err) {
    console.error(`[${agent.name}] Error:`, err.message);
    safeSend("stream-error", err.message);
  }
}

// Format tool notifications with icons
function formatToolNotification(name, input, phase) {
  if (phase === "start") {
    switch (name) {
      case "read_file": return `🔍 Lecture de \`${path.basename(input.path)}\`...`;
      case "write_file": return `✏️ Ecriture de \`${path.basename(input.path)}\` — ⏳ En attente de validation...`;
      case "list_files": return `📁 Exploration de \`${path.basename(input.directory)}\`...`;
      case "run_command": return `⚡ Commande \`${input.command}\` — ⏳ En attente de validation...`;
      case "search_files": return `🔎 Recherche de "${input.query}" dans \`${path.basename(input.directory)}\`...`;
      case "delegate_to_claude_code": return `🤖 Delegation a Claude Code — ⏳ En attente de validation...`;
      case "read_gastroflow_script": return `📦 Lecture du script GastroFlow (section: ${input.section})...`;
      default: return `🔧 ${name}...`;
    }
  } else {
    switch (name) {
      case "read_file": return `✅ Fichier lu : \`${path.basename(input.path)}\``;
      case "write_file": return `✅ Fichier ecrit : \`${path.basename(input.path)}\` (${input.content?.length || 0} car.)`;
      case "list_files": return `✅ Repertoire explore : \`${path.basename(input.directory)}\``;
      case "run_command": return `✅ Commande terminee : \`${input.command}\``;
      case "search_files": return `✅ Recherche terminee pour "${input.query}"`;
      case "delegate_to_claude_code": return `✅ Claude Code a termine sa tache`;
      case "read_gastroflow_script": return `✅ Script GastroFlow lu (section: ${input.section})`;
      default: return `✅ ${name} termine`;
    }
  }
}

// ═══════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════

module.exports = {
  handleChat,
  getSessionHistory,
  clearSessionHistory,
  analyzeContext,
  getGreetingContext,
  invalidatePromptCache,
  getSharedContext,
  setCurrentProject,
  getCurrentProject,
  setAllProjectScans,
  resolveToolConfirmation,
  generateSessionSummary,
};
