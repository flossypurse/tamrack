"use client";

import { useEffect, useRef } from "react";

// "Ambient Ripple" — slow, elegant rings radiate from random origins within
// the hero area. No nodes, no text, no connection lines — just soft expanding
// circles that fade out. Confined to the top ~70vh with a feathered bottom
// edge and scroll-based opacity fade. One pulse at a time max.

export function HeroVisualization() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let time = 0;
    let scrollY = 0;

    const colors = [
      { r: 212, g: 134, b: 58 }, // brand accent orange (dominant)
      { r: 212, g: 134, b: 58 }, // brand accent orange (weighted)
      { r: 120, g: 160, b: 158 }, // muted teal
      { r: 140, g: 150, b: 165 }, // soft slate
    ];

    interface Pulse {
      cx: number;
      cy: number;
      radius: number;
      maxRadius: number;
      speed: number;
      color: (typeof colors)[number];
    }

    let pulses: Pulse[] = [];
    let w = 0;
    let h = 0;
    let heroH = 0; // height of the visible hero region

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      w = window.innerWidth;
      h = window.innerHeight;
      heroH = h * 0.7; // canvas covers top 70% of viewport
      canvas!.width = w * dpr;
      canvas!.height = heroH * dpr;
      canvas!.style.height = `${heroH}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawnPulse() {
      // Only spawn if no active pulses (max 1 at a time)
      if (pulses.length > 0) return;

      const color = colors[Math.floor(Math.random() * colors.length)];
      pulses.push({
        cx: w * (0.2 + Math.random() * 0.6),
        cy: heroH * (0.2 + Math.random() * 0.6),
        radius: 0,
        maxRadius: Math.max(w, heroH) * 0.75,
        speed: 0.6 + Math.random() * 0.4, // half the original speed
        color,
      });
    }

    function onScroll() {
      scrollY = window.scrollY;
    }

    function draw() {
      time += 1;
      ctx!.clearRect(0, 0, w, heroH);

      // Fade canvas out as user scrolls past the hero region
      const scrollFade = Math.max(0, 1 - scrollY / (heroH * 0.8));
      if (scrollFade <= 0) {
        animationId = requestAnimationFrame(draw);
        return;
      }
      ctx!.globalAlpha = scrollFade;

      // Spawn a new pulse every ~8 seconds (480 frames at 60fps)
      if (time % 480 === 0 || time === 1) spawnPulse();

      // Update and draw pulses
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.radius += p.speed;

        const life = p.radius / p.maxRadius;
        if (life > 1) {
          pulses.splice(i, 1);
          continue;
        }

        // Ease opacity: fade in quickly, hold, then fade out
        const opacity = life < 0.05
          ? life / 0.05 * 0.18          // fade in
          : 0.18 * (1 - life);           // long fade out

        // Main ring — soft, wider stroke
        ctx!.beginPath();
        ctx!.arc(p.cx, p.cy, p.radius, 0, Math.PI * 2);
        ctx!.strokeStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${opacity})`;
        ctx!.lineWidth = 2.5;
        ctx!.stroke();

        // Soft outer glow ring (wider, very faint)
        ctx!.beginPath();
        ctx!.arc(p.cx, p.cy, p.radius, 0, Math.PI * 2);
        ctx!.strokeStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${opacity * 0.25})`;
        ctx!.lineWidth = 8;
        ctx!.stroke();
      }

      ctx!.globalAlpha = 1;
      animationId = requestAnimationFrame(draw);
    }

    resize();
    draw();

    window.addEventListener("resize", resize);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-x-0 top-0 w-full pointer-events-none z-0"
      style={{
        maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
      }}
    />
  );
}
