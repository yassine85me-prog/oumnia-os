import { useEffect, useRef } from "react";

export default function JarvisHologram({ speaking = false, size = 220 }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = size, h = size;
    canvas.width = w * 2; canvas.height = h * 2;
    ctx.scale(2, 2); // Retina
    const cx = w / 2, cy = h / 2;
    let raf;

    const draw = () => {
      frameRef.current++;
      const t = frameRef.current * 0.015;
      ctx.clearRect(0, 0, w, h);

      // Outer glow
      const grd = ctx.createRadialGradient(cx, cy, 20, cx, cy, 100);
      grd.addColorStop(0, speaking ? "rgba(0,229,255,0.14)" : "rgba(0,229,255,0.06)");
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      // Rotating rings
      for (let i = 0; i < 5; i++) {
        const r = 26 + i * 16;
        const rot = t * (i % 2 === 0 ? 1 : -1) * (0.4 + i * 0.25);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        ctx.beginPath();
        const arcLen = speaking ? 0.45 : 0.28;
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
          ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          ctx.lineTo(Math.cos(a + arcLen) * r, Math.sin(a + arcLen) * r);
        }
        ctx.strokeStyle = `rgba(0,229,255,${0.12 + i * 0.06})`;
        ctx.lineWidth = i === 0 ? 2 : 1.5;
        ctx.stroke();
        ctx.restore();
      }

      // Inner hexagon (rotating)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.4);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const r = 20 + Math.sin(t * 2) * 3;
        i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.strokeStyle = "rgba(0,229,255,0.6)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "rgba(0,229,255,0.04)";
      ctx.fill();
      ctx.restore();

      // Outer hexagon
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-t * 0.2);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        const r = 75;
        i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.strokeStyle = "rgba(0,229,255,0.08)";
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 12]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Corner brackets
      const bSize = 10;
      const bDist = 90;
      [[cx - bDist, cy - bDist, 1, 1], [cx + bDist, cy - bDist, -1, 1],
       [cx - bDist, cy + bDist, 1, -1], [cx + bDist, cy + bDist, -1, -1]].forEach(([x, y, dx, dy]) => {
        ctx.beginPath();
        ctx.moveTo(x, y + dy * bSize);
        ctx.lineTo(x, y);
        ctx.lineTo(x + dx * bSize, y);
        ctx.strokeStyle = "rgba(0,229,255,0.3)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // Orbiting data points
      for (let i = 0; i < 10; i++) {
        const a = t * 0.7 + (Math.PI / 5) * i;
        const r = 50 + Math.sin(t * 1.5 + i) * 10;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        ctx.beginPath();
        ctx.arc(px, py, speaking ? 2 : 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,229,255,${0.25 + Math.sin(t + i) * 0.2})`;
        ctx.fill();
      }

      // Center pulse
      const pulseR = 4 + Math.sin(t * 3) * (speaking ? 3 : 1.5);
      ctx.beginPath();
      ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
      const cGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseR);
      cGrd.addColorStop(0, speaking ? "rgba(0,229,255,0.9)" : "rgba(0,229,255,0.5)");
      cGrd.addColorStop(1, "rgba(0,229,255,0.1)");
      ctx.fillStyle = cGrd;
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [speaking, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
}
