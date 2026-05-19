/**
 * Tamrack T3 Terminal icons.
 *
 * Construction discipline (tamrack/brand/identity/iconography/set.svg):
 * - 24×24 grid, integer coords
 * - stroke 1.5px, miter joins, square caps
 * - shape-rendering="geometricPrecision"
 * - No rounded corners, no bezier curves except circular semantics
 *   (clock face, status dot, gear hub).
 *
 * Why these exist: see iconography/rejections.md — every UI-icon library
 * (Lucide / Phosphor / Tabler / Heroicons / Iconoir) rounds line caps and
 * joins by default. Authoring our own from the brand grid is the
 * anti-drift mechanism.
 *
 * Icons here are the brand-bearing set — chrome (nav, footer, hero,
 * key-once card, theme toggle). Purely functional UI controls
 * (chevrons, close buttons, form controls) keep Lucide for now and are
 * tracked in a separate sweep (see Phase 4 P3 deferred list).
 */

import type { SVGProps } from "react";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "size"> {
  size?: number;
}

function base(size: number): SVGProps<SVGSVGElement> {
  return {
    xmlns: "http://www.w3.org/2000/svg",
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "square",
    strokeLinejoin: "miter",
    shapeRendering: "geometricPrecision",
  };
}

/* ── Sun (theme toggle, light) — mitered ray polylines ── */
export function TSun({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <rect x="8" y="8" width="8" height="8" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <line x1="5" y1="5" x2="7" y2="7" />
      <line x1="17" y1="17" x2="19" y2="19" />
      <line x1="5" y1="19" x2="7" y2="17" />
      <line x1="17" y1="7" x2="19" y2="5" />
    </svg>
  );
}

/* ── Moon (theme toggle, dark) — sharp crescent built from two rects ── */
export function TMoon({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <polygon
        points="14,3 21,3 21,21 14,21 14,18 18,18 18,6 14,6"
        fill="currentColor"
        stroke="none"
      />
      <polygon
        points="4,3 14,3 14,6 7,6 7,18 14,18 14,21 4,21"
        fill="none"
      />
    </svg>
  );
}

/* ── Search — square magnifier ── */
export function TSearch({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <rect x="4" y="4" width="10" height="10" />
      <line x1="14" y1="14" x2="20" y2="20" />
    </svg>
  );
}

/* ── Menu / hamburger — three mitered bars ── */
export function TMenu({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <line x1="3" y1="6"  x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

/* ── X / close — two crossed mitered strokes ── */
export function TClose({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </svg>
  );
}

/* ── Key — terminal key glyph (square bow + rectangular bit) ── */
export function TKey({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <rect x="3" y="9" width="8" height="6" />
      <line x1="11" y1="12" x2="21" y2="12" />
      <line x1="17" y1="12" x2="17" y2="15" />
      <line x1="20" y1="12" x2="20" y2="15" />
    </svg>
  );
}

/* ── Check — mitered tick, no curves ── */
export function TCheck({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <polyline points="4,12 10,18 20,6" />
    </svg>
  );
}

/* ── Copy — two overlapping square frames ── */
export function TCopy({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <rect x="8" y="8" width="12" height="12" />
      <polyline points="4,16 4,4 16,4" />
    </svg>
  );
}

/* ── Arrow-right — mitered shaft + chevron head ── */
export function TArrowRight({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <line x1="3" y1="12" x2="19" y2="12" />
      <polyline points="13,6 19,12 13,18" />
    </svg>
  );
}

/* ── Mail / envelope — square frame + V-flap (mitered) ── */
export function TMail({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <rect x="3" y="6" width="18" height="12" />
      <polyline points="3,6 12,14 21,6" />
    </svg>
  );
}

/* ── Alert-triangle — sharp equilateral with center mark ── */
export function TAlertTriangle({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <polygon points="12,3 22,21 2,21" />
      <line x1="12" y1="9" x2="12" y2="15" />
      <rect x="11.25" y="17" width="1.5" height="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* ── Spinner-substitute — static "pending" marker. Brand bans spinners. ── */
export function TPending({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <rect x="4" y="11" width="3" height="2" fill="currentColor" stroke="none" />
      <rect x="10.5" y="11" width="3" height="2" fill="currentColor" stroke="none" />
      <rect x="17" y="11" width="3" height="2" fill="currentColor" stroke="none" />
    </svg>
  );
}
