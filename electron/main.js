const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const memory = require("./memory");
const os = require("os");
const { execSync } = require("child_process");

// Load .env manually for reliability
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  envContent.split("\n").forEach(line => {
    const [key, ...vals] = line.split("=");
    if (key && vals.length > 0 && !key.startsWith("#")) {
      process.env[key.trim()] = vals.join("=").trim();
    }
  });
}
console.log("[OUMNIA] API Key:", process.env.ANTHROPIC_API_KEY ? "OK" : "MISSING");

let Store;
try { Store = require("electron-store"); } catch(e) { Store = null; }
const store = Store ? new Store() : { get: () => null, set: () => {} };
const isDev = !app.isPackaged;

// ═══ CLAUDE AI AGENT ═══
function setupClaudeAgent() {
  ipcMain.handle("claude-chat", async (_, { message, context }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey.length < 50 || apiKey.includes("...")) {
      return { success: false, error: "Clé API invalide. Vérifie .env" };
    }
    try {
      const Anthropic = require("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey });
      const systemPrompt = `Tu es OUMNIA, l'assistant AI personnel de Yassine, Directeur Général de Oumnia Restaurant (3 restaurants à Marrakech : Semlalia, Médina, Guéliz, depuis 2011) et développeur autodidacte.

Tu travailles avec Oussama sur les projets GASTROFLOW et Snack Pizzeria Oumnia.

MEMOIRE PERSISTANTE :
${memory.getContext()}

CONTEXTE PROJETS ACTIFS :
${context || "Pas de contexte."}

Projets principaux :
- GASTROFLOW : ERP restaurant, Google Apps Script + Sheets, 2000+ lignes, 286+ articles, 9 fournisseurs
- Oumnia Digital Agency : SaaS vidéo AI, 12 agents, 5 départements, Streamlit, video_engine.py (ImagineArt + Runway)
- OCR_BONS_SYSTEM : Scan bons livraison via Claude Vision API, 9 fournisseurs
- Oumnia Studio v2.0 : Learning system + feedback + Google Reviews + Liquid Glass (GitHub: yassine85me-prog/content-generator)
- Catalogue Digital : gastroflow-by-oumnia.netlify.app (terminé)

PRIORITÉS : 1) Clés API ImagineArt 2) Branche dev 3) Pipeline text gen 4) 10 vidéos portfolio
MACHINES : MacBook M5 + Lenovo Windows
STACK : Google Apps Script, Python, Streamlit, React, Claude API, Google Sheets, Electron

Réponds en français, concis et actionnable. Sois proactif.`;

      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: message }],
      });
      memory.addConversation(message.substring(0, 100));
      return { success: true, text: response.content[0].text };
    } catch (err) {
      console.error("[OUMNIA] API Error:", err.message);
      return { success: false, error: err.message };
    }
  });
}

// ═══ GOOGLE SHEETS ═══
function setupGoogleSheets() {
  ipcMain.handle("sheets-load-projects", async () => {
    return { success: false, useDefaults: true };
  });
  ipcMain.handle("sheets-update-progress", async () => {
    return { success: false };
  });
}

// ═══ LOCAL STORE ═══
function setupLocalStore() {
  ipcMain.handle("store-get", (_, key) => store.get(key));
  ipcMain.handle("store-set", (_, key, value) => { store.set(key, value); return true; });
}

// ═══ EXTERNAL LINKS ═══
function setupExternalLinks() {
  ipcMain.handle("open-external", (_, url) => shell.openExternal(url));
}

// ═══ MEMORY ═══
function setupMemory() {
  ipcMain.handle("memory-save", async (_, data) => {
    memory.saveMemory(data);
    return { success: true };
  });
  ipcMain.handle("memory-load", async () => {
    const data = memory.loadMemory();
    return { success: true, data };
  });
}

// ═══ PROJECT SCANNER ═══
function setupProjectScanner() {
  ipcMain.handle("scan-projects", async () => {
    const scanDirs = [
      path.join(os.homedir(), "Full_AI", "Projects"),
      path.join(os.homedir(), "Documents"),
      path.join(os.homedir(), "Desktop"),
    ];
    const projects = [];
    for (const dir of scanDirs) {
      if (!fs.existsSync(dir)) continue;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
        const fullPath = path.join(dir, entry.name);
        try {
          const files = fs.readdirSync(fullPath);
          let totalSize = 0;
          let lastModified = 0;
          for (const f of files) {
            try {
              const stat = fs.statSync(path.join(fullPath, f));
              totalSize += stat.size;
              if (stat.mtimeMs > lastModified) lastModified = stat.mtimeMs;
            } catch {}
          }
          let git = null;
          try {
            const branch = execSync("git branch --show-current", { cwd: fullPath, encoding: "utf8" }).trim();
            const status = execSync("git status --porcelain", { cwd: fullPath, encoding: "utf8" }).trim();
            git = { branch, dirty: status.length > 0 };
          } catch {}
          projects.push({
            name: entry.name,
            path: fullPath,
            fileCount: files.length,
            totalSize,
            lastModified: lastModified ? new Date(lastModified).toISOString() : null,
            git,
          });
        } catch {}
      }
    }
    return { success: true, projects };
  });
}

// ═══ SYSTEM INFO ═══
function setupSystemInfo() {
  ipcMain.handle("get-system-info", async () => {
    return {
      success: true,
      platform: os.platform(),
      hostname: os.hostname(),
      cpuModel: os.cpus()[0]?.model || "Unknown",
      freemem: (os.freemem() / 1073741824).toFixed(1) + " GB",
      totalmem: (os.totalmem() / 1073741824).toFixed(1) + " GB",
      uptime: Math.floor(os.uptime() / 3600) + "h",
      datetime: new Date().toLocaleString("fr-FR"),
    };
  });
}

// ═══ AUTO-LAUNCH ═══
function setupAutoLaunch() {
  ipcMain.handle("toggle-auto-launch", async () => true);
  ipcMain.handle("get-auto-launch", () => true);
}

// ═══ WINDOW ═══
let mainWindow;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1200, minHeight: 700,
    backgroundColor: "#060610",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 15, y: 15 },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      scrollBounce: true,
    },
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  memory.incrementSession();
  setupAutoLaunch();
  setupClaudeAgent();
  setupGoogleSheets();
  setupLocalStore();
  setupExternalLinks();
  setupMemory();
  setupProjectScanner();
  setupSystemInfo();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
