import { useMemo } from "react";
import GeneralHologram from "../components/GeneralHologram";
import MessageBubble from "../components/MessageBubble";
import { AGENTS } from "../data/config";
import { STATE_COLORS, STATE_LABELS } from "../utils/ui-constants";

export default function AgentView({
  chatHistory, chatInput, chatLoading, streamingText,
  voiceMode, generalState, audioLevel,
  onInputChange, onSend, onToggleVoice, chatEndRef,
  activeAgent, onSwitchAgent,
}) {
  const stateColor = STATE_COLORS[generalState] || "var(--green)";
  const stateLabel = STATE_LABELS[generalState] || "READY";

  const activeAgents = useMemo(() => AGENTS.filter(a => a.status === "active"), []);
  const currentAgent = useMemo(() => AGENTS.find(a => a.id === activeAgent) || AGENTS[0], [activeAgent]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header with hologram + agent tabs */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: "24px",
        padding: "16px 24px", borderBottom: "1px solid var(--border)", flexShrink: 0,
        background: "rgba(6,6,16,0.4)", position: "relative",
      }}>
        {/* Agent tabs — positioned left */}
        <div style={{ position: "absolute", left: "24px", display: "flex", gap: "4px" }}>
          {activeAgents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => onSwitchAgent(agent.id)}
              style={{
                padding: "6px 14px", borderRadius: "8px", border: "1px solid",
                borderColor: activeAgent === agent.id ? agent.color + "60" : "rgba(255,255,255,0.06)",
                background: activeAgent === agent.id ? agent.color + "15" : "rgba(255,255,255,0.02)",
                color: activeAgent === agent.id ? agent.color : "var(--text-muted)",
                fontSize: "11px", fontWeight: "600", cursor: "pointer",
                fontFamily: "var(--font-main)", transition: "all 0.2s",
                display: "flex", alignItems: "center", gap: "6px",
              }}
            >
              <span style={{ fontSize: "14px" }}>{agent.emoji}</span>
              {agent.name}
            </button>
          ))}
        </div>

        <GeneralHologram state={generalState} audioLevel={audioLevel} size={100} />
        <div>
          <div style={{
            fontSize: "10px", fontFamily: "var(--font-display)", color: currentAgent.color + "99",
            letterSpacing: "4px", marginBottom: "4px",
          }}>{currentAgent.name.toUpperCase()}</div>
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
            <div style={{ fontSize: "32px", marginBottom: "12px", opacity: 0.3 }}>{currentAgent.emoji}</div>
            {activeAgent === "gastrobot"
              ? "Demande-moi sur le stock, les fournisseurs, les commandes..."
              : "Demande-moi n'importe quoi sur tes projets..."}
          </div>
        )}
        {chatHistory.map((msg, i) => (
          <MessageBubble key={i} role={msg.role} text={msg.text} />
        ))}
        {streamingText && (
          <MessageBubble role="ai" text={streamingText} isStreaming />
        )}
        {chatLoading && !streamingText && (
          <div style={{ padding: "10px 14px", fontSize: "12px", color: currentAgent.color, animation: "pulse 1s infinite" }}>
            ◈ {currentAgent.name} analyse...
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
          placeholder={activeAgent === "gastrobot" ? "Parle a GastroBot..." : "Parle a GENERAL..."}
          style={{
            flex: 1, padding: "10px 14px", borderRadius: "10px",
            border: `1px solid ${voiceMode ? currentAgent.color + "66" : "var(--border)"}`,
            background: voiceMode ? currentAgent.color + "0D" : "rgba(255,255,255,0.03)",
            color: "#fff", fontSize: "12px", outline: "none", fontFamily: "var(--font-main)",
            transition: "border-color 0.2s, background 0.2s",
          }}
        />
        <button onClick={onToggleVoice} style={{
          padding: "10px 12px", borderRadius: "10px", border: "none",
          background: voiceMode ? currentAgent.color + "33" : "rgba(255,255,255,0.05)",
          color: voiceMode ? currentAgent.color : "var(--text-secondary)",
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
