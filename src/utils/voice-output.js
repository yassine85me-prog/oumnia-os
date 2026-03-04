// ═══════════════════════════════════════════
// OUMNIA OS — Voice Output (speechSynthesis)
// TTS wrapper: fr-FR, ar-SA, en-US — auto-switch
// ═══════════════════════════════════════════

// Voice preferences per language
const VOICE_PREFS = {
  "fr-FR": { names: ["Thomas"], lang: "fr-FR", fallbackLang: "fr", rate: 1.05, pitch: 0.8 },
  "ar-SA": { names: ["Majed", "Maged"], lang: "ar-SA", fallbackLang: "ar", rate: 0.95, pitch: 0.9 },
  "en-US": { names: ["Daniel", "Samantha"], lang: "en-US", fallbackLang: "en", rate: 1.0, pitch: 0.85 },
};

export function createVoiceOutput() {
  let currentUtterance = null;
  let resumeInterval = null;
  let speaking = false;
  let boundaryCallback = null;
  let voiceCache = {}; // locale -> voice
  let currentLang = "fr-FR";

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

  function findVoiceForLang(voices, lang) {
    if (voiceCache[lang]) return voiceCache[lang];
    const pref = VOICE_PREFS[lang] || VOICE_PREFS["fr-FR"];
    const voice =
      voices.find((v) => pref.names.some((n) => v.name === n)) ||
      voices.find((v) => pref.names.some((n) => v.name.includes(n))) ||
      voices.find((v) => v.lang === pref.lang) ||
      voices.find((v) => v.lang.startsWith(pref.fallbackLang)) ||
      null;
    if (voice) voiceCache[lang] = voice;
    return voice;
  }

  // Pre-load voices
  if (window.speechSynthesis) {
    waitForVoices().then((voices) => {
      for (const lang of Object.keys(VOICE_PREFS)) {
        findVoiceForLang(voices, lang);
      }
    });
    window.speechSynthesis.onvoiceschanged = () => {
      voiceCache = {};
      const voices = window.speechSynthesis.getVoices();
      for (const lang of Object.keys(VOICE_PREFS)) {
        findVoiceForLang(voices, lang);
      }
    };
  }

  const controller = {
    setLanguage(lang) {
      if (VOICE_PREFS[lang]) {
        currentLang = lang;
      }
    },

    getLanguage() {
      return currentLang;
    },

    async speak(text, lang) {
      if (!window.speechSynthesis || !text?.trim()) {
        return;
      }

      controller.stop();

      const useLang = lang || currentLang;
      const pref = VOICE_PREFS[useLang] || VOICE_PREFS["fr-FR"];
      const voices = await waitForVoices();

      const utterance = new SpeechSynthesisUtterance(text);
      currentUtterance = utterance;

      const voice = findVoiceForLang(voices, useLang);
      if (voice) utterance.voice = voice;
      utterance.lang = pref.lang;
      utterance.rate = pref.rate;
      utterance.pitch = pref.pitch;

      return new Promise((resolve) => {
        // Chrome bug workaround
        resumeInterval = setInterval(() => {
          if (window.speechSynthesis.speaking) {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          }
        }, 14000);

        utterance.onboundary = (event) => {
          if (boundaryCallback) {
            const level = event.name === "word" ? 0.5 + Math.random() * 0.5 : 0.3;
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
          resolve();
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
