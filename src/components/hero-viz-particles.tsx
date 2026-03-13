"use client";

import { useEffect, useRef } from "react";

// Animated data visualization background for the hero section
// Renders floating dots, connecting lines, and subtle waveforms
// that evoke a sense of live data flowing through the system

export function HeroVisualization() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let particles: Particle[] = [];
    let waves: Wave[] = [];

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      opacity: number;
      color: string;
    }

    interface Wave {
      offset: number;
      amplitude: number;
      frequency: number;
      speed: number;
      color: string;
      y: number;
    }

    const colors = [
      "59, 130, 246",   // blue (policy rate)
      "16, 185, 129",   // green (CAD/USD)
      "249, 115, 22",   // orange (unemployment)
      "239, 68, 68",    // red (mortgage)
      "168, 85, 247",   // purple (GDP)
      "6, 182, 212",    // cyan (housing)
    ];

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
      ctx!.scale(dpr, dpr);
    }

    function init() {
      resize();
      const w = canvas!.getBoundingClientRect().width;
      const h = canvas!.getBoundingClientRect().height;

      // Create particles
      particles = Array.from({ length: 40 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.2,
        radius: Math.random() * 2 + 1,
        opacity: Math.random() * 0.3 + 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
      }));

      // Create wave lines (like sparkline trends flowing across)
      waves = colors.slice(0, 4).map((color, i) => ({
        offset: 0,
        amplitude: 8 + Math.random() * 12,
        frequency: 0.008 + Math.random() * 0.006,
        speed: 0.3 + Math.random() * 0.4,
        color,
        y: h * (0.25 + i * 0.18),
      }));
    }

    function draw() {
      const w = canvas!.getBoundingClientRect().width;
      const h = canvas!.getBoundingClientRect().height;
      ctx!.clearRect(0, 0, w, h);

      // Draw wave lines
      for (const wave of waves) {
        wave.offset += wave.speed;
        ctx!.beginPath();
        ctx!.strokeStyle = `rgba(${wave.color}, 0.14)`;
        ctx!.lineWidth = 1.5;

        for (let x = 0; x < w; x += 2) {
          const y = wave.y + Math.sin((x + wave.offset) * wave.frequency) * wave.amplitude
            + Math.sin((x + wave.offset * 0.7) * wave.frequency * 2.3) * (wave.amplitude * 0.3);
          if (x === 0) ctx!.moveTo(x, y);
          else ctx!.lineTo(x, y);
        }
        ctx!.stroke();
      }

      // Draw and update particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${p.color}, ${p.opacity})`;
        ctx!.fill();
      }

      // Draw connections between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 100) {
            const opacity = (1 - dist / 100) * 0.1;
            ctx!.beginPath();
            ctx!.strokeStyle = `rgba(${particles[i].color}, ${opacity})`;
            ctx!.lineWidth = 0.5;
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.stroke();
          }
        }
      }

      animationId = requestAnimationFrame(draw);
    }

    init();
    draw();

    window.addEventListener("resize", init);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", init);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 1 }}
    />
  );
}
