"use client";

import { useEffect, useRef } from "react";

// "Pulse Radar" — concentric rings radiate outward from varying origins.
// A grid of data nodes lights up as the pulse wave passes through them,
// briefly showing values before fading. Covers the full page as a fixed
// background layer.

export function HeroVisualization() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const colors = [
      { r: 59, g: 130, b: 246 },  // blue
      { r: 16, g: 185, b: 129 },  // green
      { r: 249, g: 115, b: 22 },  // orange
      { r: 239, g: 68, b: 68 },   // red
      { r: 168, g: 85, b: 247 },  // purple
      { r: 6, g: 182, b: 212 },   // cyan
    ];

    interface Node {
      x: number;
      y: number;
      baseRadius: number;
      color: typeof colors[number];
      phase: number;
      value: string;
      glow: number;
    }

    interface Pulse {
      cx: number;
      cy: number;
      radius: number;
      maxRadius: number;
      speed: number;
      color: typeof colors[number];
      opacity: number;
    }

    let nodes: Node[] = [];
    let pulses: Pulse[] = [];
    let w = 0;
    let h = 0;

    const sampleValues = [
      "2.75%", "$0.72", "6.1%", "4.8%", "4.6M", "1,247",
      "+0.3%", "$485K", "3.2%", "12.4K", "$1.2B", "847",
      "+2.1%", "54", "22", "165+", "$29", "340+",
    ];

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      initNodes();
    }

    function initNodes() {
      nodes = [];
      const spacingX = 90;
      const spacingY = 80;
      const cols = Math.ceil(w / spacingX) + 1;
      const rows = Math.ceil(h / spacingY) + 1;
      const offsetX = (w - (cols - 1) * spacingX) / 2;
      const offsetY = (h - (rows - 1) * spacingY) / 2;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const jitterX = (Math.random() - 0.5) * 30;
          const jitterY = (Math.random() - 0.5) * 25;
          nodes.push({
            x: offsetX + col * spacingX + jitterX,
            y: offsetY + row * spacingY + jitterY,
            baseRadius: 1.2 + Math.random() * 0.8,
            color: colors[Math.floor(Math.random() * colors.length)],
            phase: Math.random() * Math.PI * 2,
            value: sampleValues[Math.floor(Math.random() * sampleValues.length)],
            glow: 0,
          });
        }
      }
    }

    function spawnPulse() {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const cx = w * (0.15 + Math.random() * 0.7);
      const cy = h * (0.15 + Math.random() * 0.7);

      pulses.push({
        cx,
        cy,
        radius: 0,
        maxRadius: Math.max(w, h) * 0.7,
        speed: 1.2 + Math.random() * 0.8,
        color,
        opacity: 0.25,
      });
    }

    function draw() {
      time += 1;
      ctx!.clearRect(0, 0, w, h);

      // Spawn pulses periodically
      if (time % 120 === 0) spawnPulse();
      if (time === 1) spawnPulse();

      // Update and draw pulses
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.radius += p.speed;
        p.opacity = 0.25 * (1 - p.radius / p.maxRadius);

        if (p.radius > p.maxRadius) {
          pulses.splice(i, 1);
          continue;
        }

        // Draw the ring
        ctx!.beginPath();
        ctx!.arc(p.cx, p.cy, p.radius, 0, Math.PI * 2);
        ctx!.strokeStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${p.opacity})`;
        ctx!.lineWidth = 1.5;
        ctx!.stroke();

        // Thinner trailing ring
        if (p.radius > 20) {
          ctx!.beginPath();
          ctx!.arc(p.cx, p.cy, p.radius - 15, 0, Math.PI * 2);
          ctx!.strokeStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${p.opacity * 0.25})`;
          ctx!.lineWidth = 0.8;
          ctx!.stroke();
        }

        // Light up nodes near the pulse ring
        for (const node of nodes) {
          const dx = node.x - p.cx;
          const dy = node.y - p.cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const ringDist = Math.abs(dist - p.radius);

          if (ringDist < 25) {
            const intensity = 1 - ringDist / 25;
            node.glow = Math.max(node.glow, intensity);
          }
        }
      }

      // Draw nodes
      for (const node of nodes) {
        const breathe = 1 + Math.sin(time * 0.02 + node.phase) * 0.15;
        const baseOpacity = 0.1;
        const glowOpacity = node.glow * 0.55;
        const radius = node.baseRadius * breathe * (1 + node.glow * 1.8);

        // Outer glow when activated
        if (node.glow > 0.1) {
          ctx!.beginPath();
          ctx!.arc(node.x, node.y, radius + 5, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(${node.color.r}, ${node.color.g}, ${node.color.b}, ${glowOpacity * 0.12})`;
          ctx!.fill();
        }

        // Core dot
        ctx!.beginPath();
        ctx!.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${node.color.r}, ${node.color.g}, ${node.color.b}, ${baseOpacity + glowOpacity})`;
        ctx!.fill();

        // Show value label when glowing
        if (node.glow > 0.5) {
          ctx!.font = "9px ui-monospace, monospace";
          ctx!.fillStyle = `rgba(${node.color.r}, ${node.color.g}, ${node.color.b}, ${node.glow * 0.45})`;
          ctx!.textAlign = "center";
          ctx!.fillText(node.value, node.x, node.y - 9);
        }

        // Decay glow
        node.glow *= 0.96;
        if (node.glow < 0.01) node.glow = 0;
      }

      // Draw faint connections between nearby glowing nodes
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        if (a.glow < 0.1) continue;

        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 110) {
            const opacity = (1 - dist / 110) * Math.max(a.glow, b.glow) * 0.15;
            ctx!.beginPath();
            ctx!.strokeStyle = `rgba(${a.color.r}, ${a.color.g}, ${a.color.b}, ${opacity})`;
            ctx!.lineWidth = 0.5;
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }
        }
      }

      animationId = requestAnimationFrame(draw);
    }

    resize();
    draw();

    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
    />
  );
}
