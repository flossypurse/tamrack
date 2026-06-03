import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Build uses --webpack flag (see package.json) because Turbopack production
// builds in Next.js 16.1.x have a chunk-loading race condition that causes
// ChunkLoadError / ENOENT on SSR chunks during static page generation.
// Dev still uses Turbopack (Next.js 16 default). The prebuild script cleans
// .next to prevent Turbopack dev cache from conflicting with Webpack builds.

// Content Security Policy — strict-ish but compatible with our actual surface:
// - 'unsafe-inline' on script-src is needed for Next.js inline runtime bootstrap
//   chunks; tightening to a nonce-based policy requires custom middleware and is
//   deferred until we have time to verify across every route.
// - 'unsafe-inline' on style-src is needed for Tailwind's CSS-in-JS hash classes
//   and the inline <style> tags Next emits for critical CSS.
// - Mailgun (img + connect) is reachable for the auth-form magic-link UX.
// - Google Analytics (script + img + connect) is whitelisted because GA4 is
//   wired in the analytics component when NEXT_PUBLIC_GA_MEASUREMENT_ID is set.
// - Stripe (script + frame) reserved for when the paid tier ships.
// - Sentry ingest (*.sentry.io) is reachable for client-side error reporting
//   when NEXT_PUBLIC_SENTRY_DSN is set.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://js.stripe.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "connect-src 'self' https://api.mailgun.net https://www.google-analytics.com https://analytics.google.com https://api.stripe.com https://*.sentry.io",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  // Suppress `x-powered-by: Next.js` header (reduces framework fingerprinting).
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    // Limit static generation workers to reduce filesystem race conditions
    // that cause ENOENT / "Cannot find module" errors during build.
    // Default (os.cpus) spawns 10 workers which overwhelms the build pipeline.
    cpus: 2,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: CSP_DIRECTIVES },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Legacy municipality short URLs
      { source: "/parkland-county", destination: "/municipalities/parkland-county", permanent: true },
      { source: "/spruce-grove", destination: "/municipalities/spruce-grove", permanent: true },
      { source: "/st-albert", destination: "/municipalities/st-albert", permanent: true },
      { source: "/stony-plain", destination: "/municipalities/stony-plain", permanent: true },
      { source: "/strathcona", destination: "/municipalities/strathcona", permanent: true },

      // Old /m/ routes → /municipalities/
      { source: "/m/:slug", destination: "/municipalities/:slug", permanent: true },

      // Overview
      { source: "/signals", destination: "/overview/signals", permanent: true },
      { source: "/briefing", destination: "/overview/briefing", permanent: true },
      { source: "/briefing/:path*", destination: "/overview/briefing/:path*", permanent: true },

      // Economy
      { source: "/energy", destination: "/economy/energy", permanent: true },
      { source: "/drilling", destination: "/economy/drilling", permanent: true },
      { source: "/cycle", destination: "/economy/boom-bust", permanent: true },
      { source: "/diversification", destination: "/economy/diversification", permanent: true },
      { source: "/labour", destination: "/community/labour", permanent: true },
      { source: "/migration", destination: "/community/immigration", permanent: true },
      { source: "/agriculture", destination: "/economy/agriculture", permanent: true },

      // Real Estate
      { source: "/prospects", destination: "/real-estate/prospects", permanent: true },
      { source: "/micro", destination: "/real-estate/neighbourhoods", permanent: true },
      { source: "/pipeline", destination: "/real-estate/pipeline", permanent: true },
      { source: "/rental", destination: "/real-estate/rental", permanent: true },
      { source: "/commercial", destination: "/real-estate/commercial", permanent: true },

      // Intelligence (moved to /economy/ in Phase 1)
      { source: "/benchmarks", destination: "/economy/benchmarks", permanent: true },
      { source: "/corridors", destination: "/economy/corridors", permanent: true },
      { source: "/risk", destination: "/economy/risk", permanent: true },
      { source: "/invest", destination: "/economy/invest", permanent: true },
      { source: "/compare", destination: "/economy/compare", permanent: true },
      { source: "/intelligence/:path*", destination: "/economy/:path*", permanent: true },

      // Environment
      { source: "/weather", destination: "/environment/weather", permanent: true },
      { source: "/air-quality", destination: "/environment/air-quality", permanent: true },
      { source: "/water", destination: "/environment/water", permanent: true },
      { source: "/wildfire", destination: "/environment/wildfire", permanent: true },

      // Public Safety (moved to /community/ in Phase 1)
      { source: "/traffic", destination: "/community/traffic", permanent: true },
      { source: "/earthquakes", destination: "/community/seismic", permanent: true },
      { source: "/emergencies", destination: "/community/emergencies", permanent: true },
      { source: "/safety/:path*", destination: "/community/:path*", permanent: true },

      // Municipalities
      { source: "/coverage", destination: "/municipalities/coverage", permanent: true },

      // Tools
      { source: "/sources", destination: "/tools/sources", permanent: true },

      // Legacy routes removed in Phase 1
      { source: "/overview/:path*", destination: "/home/:path*", permanent: true },
      { source: "/politics/:path*", destination: "/governance/:path*", permanent: true },
      { source: "/health/:path*", destination: "/community/health", permanent: true },
      { source: "/dashboard", destination: "/home/dashboard", permanent: true },
    ];
  },
};

// withSentryConfig wraps the build to:
// (1) upload source maps when SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT are set,
// (2) hide source maps from the public build output.
// All three options are no-ops without the env vars, so the build still ships
// cleanly before the Sentry project is provisioned.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
});
