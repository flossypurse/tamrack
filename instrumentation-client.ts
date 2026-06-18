// Browser-runtime Sentry init for Next.js. Next.js 15+ auto-loads
// instrumentation-client.ts as the client entrypoint.
//
// We expose the DSN as NEXT_PUBLIC_SENTRY_DSN so it can be inlined into the
// client bundle at build time. No DSN -> no init -> no client events.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "production",
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    tracesSampleRate: 0,
    // Replay/session-tracing intentionally off — error capture only for now.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}
