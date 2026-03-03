import { useState, useEffect, useRef, useCallback } from "react";
import GeneralHologram from "./components/GeneralHologram";
import MessageBubble from "./components/MessageBubble";
import { USER, DEFAULT_PROJECTS, AGENTS, FOCUS_TASKS, QUICK_ACCESS, NAV_ITEMS } from "./data/config";
import { createVoiceOutput } from "./utils/voice-output";
import { createVoiceInput } from "./utils/voice-input";

// ═══════════════════════════════════════════
// OUMNIA OS — Main Application
// ═══════════════════════════════════════════

// Check if running in Electron
const isElectron = typeof window !== "undefined" && window.oumniaAPI;

function App() {
  // ═══ State ═══
  const [time, setTime] = useState(new Date());
  const [activeNav, setActiveNav] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [projects, setProjects] = useState(DEFAULT_PROJECTS);
  const [aiText, setAiText] = useState("");
  const [aiTyping, setAiTyping] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [xp, setXp] = useState(340);
  const [level, setLevel] = useState(3);
  const [loaded, setLoaded] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [hoveredAgent, setHoveredAgent] = useState(null);
  const chatEndRef = useRef(null);
  const [generalState, setGeneralState] = useState("idle");
  const [chatOpen, setChatOpen] = useState(false);
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
  const projectsRef = useRef(projects);

  const maxXp = 500;
  const activeProjects = projects.filter((p) => p.status === "in_progress");
  const totalProgress = activeProjects.length > 0
    ? Math.round(activeProjects.reduce((a, p) => a + p.progress, 0) / activeProjects.length)
    : 0;

  // Keep refs in sync
  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);
  useEffect(() => { projectsRef.current = projects; }, [projects]);

  // ═══ Greeting ═══
  const getGreeting = () => {
    const h = new Date().getHours();
    return h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
  };

  const fullGreeting = `${getGreeting()} ${USER.name} ! Bienvenue dans ton Command Center. Tu as ${activeProjects.length} projets actifs avec une progression moyenne de ${totalProgress}%. Je te suggère de commencer par configurer les clés API ImagineArt — c'est le blocker principal pour tester le pipeline vidéo.`;

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

    setChatInput("");
    setChatHistory((prev) => [...prev, { role: "user", text }]);
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
      window.oumniaAPI.chatStream(text, projectContext, true);
    }
  }, []);

  // ═══ Command Handlers ═══
  const handleReposCommand = useCallback(() => {
    setGeneralState("repos");
    setVoiceMode(false);
    voiceInputRef.current?.stop();
    voiceOutputRef.current?.stop();
  }, []);

  const handleWakeCommand = useCallback(() => {
    setGeneralState("idle");
    setVoiceMode(true);
    voiceOutputRef.current?.speak("Je suis de retour. Je t'écoute.").then(() => {
      setGeneralState("listening");
      voiceInputRef.current?.start();
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

        const welcomePrompt = `Genere un message d'accueil court (2-3 phrases max, pas d'emoji) pour ${ctx.profile?.name || "Yassine"}.

CONTEXTE :
- ${ctx.time?.dateStr || "Aujourd'hui"}, ${ctx.time?.timeStr || ""} (${ctx.time?.period || ""})
- ${ctx.projects?.activeCount || 0} projets actifs, progression moyenne ${ctx.projects?.averageProgress || 0}%
- Sessions totales : ${ctx.stats?.sessionsCount || 0}, Interactions : ${ctx.stats?.totalInteractions || 0}
${ctx.sessionGap?.days >= 1 ? `- Derniere session il y a ${ctx.sessionGap.days} jour(s)` : ""}
${alerts}
${ctx.timeSuggestion || ""}

TON = commandant bienveillant : concis, professionnel, une suggestion d'action concrete basee sur les alertes.
NE DIS PAS "Bonjour" de maniere generique — donne un briefing contextuel.`;

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
      setChatHistory((prev) => [...prev, { role: "ai", text: fullText }]);
      setStreamingText("");
      streamingRef.current = "";
      setChatLoading(false);

      if (voiceModeRef.current) {
        // Speak any remaining unspoken text
        const textForSpeech = fullText.replace(/```[\s\S]*?```/g, " bloc de code ");
        const remaining = textForSpeech.substring(spokenIndexRef.current).trim();
        spokenIndexRef.current = 0;
        sentenceQueueRef.current = [];

        // Start listening immediately — don't wait for speech to finish
        // User can interrupt GENERAL by speaking (handled in handleVoiceTranscript)
        voiceInputRef.current?.start();
        setGeneralState("speaking");

        const onSpeechDone = () => {
          // Only switch to listening if still in speaking state (not interrupted)
          setGeneralState((prev) => prev === "speaking" ? "listening" : prev);
        };

        if (remaining.length > 2) {
          voiceOutputRef.current?.speak(remaining).then(onSpeechDone).catch(onSpeechDone);
        } else {
          const waitForSpeech = () => {
            if (voiceOutputRef.current?.isSpeaking()) {
              setTimeout(waitForSpeech, 200);
            } else {
              onSpeechDone();
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
        if (newXp >= maxXp) {
          setLevel((l) => {
            const newLevel = l + 1;
            window.oumniaAPI.storeSet("level", newLevel);
            return newLevel;
          });
          const remainder = newXp - maxXp;
          window.oumniaAPI.storeSet("xp", remainder);
          return remainder;
        }
        window.oumniaAPI.storeSet("xp", newXp);
        return newXp;
      });
    });

    window.oumniaAPI.onStreamError((error) => {
      setChatHistory((prev) => [
        ...prev,
        { role: "ai", text: `Erreur : ${error}` },
      ]);
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
        setChatHistory(prev => [...prev, { role: "ai", text: "\u26a0\ufe0f Acc\u00e8s au micro refus\u00e9. V\u00e9rifie les permissions." }]);
        setVoiceMode(false);
        setGeneralState("idle");
      }
    };

    // Auto-start voice input after app is ready (delay to avoid boot race)
    const autoStartTimer = setTimeout(() => {
      if (!voiceIn.isListening()) {
        console.log("[VOICE] Auto-starting voice input");
        voiceIn.start();
      }
    }, 3000);

    // ═══ WATCHDOG — JARVIS never sleeps ═══
    // Every 2s: if voiceMode is ON, not speaking/thinking, and mic is dead → force restart
    const watchdog = setInterval(() => {
      const vm = voiceModeRef.current;
      const speaking = voiceOut.isSpeaking();
      const listening = voiceIn.isListening();

      if (vm && !speaking && !listening) {
        console.log("[VOICE-WATCHDOG] Mic down — forcing restart");
        voiceIn.start();
        setGeneralState((prev) => {
          // Only override to "listening" if we're in a stale state
          if (prev === "idle" || prev === "speaking") return "listening";
          return prev; // Don't override thinking/coding
        });
      }
    }, 2000);

    // Sync audioLevel ref -> state at ~15fps with decay
    const levelInterval = setInterval(() => {
      setAudioLevel(audioLevelRef.current);
      audioLevelRef.current *= 0.85;
    }, 66);

    return () => {
      clearTimeout(autoStartTimer);
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
    setChatInput("");
    setChatHistory((prev) => [...prev, { role: "user", text: msg }]);
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
      window.oumniaAPI.chatStream(msg, projectContext, voiceMode);
    } else {
      // Fallback when not in Electron
      setTimeout(() => {
        setChatHistory((prev) => [
          ...prev,
          { role: "ai", text: "Mode demo — connecte l'API Claude via le fichier .env pour activer l'agent AI." },
        ]);
        setChatLoading(false);
        setGeneralState("idle");
      }, 1000);
    }
  }, [chatInput, chatLoading, projects]);

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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, streamingText]);

  // ═══ Open links ═══
  const openLink = (url) => {
    if (isElectron) window.oumniaAPI.openExternal(url);
    else window.open(url, "_blank");
  };

  // ═══ Time formatting ═══
  const hours = time.getHours().toString().padStart(2, "0");
  const mins = time.getMinutes().toString().padStart(2, "0");
  const secs = time.getSeconds().toString().padStart(2, "0");
  const dateStr = time.toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // ═══ Status display ═══
  const stateColors = {
    idle: "var(--green)", listening: "#00e676", thinking: "#7c4dff",
    speaking: "var(--cyan)", coding: "#ff6d00", repos: "var(--text-muted)",
  };
  const stateLabels = {
    idle: "READY", listening: "LISTENING", thinking: "THINKING",
    speaking: "SPEAKING", coding: "CODING", repos: "REPOS",
  };
  const stateColor = stateColors[generalState] || "var(--green)";
  const stateLabel = stateLabels[generalState] || "READY";

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
                  onClick={() => {
                    setActiveNav(item.key);
                    if (item.key === "agent") setChatOpen(true);
                  }}
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
                  {xp}/{maxXp} XP
                </span>
              </div>
              <div style={{ height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(xp / maxXp) * 100}%`, borderRadius: "2px",
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
            <button onClick={() => setFocusMode(!focusMode)} style={{
              padding: "4px 12px", borderRadius: "6px",
              border: `1px solid ${focusMode ? "var(--border-accent)" : "var(--border)"}`,
              background: focusMode ? "var(--bg-hover)" : "rgba(255,255,255,0.03)",
              color: focusMode ? "var(--cyan)" : "var(--text-secondary)",
              fontSize: "10px", fontWeight: "600", cursor: "pointer", fontFamily: "var(--font-main)",
            }}>▶ {focusMode ? "Focus ON" : "Start Focus"}</button>
            <button style={{
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

        {/* Energy Bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: "16px", padding: "7px 24px",
          background: "rgba(255,255,255,0.01)", borderBottom: "1px solid rgba(255,255,255,0.03)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "9px", fontWeight: "600", color: "var(--text-muted)", letterSpacing: "1px" }}>ENERGY</span>
            <div style={{ width: "160px", height: "3px", borderRadius: "2px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: "83%", borderRadius: "2px",
                background: "linear-gradient(90deg, var(--green), var(--cyan))", boxShadow: "0 0 8px rgba(0,230,118,0.3)" }} />
            </div>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--green)", fontFamily: "var(--font-display)" }}>83%</span>
          </div>
          <div style={{ width: "1px", height: "14px", background: "var(--border)" }} />
          <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>PROCHAIN →</span>
          <span style={{ fontSize: "11px", color: "var(--yellow)", fontWeight: "600" }}>Sync Oussama</span>
          <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>dans 2h 30m</span>
        </div>

        {/* ═══ SCROLLABLE CONTENT ═══ */}
        <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>

          {/* HERO ROW */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 220px 260px", gap: "20px", marginBottom: "24px", alignItems: "center" }}>

            {/* Greeting */}
            <div style={{ animation: "fadeIn 0.8s ease-out" }}>
              <div style={{ fontSize: "10px", color: "rgba(0,229,255,0.4)", letterSpacing: "3px", fontWeight: "600", marginBottom: "6px" }}>
                // COMMAND CENTER
              </div>
              <div style={{ fontSize: "26px", fontWeight: "300", color: "var(--text-secondary)", lineHeight: 1.2 }}>
                {getGreeting()},
              </div>
              <div style={{
                fontSize: "36px", fontWeight: "800", marginTop: "2px",
                background: "linear-gradient(135deg, var(--cyan) 0%, #00b8d4 50%, var(--purple) 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1.1,
              }}>{USER.name}</div>
              <div style={{ width: "60px", height: "2px", background: "linear-gradient(90deg, var(--cyan), transparent)", marginTop: "8px" }} />
            </div>

            {/* GENERAL HOLOGRAM */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", animation: "fadeIn 1s ease-out 0.2s both" }}>
              <div style={{ fontSize: "10px", fontFamily: "var(--font-display)", color: "rgba(0,229,255,0.4)", letterSpacing: "4px", marginBottom: "-4px" }}>
                G.E.N.E.R.A.L
              </div>
              <GeneralHologram
                state={generalState}
                audioLevel={audioLevel}
                onClick={() => {
                  if (generalState === "repos") {
                    handleWakeCommand();
                  } else {
                    setChatOpen(!chatOpen);
                  }
                }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "-4px" }}>
                <div style={{
                  width: "5px", height: "5px", borderRadius: "50%",
                  background: stateColor,
                  boxShadow: `0 0 8px ${stateColor}`,
                  animation: generalState !== "idle" ? "pulse 1s infinite" : "none",
                }} />
                <span style={{ fontSize: "9px", fontFamily: "var(--font-mono)", color: stateColor, letterSpacing: "2px" }}>
                  {stateLabel}
                </span>
              </div>
            </div>

            {/* Weather */}
            <div style={{
              background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "14px",
              padding: "16px", animation: "fadeIn 1s ease-out 0.4s both",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                <div>
                  <div style={{ fontSize: "30px", fontWeight: "700", fontFamily: "var(--font-display)", color: "var(--yellow)" }}>
                    26°<span style={{ fontSize: "13px", fontWeight: "400", color: "var(--text-muted)" }}>C</span>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Ensoleillé</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "28px" }}>☀️</div>
                  <div style={{ fontSize: "9px", color: "var(--text-muted)" }}>💧 38% · 🌬 12km/h</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                {[{ d: "LUN", t: "28°", i: "☀️" }, { d: "MAR", t: "25°", i: "⛅" }, { d: "MER", t: "27°", i: "☀️" }].map((f) => (
                  <div key={f.d} style={{ flex: 1, textAlign: "center", padding: "5px 0", borderRadius: "6px", background: "rgba(255,255,255,0.03)" }}>
                    <div style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: "600", marginBottom: "2px" }}>{f.d}</div>
                    <div style={{ fontSize: "14px" }}>{f.i}</div>
                    <div style={{ fontSize: "10px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{f.t}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* AI Message */}
          <div style={{
            background: "rgba(0,229,255,0.03)", border: "1px solid rgba(0,229,255,0.1)", borderRadius: "12px",
            padding: "12px 16px", marginBottom: "20px", display: "flex", alignItems: "flex-start", gap: "12px",
          }}>
            <div style={{
              width: "28px", height: "28px", borderRadius: "8px", background: "linear-gradient(135deg, var(--cyan), var(--purple))",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", flexShrink: 0, color: "#fff",
            }}>◈</div>
            <div style={{ flex: 1, fontSize: "12px", color: "rgba(255,255,255,0.7)", lineHeight: 1.6,
              overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
              {aiText}{aiTyping && <span style={{ color: "var(--cyan)", animation: "blink 0.7s infinite" }}>│</span>}
            </div>
          </div>

          {/* STATS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
            {[
              { value: activeProjects.length, label: "PROJETS ACTIFS", color: "var(--purple)", bg: "rgba(124,77,255,0.06)" },
              { value: AGENTS.length, label: "AGENTS AI", color: "var(--cyan)", bg: "rgba(0,229,255,0.05)" },
              { value: `${totalProgress}%`, label: "PROGRESSION", color: "var(--green)", bg: "rgba(0,230,118,0.05)" },
              { value: "6.9k", label: "LIGNES CODE", color: "var(--yellow)", bg: "rgba(255,215,64,0.05)" },
            ].map((s, i) => (
              <div key={i} style={{
                background: s.bg, border: "1px solid rgba(255,255,255,0.04)", borderRadius: "12px",
                padding: "14px", textAlign: "center", animation: `fadeIn 0.6s ease-out ${0.6 + i * 0.1}s both`,
              }}>
                <div style={{ fontSize: "26px", fontWeight: "800", fontFamily: "var(--font-display)", color: s.color }}>{s.value}</div>
                <div style={{ fontSize: "9px", color: "var(--text-muted)", letterSpacing: "1px", fontWeight: "600", marginTop: "3px" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* FOCUS + AGENTS */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>

            {/* Today's Focus */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "14px", padding: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px" }}>
                <span style={{ fontSize: "10px", color: "var(--text-muted)", letterSpacing: "2px", fontWeight: "600" }}>// EXECUTE TODAY</span>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--cyan)" }}>TODAY'S FOCUS</span>
              </div>
              {FOCUS_TASKS.map((task, i) => (
                <div key={task.id} style={{
                  display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px",
                  borderRadius: "8px", marginBottom: "6px", background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.03)", cursor: "pointer", transition: "all 0.2s",
                }}>
                  <span style={{ fontSize: "12px", fontFamily: "var(--font-display)", color: "rgba(0,229,255,0.4)", fontWeight: "700", width: "20px" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "12px", color: "var(--text-primary)", fontWeight: "500" }}>{task.text}</div>
                    <div style={{ fontSize: "9px", color: "var(--text-muted)", marginTop: "2px" }}>{task.project}</div>
                  </div>
                  <span style={{
                    fontSize: "9px", padding: "3px 8px", borderRadius: "4px", fontWeight: "700",
                    background: task.status === "in_progress" ? "rgba(0,229,255,0.1)" : "rgba(255,215,64,0.1)",
                    color: task.status === "in_progress" ? "var(--cyan)" : "var(--yellow)",
                  }}>
                    {task.status === "in_progress" ? "● En Cours" : "○ En Attente"}
                  </span>
                </div>
              ))}
            </div>

            {/* AI Agents */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "14px", padding: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px" }}>
                <span style={{ fontSize: "10px", color: "var(--text-muted)", letterSpacing: "2px", fontWeight: "600" }}>// AI WORKFORCE</span>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--purple)" }}>
                  AGENTS · {AGENTS.filter((a) => a.status === "active").length} ACTIVE
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "16px", padding: "10px 0" }}>
                {AGENTS.map((agent, i) => (
                  <div key={i} onMouseEnter={() => setHoveredAgent(i)} onMouseLeave={() => setHoveredAgent(null)}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
                      cursor: "pointer", transition: "transform 0.3s", transform: hoveredAgent === i ? "scale(1.1)" : "scale(1)",
                    }}>
                    <div style={{
                      width: "52px", height: "52px", borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px",
                      background: "rgba(6,6,16,0.8)",
                      border: `2px solid ${agent.status === "active" ? agent.color : "rgba(255,255,255,0.1)"}`,
                      boxShadow: agent.status === "active" ? `0 0 15px ${agent.color}30` : "none",
                    }}>{agent.emoji}</div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "10px", fontWeight: "600", color: agent.status === "active" ? agent.color : "var(--text-secondary)" }}>
                        {agent.name}
                      </div>
                      <div style={{ fontSize: "8px", color: "var(--text-muted)" }}>{agent.role}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: "14px", marginTop: "8px", paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                {[{ l: "Active", c: "var(--cyan)" }, { l: "Idle", c: "var(--yellow)" }, { l: "Building", c: "var(--purple)" }].map((s) => (
                  <div key={s.l} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: s.c }} />
                    <span style={{ fontSize: "8px", color: "var(--text-muted)" }}>{s.l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* PROJECTS */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px", marginBottom: "24px" }}>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "14px", padding: "18px" }}>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", letterSpacing: "2px", fontWeight: "600", marginBottom: "14px" }}>
                // PROJETS ACTIFS
              </div>
              {activeProjects.map((p) => (
                <div key={p.id} style={{
                  padding: "10px 12px", borderRadius: "8px", marginBottom: "6px",
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.03)",
                  cursor: "pointer", transition: "all 0.2s",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)" }}>{p.name}</span>
                      {p.priority === "high" && (
                        <span style={{ fontSize: "8px", padding: "1px 5px", borderRadius: "3px",
                          background: "rgba(255,61,0,0.12)", color: "var(--red)", fontWeight: "700" }}>HIGH</span>
                      )}
                    </div>
                    <span style={{ fontSize: "11px", fontFamily: "var(--font-display)", color: "var(--cyan)", fontWeight: "600" }}>{p.progress}%</span>
                  </div>
                  <div style={{ height: "2px", borderRadius: "1px", background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${p.progress}%`, borderRadius: "1px",
                      background: "linear-gradient(90deg, var(--cyan), var(--purple))", transition: "width 1.5s ease" }} />
                  </div>
                  <div style={{ fontSize: "9px", color: "var(--text-muted)", marginTop: "4px" }}>{p.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* QUICK ACCESS */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "14px", padding: "18px", marginBottom: "24px" }}>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", letterSpacing: "2px", fontWeight: "600", marginBottom: "14px" }}>
              // QUICK ACCESS
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
              {Object.entries(QUICK_ACCESS).map(([cat, links]) => (
                <div key={cat}>
                  <div style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: "600", letterSpacing: "1px", marginBottom: "8px" }}>{cat}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {links.map((link) => (
                      <span key={link.name} onClick={() => openLink(link.url)} style={{
                        padding: "4px 10px", borderRadius: "5px", fontSize: "10px", fontWeight: "500",
                        color: "var(--text-secondary)", background: "rgba(255,255,255,0.04)",
                        cursor: "pointer", transition: "all 0.2s", border: "1px solid rgba(255,255,255,0.04)",
                        display: "inline-block",
                      }}>{link.name}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* NEWS */}
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "14px",
            padding: "14px 18px", display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px",
          }}>
            <span style={{ fontSize: "10px", color: "var(--text-muted)", letterSpacing: "2px", fontWeight: "600", flexShrink: 0 }}>📰 NEWS</span>
            <div style={{ width: "1px", height: "18px", background: "var(--border)" }} />
            <div style={{ display: "flex", gap: "16px", flex: 1, overflow: "auto" }}>
              {[
                { t: "Claude 4.5 Opus : modèle le plus avancé", tag: "AI", c: "var(--cyan)" },
                { t: "Food Tech Maroc : digitalisation en hausse", tag: "Food", c: "var(--orange)" },
                { t: "GitHub Copilot intègre les agents multi-fichiers", tag: "Dev", c: "var(--purple)" },
              ].map((n, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, cursor: "pointer" }}>
                  <span style={{ fontSize: "8px", padding: "2px 6px", borderRadius: "3px",
                    background: `${n.c}15`, color: n.c, fontWeight: "700" }}>{n.tag}</span>
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{n.t}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ═══ CHAT OVERLAY ═══ */}
      <div style={{
        position: "fixed", bottom: "24px", right: "24px", width: "400px", height: "500px",
        background: "rgba(6,6,16,0.95)", border: "1px solid var(--border)", borderRadius: "16px",
        backdropFilter: "blur(20px)", display: "flex", flexDirection: "column", zIndex: 100,
        transform: chatOpen ? "translateY(0)" : "translateY(calc(100% + 40px))",
        transition: "transform 0.3s ease",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "14px 18px", borderBottom: "1px solid var(--border)",
        }}>
          <span style={{ fontSize: "10px", color: "var(--text-muted)", letterSpacing: "2px", fontWeight: "600" }}>
            // AGENT OUMNIA · CHAT
          </span>
          <button onClick={() => setChatOpen(false)} style={{
            background: "none", border: "none", color: "var(--text-muted)", fontSize: "16px",
            cursor: "pointer", padding: "2px 6px", lineHeight: 1,
          }}>✕</button>
        </div>
        {/* Messages */}
        <div className="chat-messages" style={{ flex: 1, minHeight: 0, overflowY: "scroll", display: "flex", flexDirection: "column", gap: "8px", padding: "14px 18px" }}>
          {chatHistory.length === 0 && (
            <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", fontSize: "11px" }}>
              <div style={{ fontSize: "24px", marginBottom: "6px" }}>◈</div>
              Demande-moi n'importe quoi sur tes projets...
            </div>
          )}
          {chatHistory.map((msg, i) => (
            <MessageBubble key={i} role={msg.role} text={msg.text} />
          ))}
          {streamingText && (
            <MessageBubble role="ai" text={streamingText} isStreaming />
          )}
          {chatLoading && !streamingText && (
            <div style={{ padding: "8px 12px", fontSize: "11px", color: "var(--cyan)", animation: "pulse 1s infinite" }}>
              ◈ Analyse en cours...
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        {/* Input */}
        <div style={{ display: "flex", gap: "6px", padding: "12px 18px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
          <input
            data-chat-input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendChat()}
            placeholder="Parle à l'agent OUMNIA..."
            style={{
              flex: 1, padding: "8px 12px", borderRadius: "8px",
              border: `1px solid ${voiceMode ? "rgba(0,230,118,0.4)" : "var(--border)"}`,
              background: voiceMode ? "rgba(0,230,118,0.05)" : "rgba(255,255,255,0.03)",
              color: "#fff", fontSize: "11px", outline: "none", fontFamily: "var(--font-main)",
              transition: "border-color 0.2s, background 0.2s",
            }}
          />
          <button onClick={toggleVoice} style={{
            padding: "8px 10px", borderRadius: "8px", border: "none",
            background: voiceMode ? "rgba(0,230,118,0.2)" : "rgba(255,255,255,0.05)",
            color: voiceMode ? "#00e676" : "var(--text-secondary)",
            cursor: "pointer", fontSize: "14px", lineHeight: 1,
            animation: voiceMode ? "pulse 1s infinite" : "none",
            transition: "all 0.2s",
          }} title={voiceMode ? "Désactiver la voix" : "Activer la voix"}>
            {voiceMode ? "●" : "🎤"}
          </button>
          <button onClick={sendChat} style={{
            padding: "8px 14px", borderRadius: "8px", border: "none",
            background: "linear-gradient(135deg, var(--cyan), var(--purple))",
            color: "#fff", cursor: "pointer", fontSize: "11px", fontWeight: "600", fontFamily: "var(--font-main)",
          }}>➤</button>
        </div>
      </div>
    </div>
  );
}

export default App;
