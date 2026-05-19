"use client";

/**
 * Tamrack wordmark — T3 Terminal cut.
 *
 * Source SVG: tamrack/brand/identity/logo/wordmark.svg (light) +
 * wordmark-dark.svg (dark). Inlined so we can swap fill via currentColor and
 * follow the active theme without a per-render asset fetch.
 *
 * The geometry is the custom "Terminal Block" cut — NOT JetBrains Mono
 * typeset as "tamrack". Anti-drift discipline per
 * tamrack/brand/TERRITORY-MATRIX.md.
 */

interface Props {
  /** Pixel height. Width auto-scales 460:120. Default 24. */
  height?: number;
  /** Override the default theme-aware color. Pass `var(--amber)` for hero-amber treatment. */
  color?: string;
  className?: string;
  title?: string;
}

export function Wordmark({
  height = 24,
  color,
  className,
  title = "Tamrack",
}: Props) {
  const width = (height * 460) / 120;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 460 120"
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label={title}
      shapeRendering="geometricPrecision"
      style={{ color: color ?? "var(--ink)" }}
    >
      <title>{title}</title>
      <g transform="translate(20,10)" fill="currentColor" stroke="none">
        {/* t */}
        <path d="M 26 0 L 34 0 L 34 92 L 52 92 L 52 100 L 26 100 Z" />
        <path d="M 10 28 L 50 28 L 50 36 L 10 36 Z" />
        {/* a */}
        <path d="M 68 36 L 116 36 L 116 44 L 68 44 Z" />
        <path d="M 108 44 L 116 44 L 116 100 L 108 100 Z" />
        <path d="M 68 92 L 108 92 L 108 100 L 68 100 Z" />
        <path d="M 68 60 L 76 60 L 76 92 L 68 92 Z" />
        <path d="M 76 60 L 108 60 L 108 68 L 76 68 Z" />
        {/* m */}
        <path d="M 122 36 L 174 36 L 174 44 L 122 44 Z" />
        <path d="M 122 44 L 130 44 L 130 100 L 122 100 Z" />
        <path d="M 144 44 L 152 44 L 152 100 L 144 100 Z" />
        <path d="M 166 44 L 174 44 L 174 100 L 166 100 Z" />
        {/* r */}
        <path d="M 184 36 L 192 36 L 192 100 L 184 100 Z" />
        <path d="M 192 36 L 224 36 L 224 44 L 192 44 Z" />
        <path d="M 216 44 L 224 44 L 224 52 L 216 52 Z" />
        {/* a */}
        <path d="M 240 36 L 288 36 L 288 44 L 240 44 Z" />
        <path d="M 280 44 L 288 44 L 288 100 L 280 100 Z" />
        <path d="M 240 92 L 280 92 L 280 100 L 240 100 Z" />
        <path d="M 240 60 L 248 60 L 248 92 L 240 92 Z" />
        <path d="M 248 60 L 280 60 L 280 68 L 248 68 Z" />
        {/* c */}
        <path d="M 300 36 L 348 36 L 348 44 L 300 44 Z" />
        <path d="M 300 44 L 308 44 L 308 92 L 300 92 Z" />
        <path d="M 300 92 L 348 92 L 348 100 L 300 100 Z" />
        {/* k */}
        <path d="M 364 0 L 372 0 L 372 100 L 364 100 Z" />
        <path d="M 404 36 L 412 36 L 412 44 L 404 44 Z" />
        <path d="M 396 44 L 404 44 L 404 52 L 396 52 Z" />
        <path d="M 388 52 L 396 52 L 396 60 L 388 60 Z" />
        <path d="M 380 60 L 388 60 L 388 68 L 380 68 Z" />
        <path d="M 372 60 L 380 60 L 380 68 L 372 68 Z" />
        <path d="M 372 68 L 380 68 L 380 76 L 372 76 Z" />
        <path d="M 380 76 L 388 76 L 388 84 L 380 84 Z" />
        <path d="M 388 84 L 396 84 L 396 92 L 388 92 Z" />
        <path d="M 396 92 L 412 92 L 412 100 L 396 100 Z" />
      </g>
    </svg>
  );
}

/**
 * Tamrack symbol — 24×24 tiered conifer / instrument-axis glyph.
 * Source SVG: tamrack/brand/identity/logo/symbol.svg.
 */
export function Symbol({
  size = 20,
  color,
  className,
  title = "Tamrack",
}: {
  size?: number;
  color?: string;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
      shapeRendering="crispEdges"
      style={{ color: color ?? "var(--ink)" }}
    >
      <title>{title}</title>
      <g fill="currentColor">
        <rect x="11" y="2" width="2" height="20" />
        <rect x="9"  y="4"  width="6"  height="2" />
        <rect x="7"  y="8"  width="10" height="2" />
        <rect x="5"  y="12" width="14" height="2" />
        <rect x="3"  y="16" width="18" height="2" />
        <rect x="7"  y="20" width="10" height="2" />
      </g>
    </svg>
  );
}
