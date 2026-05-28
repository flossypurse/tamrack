// Edge-runtime Sentry init for Next.js. Currently no routes use the edge
// runtime, but @sentry/nextjs wires this anyway in case middleware ships.
//
// No-op when SENTRY_DSN is unset.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "production",
    release: process.env.SENTRY_RELEASE || process.env.FLY_MACHINE_VERSION,
    tracesSampleRate: 0,
  });
}
