import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { CARD_STYLE as cardStyle, CARD_HEADER_STYLE as cardHeaderStyle } from "../utils/ui-constants";

const isElectron = typeof window !== "undefined" && window.oumniaAPI;

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}j`;
}

export default function ProjectsView({ onOpenTerminal }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedPath, setSelectedPath] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!isElectron) { setLoading(false); return; }
    window.oumniaAPI.scanProjects().then((res) => {
      if (res.success) setProjects(res.projects || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSelect = async (project) => {
    if (!isElectron) return;
    setSelectedPath(project.path);
    setDetailLoading(true);
    try {
      const res = await window.oumniaAPI.deepScanProject(project.path);
      if (res.success !== false) {
        setDetail(res);
        window.oumniaAPI.setCurrentProject(res);
      }
    } catch {}
    setDetailLoading(false);
  };

  const handleBack = () => { setSelectedPath(null); setDetail(null); };

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  // ═══ DETAIL VIEW ═══
  if (selectedPath) {
    if (detailLoading) {
      return (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ color: "var(--cyan)", fontSize: "14px", animation: "pulse 1s infinite" }}>◈ Analyse du projet en cours...</div>
        </div>
      );
    }
    if (!detail) {
      return (
        <div style={{ flex: 1, padding: "24px" }}>
          <button onClick={handleBack} style={backBtnStyle}>← Retour</button>
          <div style={{ color: "var(--text-muted)", marginTop: "20px" }}>Impossible de charger le projet.</div>
        </div>
      );
    }

    return (
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
          <button onClick={handleBack} style={backBtnStyle}>← Retour</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "20px", fontWeight: "700", fontFamily: "var(--font-display)", color: "var(--cyan)" }}>
              {detail.name}
            </div>
            {detail.description && (
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{detail.description}</div>
            )}
          </div>
          {detail.gitBranch && (
            <div style={{ padding: "4px 10px", borderRadius: "6px", background: "rgba(124,77,255,0.1)", border: "1px solid rgba(124,77,255,0.2)" }}>
              <span style={{ fontSize: "10px", color: "var(--purple)", fontWeight: "600" }}>{detail.gitBranch}</span>
            </div>
          )}
          {onOpenTerminal && (
            <button onClick={() => onOpenTerminal(detail.path)} style={{
              padding: "6px 14px", borderRadius: "8px",
              border: "1px solid var(--border-accent)",
              background: "var(--bg-hover)", color: "var(--cyan)",
              fontSize: "10px", fontWeight: "600", cursor: "pointer",
              fontFamily: "var(--font-mono)",
            }}>
              {">"}_  Terminal
            </button>
          )}
        </div>

        {/* Tech Stack */}
        {detail.techStack?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "20px" }}>
            {detail.techStack.map((tech) => (
              <span key={tech} style={{
                padding: "4px 10px", borderRadius: "6px", fontSize: "10px", fontWeight: "600",
                background: "rgba(0,229,255,0.08)", color: "var(--cyan)", border: "1px solid rgba(0,229,255,0.15)",
              }}>{tech}</span>
            ))}
          </div>
        )}

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "20px" }}>
          {/* Git Status */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>// GIT</div>
            <div style={{ fontSize: "12px", color: "var(--text-primary)", lineHeight: 1.8 }}>
              {detail.gitBranch && <div>Branche: <span style={{ color: "var(--purple)" }}>{detail.gitBranch}</span></div>}
              {detail.gitStatus && <div style={{ fontSize: "10px", color: "var(--text-muted)", whiteSpace: "pre-wrap" }}>{detail.gitStatus.substring(0, 200)}</div>}
              {!detail.gitStatus && <div style={{ color: "var(--green)", fontSize: "10px" }}>Clean</div>}
            </div>
          </div>
          {/* File Stats */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>// STATS</div>
            <div style={{ fontSize: "24px", fontWeight: "800", fontFamily: "var(--font-display)", color: "var(--cyan)" }}>
              {detail.fileCount || 0}
            </div>
            <div style={{ fontSize: "9px", color: "var(--text-muted)" }}>fichiers</div>
            <div style={{ fontSize: "18px", fontWeight: "700", fontFamily: "var(--font-display)", color: "var(--yellow)", marginTop: "6px" }}>
              {detail.totalLines ? (detail.totalLines >= 1000 ? `${(detail.totalLines / 1000).toFixed(1)}k` : detail.totalLines) : "--"}
            </div>
            <div style={{ fontSize: "9px", color: "var(--text-muted)" }}>lignes de code</div>
          </div>
          {/* Scripts */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>// SCRIPTS</div>
            {detail.scripts && Object.keys(detail.scripts).length > 0 ? (
              <div style={{ fontSize: "10px", lineHeight: 1.8 }}>
                {Object.entries(detail.scripts).slice(0, 6).map(([name, cmd]) => (
                  <div key={name}>
                    <span style={{ color: "var(--green)", fontWeight: "600" }}>{name}</span>
                    <span style={{ color: "var(--text-muted)", marginLeft: "6px", fontFamily: "var(--font-mono)", fontSize: "9px" }}>
                      {String(cmd).substring(0, 30)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>Aucun script</div>
            )}
          </div>
        </div>

        {/* Recent Commits */}
        {detail.recentCommits?.length > 0 && (
          <div style={{ ...cardStyle, marginBottom: "20px" }}>
            <div style={cardHeaderStyle}>// COMMITS RECENTS</div>
            {detail.recentCommits.slice(0, 8).map((c, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: "10px", padding: "6px 0",
                borderBottom: i < detail.recentCommits.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
              }}>
                <span style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--purple)", fontWeight: "600" }}>
                  {c.hash?.substring(0, 7)}
                </span>
                <span style={{ fontSize: "11px", color: "var(--text-primary)", flex: 1 }}>{c.message}</span>
                <span style={{ fontSize: "9px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{c.time}</span>
              </div>
            ))}
          </div>
        )}

        {/* File Tree */}
        {detail.fileTree?.length > 0 && (
          <div style={{ ...cardStyle, marginBottom: "20px" }}>
            <div style={cardHeaderStyle}>// ARBORESCENCE</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", lineHeight: 1.8, color: "var(--text-secondary)", maxHeight: "300px", overflow: "auto" }}>
              {detail.fileTree.slice(0, 50).map((line, i) => (
                <div key={i}>{line}</div>
              ))}
              {detail.fileTree.length > 50 && (
                <div style={{ color: "var(--text-muted)", marginTop: "4px" }}>...et {detail.fileTree.length - 50} de plus</div>
              )}
            </div>
          </div>
        )}

        {/* README */}
        {detail.readme && (
          <div style={{ ...cardStyle, marginBottom: "20px" }}>
            <div style={cardHeaderStyle}>// README</div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.7 }}>
              <ReactMarkdown>{detail.readme.substring(0, 2000)}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══ LIST VIEW ═══
  return (
    <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", letterSpacing: "2px", fontWeight: "600" }}>// PROJETS</div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>
            {projects.length} projets detectes
          </div>
        </div>
        <button onClick={() => {
          setLoading(true);
          window.oumniaAPI?.scanProjects().then((res) => {
            if (res.success) setProjects(res.projects || []);
            setLoading(false);
          }).catch(() => setLoading(false));
        }} style={{
          padding: "6px 14px", borderRadius: "8px", border: "1px solid var(--border-accent)",
          background: "var(--bg-hover)", color: "var(--cyan)", fontSize: "10px", fontWeight: "600",
          cursor: "pointer", fontFamily: "var(--font-main)",
        }}>↻ Scanner</button>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher un projet..."
        style={{
          width: "100%", padding: "8px 14px", borderRadius: "8px",
          border: "1px solid var(--border)", background: "rgba(255,255,255,0.03)",
          color: "#fff", fontSize: "11px", outline: "none", fontFamily: "var(--font-main)",
          marginBottom: "16px", boxSizing: "border-box",
        }}
      />

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "var(--cyan)", animation: "pulse 1s infinite" }}>
          ◈ Scan des projets en cours...
        </div>
      ) : !isElectron ? (
        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", fontSize: "12px" }}>
          Lance l'app en mode Electron pour scanner tes projets.
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", fontSize: "12px" }}>
          Aucun projet trouve.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {filtered.map((p) => (
            <div key={p.path} onClick={() => handleSelect(p)} style={{
              background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px",
              padding: "16px", cursor: "pointer", transition: "all 0.2s",
            }}>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "8px" }}>
                {p.name}
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "8px" }}>
                {p.git?.branch && (
                  <span style={{ fontSize: "9px", padding: "2px 6px", borderRadius: "4px", background: "rgba(124,77,255,0.1)", color: "var(--purple)", fontWeight: "600" }}>
                    {p.git.branch}
                  </span>
                )}
                {p.git?.dirty && (
                  <span style={{ fontSize: "9px", padding: "2px 6px", borderRadius: "4px", background: "rgba(255,109,0,0.1)", color: "var(--orange)", fontWeight: "600" }}>
                    modified
                  </span>
                )}
                {!p.git?.dirty && p.git && (
                  <span style={{ fontSize: "9px", padding: "2px 6px", borderRadius: "4px", background: "rgba(0,230,118,0.1)", color: "var(--green)", fontWeight: "600" }}>
                    clean
                  </span>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-muted)" }}>
                <span>{p.fileCount} fichiers</span>
                <span>{timeAgo(p.lastModified)}</span>
              </div>
              <div style={{ fontSize: "9px", color: "var(--text-muted)", marginTop: "6px", fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.path}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const backBtnStyle = {
  padding: "6px 14px", borderRadius: "8px", border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.03)", color: "var(--text-secondary)", fontSize: "11px",
  cursor: "pointer", fontFamily: "var(--font-main)",
};
