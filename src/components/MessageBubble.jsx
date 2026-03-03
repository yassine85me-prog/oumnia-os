// ═══════════════════════════════════════════
// OUMNIA OS — MessageBubble (Markdown + Syntax Highlight)
// ═══════════════════════════════════════════

import React, { memo } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

const codeStyle = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    background: "rgba(0,0,0,0.4)",
    borderRadius: "8px",
    border: "1px solid rgba(0,212,255,0.1)",
    margin: "8px 0",
    fontSize: "11px",
  },
  'code[class*="language-"]': {
    ...oneDark['code[class*="language-"]'],
    fontSize: "11px",
  },
};

function MessageBubble({ role, text, isStreaming }) {
  const isUser = role === "user";

  if (isUser) {
    return (
      <div
        style={{
          padding: "8px 12px",
          borderRadius: "8px",
          fontSize: "11px",
          lineHeight: 1.5,
          background: "rgba(0,212,255,0.08)",
          color: "var(--cyan)",
          alignSelf: "flex-end",
          maxWidth: "85%",
          whiteSpace: "pre-wrap",
        }}
      >
        {text}
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: "8px",
        fontSize: "11px",
        lineHeight: 1.6,
        background: "rgba(255,255,255,0.03)",
        color: "rgba(255,255,255,0.8)",
        alignSelf: "flex-start",
        maxWidth: "85%",
        overflow: "hidden",
      }}
    >
      <ReactMarkdown
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            if (match) {
              return (
                <div style={{ position: "relative" }}>
                  <div
                    style={{
                      position: "absolute",
                      top: "4px",
                      right: "8px",
                      fontSize: "9px",
                      color: "rgba(0,212,255,0.4)",
                      fontFamily: "var(--font-mono)",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                    }}
                  >
                    {match[1]}
                  </div>
                  <SyntaxHighlighter
                    style={codeStyle}
                    language={match[1]}
                    PreTag="div"
                  >
                    {String(children).replace(/\n$/, "")}
                  </SyntaxHighlighter>
                </div>
              );
            }
            return (
              <code
                style={{
                  background: "rgba(0,212,255,0.08)",
                  padding: "1px 5px",
                  borderRadius: "3px",
                  fontSize: "10.5px",
                  color: "#00d4ff",
                  fontFamily: "var(--font-mono)",
                }}
                {...props}
              >
                {children}
              </code>
            );
          },
          p({ children }) {
            return <p style={{ margin: "4px 0" }}>{children}</p>;
          },
          h1({ children }) {
            return (
              <h1
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#00d4ff",
                  margin: "10px 0 4px",
                  borderBottom: "1px solid rgba(0,212,255,0.15)",
                  paddingBottom: "4px",
                }}
              >
                {children}
              </h1>
            );
          },
          h2({ children }) {
            return (
              <h2
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "rgba(0,212,255,0.85)",
                  margin: "8px 0 3px",
                }}
              >
                {children}
              </h2>
            );
          },
          h3({ children }) {
            return (
              <h3
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.9)",
                  margin: "6px 0 2px",
                }}
              >
                {children}
              </h3>
            );
          },
          ul({ children }) {
            return (
              <ul style={{ margin: "4px 0", paddingLeft: "16px" }}>
                {children}
              </ul>
            );
          },
          ol({ children }) {
            return (
              <ol style={{ margin: "4px 0", paddingLeft: "16px" }}>
                {children}
              </ol>
            );
          },
          li({ children }) {
            return <li style={{ margin: "2px 0" }}>{children}</li>;
          },
          strong({ children }) {
            return (
              <strong style={{ color: "rgba(255,255,255,0.95)", fontWeight: 600 }}>
                {children}
              </strong>
            );
          },
          blockquote({ children }) {
            return (
              <blockquote
                style={{
                  borderLeft: "2px solid rgba(0,212,255,0.3)",
                  paddingLeft: "10px",
                  margin: "6px 0",
                  color: "rgba(255,255,255,0.6)",
                  fontStyle: "italic",
                }}
              >
                {children}
              </blockquote>
            );
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                style={{ color: "#00d4ff", textDecoration: "underline" }}
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
      {isStreaming && (
        <span
          style={{
            color: "var(--cyan)",
            animation: "blink 0.7s infinite",
            marginLeft: "2px",
          }}
        >
          |
        </span>
      )}
    </div>
  );
}

export default memo(MessageBubble);
