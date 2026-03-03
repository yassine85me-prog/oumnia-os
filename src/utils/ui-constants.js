// ═══════════════════════════════════════════
// OUMNIA OS — Shared UI Constants
// ═══════════════════════════════════════════

// GENERAL state display
export const STATE_COLORS = {
  idle: "var(--green)",
  listening: "#00e676",
  thinking: "#7c4dff",
  speaking: "var(--cyan)",
  coding: "#ff6d00",
  repos: "var(--text-muted)",
};

export const STATE_LABELS = {
  idle: "READY",
  listening: "LISTENING",
  thinking: "THINKING",
  speaking: "SPEAKING",
  coding: "CODING",
  repos: "REPOS",
};

// Reusable card styles
export const CARD_STYLE = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: "14px",
  padding: "18px",
};

export const CARD_HEADER_STYLE = {
  fontSize: "10px",
  color: "var(--text-muted)",
  letterSpacing: "2px",
  fontWeight: "600",
  marginBottom: "12px",
};

// Gamification
export const MAX_XP = 500;

// Helpers
export const getGreeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
};
