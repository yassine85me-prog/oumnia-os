import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { USER, DEFAULT_PROJECTS, NAV_ITEMS } from "./data/config";
import { getGreeting, MAX_XP } from "./utils/ui-constants";
import { createVoiceOutput } from "./utils/voice-output";
import { createVoiceInput } from "./utils/voice-input";
import DashboardView from "./views/DashboardView";
import AgentView from "./views/AgentView";
import ProjectsView from "./views/ProjectsView";
import SettingsView from "./views/SettingsView";
import PlaceholderView from "./views/PlaceholderView";
import TerminalView from "./views/TerminalView";

// ═══════════════════════════════════════════
// OUMNIA OS — Main Application
// ═══════════════════════════════════════════

// Check if running in Electron
const isElectron = typeof window !== "undefined" && window.oumniaAPI;

// ═══ Language Detection ═══
const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
const LANG_MAP = { "fr-FR": "fr-FR", "ar-SA": "ar-SA", "en-US": "en-US" };

function detectLanguage(text) {
  if (!text) return "fr-FR";
  // If >30% Arabic characters, it's Arabic
  const arabicChars = (text.match(ARABIC_RE) || []).length;
  if (arabicChars > text.length * 0.3) return "ar-SA";
  // English heuristic: common English words that are NOT French
  const englishWords = /\b(the|is|are|was|were|have|has|this|that|with|from|they|would|could|should|about|what|when|where|which|their|there|been|being|will|your|can|how|its|you|for|not|but|had|her|him|his|she|some|than|them|then|into|very|just|also|more|like|here|know|want|make|does|did|get|got|let|say|need|help|try|use|work|look|take|give|think|come|find|tell)\b/gi;
  const engMatches = (text.match(englishWords) || []).length;
  const words = text.split(/\s+/).length;
  if (words >= 3 && engMatches >= words * 0.3) return "en-US";
  // Default: French
  return "fr-FR";
}

function App() {
  // ═══ State ═══
  const [time, setTime] = useState(new Date());
  const [activeNav, setActiveNav] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [projects, setProjects] = useState(DEFAULT_PROJECTS);
  const [aiText, setAiText] = useState("");
  const [aiTyping, setAiTyping] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [activeAgent, setActiveAgent] = useState("general");
  const [chatHistories, setChatHistories] = useState({});
  const [chatLoading, setChatLoading] = useState(false);
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const chatEndRef = useRef(null);
  const [generalState, setGeneralState] = useState("idle");
  const [streamingText, setStreamingText] = useState("");
  const streamingRef = useRef("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [voiceMode, setVoiceMode] = useState(true);
  const voiceOutputRef = useRef(null);
  const voiceInputRef = useRef(null);
  const audioLevelRef = useRef(0);
  const spokenIndexRef = useRef(0);
  const sentenceQueueRef = useRef([]);
  const voiceModeRef = useRef(false);
  const standbyRef = useRef(false);
  const projectsRef = useRef(projects);
  const [deepScanResults, setDeepScanResults] = useState([]);
  const [terminalCwd, setTerminalCwd] = useState(null);
  const [toolConfirm, setToolConfirm] = useState(null); // { requestId, toolName, input, preview }
  const detectedLangRef = useRef("fr-FR");
  const activeAgentRef = useRef("general");
  const streamingAgentRef = useRef("general");

  const handleOpenTerminal = useCallback((projectPath) => {
    setTerminalCwd(projectPath);
    setActiveNav("terminal");
  }, []);

  const totalCodeLines = useMemo(() => deepScanResults.reduce((sum, s) => sum + (s.totalLines || 0), 0), [deepScanResults]);

  // Keep refs in sync
  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);
  useEffect(() => { projectsRef.current = projects; }, [projects]);
  useEffect(() => { activeAgentRef.current = activeAgent; }, [activeAgent]);

  const chatHistory = useMemo(() => chatHistories[activeAgent] || [], [chatHistories, activeAgent]);

  const pushToHistory = useCallback((agentId, msg) => {
    setChatHistories(prev => ({
      ...prev,
      [agentId]: [...(prev[agentId] || []), msg],
    }));
  }, []);

  const handleSwitchAgent = useCallback((agentId) => {
    setActiveAgent(agentId);
  }, []);

  // ═══ Greeting (fallback) ═══
  const fullGreeting = (() => {
    const active = projects.filter((p) => p.status === "in_progress");
    const progress = active.length > 0
      ? Math.round(active.reduce((a, p) => a + p.progress, 0) / active.length)
      : 0;
    return `${getGreeting()} ${USER.name}. Tu as ${active.length} projets actifs, progression moyenne ${progress}%. Sur quoi tu veux bosser ?`;
  })();

  // ═══ Speech Queue Processor ═══
  const processSpeechQueue = useCallback(async () => {
    const voiceOut = voiceOutputRef.current;
    if (!voiceOut || voiceOut.isSpeaking()) return;

    const next = sentenceQueueRef.current.shift();
    if (next) {
      setGeneralState("speaking");
      try {
        await voiceOut.speak(next);
      } catch {}
      processSpeechQueue();
    }
  }, []);

  // ═══ Voice Transcript Handler ═══
  const handleVoiceTranscript = useCallback((text) => {
    // Interrupt GENERAL if he's speaking
    voiceOutputRef.current?.stop();
    sentenceQueueRef.current = [];

    // Detect language from user input
    const lang = detectLanguage(text);
    detectedLangRef.current = lang;
    // Switch TTS voice to match
    voiceOutputRef.current?.setLanguage(lang);

    setChatInput("");
    streamingAgentRef.current = activeAgentRef.current;
    pushToHistory(activeAgentRef.current, { role: "user", text });
    setChatLoading(true);
    setGeneralState("thinking");
    streamingRef.current = "";
    setStreamingText("");
    spokenIndexRef.current = 0;

    // Pause voice input while processing
    voiceInputRef.current?.stop();

    // Send immediately — no blocking micro-ack
    if (isElectron) {
      const projectContext = projectsRef.current
        .map((p) => `- ${p.name}: ${p.status} (${p.progress}%) — ${p.desc}`)
        .join("\n");
      window.oumniaAPI.chatStream(text, projectContext, true, activeAgentRef.current);
    }
  }, []);

  // ═══ Command Handlers ═══
  const handleReposCommand = useCallback(() => {
    standbyRef.current = true;
    setGeneralState("repos");
    voiceOutputRef.current?.stop();
    sentenceQueueRef.current = [];
    voiceInputRef.current?.stop(); // Stop mic before TTS (avoid feedback)
    voiceOutputRef.current?.speak("A vos ordres, je me mets en veille.").then(() => {
      voiceInputRef.current?.start(); // Restart for wake detection
    }).catch(() => {
      voiceInputRef.current?.start();
    });
  }, []);

  const handleWakeCommand = useCallback(() => {
    standbyRef.current = false;
    setGeneralState("idle");
    setVoiceMode(true);
    voiceInputRef.current?.stop(); // Force reset listening=false
    voiceOutputRef.current?.speak("Je suis la, Yassine.").then(() => {
      setGeneralState("listening");
      voiceInputRef.current?.start(); // Clean restart
    }).catch(() => {
      setGeneralState("listening");
      voiceInputRef.current?.start(); // Restart even if TTS fails
    });
  }, []);

  // ═══ Init ═══
  useEffect(() => {
    setTimeout(() => setLoaded(true), 200);
    const timer = setInterval(() => setTime(new Date()), 1000);
    let typingInterval;

    const speakGreeting = (text) => {
      setGeneralState("speaking");
      voiceOutputRef.current?.speak(text).then(() => {
        setGeneralState("listening");
        voiceInputRef.current?.start();
      }).catch(() => {
        setGeneralState("listening");
        voiceInputRef.current?.start();
      });
    };

    const typeText = (text, onDone) => {
      let i = 0;
      setAiTyping(true);
      typingInterval = setInterval(() => {
        if (i <= text.length) {
          setAiText(text.slice(0, i));
          i++;
        } else {
          setAiTyping(false);
          clearInterval(typingInterval);
          if (onDone) onDone();
        }
      }, 22);
    };

    if (isElectron) {
      setGeneralState("thinking");
      window.oumniaAPI.getGreetingContext().then(async (ctx) => {
        if (!ctx.success) {
          setGeneralState("speaking");
          typeText(fullGreeting, () => speakGreeting(fullGreeting));
          return;
        }

        const alerts = ctx.alerts?.length > 0
          ? `ALERTES : ${ctx.alerts.join(" | ")}`
          : "";

        const welcomePrompt = `Genere un message d'accueil court (2-3 phrases max, pas d'emoji, pas de markdown) pour ${ctx.profile?.name || "Yassine"}.

CONTEXTE :
- ${ctx.time?.dateStr || "Aujourd'hui"}, ${ctx.time?.timeStr || ""} (${ctx.time?.period || ""})
- ${ctx.projects?.activeCount || 0} projets actifs, progression moyenne ${ctx.projects?.averageProgress || 0}%
${ctx.sessionGap?.days >= 1 ? `- Derniere session il y a ${ctx.sessionGap.days} jour(s)` : ""}
${alerts}

TON = naturel et direct, comme un collegue de confiance. Pas de ton militaire, pas de briefing formel.
Salue Yassine simplement, mentionne un detail contextuel (heure, projets, ou derniere session).
TERMINE TOUJOURS par une question ouverte du style "Sur quoi tu veux bosser ?" ou "Qu'est-ce qu'on attaque ?".
Texte brut uniquement — pas de listes, pas de puces, pas de caracteres speciaux.`;

        try {
          const res = await window.oumniaAPI.chat(welcomePrompt, "");
          if (res.success) {
            setGeneralState("speaking");
            typeText(res.text, () => speakGreeting(res.text));
          } else {
            setGeneralState("speaking");
            typeText(fullGreeting, () => speakGreeting(fullGreeting));
          }
        } catch {
          setGeneralState("speaking");
          typeText(fullGreeting, () => speakGreeting(fullGreeting));
        }
      }).catch(() => {
        setGeneralState("speaking");
        typeText(fullGreeting, () => speakGreeting(fullGreeting));
      });

      // Load projects from Google Sheets if available
      window.oumniaAPI.loadProjects().then((res) => {
        if (res.success && res.projects.length > 0) {
          setProjects(res.projects);
        }
      });

      // Deep scan all projects in background — GENERAL learns everything
      window.oumniaAPI.scanProjects().then(async (res) => {
        if (!res.success || !res.projects?.length) return;
        console.log("[DEEP-SCAN] Scanning", res.projects.length, "projects...");
        const scans = [];
        for (const proj of res.projects) {
          try {
            const scan = await window.oumniaAPI.deepScanProject(proj.path);
            if (scan.success) {
              scans.push(scan);
            }
          } catch (err) {
            console.warn("[DEEP-SCAN] Failed:", proj.name, err);
          }
        }
        if (scans.length > 0) {
          console.log("[DEEP-SCAN] Completed:", scans.length, "projects scanned");
          // Send all scans to backend for system prompt enrichment
          window.oumniaAPI.setAllProjectScans(scans);
          setDeepScanResults(scans);
          // Auto-select the most recently modified project as "current"
          const sorted = [...scans].sort((a, b) => {
            const aTime = a.recentCommits?.[0]?.time || "";
            const bTime = b.recentCommits?.[0]?.time || "";
            return aTime.localeCompare(bTime);
          });
          if (sorted.length > 0) {
            window.oumniaAPI.setCurrentProject(sorted[0]);
            console.log("[DEEP-SCAN] Current project:", sorted[0].name);
          }
        }
      }).catch((err) => console.warn("[DEEP-SCAN] Error:", err));

      // Load saved XP
      window.oumniaAPI.storeGet("xp").then((val) => val && setXp(val));
      window.oumniaAPI.storeGet("level").then((val) => val && setLevel(val));
    } else {
      typeText(fullGreeting, () => {
        setGeneralState("listening");
      });
    }

    return () => { clearInterval(timer); if (typingInterval) clearInterval(typingInterval); };
  }, []);

  // ═══ Setup streaming listeners ═══
  useEffect(() => {
    if (!isElectron) return;

    window.oumniaAPI.onStreamChunk((chunk) => {
      streamingRef.current += chunk;
      setStreamingText(streamingRef.current);

      // Detect code blocks -> coding state, otherwise speaking
      if (streamingRef.current.includes("```")) {
        setGeneralState("coding");
      } else {
        setGeneralState("speaking");
      }

      // Sentence-by-sentence TTS when voice mode is on
      if (voiceModeRef.current) {
        const fullText = streamingRef.current;
        // Strip code blocks for speech
        const textForSpeech = fullText.replace(/```[\s\S]*?```/g, " bloc de code ");
        const spokenSoFar = spokenIndexRef.current;
        const unspoken = textForSpeech.substring(spokenSoFar);

        // Extract complete sentences
        const sentenceRegex = /[^.!?\n]*[.!?\n]+[\s]?/g;
        let match;
        let lastEnd = 0;
        while ((match = sentenceRegex.exec(unspoken)) !== null) {
          const sentence = match[0].trim();
          if (sentence.length > 2) {
            sentenceQueueRef.current.push(sentence);
          }
          lastEnd = match.index + match[0].length;
        }
        if (lastEnd > 0) {
          spokenIndexRef.current += lastEnd;
        }
        processSpeechQueue();
      }
    });

    window.oumniaAPI.onStreamEnd((fullText) => {
      const finalText = fullText || streamingRef.current || "";
      if (finalText.trim()) {
        pushToHistory(streamingAgentRef.current, { role: "ai", text: finalText });
      }
      setStreamingText("");
      streamingRef.current = "";
      setChatLoading(false);

      if (voiceModeRef.current) {
        // Speak any remaining unspoken text
        const textForSpeech = finalText.replace(/```[\s\S]*?```/g, " bloc de code ");
        const remaining = textForSpeech.substring(spokenIndexRef.current).trim();
        spokenIndexRef.current = 0;
        sentenceQueueRef.current = [];

        setGeneralState("speaking");

        // Detect response language and switch STT to match for next input
        const responseLang = detectLanguage(finalText);
        if (isElectron && responseLang !== detectedLangRef.current) {
          // If GENERAL responded in a different language, follow user's language
        }
        // Switch STT to user's language for next listening cycle
        if (isElectron) {
          window.oumniaAPI.setSpeechLanguage(detectedLangRef.current);
        }

        // Wait for ALL speech to finish BEFORE starting mic
        const onAllSpeechDone = () => {
          setGeneralState((prev) => prev === "speaking" ? "listening" : prev);
          // Only start listening AFTER GENERAL is completely done talking
          setTimeout(() => voiceInputRef.current?.start(), 300);
        };

        if (remaining.length > 2) {
          voiceOutputRef.current?.speak(remaining).then(onAllSpeechDone).catch(onAllSpeechDone);
        } else {
          const waitForSpeech = () => {
            if (voiceOutputRef.current?.isSpeaking()) {
              setTimeout(waitForSpeech, 200);
            } else {
              onAllSpeechDone();
            }
          };
          waitForSpeech();
        }
      } else {
        setTimeout(() => setGeneralState("idle"), 1500);
      }

      // XP reward
      setXp((prevXp) => {
        const newXp = prevXp + 10;
        if (newXp >= MAX_XP) {
          setLevel((l) => {
            const newLevel = l + 1;
            window.oumniaAPI.storeSet("level", newLevel);
            return newLevel;
          });
          const remainder = newXp - MAX_XP;
          window.oumniaAPI.storeSet("xp", remainder);
          return remainder;
        }
        window.oumniaAPI.storeSet("xp", newXp);
        return newXp;
      });
    });

    window.oumniaAPI.onStreamError((error) => {
      pushToHistory(streamingAgentRef.current, { role: "ai", text: `Erreur : ${error}` });
      setStreamingText("");
      streamingRef.current = "";
      setChatLoading(false);
      // Restart listening if voice mode is active
      if (voiceModeRef.current) {
        setGeneralState("listening");
        voiceInputRef.current?.start();
      } else {
        setGeneralState("idle");
      }
    });

    // Tool confirmation requests
    window.oumniaAPI.onToolConfirmRequest((data) => {
      setToolConfirm(data);
    });
  }, [processSpeechQueue]);

  // ═══ Voice System Init ═══
  useEffect(() => {
    const voiceOut = createVoiceOutput();
    const voiceIn = createVoiceInput();
    voiceOutputRef.current = voiceOut;
    voiceInputRef.current = voiceIn;

    // Wire audioLevel from speech boundary events
    voiceOut.onBoundary = (level) => {
      audioLevelRef.current = level;
    };

    // Wire voice input callbacks
    voiceIn.onResult = (transcript, isFinal) => {
      if (standbyRef.current) return;
      setChatInput(transcript);
      if (isFinal && transcript.trim()) {
        handleVoiceTranscript(transcript.trim());
      }
    };

    voiceIn.onCommand = (cmd) => {
      if (cmd === "repos") {
        handleReposCommand();
      } else if (cmd === "wake") {
        handleWakeCommand();
      }
    };

    voiceIn.onError = (error) => {
      console.warn("[VOICE] Input error:", error);
      if (error === "not-allowed") {
        pushToHistory(activeAgentRef.current, { role: "ai", text: "\u26a0\ufe0f Acc\u00e8s au micro refus\u00e9. V\u00e9rifie les permissions." });
        setVoiceMode(false);
        setGeneralState("idle");
      }
    };

    // ═══ WATCHDOG — Gentle mic recovery ═══
    // Every 10s: only restart mic if voiceMode ON, state is "listening", and mic is actually dead
    const watchdog = setInterval(() => {
      const vm = voiceModeRef.current;
      const speaking = voiceOut.isSpeaking();
      const listening = voiceIn.isListening();
      const stale = Date.now() - voiceIn.getLastActivity() > 60000;

      if (vm && !speaking && (!listening || stale)) {
        if (stale) voiceIn.stop(); // Force reset if stale
        setGeneralState((prev) => {
          if (prev === "listening" || prev === "idle" || prev === "repos") {
            voiceIn.start();
            return standbyRef.current ? "repos" : "listening";
          }
          return prev;
        });
      }
    }, 5000);

    // Sync audioLevel ref -> state at ~15fps with decay
    const levelInterval = setInterval(() => {
      setAudioLevel(audioLevelRef.current);
      audioLevelRef.current *= 0.85;
    }, 66);

    return () => {
      clearInterval(watchdog);
      clearInterval(levelInterval);
      voiceOut.stop();
      voiceIn.stop();
    };
  }, [handleVoiceTranscript, handleReposCommand, handleWakeCommand]);

  // ═══ Chat with Claude ═══
  const sendChat = useCallback(() => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();

    // Detect language for TTS
    const lang = detectLanguage(msg);
    detectedLangRef.current = lang;
    voiceOutputRef.current?.setLanguage(lang);

    setChatInput("");
    streamingAgentRef.current = activeAgentRef.current;
    pushToHistory(activeAgentRef.current, { role: "user", text: msg });
    setChatLoading(true);
    setGeneralState("thinking");
    streamingRef.current = "";
    setStreamingText("");
    spokenIndexRef.current = 0;
    sentenceQueueRef.current = [];

    if (isElectron) {
      const projectContext = projects
        .map((p) => `- ${p.name}: ${p.status} (${p.progress}%) — ${p.desc}`)
        .join("\n");
      window.oumniaAPI.chatStream(msg, projectContext, voiceMode, activeAgentRef.current);
    } else {
      // Fallback when not in Electron
      setTimeout(() => {
        pushToHistory(activeAgentRef.current, { role: "ai", text: "Mode demo — connecte l'API Claude via le fichier .env pour activer l'agent AI." });
        setChatLoading(false);
        setGeneralState("idle");
      }, 1000);
    }
  }, [chatInput, chatLoading, projects, voiceMode]);

  // ═══ Voice Toggle ═══
  const toggleVoice = useCallback(() => {
    if (voiceMode) {
      // Disable voice mode
      console.log("[VOICE] Disabling voice mode");
      setVoiceMode(false);
      voiceInputRef.current?.stop();
      voiceOutputRef.current?.stop();
      setGeneralState("idle");
      setChatInput("");
    } else {
      // Check SpeechRecognition availability before enabling
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        console.warn("[VOICE] SpeechRecognition not available");
        setChatHistory(prev => [...prev, { role: "ai", text: "\u26a0\ufe0f Micro non disponible dans ce navigateur." }]);
        return;
      }
      // Enable voice mode
      console.log("[VOICE] Enabling voice mode");
      setVoiceMode(true);
      setGeneralState("listening");
      voiceInputRef.current?.start();
    }
  }, [voiceMode]);

  const handleToolConfirmResponse = useCallback((approved) => {
    if (!toolConfirm) return;
    if (isElectron) {
      window.oumniaAPI.toolConfirmResponse(toolConfirm.requestId, approved);
    }
    setToolConfirm(null);
  }, [toolConfirm]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, streamingText]);

  // ═══ Time formatting ═══
  const hours = time.getHours().toString().padStart(2, "0");
  const mins = time.getMinutes().toString().padStart(2, "0");
  const secs = time.getSeconds().toString().padStart(2, "0");
  const dateStr = time.toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════
  return (
    <div style={{ height: "100vh", display: "flex", overflow: "hidden", background: "var(--bg-primary)", position: "relative" }}>

      {/* ═══ COSMIC BACKGROUND ═══ */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", width: "800px", height: "800px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,229,255,0.04) 0%, transparent 70%)",
          top: "-300px", right: "-200px", animation: "float 20s ease-in-out infinite" }} />
        <div style={{ position: "absolute", width: "600px", height: "600px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(124,77,255,0.03) 0%, transparent 70%)",
          bottom: "-200px", left: "10%", animation: "float 25s ease-in-out infinite 3s" }} />
        {/* Stars */}
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} style={{ position: "absolute", width: "1px", height: "1px",
            background: "rgba(255,255,255,0.3)", borderRadius: "50%",
            top: `${(i * 37) % 100}%`, left: `${(i * 53) % 100}%`,
            animation: `pulse ${2 + (i % 3)}s ease-in-out infinite ${(i % 5) * 0.4}s` }} />
        ))}
        {/* Scan line */}
        <div style={{ position: "absolute", left: 0, right: 0, height: "1px",
          background: "linear-gradient(90deg, transparent, rgba(0,229,255,0.05), transparent)",
          animation: "scanline 8s linear infinite" }} />
      </div>

      {/* ═══════════ LEFT SIDEBAR ═══════════ */}
      <div style={{
        width: sidebarCollapsed ? "60px" : "220px", height: "100vh",
        background: "rgba(6,6,16,0.95)", borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column", zIndex: 10,
        transition: "width 0.3s ease", flexShrink: 0,
      }}>
        {/* Logo */}
        <div
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          style={{
            padding: sidebarCollapsed ? "20px 12px" : "20px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", gap: "10px", cursor: "pointer",
            paddingTop: "28px",
          }}
        >
          <div style={{
            width: "36px", height: "36px", borderRadius: "10px",
            background: "linear-gradient(135deg, var(--cyan), var(--purple))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "16px", fontWeight: "900", fontFamily: "var(--font-display)",
            boxShadow: "0 0 20px rgba(0,229,255,0.25)", flexShrink: 0, color: "#fff",
          }}>O</div>
          {!sidebarCollapsed && (
            <div>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "#fff", letterSpacing: "1px" }}>OUMNIA OS</div>
              <div style={{ fontSize: "9px", color: "rgba(0,229,255,0.5)", letterSpacing: "2px", fontWeight: "500" }}>COMMAND CENTER</div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div style={{ flex: 1, overflow: "auto", padding: "12px 0" }}>
          {NAV_ITEMS.map((sec) => (
            <div key={sec.section} style={{ marginBottom: "8px" }}>
              {!sidebarCollapsed && (
                <div style={{ fontSize: "9px", color: "var(--text-muted)", letterSpacing: "2px", fontWeight: "600", padding: "8px 16px 4px" }}>
                  {sec.section}
                </div>
              )}
              {sec.items.map((item) => (
                <div
                  key={item.key}
                  onClick={() => setActiveNav(item.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: sidebarCollapsed ? "10px 0" : "9px 16px",
                    justifyContent: sidebarCollapsed ? "center" : "flex-start",
                    cursor: "pointer", transition: "all 0.2s",
                    background: activeNav === item.key ? "var(--bg-hover)" : "transparent",
                    borderLeft: activeNav === item.key ? "2px solid var(--cyan)" : "2px solid transparent",
                    color: activeNav === item.key ? "var(--cyan)" : "var(--text-secondary)",
                    fontSize: "12px", fontWeight: "500",
                  }}
                >
                  <span style={{ fontSize: "14px", width: "20px", textAlign: "center" }}>{item.icon}</span>
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* XP / Level */}
        <div style={{ padding: sidebarCollapsed ? "12px 6px" : "14px 16px", borderTop: "1px solid var(--border)" }}>
          {!sidebarCollapsed ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "10px", fontWeight: "700", fontFamily: "var(--font-display)",
                  background: "linear-gradient(90deg, var(--yellow), var(--orange))",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  PLAYER LVL {level}
                </span>
                <span style={{ fontSize: "9px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  {xp}/{MAX_XP} XP
                </span>
              </div>
              <div style={{ height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(xp / MAX_XP) * 100}%`, borderRadius: "2px",
                  background: "linear-gradient(90deg, var(--yellow), var(--orange))",
                  transition: "width 0.8s ease", boxShadow: "0 0 8px rgba(255,215,64,0.3)" }} />
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", fontSize: "10px", fontFamily: "var(--font-display)", color: "var(--yellow)" }}>L{level}</div>
          )}
        </div>
      </div>

      {/* ═══════════ MAIN CONTENT ═══════════ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", zIndex: 1,
        opacity: loaded ? 1 : 0, transition: "opacity 0.6s ease" }}>

        {/* Top Bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 24px", borderBottom: "1px solid var(--border)",
          background: "rgba(6,6,16,0.6)", backdropFilter: "blur(10px)", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {USER.machines.map((m) => (
              <div key={m.name} style={{
                display: "flex", alignItems: "center", gap: "5px", padding: "4px 10px", borderRadius: "6px",
                background: m.active ? "rgba(0,229,255,0.08)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${m.active ? "rgba(0,229,255,0.2)" : "rgba(255,255,255,0.05)"}`,
              }}>
                <div style={{ width: "5px", height: "5px", borderRadius: "50%",
                  background: m.active ? "var(--cyan)" : "rgba(255,255,255,0.2)",
                  boxShadow: m.active ? "0 0 6px var(--cyan)" : "none" }} />
                <span style={{ fontSize: "10px", fontWeight: "500", color: m.active ? "var(--cyan)" : "var(--text-muted)" }}>{m.name}</span>
              </div>
            ))}
            <div style={{ width: "1px", height: "18px", background: "var(--border)" }} />
            <div style={{
              padding: "4px 10px", borderRadius: "6px", fontSize: "10px", fontWeight: "600",
              letterSpacing: "1px", fontFamily: "var(--font-mono)",
              background: generalState === "repos" ? "rgba(255,255,255,0.03)" : "rgba(0,230,118,0.08)",
              color: generalState === "repos" ? "var(--text-muted)" : "#00e676",
              border: `1px solid ${generalState === "repos" ? "rgba(255,255,255,0.05)" : "rgba(0,230,118,0.2)"}`,
            }}>
              {generalState === "repos" ? "STANDBY" : "LISTENING"}
            </div>
            <button onClick={() => {
              if (!isElectron) return;
              window.oumniaAPI.scanProjects().then(async (res) => {
                if (!res.success || !res.projects?.length) return;
                const scans = [];
                for (const proj of res.projects) {
                  try {
                    const scan = await window.oumniaAPI.deepScanProject(proj.path);
                    if (scan.success) scans.push(scan);
                  } catch {}
                }
                if (scans.length > 0) {
                  window.oumniaAPI.setAllProjectScans(scans);
                  setDeepScanResults(scans);
                }
              });
            }} style={{
              padding: "4px 12px", borderRadius: "6px", border: "1px solid var(--border-accent)",
              background: "var(--bg-hover)", color: "var(--cyan)",
              fontSize: "10px", fontWeight: "600", cursor: "pointer", fontFamily: "var(--font-main)",
            }}>↻ SYNC DATA</button>
          </div>

          {/* Clock */}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: "700",
              letterSpacing: "3px", color: "var(--cyan)", textShadow: "0 0 20px rgba(0,229,255,0.3)" }}>
              {hours}<span style={{ opacity: 0.3 }}>:</span>{mins}<span style={{ opacity: 0.15 }}>:</span>
              <span style={{ fontSize: "14px", opacity: 0.5 }}>{secs}</span>
            </div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "capitalize", letterSpacing: "0.5px" }}>
              {dateStr} · {USER.timezone} · {USER.location}
            </div>
          </div>
        </div>

        {/* ═══ VIEW ROUTER ═══ */}

        {/* Terminal — always mounted, hidden via display:none to preserve PTY state */}
        <div style={{ flex: 1, display: activeNav === "terminal" ? "flex" : "none", flexDirection: "column", overflow: "hidden" }}>
          <TerminalView initialCwd={terminalCwd} isVisible={activeNav === "terminal"} />
        </div>

        {activeNav !== "terminal" && (() => {
          switch (activeNav) {
            case "dashboard":
              return (
                <DashboardView
                  projects={projects}
                  aiText={aiText}
                  aiTyping={aiTyping}
                  generalState={generalState}
                  audioLevel={audioLevel}
                  totalCodeLines={totalCodeLines}
                  onNavigate={setActiveNav}
                  onHologramClick={() => {
                    if (generalState === "repos") handleWakeCommand();
                    else setActiveNav("agent");
                  }}
                  onSwitchAgent={(id) => { handleSwitchAgent(id); setActiveNav("agent"); }}
                />
              );
            case "agent":
              return (
                <AgentView
                  chatHistory={chatHistory}
                  chatInput={chatInput}
                  chatLoading={chatLoading}
                  streamingText={streamingText}
                  voiceMode={voiceMode}
                  generalState={generalState}
                  audioLevel={audioLevel}
                  onInputChange={setChatInput}
                  onSend={sendChat}
                  onToggleVoice={toggleVoice}
                  chatEndRef={chatEndRef}
                  activeAgent={activeAgent}
                  onSwitchAgent={handleSwitchAgent}
                />
              );
            case "projects":
              return <ProjectsView onOpenTerminal={handleOpenTerminal} />;
            case "settings":
              return <SettingsView />;
            default:
              return <PlaceholderView viewKey={activeNav} />;
          }
        })()}
      </div>

      {/* ═══ TOOL CONFIRMATION MODAL ═══ */}
      {toolConfirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "rgba(12,12,30,0.98)", border: "1px solid rgba(0,229,255,0.3)",
            borderRadius: "16px", padding: "28px", maxWidth: "520px", width: "90%",
            boxShadow: "0 0 40px rgba(0,229,255,0.15), 0 20px 60px rgba(0,0,0,0.5)",
          }}>
            <div style={{
              fontSize: "14px", fontWeight: "700", color: "var(--cyan)",
              fontFamily: "var(--font-display)", letterSpacing: "1px", marginBottom: "16px",
              display: "flex", alignItems: "center", gap: "8px",
            }}>
              {toolConfirm.toolName === "write_file" ? "✏️" : toolConfirm.toolName === "delegate_to_claude_code" ? "🤖" : "⚡"}
              {toolConfirm.toolName === "write_file" ? " ECRITURE DE FICHIER" : toolConfirm.toolName === "delegate_to_claude_code" ? " DELEGATION A CLAUDE CODE" : " EXECUTION DE COMMANDE"}
            </div>

            <div style={{
              background: "rgba(0,0,0,0.4)", borderRadius: "8px", padding: "14px",
              border: "1px solid rgba(255,255,255,0.06)", marginBottom: "16px",
            }}>
              {toolConfirm.toolName === "write_file" ? (
                <>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>FICHIER</div>
                  <div style={{ fontSize: "13px", color: "#fff", fontFamily: "var(--font-mono)", marginBottom: "12px", wordBreak: "break-all" }}>
                    {toolConfirm.input?.path}
                  </div>
                  {toolConfirm.preview && (
                    <>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>APERCU DU CONTENU</div>
                      <pre style={{
                        fontSize: "11px", color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-mono)",
                        whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: "200px", overflow: "auto",
                        margin: 0, lineHeight: "1.5",
                      }}>
                        {toolConfirm.preview}{toolConfirm.preview.length >= 500 ? "\n..." : ""}
                      </pre>
                    </>
                  )}
                </>
              ) : toolConfirm.toolName === "delegate_to_claude_code" ? (
                <>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>INSTRUCTION POUR CLAUDE CODE</div>
                  <pre style={{
                    fontSize: "12px", color: "#fff", fontFamily: "var(--font-mono)",
                    whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: "250px", overflow: "auto",
                    margin: 0, lineHeight: "1.5", marginBottom: "12px",
                  }}>
                    {toolConfirm.input?.instruction}
                  </pre>
                  {toolConfirm.input?.cwd && (
                    <>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>PROJET</div>
                      <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", fontFamily: "var(--font-mono)" }}>
                        {toolConfirm.input.cwd}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>COMMANDE</div>
                  <div style={{ fontSize: "13px", color: "#fff", fontFamily: "var(--font-mono)", marginBottom: "8px" }}>
                    {toolConfirm.input?.command}
                  </div>
                  {toolConfirm.input?.cwd && (
                    <>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>REPERTOIRE</div>
                      <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", fontFamily: "var(--font-mono)" }}>
                        {toolConfirm.input.cwd}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                onClick={() => handleToolConfirmResponse(false)}
                style={{
                  padding: "10px 24px", borderRadius: "8px", fontSize: "12px", fontWeight: "600",
                  border: "1px solid rgba(255,82,82,0.3)", background: "rgba(255,82,82,0.1)",
                  color: "#ff5252", cursor: "pointer", fontFamily: "var(--font-main)",
                  transition: "all 0.2s",
                }}
              >
                Refuser
              </button>
              <button
                onClick={() => handleToolConfirmResponse(true)}
                style={{
                  padding: "10px 24px", borderRadius: "8px", fontSize: "12px", fontWeight: "600",
                  border: "1px solid rgba(0,229,255,0.3)", background: "rgba(0,229,255,0.15)",
                  color: "var(--cyan)", cursor: "pointer", fontFamily: "var(--font-main)",
                  transition: "all 0.2s",
                }}
              >
                Accepter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
