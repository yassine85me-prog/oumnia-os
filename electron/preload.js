// ═══════════════════════════════════════════
// OUMNIA OS — Preload Script (Secure Bridge)
// ═══════════════════════════════════════════

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("oumniaAPI", {
  // ═══ Claude AI Agent (legacy — compatibilite) ═══
  chat: (message, context) =>
    ipcRenderer.invoke("claude-chat", { message, context }),

  // ═══ Claude AI Agent (streaming) ═══
  chatStream: (message, context, voiceMode, agentId) =>
    ipcRenderer.send("chat-stream", { message, context, voiceMode, agentId }),
  onStreamChunk: (callback) => {
    ipcRenderer.removeAllListeners("stream-chunk");
    ipcRenderer.on("stream-chunk", (_, chunk) => callback(chunk));
  },
  onStreamEnd: (callback) => {
    ipcRenderer.removeAllListeners("stream-end");
    ipcRenderer.on("stream-end", (_, fullText) => callback(fullText));
  },
  onStreamError: (callback) => {
    ipcRenderer.removeAllListeners("stream-error");
    ipcRenderer.on("stream-error", (_, error) => callback(error));
  },

  // ═══ Tool Status (visual only, not spoken by TTS) ═══
  onStreamToolStatus: (callback) => {
    ipcRenderer.removeAllListeners("stream-tool-status");
    ipcRenderer.on("stream-tool-status", (_, text) => callback(text));
  },

  // ═══ Agent Routing ═══
  onAgentRouted: (callback) => {
    ipcRenderer.removeAllListeners("agent-routed");
    ipcRenderer.on("agent-routed", (_, data) => callback(data));
  },

  // ═══ Google Sheets ═══
  loadProjects: () => ipcRenderer.invoke("sheets-load-projects"),
  updateProgress: (row, progress) =>
    ipcRenderer.invoke("sheets-update-progress", { row, progress }),

  // ═══ Local Storage ═══
  storeGet: (key) => ipcRenderer.invoke("store-get", key),
  storeSet: (key, value) => ipcRenderer.invoke("store-set", key, value),

  // ═══ Auto-Launch ═══
  getAutoLaunch: () => ipcRenderer.invoke("get-auto-launch"),
  toggleAutoLaunch: (enabled) =>
    ipcRenderer.invoke("toggle-auto-launch", enabled),

  // ═══ Memory System ═══
  memorySave: (data) => ipcRenderer.invoke("memory-save", data),
  memoryLoad: () => ipcRenderer.invoke("memory-load"),

  // ═══ Project Scanner ═══
  scanProjects: () => ipcRenderer.invoke("scan-projects"),

  // ═══ Greeting Context ═══
  getGreetingContext: () => ipcRenderer.invoke("get-greeting-context"),

  // ═══ Deep Project Scanner ═══
  deepScanProject: (projectPath) => ipcRenderer.invoke("deep-scan-project", projectPath),
  setCurrentProject: (scanData) => ipcRenderer.invoke("set-current-project", scanData),
  setAllProjectScans: (scansArray) => ipcRenderer.invoke("set-all-project-scans", scansArray),

  // ═══ Project File Operations (used by tool-use) ═══
  readProjectFile: (filePath) => ipcRenderer.invoke("read-project-file", filePath),
  writeProjectFile: (filePath, content) => ipcRenderer.invoke("write-project-file", { filePath, content }),
  listProjectFiles: (dirPath) => ipcRenderer.invoke("list-project-files", dirPath),
  runProjectCommand: (cwd, command) => ipcRenderer.invoke("run-project-command", { cwd, command }),

  // ═══ System Info ═══
  getSystemInfo: () => ipcRenderer.invoke("get-system-info"),

  // ═══ External Links ═══
  openExternal: (url) => ipcRenderer.invoke("open-external", url),

  // ═══ Platform Info ═══
  platform: process.platform, // 'darwin' | 'win32' | 'linux'

  // ═══ Native Speech Recognition ═══
  startNativeSpeech: () => ipcRenderer.invoke("native-speech-start"),
  stopNativeSpeech: () => ipcRenderer.invoke("native-speech-stop"),
  isNativeSpeechRunning: () => ipcRenderer.invoke("native-speech-is-running"),
  setSpeechLanguage: (locale) => ipcRenderer.invoke("native-speech-set-language", locale),
  onNativeSpeechResult: (cb) => {
    ipcRenderer.removeAllListeners("native-speech-result");
    ipcRenderer.on("native-speech-result", (_, data) => cb(data));
  },
  onNativeSpeechStatus: (cb) => {
    ipcRenderer.removeAllListeners("native-speech-status");
    ipcRenderer.on("native-speech-status", (_, status) => cb(status));
  },
  onNativeSpeechError: (cb) => {
    ipcRenderer.removeAllListeners("native-speech-error");
    ipcRenderer.on("native-speech-error", (_, error) => cb(error));
  },

  // ═══ Terminal (xterm.js + node-pty) ═══
  terminalSpawn: (cwd) => ipcRenderer.invoke("terminal-spawn", { cwd }),
  terminalInput: (id, data) => ipcRenderer.send("terminal-input", { id, data }),
  terminalResize: (id, cols, rows) => ipcRenderer.send("terminal-resize", { id, cols, rows }),
  terminalKill: (id) => ipcRenderer.invoke("terminal-kill", { id }),
  onTerminalOutput: (cb) => {
    ipcRenderer.removeAllListeners("terminal-output");
    ipcRenderer.on("terminal-output", (_, p) => cb(p));
  },
  onTerminalExit: (cb) => {
    ipcRenderer.removeAllListeners("terminal-exit");
    ipcRenderer.on("terminal-exit", (_, p) => cb(p));
  },

  // ═══ Tool Confirmation ═══
  onToolConfirmRequest: (callback) => {
    ipcRenderer.removeAllListeners("tool-confirm-request");
    ipcRenderer.on("tool-confirm-request", (_, data) => callback(data));
  },
  toolConfirmResponse: (requestId, approved) => {
    ipcRenderer.send("tool-confirm-response", { requestId, approved });
  },

  // ═══ Diagnostics ═══
  logToMain: (msg) => ipcRenderer.send("renderer-log", msg),
});
