/**
 * Subtle decorative SVG elements that give Alberta Pulse
 * a distinctly Albertan / Canadian identity.
 *
 * All elements are designed to be near-invisible background accents —
 * using the existing accent color at very low opacity.
 */

/**
 * Outline of Alberta's provincial boundary.
 * Simplified path — recognizable shape without excessive detail.
 * Intended as a large, faint watermark behind content.
 */
export function AlbertaOutline({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M30 10 L170 10 L170 14 L168 20 L166 30 L164 45 L162 60 L160 80 L158 100 L156 120 L155 135 L154 150 L153 165 L152 180 L151 195 L150 210 L149 225 L148 240 L147 255 L146 270 L145 280 L144 290 L30 290 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.6"
      />
    </svg>
  );
}

/**
 * Minimal maple leaf outline — single stroke, geometric style.
 * Works at small sizes (16–24px) next to text/logos.
 */
export function MapleLeaf({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 2 L13.5 6.5 L17 5 L15.5 9 L20 9.5 L16.5 12 L19 15 L15 14 L14.5 18 L12 15.5 L9.5 18 L9 14 L5 15 L7.5 12 L4 9.5 L8.5 9 L7 5 L10.5 6.5 L12 2Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="currentColor"
        fillOpacity="0.08"
      />
      {/* Stem */}
      <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Rocky Mountain ridge silhouette — spans full width.
 * Gentle peaks inspired by the view from the Alberta foothills.
 * Intended as a bottom-edge decoration.
 */
export function MountainRidge({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 120"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M0 120 L0 95 L40 80 L80 88 L130 60 L170 72 L220 45 L260 55 L300 35 L340 48 L380 28 L420 42 L470 18 L510 32 L550 22 L590 38 L640 15 L680 30 L720 20 L760 35 L800 25 L840 40 L890 30 L930 45 L970 38 L1010 50 L1050 42 L1090 55 L1130 48 L1160 60 L1200 52 L1200 120 Z"
        fill="currentColor"
        opacity="0.5"
      />
      {/* Second layer — closer foothills, slightly darker */}
      <path
        d="M0 120 L0 100 L60 92 L120 96 L180 85 L240 90 L310 78 L370 84 L440 75 L500 82 L570 72 L630 80 L700 70 L760 78 L830 68 L890 76 L950 70 L1010 80 L1070 74 L1130 82 L1200 76 L1200 120 Z"
        fill="currentColor"
        opacity="0.7"
      />
    </svg>
  );
}

/**
 * Wild Rose (Rosa acicularis) — Alberta's provincial flower.
 * Simple 5-petal geometric outline. Works at 16–32px.
 */
export function WildRose({ size = 20, className }: { size?: number; className?: string }) {
  // 5 petals evenly spaced
  const petals = Array.from({ length: 5 }, (_, i) => {
    const angle = (i * 72 - 90) * (Math.PI / 180);
    const cx = 12 + Math.cos(angle) * 6;
    const cy = 12 + Math.sin(angle) * 6;
    return <circle key={i} cx={cx} cy={cy} r="3.5" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.06" />;
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {petals}
      {/* Center */}
      <circle cx="12" cy="12" r="2.5" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="0.8" />
    </svg>
  );
}
