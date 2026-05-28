// Next.js instrumentation hook. Runs once per server process at startup
// (NEXT_RUNTIME is "nodejs" for SSR/API, "edge" for middleware).
//
// @sentry/nextjs reads sentry.server.config.ts / sentry.edge.config.ts from
// the project root automatically when we forward to them here.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export { captureRequestError } from "@sentry/nextjs";
