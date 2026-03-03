// ═══════════════════════════════════════════
// OUMNIA OS — Voice Output (speechSynthesis)
// TTS wrapper: fr-FR, Chrome bug workaround
// ═══════════════════════════════════════════

export function createVoiceOutput() {
  let currentUtterance = null;
  let resumeInterval = null;
  let speaking = false;
  let boundaryCallback = null;
  let cachedVoice = null;

  function waitForVoices() {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) {
        resolve([]);
        return;
      }
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        resolve(voices);
        return;
      }
      let elapsed = 0;
      const interval = setInterval(() => {
        elapsed += 100;
        const v = window.speechSynthesis.getVoices();
        if (v.length > 0 || elapsed >= 3000) {
          clearInterval(interval);
          resolve(v);
        }
      }, 100);
    });
  }

  function findFrenchVoice(voices) {
    if (cachedVoice) return cachedVoice;
    cachedVoice =
      voices.find((v) => v.name === "Thomas") ||
      voices.find((v) => v.name.includes("Thomas")) ||
      voices.find((v) => v.lang === "fr-FR" && v.name.toLowerCase().includes("male")) ||
      voices.find((v) => v.lang === "fr-FR") ||
      voices.find((v) => v.lang.startsWith("fr")) ||
      voices[0] || null;
    return cachedVoice;
  }

  // Pre-load voices (some browsers load async)
  if (window.speechSynthesis) {
    waitForVoices().then((voices) => findFrenchVoice(voices));
    window.speechSynthesis.onvoiceschanged = () => {
      cachedVoice = null;
      const voices = window.speechSynthesis.getVoices();
      findFrenchVoice(voices);
    };
  }

  const controller = {
    async speak(text) {
      if (!window.speechSynthesis || !text?.trim()) {
        return;
      }

      controller.stop();

      const voices = await waitForVoices();

      const utterance = new SpeechSynthesisUtterance(text);
      currentUtterance = utterance;

      const voice = findFrenchVoice(voices);
      if (voice) utterance.voice = voice;
      utterance.lang = "fr-FR";
      utterance.rate = 1.05;
      utterance.pitch = 0.8;

      return new Promise((resolve) => {
        // Chrome bug workaround: pause/resume every 14s
        resumeInterval = setInterval(() => {
          if (window.speechSynthesis.speaking) {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          }
        }, 14000);

        // Boundary events for audioLevel estimation
        utterance.onboundary = (event) => {
          if (boundaryCallback) {
            const level =
              event.name === "word"
                ? 0.5 + Math.random() * 0.5
                : 0.3;
            boundaryCallback(level);
          }
        };

        utterance.onend = () => {
          speaking = false;
          clearInterval(resumeInterval);
          resumeInterval = null;
          currentUtterance = null;
          if (boundaryCallback) boundaryCallback(0);
          resolve();
        };

        utterance.onerror = () => {
          speaking = false;
          clearInterval(resumeInterval);
          resumeInterval = null;
          currentUtterance = null;
          if (boundaryCallback) boundaryCallback(0);
          resolve(); // Always resolve — don't break the voice loop
        };

        speaking = true;
        window.speechSynthesis.speak(utterance);
      });
    },

    stop() {
      speaking = false;
      if (resumeInterval) {
        clearInterval(resumeInterval);
        resumeInterval = null;
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      currentUtterance = null;
      if (boundaryCallback) boundaryCallback(0);
    },

    isSpeaking() {
      return speaking && window.speechSynthesis?.speaking;
    },

    set onBoundary(cb) {
      boundaryCallback = cb;
    },
  };

  return controller;
}
