import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

const isElectron = typeof window !== "undefined" && window.oumniaAPI;

const THEME = {
  background: "#060610",
  foreground: "rgba(255, 255, 255, 0.88)",
  cursor: "#00e5ff",
  cursorAccent: "#060610",
  selectionBackground: "rgba(0, 229, 255, 0.2)",
  selectionForeground: "#ffffff",
  black: "#1a1a2e",
  red: "#ff6e40",
  green: "#00e676",
  yellow: "#ffd740",
  blue: "#7c4dff",
  magenta: "#c084fc",
  cyan: "#00e5ff",
  white: "rgba(255, 255, 255, 0.85)",
  brightBlack: "#4a4a6a",
  brightRed: "#ff8a65",
  brightGreen: "#69f0ae",
  brightYellow: "#ffe57f",
  brightBlue: "#b388ff",
  brightMagenta: "#ea80fc",
  brightCyan: "#84ffff",
  brightWhite: "#ffffff",
};

export default function TerminalView({ initialCwd, isVisible }) {
  const containerRef = useRef(null);
  const terminalRef = useRef(null);
  const fitAddonRef = useRef(null);
  const termIdRef = useRef(null);
  const prevCwdRef = useRef(null);
  const initDoneRef = useRef(false);
  const [status, setStatus] = useState("connecting");

  // Spawn a PTY — called only after xterm is open + fit on a visible container
  const spawnTerminal = useCallback(async (cwd) => {
    if (!isElectron) return;
    setStatus("connecting");
    try {
      const res = await window.oumniaAPI.terminalSpawn(cwd || null);
      if (res.success) {
        termIdRef.current = res.id;
        setStatus("connected");
      } else {
        setStatus("exited");
      }
    } catch {
      setStatus("exited");
    }
  }, []);

  const handleRestart = useCallback(async () => {
    if (!isElectron) return;
    if (termIdRef.current !== null) {
      await window.oumniaAPI.terminalKill(termIdRef.current);
      termIdRef.current = null;
    }
    terminalRef.current?.clear();
    await spawnTerminal(prevCwdRef.current);
  }, [spawnTerminal]);

  // One-time setup: create xterm, IPC listeners, ResizeObserver.
  // Cleanup only runs on true unmount (component is persistent, so rarely).
  // We use an empty dep array — first-visibility is handled via isVisible ref check below.
  useEffect(() => {
    return () => {
      // Unmount-only cleanup
      if (termIdRef.current !== null && isElectron) {
        window.oumniaAPI.terminalKill(termIdRef.current);
      }
      if (terminalRef.current) {
        terminalRef.current.dispose();
      }
    };
  }, []);

  // Initialize xterm + IPC + spawn on FIRST visibility.
  // Container starts as display:none — xterm needs real dimensions to render.
  // initDoneRef ensures this runs exactly once; no cleanup kills the PTY.
  useEffect(() => {
    if (!isVisible || initDoneRef.current || !containerRef.current) return;
    initDoneRef.current = true;

    const term = new Terminal({
      theme: THEME,
      fontFamily: '"JetBrains Mono", "SF Mono", "Menlo", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      scrollback: 5000,
      cursorBlink: true,
      cursorStyle: "bar",
      macOptionIsMeta: true,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    // Fit after one frame so the container has layout dimensions
    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
      } catch {}
      term.focus();

      if (isElectron) {
        // IPC: receive PTY output → write to xterm
        window.oumniaAPI.onTerminalOutput(({ data }) => {
          term.write(data);
        });

        window.oumniaAPI.onTerminalExit(({ id }) => {
          if (id === termIdRef.current) {
            setStatus("exited");
          }
        });

        // Send keystrokes to PTY
        term.onData((data) => {
          if (termIdRef.current !== null) {
            window.oumniaAPI.terminalInput(termIdRef.current, data);
          }
        });

        // Send resize events to PTY
        term.onResize(({ cols, rows }) => {
          if (termIdRef.current !== null) {
            window.oumniaAPI.terminalResize(termIdRef.current, cols, rows);
          }
        });

        // Spawn the PTY — xterm is open and fit on a visible container
        prevCwdRef.current = initialCwd;
        spawnTerminal(initialCwd);
      }
    });

    // ResizeObserver for auto-fit on window resize
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        try { fitAddon.fit(); } catch {}
      });
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [isVisible, initialCwd, spawnTerminal]);

  // Re-fit + focus when returning to terminal view (after the first init)
  useEffect(() => {
    if (!isVisible || !fitAddonRef.current || !initDoneRef.current) return;
    const raf = requestAnimationFrame(() => {
      setTimeout(() => {
        try { fitAddonRef.current.fit(); } catch {}
        terminalRef.current?.focus();
      }, 50);
    });
    return () => cancelAnimationFrame(raf);
  }, [isVisible]);

  // Handle cwd change from ProjectsView → send cd command
  useEffect(() => {
    if (!initialCwd || !isElectron || !initDoneRef.current) return;
    if (prevCwdRef.current !== initialCwd && termIdRef.current !== null) {
      const escaped = initialCwd.replace(/'/g, "'\\''");
      window.oumniaAPI.terminalInput(termIdRef.current, `cd '${escaped}'\r`);
      prevCwdRef.current = initialCwd;
    }
  }, [initialCwd]);

  const statusColor = status === "connected" ? "var(--green)"
    : status === "connecting" ? "var(--yellow)"
    : "var(--red)";

  const statusLabel = status === "connected" ? "Connected"
    : status === "connecting" ? "Connecting..."
    : "Exited";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: "8px 16px", borderBottom: "1px solid var(--border)",
        background: "rgba(6,6,16,0.6)", flexShrink: 0,
      }}>
        <div style={{
          width: "7px", height: "7px", borderRadius: "50%",
          background: statusColor,
          boxShadow: `0 0 6px ${statusColor}`,
        }} />
        <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: "500" }}>
          {statusLabel}
        </span>
        <span style={{
          fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)",
        }}>
          zsh
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleRestart}
          style={{
            padding: "4px 12px", borderRadius: "6px",
            border: "1px solid var(--border-accent)",
            background: "var(--bg-hover)", color: "var(--cyan)",
            fontSize: "10px", fontWeight: "600", cursor: "pointer",
            fontFamily: "var(--font-main)",
          }}
        >
          Restart
        </button>
      </div>

      {/* Terminal container */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          padding: "4px 0 0 4px",
          background: "#060610",
          overflow: "hidden",
        }}
      />
    </div>
  );
}
