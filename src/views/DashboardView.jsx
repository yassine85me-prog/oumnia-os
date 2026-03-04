import GeneralHologram from "../components/GeneralHologram";
import { USER, AGENTS, QUICK_ACCESS } from "../data/config";
import { STATE_COLORS, STATE_LABELS, getGreeting } from "../utils/ui-constants";

const isElectron = typeof window !== "undefined" && window.oumniaAPI;
const openLink = (url) => {
  if (isElectron) window.oumniaAPI.openExternal(url);
  else window.open(url, "_blank");
};

export default function DashboardView({
  projects, aiText, aiTyping, generalState, audioLevel,
  totalCodeLines, onNavigate, onHologramClick, onSwitchAgent,
}) {
  const activeProjects = projects.filter((p) => p.status === "in_progress");
  const totalProgress = activeProjects.length > 0
    ? Math.round(activeProjects.reduce((a, p) => a + p.progress, 0) / activeProjects.length)
    : 0;

  const stateColor = STATE_COLORS[generalState] || "var(--green)";
  const stateLabel = STATE_LABELS[generalState] || "READY";

  const codeDisplay = totalCodeLines > 0
    ? (totalCodeLines >= 1000 ? `${(totalCodeLines / 1000).toFixed(1)}k` : String(totalCodeLines))
    : "--";

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>

      {/* HERO ROW */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: "20px", marginBottom: "24px", alignItems: "center" }}>

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
          <GeneralHologram state={generalState} audioLevel={audioLevel} onClick={onHologramClick} />
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "-4px" }}>
            <div style={{
              width: "5px", height: "5px", borderRadius: "50%", background: stateColor,
              boxShadow: `0 0 8px ${stateColor}`,
              animation: generalState !== "idle" ? "pulse 1s infinite" : "none",
            }} />
            <span style={{ fontSize: "9px", fontFamily: "var(--font-mono)", color: stateColor, letterSpacing: "2px" }}>
              {stateLabel}
            </span>
          </div>
        </div>
      </div>

      {/* AI Message */}
      {aiText && (
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
      )}

      {/* STATS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
        {[
          { value: activeProjects.length, label: "PROJETS ACTIFS", color: "var(--purple)", bg: "rgba(124,77,255,0.06)", nav: "projects" },
          { value: AGENTS.length, label: "AGENTS AI", color: "var(--cyan)", bg: "rgba(0,229,255,0.05)", nav: "agents" },
          { value: `${totalProgress}%`, label: "PROGRESSION", color: "var(--green)", bg: "rgba(0,230,118,0.05)" },
          { value: codeDisplay, label: "LIGNES CODE", color: "var(--yellow)", bg: "rgba(255,215,64,0.05)" },
        ].map((s, i) => (
          <div key={i} onClick={() => s.nav && onNavigate(s.nav)} style={{
            background: s.bg, border: "1px solid rgba(255,255,255,0.04)", borderRadius: "12px",
            padding: "14px", textAlign: "center", animation: `fadeIn 0.6s ease-out ${0.6 + i * 0.1}s both`,
            cursor: s.nav ? "pointer" : "default", transition: "all 0.2s",
          }}>
            <div style={{ fontSize: "26px", fontWeight: "800", fontFamily: "var(--font-display)", color: s.color }}>{s.value}</div>
            <div style={{ fontSize: "9px", color: "var(--text-muted)", letterSpacing: "1px", fontWeight: "600", marginTop: "3px" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* AI AGENTS */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "14px", padding: "18px", marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px" }}>
          <span style={{ fontSize: "10px", color: "var(--text-muted)", letterSpacing: "2px", fontWeight: "600" }}>// AI WORKFORCE</span>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--purple)" }}>
            AGENTS · {AGENTS.filter((a) => a.status === "active").length} ACTIVE
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "16px", padding: "10px 0" }}>
          {AGENTS.map((agent, i) => (
            <div key={i} onClick={() => agent.status === "active" && onSwitchAgent && onSwitchAgent(agent.id)} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
              cursor: agent.status === "active" ? "pointer" : "default", transition: "transform 0.3s",
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
      </div>

      {/* PROJECTS */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "14px", padding: "18px", marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px" }}>
          <span style={{ fontSize: "10px", color: "var(--text-muted)", letterSpacing: "2px", fontWeight: "600" }}>// PROJETS ACTIFS</span>
          <span onClick={() => onNavigate("projects")} style={{
            fontSize: "10px", color: "var(--cyan)", cursor: "pointer", fontWeight: "600",
          }}>Voir tout →</span>
        </div>
        {activeProjects.map((p) => (
          <div key={p.id} onClick={() => onNavigate("projects")} style={{
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
    </div>
  );
}
