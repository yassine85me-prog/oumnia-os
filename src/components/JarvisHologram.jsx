import { useEffect, useRef, useState } from "react";

const STATES = {
  idle:      { speed: 1,   glow: 0.06, ringAlpha: 0.15, particleCount: 6, color1: "#00e5ff", color2: "#7c4dff", breathAmp: 2,  waveAmp: 0 },
  hover:     { speed: 1.4, glow: 0.12, ringAlpha: 0.25, particleCount: 6, color1: "#00e5ff", color2: "#7c4dff", breathAmp: 3,  waveAmp: 0 },
  listening: { speed: 1.2, glow: 0.18, ringAlpha: 0.30, particleCount: 6, color1: "#00e5ff", color2: "#00b8d4", breathAmp: 4,  waveAmp: 3 },
  thinking:  { speed: 2.5, glow: 0.22, ringAlpha: 0.35, particleCount: 6, color1: "#7c4dff", color2: "#00e5ff", breathAmp: 5,  waveAmp: 0 },
  speaking:  { speed: 1.8, glow: 0.25, ringAlpha: 0.40, particleCount: 6, color1: "#00e5ff", color2: "#7c4dff", breathAmp: 3,  waveAmp: 8 },
};

const OUMNIA_CHARS = ["O", ".", "U", ".", "M", ".", "N", ".", "I", ".", "A"];

export default function JarvisHologram({ speaking = false, state = "idle", size = 220, onClick }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(0);
  const [hovered, setHovered] = useState(false);

  const activeState = hovered && state === "idle" ? "hover" : state;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = size, h = size;
    canvas.width = w * 2; canvas.height = h * 2;
    ctx.scale(2, 2);
    const cx = w / 2, cy = h / 2;
    let raf;

    const draw = () => {
      frameRef.current++;
      const cfg = STATES[activeState] || STATES.idle;
      const t = frameRef.current * 0.015 * cfg.speed;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      // === Outer glow ===
      const grd = ctx.createRadialGradient(cx, cy, 10, cx, cy, size * 0.45);
      grd.addColorStop(0, hexToRgba(cfg.color1, cfg.glow));
      grd.addColorStop(0.6, hexToRgba(cfg.color2, cfg.glow * 0.3));
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      // === Central hexagon with breathing ===
      const breathR = 22 + Math.sin(t * 0.8) * cfg.breathAmp;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.3);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        i === 0 ? ctx.moveTo(Math.cos(a) * breathR, Math.sin(a) * breathR)
                 : ctx.lineTo(Math.cos(a) * breathR, Math.sin(a) * breathR);
      }
      ctx.closePath();
      ctx.strokeStyle = hexToRgba(cfg.color1, 0.6);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = hexToRgba(cfg.color1, 0.04);
      ctx.fill();
      ctx.restore();

      // === 3 concentric rings ===
      const rings = [
        { r: 38, dir: 1,  dashLen: 0.35, alpha: cfg.ringAlpha, width: 1.5 },
        { r: 56, dir: -1, dashLen: 0.25, alpha: cfg.ringAlpha * 0.8, width: 1.2 },
        { r: 74, dir: 1,  dashLen: 0.18, alpha: cfg.ringAlpha * 0.5, width: 1 },
      ];
      rings.forEach((ring, ri) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * (0.3 + ri * 0.15) * ring.dir);
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
          ctx.moveTo(Math.cos(a) * ring.r, Math.sin(a) * ring.r);
          ctx.lineTo(Math.cos(a + ring.dashLen) * ring.r, Math.sin(a + ring.dashLen) * ring.r);
        }
        const ringColor = ri % 2 === 0 ? cfg.color1 : cfg.color2;
        ctx.strokeStyle = hexToRgba(ringColor, ring.alpha);
        ctx.lineWidth = ring.width;
        ctx.stroke();
        ctx.restore();
      });

      // === Orbital particles — "O.U.M.N.I.A" ===
      const orbitR = 65;
      OUMNIA_CHARS.forEach((ch, i) => {
        const angle = t * 0.4 + (Math.PI * 2 / OUMNIA_CHARS.length) * i;
        const px = cx + Math.cos(angle) * (orbitR + Math.sin(t * 1.5 + i) * 4);
        const py = cy + Math.sin(angle) * (orbitR + Math.sin(t * 1.5 + i) * 4);
        const alpha = 0.3 + Math.sin(t * 2 + i) * 0.2;

        if (ch === ".") {
          ctx.beginPath();
          ctx.arc(px, py, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = hexToRgba(cfg.color1, alpha);
          ctx.fill();
        } else {
          ctx.font = `bold 9px 'JetBrains Mono', monospace`;
          ctx.fillStyle = hexToRgba(cfg.color1, alpha + 0.15);
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(ch, px, py);
        }
      });

      // === Scan line ===
      const scanY = cy + Math.sin(t * 0.5) * (size * 0.35);
      const scanGrad = ctx.createLinearGradient(0, scanY, w, scanY);
      scanGrad.addColorStop(0, "transparent");
      scanGrad.addColorStop(0.3, hexToRgba(cfg.color1, 0.08));
      scanGrad.addColorStop(0.5, hexToRgba(cfg.color1, 0.15));
      scanGrad.addColorStop(0.7, hexToRgba(cfg.color1, 0.08));
      scanGrad.addColorStop(1, "transparent");
      ctx.fillStyle = scanGrad;
      ctx.fillRect(cx - size * 0.4, scanY - 0.5, size * 0.8, 1);

      // === Bezier waves (speaking state) ===
      if (cfg.waveAmp > 0) {
        for (let w_i = 0; w_i < 3; w_i++) {
          ctx.beginPath();
          const waveY = cy + (w_i - 1) * 12;
          const amp = cfg.waveAmp * (1 - w_i * 0.2);
          ctx.moveTo(cx - 40, waveY);
          ctx.bezierCurveTo(
            cx - 20, waveY + Math.sin(t * 3 + w_i) * amp,
            cx + 20, waveY - Math.sin(t * 3.5 + w_i) * amp,
            cx + 40, waveY
          );
          ctx.strokeStyle = hexToRgba(cfg.color1, 0.2 - w_i * 0.05);
          ctx.lineWidth = 1.5 - w_i * 0.3;
          ctx.stroke();
        }
      }

      // === Center pulse ===
      const pulseR = 4 + Math.sin(t * 2.5) * (activeState === "thinking" ? 3 : 1.5);
      ctx.beginPath();
      ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
      const cGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseR);
      cGrd.addColorStop(0, hexToRgba(cfg.color1, 0.9));
      cGrd.addColorStop(1, hexToRgba(cfg.color1, 0.1));
      ctx.fillStyle = cGrd;
      ctx.fill();

      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [activeState, size]);

  return (
    <canvas
      ref={canvasRef}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        cursor: onClick ? "pointer" : "default",
        transition: "transform 0.3s ease",
        transform: hovered ? "scale(1.05)" : "scale(1)",
      }}
    />
  );
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
