// ═══════════════════════════════════════════
// OUMNIA OS — Terminal Manager (node-pty)
// ═══════════════════════════════════════════

const pty = require("node-pty");
const os = require("os");
const { execSync } = require("child_process");

const processes = new Map();
let nextId = 1;

// Fix macOS PATH — Electron launched from Finder inherits a minimal PATH
function getFullEnv() {
  const env = { ...process.env };
  if (process.platform === "darwin") {
    try {
      const shell = process.env.SHELL || "/bin/zsh";
      const raw = execSync(`${shell} --login -ic 'printenv'`, {
        encoding: "utf8",
        timeout: 5000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      for (const line of raw.split("\n")) {
        const eq = line.indexOf("=");
        if (eq > 0) {
          const key = line.substring(0, eq);
          const val = line.substring(eq + 1);
          if (key === "PATH" || key === "LANG" || key === "LC_ALL" || key === "TERM_PROGRAM") {
            env[key] = val;
          }
        }
      }
    } catch (err) {
      console.warn("[TERMINAL] Failed to read login env:", err.message);
    }
  }
  // Ensure TERM is set for proper color support
  env.TERM = "xterm-256color";
  return env;
}

let cachedEnv = null;

function spawn(cwd) {
  if (!cachedEnv) cachedEnv = getFullEnv();

  const shell = process.platform === "win32"
    ? "powershell.exe"
    : (process.env.SHELL || "/bin/zsh");

  const args = process.platform === "win32" ? [] : ["--login"];

  const id = nextId++;
  const proc = pty.spawn(shell, args, {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: cwd || os.homedir(),
    env: cachedEnv,
  });

  processes.set(id, proc);
  return { id, pid: proc.pid };
}

function write(id, data) {
  const proc = processes.get(id);
  if (proc) proc.write(data);
}

function resize(id, cols, rows) {
  const proc = processes.get(id);
  if (proc) {
    try {
      proc.resize(cols, rows);
    } catch {}
  }
}

function kill(id) {
  const proc = processes.get(id);
  if (proc) {
    try {
      proc.kill();
    } catch {}
    processes.delete(id);
  }
}

function killAll() {
  for (const [id, proc] of processes) {
    try {
      proc.kill();
    } catch {}
  }
  processes.clear();
}

function getProcess(id) {
  return processes.get(id) || null;
}

module.exports = { spawn, write, resize, kill, killAll, getProcess };
