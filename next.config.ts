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
