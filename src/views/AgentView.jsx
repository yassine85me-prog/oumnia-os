import GeneralHologram from "../components/GeneralHologram";
import MessageBubble from "../components/MessageBubble";
import { STATE_COLORS, STATE_LABELS } from "../utils/ui-constants";

export default function AgentView({
  chatHistory, chatInput, chatLoading, streamingText,
  voiceMode, generalState, audioLevel,
  onInputChange, onSend, onToggleVoice, chatEndRef,
}) {
  const stateColor = STATE_COLORS[generalState] || "var(--green)";
  const stateLabel = STATE_LABELS[generalState] || "READY";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header with hologram */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: "24px",
        padding: "16px 24px", borderBottom: "1px solid var(--border)", flexShrink: 0,
        background: "rgba(6,6,16,0.4)",
      }}>
        <GeneralHologram state={generalState} audioLevel={audioLevel} size={100} />
        <div>
          <div style={{
            fontSize: "10px", fontFamily: "var(--font-display)", color: "rgba(0,229,255,0.4)",
            letterSpacing: "4px", marginBottom: "4px",
          }}>G.E.N.E.R.A.L</div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{
              width: "6px", height: "6px", borderRadius: "50%", background: stateColor,
              boxShadow: `0 0 8px ${stateColor}`,
              animation: generalState !== "idle" ? "pulse 1s infinite" : "none",
            }} />
            <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: stateColor, letterSpacing: "2px", fontWeight: "600" }}>
              {stateLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages" style={{
        flex: 1, minHeight: 0, overflowY: "scroll", display: "flex", flexDirection: "column",
        gap: "10px", padding: "20px 24px",
      }}>
        {chatHistory.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)", fontSize: "12px" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px", opacity: 0.3 }}>◈</div>
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
          <div style={{ padding: "10px 14px", fontSize: "12px", color: "var(--cyan)", animation: "pulse 1s infinite" }}>
            ◈ Analyse en cours...
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div style={{
        display: "flex", gap: "8px", padding: "14px 24px",
        borderTop: "1px solid var(--border)", flexShrink: 0,
        background: "rgba(6,6,16,0.4)",
      }}>
        <input
          data-chat-input
          value={chatInput}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSend()}
          placeholder="Parle a GENERAL..."
          style={{
            flex: 1, padding: "10px 14px", borderRadius: "10px",
            border: `1px solid ${voiceMode ? "rgba(0,230,118,0.4)" : "var(--border)"}`,
            background: voiceMode ? "rgba(0,230,118,0.05)" : "rgba(255,255,255,0.03)",
            color: "#fff", fontSize: "12px", outline: "none", fontFamily: "var(--font-main)",
            transition: "border-color 0.2s, background 0.2s",
          }}
        />
        <button onClick={onToggleVoice} style={{
          padding: "10px 12px", borderRadius: "10px", border: "none",
          background: voiceMode ? "rgba(0,230,118,0.2)" : "rgba(255,255,255,0.05)",
          color: voiceMode ? "#00e676" : "var(--text-secondary)",
          cursor: "pointer", fontSize: "16px", lineHeight: 1,
          animation: voiceMode ? "pulse 1s infinite" : "none",
          transition: "all 0.2s",
        }} title={voiceMode ? "Desactiver la voix" : "Activer la voix"}>
          {voiceMode ? "●" : "🎤"}
        </button>
        <button onClick={onSend} style={{
          padding: "10px 18px", borderRadius: "10px", border: "none",
          background: "linear-gradient(135deg, var(--cyan), var(--purple))",
          color: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: "600", fontFamily: "var(--font-main)",
        }}>➤</button>
      </div>
    </div>
  );
}
