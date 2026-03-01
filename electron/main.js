const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");

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
  setupAutoLaunch();
  setupClaudeAgent();
  setupGoogleSheets();
  setupLocalStore();
  setupExternalLinks();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
