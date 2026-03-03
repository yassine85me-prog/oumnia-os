const { app, BrowserWindow, ipcMain, shell, session } = require("electron");
const path = require("path");
const fs = require("fs");
const memory = require("./memory-manager");
const { initDefaultProfile } = require("./profile-manager");
const { initDefaultProjects } = require("./project-manager");
const { migrate } = require("./migrate");
const { close: closeDb } = require("./database");
const { handleChat, getGreetingContext, buildSystemPrompt, setCurrentProject, setAllProjectScans } = require("./agent-core");
const nativeSpeech = require("./native-speech");
const os = require("os");
const { execSync } = require("child_process");

// ═══ EPIPE PROTECTION ═══
// Monkey-patch stdout/stderr to never throw on broken pipes
(function() {
  const patchStream = (stream) => {
    if (!stream || !stream.write) return;
    const original = stream.write.bind(stream);
    stream.write = function(...args) {
      try { return original(...args); } catch(e) { return true; }
    };
  };
  patchStream(process.stdout);
  patchStream(process.stderr);
})();

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

// ═══ CLAUDE AI AGENT (legacy non-streaming — used for greeting) ═══
function setupClaudeAgent() {
  ipcMain.handle("claude-chat", async (_, { message, context }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey.length < 50 || apiKey.includes("...")) {
      return { success: false, error: "Cle API invalide. Verifie .env" };
    }
    try {
      const Anthropic = require("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey });
      const systemPrompt = buildSystemPrompt(context, { voiceMode: true });

      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: message }],
      });
      memory.addConversation(message.substring(0, 100));
      return { success: true, text: response.content[0].text };
    } catch (err) {
      console.error("[GENERAL] API Error:", err.message);
      return { success: false, error: err.message };
    }
  });
}

// ═══ RENDERER LOGS (diagnostic) ═══
ipcMain.on("renderer-log", (_, msg) => {
  try { console.log("[RENDERER]", msg); } catch(e) {}
});

// ═══ NATIVE SPEECH RECOGNITION ═══
function setupNativeSpeech() {
  nativeSpeech.onResult = (text, isFinal) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("native-speech-result", { text, isFinal });
    }
  };
  nativeSpeech.onStatus = (status) => {
    console.log("[MAIN] Native speech status:", status);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("native-speech-status", status);
    }
  };
  nativeSpeech.onError = (error) => {
    console.error("[MAIN] Native speech error:", error);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("native-speech-error", error);
    }
  };

  ipcMain.handle("native-speech-start", () => {
    console.log("[MAIN] Starting native speech");
    return nativeSpeech.start();
  });
  ipcMain.handle("native-speech-stop", () => {
    nativeSpeech.stop();
    return true;
  });
  ipcMain.handle("native-speech-is-running", () => {
    return nativeSpeech.isRunning();
  });
}

// ═══ STREAMING CHAT ═══
function setupStreamingChat() {
  ipcMain.on("chat-stream", (_, { message, context, voiceMode }) => {
    if (!mainWindow) return;
    handleChat(message, context, mainWindow, { voiceMode: !!voiceMode });
  });
}

// ═══ GREETING CONTEXT ═══
function setupGreetingContext() {
  ipcMain.handle("get-greeting-context", async () => {
    try {
      const ctx = getGreetingContext();
      return { success: true, ...ctx };
    } catch (err) {
      console.error("[MAIN] Greeting context error:", err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("set-current-project", async (_, scanData) => {
    try {
      setCurrentProject(scanData);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("set-all-project-scans", async (_, scansArray) => {
    try {
      const scansMap = new Map(scansArray.map(s => [s.path, s]));
      setAllProjectScans(scansMap);
      return { success: true };
    } catch (err) {
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
  ipcMain.handle("open-external", (_, url) => {
    if (typeof url === "string" && /^https?:\/\//.test(url)) {
      return shell.openExternal(url);
    }
  });
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
            const branch = execSync("git branch --show-current", { cwd: fullPath, encoding: "utf8", stdio: "pipe" }).trim();
            const status = execSync("git status --porcelain", { cwd: fullPath, encoding: "utf8", stdio: "pipe" }).trim();
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

// ═══ DEEP PROJECT SCANNER ═══
function setupDeepScan() {
  const IGNORE_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", "__pycache__", ".venv", "venv", ".cache", "coverage"]);
  const IGNORE_FILES = new Set([".DS_Store", "Thumbs.db", "package-lock.json", "yarn.lock"]);

  function getFileTree(dirPath, depth = 0, maxDepth = 2) {
    if (depth >= maxDepth) return [];
    const entries = [];
    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const item of items) {
        if (item.name.startsWith(".") && depth === 0 && item.isDirectory()) continue;
        if (IGNORE_DIRS.has(item.name) && item.isDirectory()) continue;
        if (IGNORE_FILES.has(item.name)) continue;
        const prefix = "  ".repeat(depth);
        if (item.isDirectory()) {
          entries.push(`${prefix}${item.name}/`);
          entries.push(...getFileTree(path.join(dirPath, item.name), depth + 1, maxDepth));
        } else {
          entries.push(`${prefix}${item.name}`);
        }
      }
    } catch {}
    return entries;
  }

  function readFileSafe(filePath, maxChars = 2000) {
    try {
      if (!fs.existsSync(filePath)) return null;
      const content = fs.readFileSync(filePath, "utf8");
      return content.length > maxChars ? content.substring(0, maxChars) + "\n...(truncated)" : content;
    } catch { return null; }
  }

  function gitCommand(cwd, cmd) {
    try {
      return execSync(cmd, { cwd, encoding: "utf8", stdio: "pipe", timeout: 5000 }).trim();
    } catch { return ""; }
  }

  ipcMain.handle("deep-scan-project", async (_, projectPath) => {
    try {
      const result = {
        name: path.basename(projectPath),
        path: projectPath,
        techStack: [],
        dependencies: {},
        scripts: {},
        recentCommits: [],
        gitStatus: "",
        gitBranch: "",
        fileTree: [],
        readme: "",
        description: "",
        fileCount: 0,
        totalLines: 0,
      };

      // --- package.json (Node/JS projects) ---
      const pkgPath = path.join(projectPath, "package.json");
      const pkgContent = readFileSafe(pkgPath, 10000);
      if (pkgContent) {
        try {
          const pkg = JSON.parse(pkgContent);
          result.description = pkg.description || "";
          result.scripts = pkg.scripts || {};
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          result.dependencies = deps;
          // Extract tech stack from deps
          const stackMap = {
            react: "React", vue: "Vue", angular: "@angular/core", svelte: "Svelte",
            electron: "Electron", express: "Express", fastify: "Fastify", next: "Next.js",
            vite: "Vite", webpack: "Webpack", typescript: "TypeScript",
            tailwindcss: "Tailwind CSS", prisma: "@prisma/client",
            "@anthropic-ai/sdk": "Claude API", openai: "OpenAI API",
            "better-sqlite3": "SQLite", mongoose: "MongoDB", pg: "PostgreSQL",
            jest: "Jest", vitest: "Vitest", mocha: "Mocha",
          };
          for (const [dep, label] of Object.entries(stackMap)) {
            if (deps[dep] || deps[label]) result.techStack.push(label);
          }
          if (pkg.main?.endsWith(".ts") || deps.typescript) result.techStack.push("TypeScript");
        } catch {}
      }

      // --- requirements.txt (Python projects) ---
      const reqPath = path.join(projectPath, "requirements.txt");
      const reqContent = readFileSafe(reqPath);
      if (reqContent) {
        result.techStack.push("Python");
        const pyDeps = reqContent.split("\n").filter(l => l.trim() && !l.startsWith("#")).map(l => l.split("==")[0].split(">=")[0].trim());
        const pyStackMap = {
          flask: "Flask", django: "Django", fastapi: "FastAPI", streamlit: "Streamlit",
          pandas: "Pandas", numpy: "NumPy", anthropic: "Claude API", openai: "OpenAI",
          sqlalchemy: "SQLAlchemy", pytorch: "PyTorch", tensorflow: "TensorFlow",
        };
        for (const dep of pyDeps) {
          const lower = dep.toLowerCase();
          if (pyStackMap[lower]) result.techStack.push(pyStackMap[lower]);
        }
        result.dependencies = { ...result.dependencies, ...Object.fromEntries(pyDeps.map(d => [d, "python"])) };
      }

      // --- Pyproject.toml ---
      if (fs.existsSync(path.join(projectPath, "pyproject.toml")) && !result.techStack.includes("Python")) {
        result.techStack.push("Python");
      }

      // --- README.md ---
      const readmePath = path.join(projectPath, "README.md");
      result.readme = readFileSafe(readmePath, 3000) || "";

      // --- Git info ---
      result.gitBranch = gitCommand(projectPath, "git branch --show-current");
      result.gitStatus = gitCommand(projectPath, "git status --porcelain -uno");
      const logRaw = gitCommand(projectPath, "git log --oneline -20 --format=%h|%s|%cr");
      if (logRaw) {
        result.recentCommits = logRaw.split("\n").map(line => {
          const [hash, msg, time] = line.split("|");
          return { hash, message: msg, time };
        });
      }

      // --- File tree (3 levels) ---
      result.fileTree = getFileTree(projectPath, 0, 3);

      // --- Count source files + lines ---
      const codeExts = new Set([".js", ".jsx", ".ts", ".tsx", ".py", ".swift", ".css", ".html", ".json", ".gs"]);
      function countFiles(dir, depth = 0) {
        if (depth > 3) return;
        try {
          const items = fs.readdirSync(dir, { withFileTypes: true });
          for (const item of items) {
            if (IGNORE_DIRS.has(item.name)) continue;
            if (item.isDirectory()) {
              countFiles(path.join(dir, item.name), depth + 1);
            } else if (codeExts.has(path.extname(item.name))) {
              result.fileCount++;
              try {
                const content = fs.readFileSync(path.join(dir, item.name), "utf8");
                result.totalLines += content.split("\n").length;
              } catch {}
            }
          }
        } catch {}
      }
      countFiles(projectPath);

      // Deduplicate tech stack
      result.techStack = [...new Set(result.techStack)];

      return { success: true, ...result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // --- Read single project file ---
  ipcMain.handle("read-project-file", async (_, filePath) => {
    try {
      if (filePath.includes("..")) return { success: false, error: "Path traversal blocked" };
      const content = fs.readFileSync(filePath, "utf8");
      return { success: true, content: content.substring(0, 50000) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // --- Write project file ---
  ipcMain.handle("write-project-file", async (_, { filePath, content }) => {
    try {
      if (filePath.includes("..")) return { success: false, error: "Path traversal blocked" };
      // Ensure parent directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, content, "utf8");
      console.log("[TOOL] Wrote file:", filePath, `(${content.length} chars)`);
      return { success: true, bytesWritten: content.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // --- List project files ---
  ipcMain.handle("list-project-files", async (_, dirPath) => {
    try {
      if (dirPath.includes("..")) return { success: false, error: "Path traversal blocked" };
      if (!fs.existsSync(dirPath)) return { success: false, error: "Directory not found" };
      const items = fs.readdirSync(dirPath, { withFileTypes: true });
      const files = items
        .filter(i => !IGNORE_DIRS.has(i.name) && !IGNORE_FILES.has(i.name) && !i.name.startsWith("."))
        .map(i => ({
          name: i.name,
          isDirectory: i.isDirectory(),
          path: path.join(dirPath, i.name),
        }));
      return { success: true, files };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // --- Run project command (whitelisted) ---
  const ALLOWED_COMMANDS = ["npm", "npx", "node", "git", "python", "python3", "pip", "pip3", "ls", "cat", "echo", "mkdir", "touch", "cp", "mv"];
  ipcMain.handle("run-project-command", async (_, { cwd, command }) => {
    try {
      if (!cwd || cwd.includes("..")) return { success: false, error: "Invalid cwd" };
      // Security: check command starts with an allowed binary
      const cmdBase = command.trim().split(/\s+/)[0];
      if (!ALLOWED_COMMANDS.includes(cmdBase)) {
        return { success: false, error: `Commande non autorisee: ${cmdBase}. Autorisees: ${ALLOWED_COMMANDS.join(", ")}` };
      }
      console.log("[TOOL] Running:", command, "in", cwd);
      const output = execSync(command, { cwd, encoding: "utf8", stdio: "pipe", timeout: 30000 });
      return { success: true, output: output.substring(0, 20000) };
    } catch (err) {
      // execSync throws on non-zero exit — capture stderr
      return { success: false, error: err.stderr?.substring(0, 5000) || err.message };
    }
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

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    // DevTools disabled — open manually via View menu if needed
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  // Migration JSON -> SQLite (une seule fois)
  migrate();
  initDefaultProfile();
  initDefaultProjects();
  memory.incrementSession();
  setupAutoLaunch();
  setupClaudeAgent();
  setupStreamingChat();
  setupGreetingContext();
  setupGoogleSheets();
  setupLocalStore();
  setupExternalLinks();
  setupMemory();
  setupProjectScanner();
  setupDeepScan();
  setupSystemInfo();
  setupNativeSpeech();
  createWindow();

  // Grant microphone + audio permissions
  mainWindow.webContents.session.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      const allowed = ["media", "microphone", "audioCapture"];
      callback(allowed.includes(permission));
    }
  );
  mainWindow.webContents.session.setPermissionCheckHandler(
    (webContents, permission) => {
      const allowed = ["media", "microphone", "audioCapture"];
      return allowed.includes(permission);
    }
  );

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  nativeSpeech.quit();
  closeDb();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
