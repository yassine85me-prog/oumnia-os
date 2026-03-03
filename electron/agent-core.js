// ═══════════════════════════════════════════
// OUMNIA OS — Agent Core (GENERAL Brain)
// Chat intelligent avec streaming, memoire, contexte, analyse proactive
// ═══════════════════════════════════════════

const memory = require("./memory-manager");
const { getProfile } = require("./profile-manager");
const { getProjectsForPrompt, getProjects } = require("./project-manager");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ── Historique conversationnel de la session ──
const MAX_HISTORY = 10;
let sessionHistory = [];

// ── Cache du system prompt ──
let cachedPrompt = null;
let cacheTimestamp = 0;
let cacheExtraContext = "";
let cacheVoiceMode = false;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ── Deep project knowledge ──
let currentProjectData = null;
let allProjectScans = new Map(); // path -> scan data

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
  invalidatePromptCache();
}

function buildDeepProjectContext() {
  if (!currentProjectData) return "";

  const p = currentProjectData;
  const lines = [`PROJET EN COURS : ${p.name} (${p.path})`];

  if (p.techStack && p.techStack.length > 0) {
    lines.push(`TECH STACK : ${p.techStack.join(", ")}`);
  }

  if (p.fileCount) {
    lines.push(`CODE : ${p.fileCount} fichiers, ${p.totalLines} lignes`);
  }

  if (p.gitBranch) {
    lines.push(`GIT : branche ${p.gitBranch}${p.gitStatus ? " (modifications en cours)" : " (clean)"}`);
  }

  if (p.recentCommits && p.recentCommits.length > 0) {
    lines.push("DERNIERS COMMITS :");
    const commits = p.recentCommits.slice(0, 10);
    for (const c of commits) {
      lines.push(`  ${c.hash} ${c.message} (${c.time})`);
    }
  }

  if (p.scripts && Object.keys(p.scripts).length > 0) {
    const scriptList = Object.entries(p.scripts).map(([k, v]) => `  ${k}: ${v}`).slice(0, 8);
    lines.push("SCRIPTS NPM :");
    lines.push(...scriptList);
  }

  if (p.fileTree && p.fileTree.length > 0) {
    lines.push("STRUCTURE (3 niveaux) :");
    lines.push(...p.fileTree.slice(0, 40));
  }

  if (p.description) {
    lines.push(`DESCRIPTION : ${p.description}`);
  }

  if (p.readme) {
    const readmePreview = p.readme.substring(0, 500);
    lines.push(`README (extrait) :\n${readmePreview}`);
  }

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
    hour,
    period,
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

  // Projets stagnants (pas d'activite depuis 7+ jours)
  const stalledProjects = activeProjects.filter((p) => {
    if (!p.last_activity) return false;
    const lastActivity = new Date(p.last_activity).getTime();
    return now - lastActivity > 7 * 24 * 60 * 60 * 1000;
  });

  // Projets basse progression (<30%)
  const lowProgressProjects = activeProjects.filter((p) => p.progress < 30);

  // Projets presque termines (>80%)
  const nearCompletionProjects = activeProjects.filter((p) => p.progress >= 80);

  // Suggestion basee sur l'heure
  let timeSuggestion = "";
  if (time.period === "matin") {
    timeSuggestion = "Debut de journee — bon moment pour planifier et attaquer les taches difficiles.";
  } else if (time.period === "apres-midi") {
    timeSuggestion = "Apres-midi — ideal pour le code et les taches techniques.";
  } else if (time.period === "soiree") {
    timeSuggestion = "Soiree — bon pour les reviews, documentation et planification de demain.";
  } else if (time.period === "nuit") {
    timeSuggestion = "Il est tard — pense a te reposer si ce n'est pas urgent.";
  }

  // Gap depuis la derniere session
  let sessionGap = null;
  if (stats.lastSessionDate) {
    const gapMs = now - Number(stats.lastSessionDate);
    const gapHours = Math.floor(gapMs / (1000 * 60 * 60));
    const gapDays = Math.floor(gapHours / 24);
    sessionGap = { hours: gapHours, days: gapDays };
  }

  return {
    time,
    profile,
    projects: {
      active: activeProjects,
      stalled: stalledProjects,
      lowProgress: lowProgressProjects,
      nearCompletion: nearCompletionProjects,
      totalCount: projects.length,
      activeCount: activeProjects.length,
      averageProgress:
        activeProjects.length > 0
          ? Math.round(activeProjects.reduce((a, p) => a + p.progress, 0) / activeProjects.length)
          : 0,
    },
    stats,
    sessionGap,
    timeSuggestion,
  };
}

// ═══════════════════════════════════════════
// System Prompt — Dynamic, contextual
// ═══════════════════════════════════════════

function buildSystemPrompt(extraContext, { voiceMode = false } = {}) {
  const profile = getProfile();
  const projectsPrompt = getProjectsForPrompt();
  const memoryContext = memory.getContext();
  const time = getTimeContext();

  const voiceInstructions = voiceMode
    ? `MODE VOCAL ACTIF :
- Reponds en 2-3 phrases MAXIMUM
- Pas de markdown, pas de code blocks, pas de listes a puces
- Langage naturel et conversationnel
- Si on te demande de coder, utilise tes outils (read_file, write_file, run_command) pour le faire DIRECTEMENT
- Apres avoir code, confirme vocalement : "C'est fait, j'ai cree/modifie X"
- Ne montre pas le code dans ta reponse vocale — execute-le directement`
    : `MODE TEXTE :
- Utilise le markdown pour structurer (titres, listes, code blocks)
- Si on te demande du code, utilise tes outils pour lire/ecrire les fichiers directement
- Tu peux aussi montrer le code dans ta reponse ET l'ecrire sur disque
- Tu peux etre detaille quand necessaire`;

  const deepProjectCtx = buildDeepProjectContext();
  const allProjectsCtx = buildAllProjectsSummary();

  return `Tu es GENERAL, l'assistant AI personnel de ${profile.name || "Yassine"}, ${profile.role || "Directeur General"} a ${profile.city || "Marrakech"}, et developpeur autodidacte.

DATE ET HEURE : ${time.dateStr}, ${time.timeStr} (${time.period})
${time.isWeekend ? "C'est le weekend." : ""}

Tu travailles avec ${profile.partner || "Oussama"} sur les projets GASTROFLOW et Snack Pizzeria Oumnia.

MEMOIRE PERSISTANTE :
${memoryContext}

PROJETS ACTIFS :
${projectsPrompt}

${deepProjectCtx ? `CONNAISSANCE PROFONDE DU PROJET :\n${deepProjectCtx}` : ""}

${allProjectsCtx}

CONTEXTE SUPPLEMENTAIRE :
${extraContext || "Aucun."}

MACHINES : ${profile.machines || "MacBook M5 + Lenovo Windows"}
STACK : ${profile.stack || "Google Apps Script, Python, Streamlit, React, Claude API, Google Sheets, Electron"}

${voiceInstructions}

CAPACITES (outils disponibles) :
- read_file : lire n'importe quel fichier du projet
- write_file : creer ou modifier des fichiers
- list_files : explorer les repertoires
- run_command : executer npm, git, python, node, etc.
Tu peux enchainer plusieurs outils pour accomplir des taches complexes (ex: lire un fichier, le modifier, lancer les tests).

REGLES :
- Reponds en francais, concis et actionnable
- Sois proactif : suggere les prochaines etapes
- Tu as acces a la memoire : rappelle-toi des conversations precedentes
- Ton identite est GENERAL (pas OUMNIA — OUMNIA est le nom du systeme OS)
- Ton style : commandant bienveillant, direct, tu anticipes les besoins
- Tu connais la structure exacte des projets, leurs commits, leur tech stack — utilise cette connaissance
- Quand on te demande de coder, FAIS-LE directement avec tes outils — ne te contente pas de montrer le code`;
}

// ═══════════════════════════════════════════
// Prompt Cache
// ═══════════════════════════════════════════

function getCachedSystemPrompt(extraContext, { voiceMode = false } = {}) {
  const now = Date.now();
  const expired = now - cacheTimestamp > CACHE_TTL;
  const contextChanged = extraContext !== cacheExtraContext;
  const voiceChanged = voiceMode !== cacheVoiceMode;

  if (cachedPrompt && !expired && !contextChanged && !voiceChanged) {
    return cachedPrompt;
  }

  cachedPrompt = buildSystemPrompt(extraContext, { voiceMode });
  cacheTimestamp = now;
  cacheExtraContext = extraContext;
  cacheVoiceMode = voiceMode;
  return cachedPrompt;
}

function invalidatePromptCache() {
  cachedPrompt = null;
  cacheTimestamp = 0;
}

// ═══════════════════════════════════════════
// Session History
// ═══════════════════════════════════════════

function addToHistory(role, content) {
  sessionHistory.push({ role, content });
  if (sessionHistory.length > MAX_HISTORY * 2) {
    sessionHistory = sessionHistory.slice(-MAX_HISTORY * 2);
  }
}

function getSessionHistory() {
  return [...sessionHistory];
}

function clearSessionHistory() {
  sessionHistory = [];
}

// ═══════════════════════════════════════════
// Greeting Context — pour le frontend
// ═══════════════════════════════════════════

function getGreetingContext() {
  const ctx = analyzeContext();
  const alerts = [];

  if (ctx.sessionGap && ctx.sessionGap.days >= 2) {
    alerts.push(`Absence de ${ctx.sessionGap.days} jours — faire un point complet.`);
  }

  if (ctx.projects.stalled.length > 0) {
    alerts.push(`Projets sans activite recente : ${ctx.projects.stalled.map((p) => p.name).join(", ")}`);
  }

  if (ctx.projects.nearCompletion.length > 0) {
    alerts.push(`Presque termines (>80%) : ${ctx.projects.nearCompletion.map((p) => `${p.name} (${p.progress}%)`).join(", ")}`);
  }

  if (ctx.projects.lowProgress.length > 0) {
    alerts.push(`Progression basse (<30%) : ${ctx.projects.lowProgress.map((p) => `${p.name} (${p.progress}%)`).join(", ")}`);
  }

  return {
    profile: ctx.profile,
    time: ctx.time,
    projects: ctx.projects,
    stats: ctx.stats,
    sessionGap: ctx.sessionGap,
    timeSuggestion: ctx.timeSuggestion,
    alerts,
  };
}

// ═══════════════════════════════════════════
// Tool-Use — GENERAL peut coder
// ═══════════════════════════════════════════

const TOOLS = [
  {
    name: "read_file",
    description: "Lire le contenu d'un fichier du projet. Utilise des chemins absolus.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string", description: "Chemin absolu du fichier" } },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Ecrire ou creer un fichier dans le projet. Cree les repertoires parents si necessaire.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Chemin absolu du fichier" },
        content: { type: "string", description: "Contenu complet du fichier" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "list_files",
    description: "Lister les fichiers et dossiers d'un repertoire du projet.",
    input_schema: {
      type: "object",
      properties: { directory: { type: "string", description: "Chemin absolu du repertoire" } },
      required: ["directory"],
    },
  },
  {
    name: "run_command",
    description: "Executer une commande shell dans le repertoire du projet. Commandes autorisees : npm, npx, node, git, python, python3, pip, ls, cat, echo, mkdir, touch, cp, mv.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "La commande a executer" },
        cwd: { type: "string", description: "Repertoire de travail (chemin absolu)" },
      },
      required: ["command"],
    },
  },
];

const ALLOWED_COMMANDS = ["npm", "npx", "node", "git", "python", "python3", "pip", "pip3", "ls", "cat", "echo", "mkdir", "touch", "cp", "mv"];
const IGNORE_DIRS_TOOL = new Set(["node_modules", ".git", ".next", "dist", "build", "__pycache__", ".venv", "venv", ".cache", "coverage"]);

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
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, input.content, "utf8");
        console.log("[TOOL] write_file:", filePath, `(${input.content.length} chars)`);
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
        if (!ALLOWED_COMMANDS.includes(cmdBase)) {
          return { error: `Commande non autorisee: ${cmdBase}` };
        }
        console.log("[TOOL] run_command:", input.command, "in", cwd);
        const output = execSync(input.command, { cwd, encoding: "utf8", stdio: "pipe", timeout: 30000 });
        return { output: output.substring(0, 20000) };
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { error: err.message?.substring(0, 2000) || "Unknown error" };
  }
}

// ═══════════════════════════════════════════
// Streaming Chat — Claude API (with tool-use)
// ═══════════════════════════════════════════

async function handleChat(message, context, mainWindow, { voiceMode = false } = {}) {
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

  try {
    const Anthropic = require("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    addToHistory("user", message);

    const systemPrompt = getCachedSystemPrompt(context, { voiceMode });
    const maxTokens = voiceMode ? 1024 : 8192;

    // Build messages from session history
    let messages = sessionHistory.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // ═══ Tool-Use Loop ═══
    // Claude may request tools multiple times before giving a final text response
    const MAX_TOOL_ROUNDS = 8;
    let fullText = "";

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
        tools: TOOLS,
      });

      // Process response content blocks
      const toolUseBlocks = [];
      let textContent = "";

      for (const block of response.content) {
        if (block.type === "text") {
          textContent += block.text;
        } else if (block.type === "tool_use") {
          toolUseBlocks.push(block);
        }
      }

      // If there's text, stream it to the frontend
      if (textContent) {
        fullText += textContent;
        safeSend("stream-chunk", textContent);
      }

      // If no tool calls or stop_reason is "end_turn", we're done
      if (toolUseBlocks.length === 0 || response.stop_reason === "end_turn") {
        break;
      }

      // Execute tool calls and build tool results
      // Add the assistant message (with tool_use blocks) to messages
      messages.push({ role: "assistant", content: response.content });

      const toolResults = [];
      for (const toolBlock of toolUseBlocks) {
        console.log(`[AGENT] Tool call: ${toolBlock.name}`, JSON.stringify(toolBlock.input).substring(0, 200));

        // Notify frontend about tool action
        safeSend("stream-chunk", `\n\n> **${toolBlock.name}** : ${formatToolInput(toolBlock.name, toolBlock.input)}\n`);

        const result = executeToolCall(toolBlock.name, toolBlock.input);
        const resultStr = JSON.stringify(result).substring(0, 10000);
        console.log(`[AGENT] Tool result: ${resultStr.substring(0, 200)}`);

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolBlock.id,
          content: resultStr,
        });
      }

      // Add tool results to messages for the next round
      messages.push({ role: "user", content: toolResults });
    }

    // Done — finalize
    addToHistory("assistant", fullText);
    memory.addConversation(message.substring(0, 200));
    safeSend("stream-end", fullText);
  } catch (err) {
    console.error("[AGENT] Error:", err.message);
    safeSend("stream-error", err.message);
  }
}

// Format tool input for display
function formatToolInput(name, input) {
  switch (name) {
    case "read_file": return `Lecture de \`${input.path}\``;
    case "write_file": return `Ecriture de \`${input.path}\` (${input.content?.length || 0} car.)`;
    case "list_files": return `Liste de \`${input.directory}\``;
    case "run_command": return `\`${input.command}\`${input.cwd ? ` dans ${input.cwd}` : ""}`;
    default: return JSON.stringify(input).substring(0, 100);
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
  buildSystemPrompt,
  setCurrentProject,
  getCurrentProject,
  setAllProjectScans,
};
