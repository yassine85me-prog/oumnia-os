import { NAV_ITEMS, QUICK_ACCESS } from "../data/config";

const isElectron = typeof window !== "undefined" && !!window.oumniaAPI;

const allItems = NAV_ITEMS.flatMap((sec) => sec.items);

const VIEW_INFO = {
  analytics: { desc: "Statistiques et metriques de tes projets en temps reel.", phase: 2 },
  agents:    { desc: "Gestion et monitoring de tes agents IA.", phase: 2 },
  tasks:     { desc: "Liste de taches et suivi de progression.", phase: 2 },
  links:     { desc: "Acces rapide a tous tes outils.", phase: 1, hasContent: true },
  health:    { desc: "Suivi sante, energie et habitudes.", phase: 3 },
  calendar:  { desc: "Planning, agenda et rappels.", phase: 3 },
  goals:     { desc: "Objectifs personnels et professionnels.", phase: 3 },
};

function openLink(url) {
  if (isElectron && window.oumniaAPI.openExternal) {
    window.oumniaAPI.openExternal(url);
  } else {
    window.open(url, "_blank");
  }
}

function QuickLinksView() {
  return (
    <div style={{ flex: 1, overflow: "auto", padding: "32px" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <div style={{ marginBottom: "24px" }}>
          <h2 style={{
            fontSize: "18px", fontWeight: "700", fontFamily: "var(--font-display)",
            color: "var(--cyan)", letterSpacing: "1px", margin: 0,
          }}>Quick Links</h2>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "4px 0 0" }}>
            Acces rapide a tous tes outils et services.
          </p>
        </div>

        {Object.entries(QUICK_ACCESS).map(([category, items]) => (
          <div key={category} style={{ marginBottom: "24px" }}>
            <div style={{
              fontSize: "10px", fontWeight: "600", letterSpacing: "2px",
              color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "10px",
            }}>{category}</div>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px",
            }}>
              {items.map((item) => (
                <div
                  key={item.name}
                  onClick={() => openLink(item.url)}
                  style={{
                    padding: "14px 16px", borderRadius: "10px", cursor: "pointer",
                    background: "var(--bg-card)", border: "1px solid var(--border)",
                    transition: "all 0.2s", display: "flex", alignItems: "center", gap: "10px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = item.color;
                    e.currentTarget.style.boxShadow = `0 0 12px ${item.color}22`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{
                    width: "8px", height: "8px", borderRadius: "50%",
                    background: item.color, flexShrink: 0,
                    boxShadow: `0 0 6px ${item.color}44`,
                  }} />
                  <span style={{
                    fontSize: "12px", fontWeight: "500", color: "var(--text-primary)",
                  }}>{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PlaceholderView({ viewKey }) {
  const item = allItems.find((i) => i.key === viewKey);
  const label = item?.label || viewKey;
  const icon = item?.icon || "◈";
  const info = VIEW_INFO[viewKey];

  // Quick Links — functional view
  if (viewKey === "links") {
    return <QuickLinksView />;
  }

  // Other placeholders — enriched card
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px" }}>
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "14px",
        padding: "40px 60px", textAlign: "center", maxWidth: "420px",
        position: "relative", overflow: "hidden",
      }}>
        {/* Animated accent border */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "2px",
          background: "linear-gradient(90deg, transparent, var(--cyan), var(--purple), transparent)",
          backgroundSize: "200% 100%",
          animation: "shimmer 3s ease-in-out infinite",
        }} />

        <div style={{ fontSize: "40px", marginBottom: "16px" }}>{icon}</div>
        <div style={{
          fontSize: "18px", fontWeight: "700", fontFamily: "var(--font-display)",
          color: "var(--cyan)", letterSpacing: "1px", marginBottom: "8px",
        }}>{label}</div>

        {info && (
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "16px" }}>
            {info.desc}
          </div>
        )}

        {info && !info.hasContent && (
          <div style={{
            display: "inline-block", padding: "4px 12px", borderRadius: "20px",
            background: "rgba(124,77,255,0.1)", border: "1px solid rgba(124,77,255,0.2)",
            fontSize: "10px", fontWeight: "600", letterSpacing: "1px",
            color: "var(--purple)", fontFamily: "var(--font-mono)",
          }}>
            COMING SOON · PHASE {info.phase}
          </div>
        )}

        {!info && (
          <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.6 }}>
            Cette section sera disponible prochainement.
          </div>
        )}

        <style>{`
          @keyframes shimmer {
            0%, 100% { background-position: -200% 0; }
            50% { background-position: 200% 0; }
          }
        `}</style>
      </div>
    </div>
  );
}
