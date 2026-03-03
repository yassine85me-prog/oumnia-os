// ═══════════════════════════════════════════
// OUMNIA OS — GeneralHologram (3-Layer Living Hologram)
// CSS Rings + CSS Orb + Canvas Effects
// 6 states: idle, listening, thinking, speaking, coding, repos
// ═══════════════════════════════════════════

import { useEffect, useRef, useState, memo } from "react";

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const STATE_CONFIG = {
  idle: {
    color: "#00e5ff",
    ringSpeed: 20,
    breathSpeed: 4,
    ringOpacity: 0.25,
    orbGlow: 0.15,
    canvasEffect: "none",
    dimFactor: 1,
  },
  listening: {
    color: "#00e676",
    ringSpeed: 12,
    breathSpeed: 2,
    ringOpacity: 0.45,
    orbGlow: 0.25,
    canvasEffect: "waveform",
    dimFactor: 1,
  },
  thinking: {
    color: "#7c4dff",
    ringSpeed: 5,
    breathSpeed: 1.5,
    ringOpacity: 0.55,
    orbGlow: 0.3,
    canvasEffect: "particles",
    dimFactor: 1,
  },
  speaking: {
    color: "#00e5ff",
    ringSpeed: 15,
    breathSpeed: 3,
    ringOpacity: 0.4,
    orbGlow: 0.2,
    canvasEffect: "waveform",
    dimFactor: 1,
  },
  coding: {
    color: "#ff6d00",
    ringSpeed: 10,
    breathSpeed: 2.5,
    ringOpacity: 0.45,
    orbGlow: 0.2,
    canvasEffect: "matrix",
    dimFactor: 1,
  },
  repos: {
    color: "#00e5ff",
    ringSpeed: 40,
    breathSpeed: 8,
    ringOpacity: 0.08,
    orbGlow: 0.04,
    canvasEffect: "none",
    dimFactor: 0.3,
  },
};

const KEYFRAMES = `
@keyframes holo-spin {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to { transform: translate(-50%, -50%) rotate(360deg); }
}
@keyframes holo-spin-rev {
  from { transform: translate(-50%, -50%) rotate(360deg); }
  to { transform: translate(-50%, -50%) rotate(0deg); }
}
@keyframes holo-breathe {
  0%, 100% { transform: translate(-50%, -50%) scale(0.95); opacity: 0.8; }
  50% { transform: translate(-50%, -50%) scale(1.08); opacity: 1; }
}
`;

// ── Canvas drawing functions ──

function drawWaveform(ctx, cx, cy, radius, level, color, t) {
  const points = 64;
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const noise =
      Math.sin(t * 3 + i * 0.5) * 0.3 +
      Math.sin(t * 7 + i * 1.2) * 0.2 +
      Math.sin(t * 11 + i * 0.8) * 0.15;
    const amp = Math.max(level, 0.08) * radius * 0.35 * (1 + noise);
    const r = radius + amp;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = hexToRgba(color, 0.35);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Inner glow ring
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const noise = Math.sin(t * 5 + i * 0.7) * 0.2;
    const amp = Math.max(level, 0.05) * radius * 0.2 * (1 + noise);
    const r = radius * 0.85 + amp;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = hexToRgba(color, 0.15);
  ctx.lineWidth = 1;
  ctx.stroke();
}

function initParticles(count) {
  return Array.from({ length: count }, () => ({
    x: 0, y: 0,
    vx: (Math.random() - 0.5) * 3,
    vy: (Math.random() - 0.5) * 3,
    alpha: 0.6 + Math.random() * 0.4,
    size: 1 + Math.random() * 2,
  }));
}

function drawParticles(ctx, cx, cy, particles, color) {
  for (const p of particles) {
    ctx.beginPath();
    ctx.arc(p.x + cx, p.y + cy, p.size, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(color, p.alpha);
    ctx.fill();
    // Move outward
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= 0.008;
    // Respawn at center
    if (p.alpha <= 0) {
      p.x = 0;
      p.y = 0;
      p.vx = (Math.random() - 0.5) * 3;
      p.vy = (Math.random() - 0.5) * 3;
      p.alpha = 0.6 + Math.random() * 0.4;
      p.size = 1 + Math.random() * 2;
    }
  }
}

function drawMatrix(ctx, w, h, columns, color) {
  const chars = "0123456789ABCDEF{}[]<>/=+-";
  const fontSize = 10;
  const colCount = Math.floor(w / fontSize);

  // Ensure columns array is sized
  while (columns.length < colCount) columns.push(Math.random() * (h / fontSize));

  ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;
  for (let i = 0; i < colCount; i++) {
    const char = chars[Math.floor(Math.random() * chars.length)];
    const x = i * fontSize;
    const y = columns[i] * fontSize;
    ctx.fillStyle = hexToRgba(color, 0.6);
    ctx.fillText(char, x, y);
    // Dim trail
    ctx.fillStyle = hexToRgba(color, 0.1);
    ctx.fillText(chars[Math.floor(Math.random() * chars.length)], x, y - fontSize);

    if (y > h && Math.random() > 0.975) columns[i] = 0;
    columns[i] += 0.5;
  }
}

// ── Main Component ──

function GeneralHologram({ state = "idle", audioLevel = 0, size = 220, onClick }) {
  const canvasRef = useRef(null);
  const particlesRef = useRef(initParticles(30));
  const matrixColsRef = useRef([]);
  const frameRef = useRef(0);
  const [hovered, setHovered] = useState(false);

  const cfg = STATE_CONFIG[state] || STATE_CONFIG.idle;

  // Canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    let raf;
    const loop = () => {
      frameRef.current++;
      const t = frameRef.current / 60;
      const currentCfg = STATE_CONFIG[state] || STATE_CONFIG.idle;

      ctx.clearRect(0, 0, size, size);
      ctx.globalCompositeOperation = "lighter";

      const cx = size / 2;
      const cy = size / 2;

      if (currentCfg.canvasEffect === "waveform") {
        const level = state === "speaking" ? audioLevel : 0.15 + Math.sin(t * 2) * 0.1;
        drawWaveform(ctx, cx, cy, size * 0.22, level, currentCfg.color, t);
      } else if (currentCfg.canvasEffect === "particles") {
        drawParticles(ctx, cx, cy, particlesRef.current, currentCfg.color);
      } else if (currentCfg.canvasEffect === "matrix") {
        ctx.globalCompositeOperation = "source-over";
        // Fade previous frame
        ctx.fillStyle = "rgba(6,6,16,0.15)";
        ctx.fillRect(0, 0, size, size);
        drawMatrix(ctx, size, size, matrixColsRef.current, currentCfg.color);
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [state, size, audioLevel]);

  // Ring styles
  const ringBase = {
    position: "absolute",
    top: "50%",
    left: "50%",
    borderRadius: "50%",
    transition: "border-color 0.5s ease, opacity 0.5s ease, animation-duration 0.5s ease",
    opacity: cfg.dimFactor,
  };

  const ring1 = {
    ...ringBase,
    width: `${size * 0.55}px`,
    height: `${size * 0.55}px`,
    border: `1.5px solid ${hexToRgba(cfg.color, cfg.ringOpacity)}`,
    borderTopColor: "transparent",
    borderRightColor: "transparent",
    animation: `holo-spin ${cfg.ringSpeed}s linear infinite`,
  };

  const ring2 = {
    ...ringBase,
    width: `${size * 0.72}px`,
    height: `${size * 0.72}px`,
    border: `1px solid ${hexToRgba(cfg.color, cfg.ringOpacity * 0.7)}`,
    borderBottomColor: "transparent",
    borderLeftColor: "transparent",
    animation: `holo-spin-rev ${cfg.ringSpeed * 1.4}s linear infinite`,
  };

  const ring3 = {
    ...ringBase,
    width: `${size * 0.88}px`,
    height: `${size * 0.88}px`,
    border: `1px dashed ${hexToRgba(cfg.color, cfg.ringOpacity * 0.4)}`,
    borderRightColor: "transparent",
    animation: `holo-spin ${cfg.ringSpeed * 2}s linear infinite`,
  };

  // Orb style
  const orbSize = size * 0.25;
  const orbStyle = {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: `${orbSize}px`,
    height: `${orbSize}px`,
    borderRadius: "50%",
    background: `radial-gradient(circle, ${hexToRgba(cfg.color, 0.6)} 0%, ${hexToRgba(cfg.color, 0.15)} 55%, transparent 100%)`,
    boxShadow: `0 0 ${size * 0.12}px ${hexToRgba(cfg.color, cfg.orbGlow)}, 0 0 ${size * 0.25}px ${hexToRgba(cfg.color, cfg.orbGlow * 0.5)}`,
    animation: `holo-breathe ${cfg.breathSpeed}s ease-in-out infinite`,
    transition: "background 0.5s ease, box-shadow 0.5s ease",
    opacity: cfg.dimFactor,
    zIndex: 2,
  };

  // Canvas style
  const canvasStyle = {
    position: "absolute",
    top: 0,
    left: 0,
    width: `${size}px`,
    height: `${size}px`,
    zIndex: 3,
    pointerEvents: "none",
    opacity: cfg.dimFactor,
    transition: "opacity 0.5s ease",
  };

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        width: `${size}px`,
        height: `${size}px`,
        cursor: "pointer",
        transform: hovered && state !== "repos" ? "scale(1.04)" : "scale(1)",
        transition: "transform 0.3s ease",
      }}
    >
      <style>{KEYFRAMES}</style>

      {/* Layer 1: CSS Rings */}
      <div style={ring1} />
      <div style={ring2} />
      <div style={ring3} />

      {/* Layer 2: Central Orb */}
      <div style={orbStyle} />

      {/* Layer 3: Canvas Effects */}
      <canvas ref={canvasRef} style={canvasStyle} />
    </div>
  );
}

export default memo(GeneralHologram);
