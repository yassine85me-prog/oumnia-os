import { useState, useEffect } from "react";
import { CARD_STYLE as cardStyle, CARD_HEADER_STYLE as cardHeaderStyle, MAX_XP } from "../utils/ui-constants";

const isElectron = typeof window !== "undefined" && window.oumniaAPI;

const PROFILE_FIELDS = [
  { key: "name", label: "Nom" },
  { key: "role", label: "Role" },
  { key: "city", label: "Ville" },
  { key: "expertise", label: "Expertise" },
  { key: "stack", label: "Stack Technique" },
  { key: "machines", label: "Machines" },
  { key: "restaurants", label: "Restaurants" },
  { key: "partner", label: "Partenaire" },
];

export default function SettingsView() {
  const [profile, setProfile] = useState({});
  const [systemInfo, setSystemInfo] = useState(null);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);

  useEffect(() => {
    if (!isElectron) { setLoading(false); return; }
    Promise.all([
      window.oumniaAPI.memoryLoad(),
      window.oumniaAPI.getSystemInfo(),
      window.oumniaAPI.storeGet("xp"),
      window.oumniaAPI.storeGet("level"),
    ]).then(([memRes, sysRes, xpVal, lvlVal]) => {
      if (memRes?.success && memRes.data) {
        setProfile(memRes.data.profile || {});
        setStats(memRes.data.stats || {});
      }
      if (sysRes?.success) setSystemInfo(sysRes);
      if (xpVal) setXp(xpVal);
      if (lvlVal) setLevel(lvlVal);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const startEdit = (key, value) => {
    setEditingKey(key);
    setEditValue(value || "");
  };

  const saveField = async () => {
    if (!editingKey || !isElectron) return;
    setSaving(true);
    try {
      await window.oumniaAPI.memorySave({ profile: { [editingKey]: editValue } });
      setProfile((prev) => ({ ...prev, [editingKey]: editValue }));
    } catch {}
    setSaving(false);
    setEditingKey(null);
  };

  const cancelEdit = () => { setEditingKey(null); setEditValue(""); };

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "var(--cyan)", fontSize: "14px", animation: "pulse 1s infinite" }}>◈ Chargement...</div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
      <div style={{ fontSize: "10px", color: "var(--text-muted)", letterSpacing: "2px", fontWeight: "600", marginBottom: "20px" }}>
        // PARAMETRES
      </div>

      {/* Profile */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>// PROFIL</div>
        {PROFILE_FIELDS.map((field) => {
          const value = profile[field.key] || "";
          const isEditing = editingKey === field.key;
          return (
            <div key={field.key} style={{
              display: "flex", alignItems: "center", gap: "12px", padding: "8px 0",
              borderBottom: "1px solid rgba(255,255,255,0.03)",
            }}>
              <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "600", width: "100px", flexShrink: 0 }}>
                {field.label}
              </span>
              {isEditing ? (
                <>
                  <input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveField()}
                    autoFocus
                    style={{
                      flex: 1, padding: "6px 10px", borderRadius: "6px",
                      border: "1px solid var(--border-accent)", background: "rgba(0,229,255,0.05)",
                      color: "#fff", fontSize: "11px", outline: "none", fontFamily: "var(--font-main)",
                    }}
                  />
                  <button onClick={saveField} disabled={saving} style={{
                    padding: "4px 10px", borderRadius: "6px", border: "none",
                    background: "rgba(0,230,118,0.15)", color: "var(--green)",
                    fontSize: "10px", fontWeight: "600", cursor: "pointer",
                  }}>{saving ? "..." : "OK"}</button>
                  <button onClick={cancelEdit} style={{
                    padding: "4px 8px", borderRadius: "6px", border: "none",
                    background: "rgba(255,255,255,0.05)", color: "var(--text-muted)",
                    fontSize: "10px", cursor: "pointer",
                  }}>✕</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: "11px", color: value ? "var(--text-primary)" : "var(--text-muted)" }}>
                    {value || "—"}
                  </span>
                  <button onClick={() => startEdit(field.key, value)} style={{
                    padding: "4px 10px", borderRadius: "6px", border: "1px solid var(--border)",
                    background: "rgba(255,255,255,0.03)", color: "var(--text-secondary)",
                    fontSize: "10px", cursor: "pointer", fontFamily: "var(--font-main)",
                  }}>Modifier</button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* System Info + Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "20px" }}>
        {/* System */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>// SYSTEME</div>
          {!isElectron ? (
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Disponible en mode Electron</div>
          ) : systemInfo ? (
            <div style={{ fontSize: "11px", lineHeight: 2, color: "var(--text-secondary)" }}>
              <div>Plateforme: <span style={{ color: "var(--cyan)" }}>{systemInfo.platform}</span></div>
              <div>Hostname: <span style={{ color: "var(--text-primary)" }}>{systemInfo.hostname}</span></div>
              <div>CPU: <span style={{ color: "var(--text-primary)" }}>{systemInfo.cpuModel}</span></div>
              <div>RAM: <span style={{ color: "var(--green)" }}>{systemInfo.freemem}</span> / {systemInfo.totalmem}</div>
              <div>Uptime: <span style={{ color: "var(--text-primary)" }}>{systemInfo.uptime}</span></div>
            </div>
          ) : (
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Chargement...</div>
          )}
        </div>

        {/* Stats */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>// STATISTIQUES</div>
          <div style={{ fontSize: "11px", lineHeight: 2, color: "var(--text-secondary)" }}>
            <div>Sessions: <span style={{ color: "var(--cyan)", fontWeight: "700", fontFamily: "var(--font-display)" }}>{stats.sessionsCount || 0}</span></div>
            <div>Interactions: <span style={{ color: "var(--cyan)", fontWeight: "700", fontFamily: "var(--font-display)" }}>{stats.totalInteractions || 0}</span></div>
            <div>Derniere session: <span style={{ color: "var(--text-primary)" }}>{stats.lastSessionDate || "—"}</span></div>
            <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              <span style={{ fontSize: "10px", fontWeight: "700", fontFamily: "var(--font-display)",
                background: "linear-gradient(90deg, var(--yellow), var(--orange))",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>PLAYER LVL {level}</span>
              <span style={{ fontSize: "10px", color: "var(--text-muted)", marginLeft: "8px" }}>{xp}/{MAX_XP} XP</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

