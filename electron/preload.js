// ═══════════════════════════════════════════
// OUMNIA OS — Preload Script (Secure Bridge)
// ═══════════════════════════════════════════

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("oumniaAPI", {
  // ═══ Claude AI Agent ═══
  chat: (message, context) =>
    ipcRenderer.invoke("claude-chat", { message, context }),

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

  // ═══ System Info ═══
  getSystemInfo: () => ipcRenderer.invoke("get-system-info"),

  // ═══ External Links ═══
  openExternal: (url) => ipcRenderer.invoke("open-external", url),

  // ═══ Platform Info ═══
  platform: process.platform, // 'darwin' | 'win32' | 'linux'
});
