// Worker-side error reporting. Only the durable worker (worker.ts, run via
// `npx tsx`) imports this. The Next.js webui uses @sentry/nextjs and is wired
// through instrumentation.ts / sentry.server.config.ts instead.
//
// Init posture is deliberately minimal: error capture only, no performance
// tracing, no auto-instrumentation. We capture exceptions explicitly at known
// entrypoints (per-indicator catch, per-phase catch, fatal main catch) so
// Resonate SDK / pg auto-instrumentation surprises don't matter.
//
// Without SENTRY_DSN this module is a no-op: initObservability logs and
// returns, captureError still works and falls back to console.error.

import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;

let initialized = false;

export function initObservability(): void {
  if (initialized) return;
  initialized = true;

  if (!dsn) {
    console.log("[observability] SENTRY_DSN not set — error reporting disabled");
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "production",
    // `||` (not `??`) so an empty-string SENTRY_RELEASE="" left behind in env
    // still falls through to the SHA — empty string would tag Sentry events
    // as "set but invalid", defeating the fallback.
    release: process.env.SENTRY_RELEASE || process.env.GITHUB_SHA || process.env.FLY_MACHINE_VERSION,
    tracesSampleRate: 0,
    defaultIntegrations: false,
    integrations: [
      Sentry.onUncaughtExceptionIntegration(),
      Sentry.onUnhandledRejectionIntegration(),
    ],
  });

  console.log(`[observability] Sentry initialized (env=${process.env.NODE_ENV ?? "production"})`);
}

export type ErrorContext = {
  phase?: string;
  indicator?: string;
  source?: string;
  today?: string;
  [k: string]: unknown;
};

// Capture an error to Sentry with structured context. Always logs to console
// too — Sentry is an enhancement, not a replacement for stdout/stderr capture.
export function captureError(err: unknown, ctx: ErrorContext = {}): void {
  const message = err instanceof Error ? err.message : String(err);
  const ctxStr = Object.keys(ctx).length > 0 ? ` ${JSON.stringify(ctx)}` : "";
  console.error(`[error] ${message}${ctxStr}`);

  if (!dsn || !initialized) return;
  Sentry.withScope((scope) => {
    for (const [k, v] of Object.entries(ctx)) {
      if (v !== undefined) scope.setExtra(k, v);
    }
    if (ctx.phase) scope.setTag("phase", String(ctx.phase));
    if (ctx.indicator) scope.setTag("indicator", String(ctx.indicator));
    if (ctx.source) scope.setTag("source", String(ctx.source));
    Sentry.captureException(err);
  });
}
