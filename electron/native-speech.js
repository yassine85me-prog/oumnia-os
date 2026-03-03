// ═══════════════════════════════════════════
// OUMNIA OS — Native Speech Bridge
// Manages the macOS SFSpeechRecognizer process
// ═══════════════════════════════════════════

const { spawn, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const HELPER_PATH = path.join(__dirname, "speech-helper");
const SOURCE_PATH = path.join(__dirname, "speech.swift");

let speechProcess = null;
let onResultCb = null;
let onStatusCb = null;
let onErrorCb = null;

function ensureCompiled() {
  if (fs.existsSync(HELPER_PATH)) return true;
  console.log("[NATIVE-SPEECH] Compiling speech helper...");
  try {
    execSync(
      `swiftc "${SOURCE_PATH}" -o "${HELPER_PATH}" -framework Speech -framework AVFoundation`,
      { timeout: 60000, stdio: "pipe" }
    );
    console.log("[NATIVE-SPEECH] Compiled OK");
    return true;
  } catch (e) {
    console.error("[NATIVE-SPEECH] Compile failed:", e.stderr?.toString() || e.message);
    return false;
  }
}

function start() {
  if (speechProcess) {
    send("start");
    return true;
  }
  if (!ensureCompiled()) return false;

  // Launch speech-helper process
  speechProcess = spawn(HELPER_PATH, [], { stdio: ["pipe", "pipe", "pipe"] });

  let buffer = "";
  speechProcess.stdout.on("data", (data) => {
    buffer += data.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.text !== undefined && onResultCb) onResultCb(msg.text, !!msg.final);
        if (msg.status && onStatusCb) onStatusCb(msg.status);
        if (msg.error && onErrorCb) onErrorCb(msg.error);
      } catch {}
    }
  });

  speechProcess.stderr.on("data", () => {});

  speechProcess.on("close", () => {
    speechProcess = null;
    if (onStatusCb) onStatusCb("stopped");
  });

  speechProcess.on("error", (err) => {
    speechProcess = null;
    if (onErrorCb) onErrorCb(err.message);
  });

  return true;
}

function send(cmd) {
  if (speechProcess?.stdin?.writable) speechProcess.stdin.write(cmd + "\n");
}

function stop() { send("stop"); }

function quit() {
  send("quit");
  setTimeout(() => {
    if (speechProcess) { speechProcess.kill(); speechProcess = null; }
  }, 1000);
}

function isRunning() { return speechProcess !== null; }

module.exports = {
  start, stop, quit, isRunning,
  set onResult(cb) { onResultCb = cb; },
  set onStatus(cb) { onStatusCb = cb; },
  set onError(cb) { onErrorCb = cb; },
};
