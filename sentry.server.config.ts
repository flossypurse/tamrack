// Server-runtime Sentry init for Next.js (Node).
// Called from instrumentation.ts when NEXT_RUNTIME === "nodejs".
//
// No-op when SENTRY_DSN is unset so the build still runs and prod can ship
// before the DSN is provisioned in Fly secrets.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "production",
    release: process.env.SENTRY_RELEASE || process.env.FLY_MACHINE_VERSION,
    tracesSampleRate: 0,
    // No PII capture by default; we redact upstream-fetcher errors that may
    // include URLs with API keys before reaching Sentry.
    sendDefaultPii: false,
  });
}
