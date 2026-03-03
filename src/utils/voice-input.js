// ═══════════════════════════════════════════
// OUMNIA OS — Voice Input
// Uses macOS native SFSpeechRecognizer via IPC
// Fallback to webkitSpeechRecognition if not in Electron
// ═══════════════════════════════════════════

const COMMANDS = {
  repos: ["repos général", "repos general", "repose-toi", "dors", "sleep"],
  wake: ["oumnia", "réveille", "reveille", "reveille-toi", "wake"],
};

function detectCommand(transcript) {
  const lower = transcript.toLowerCase().trim();
  for (const [cmd, keywords] of Object.entries(COMMANDS)) {
    if (keywords.some((k) => lower.includes(k))) return cmd;
  }
  return null;
}

export function createVoiceInput() {
  let listening = false;
  let resultCallback = null;
  let commandCallback = null;
  let errorCallback = null;
  const isElectron = !!window.oumniaAPI?.startNativeSpeech;

  function log(msg) {
    console.log(msg);
    if (window.oumniaAPI?.logToMain) window.oumniaAPI.logToMain(msg);
  }

  // ═══ NATIVE macOS path (Electron) ═══
  if (isElectron) {
    log("[VOICE-IN] Using NATIVE macOS SFSpeechRecognizer");

    const controller = {
      start() {
        if (listening) return;
        log("[VOICE-IN] Starting native speech");
        listening = true;

        // Wire IPC listeners
        window.oumniaAPI.onNativeSpeechResult(({ text, isFinal }) => {
          log(`[VOICE-IN] Native result: ${isFinal ? "FINAL" : "interim"} "${text.substring(0, 50)}"`);

          if (isFinal) {
            const cmd = detectCommand(text);
            if (cmd && commandCallback) {
              commandCallback(cmd);
              return;
            }
          }
          if (resultCallback) resultCallback(text, isFinal);
        });

        window.oumniaAPI.onNativeSpeechStatus((status) => {
          log(`[VOICE-IN] Native status: ${status}`);
          if (status === "stopped" || status === "no_permission") {
            listening = false;
            if (status === "no_permission" && errorCallback) {
              errorCallback("not-allowed");
            }
          }
          if (status === "listening") {
            listening = true;
          }
        });

        window.oumniaAPI.onNativeSpeechError((error) => {
          log(`[VOICE-IN] Native error: ${error}`);
          if (errorCallback) errorCallback(error);
        });

        window.oumniaAPI.startNativeSpeech();
      },

      stop() {
        log("[VOICE-IN] Stopping native speech");
        listening = false;
        window.oumniaAPI.stopNativeSpeech();
      },

      isListening() {
        return listening;
      },

      set onResult(cb) { resultCallback = cb; },
      set onCommand(cb) { commandCallback = cb; },
      set onError(cb) { errorCallback = cb; },
    };

    return controller;
  }

  // ═══ WEB API fallback (browser dev) ═══
  log("[VOICE-IN] Using web SpeechRecognition (fallback)");

  let recognition = null;
  let manualStop = false;
  let restartCount = 0;
  let restartTimer = null;

  function scheduleRestart() {
    if (manualStop || !listening) return;
    restartCount++;
    const delay = restartCount > 3 ? 5000 : 500;
    log(`[VOICE-IN] Scheduling restart #${restartCount} in ${delay}ms`);
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = setTimeout(() => {
      restartTimer = null;
      if (!manualStop && listening && recognition) {
        try { recognition.start(); } catch {}
      }
    }, delay);
  }

  const controller = {
    start() {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        log("[VOICE-IN] SpeechRecognition not available");
        if (errorCallback) errorCallback("not-available");
        return;
      }
      if (listening) return;

      log("[VOICE-IN] Starting web recognition");
      manualStop = false;
      restartCount = 0;
      recognition = new SR();
      recognition.lang = "fr-FR";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (e) => {
        restartCount = 0;
        const last = e.results[e.results.length - 1];
        const transcript = last[0].transcript;
        const isFinal = last.isFinal;
        if (isFinal) {
          const cmd = detectCommand(transcript);
          if (cmd && commandCallback) { commandCallback(cmd); return; }
        }
        if (resultCallback) resultCallback(transcript, isFinal);
      };

      recognition.onerror = (e) => {
        log(`[VOICE-IN] Web error: ${e.error}`);
        if (e.error === "not-allowed") {
          listening = false; recognition = null;
          if (errorCallback) errorCallback(e.error);
          return;
        }
        if (errorCallback && e.error !== "aborted") errorCallback(e.error);
      };

      recognition.onend = () => {
        if (!manualStop && listening) scheduleRestart();
        else { listening = false; recognition = null; }
      };

      try { recognition.start(); listening = true; }
      catch { listening = false; recognition = null; }
    },

    stop() {
      manualStop = true;
      listening = false;
      if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
      if (recognition) { try { recognition.abort(); } catch {} recognition = null; }
    },

    isListening() { return listening; },
    set onResult(cb) { resultCallback = cb; },
    set onCommand(cb) { commandCallback = cb; },
    set onError(cb) { errorCallback = cb; },
  };

  return controller;
}
