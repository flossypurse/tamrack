// One-shot cookies that carry a just-minted plaintext token from the route
// that issues it to the page that displays it ONCE before deleting it. They
// live in their own module (not in a route.ts or in invites.ts) so that the
// key/token UI can depend on them without coupling to the invite system, and
// so Next.js 16's "no non-handler exports from route files" rule is satisfied.

/** Carries the just-minted plaintext HTTP API key to the key-display surface. */
export const ONCE_KEY_COOKIE = "tk_once";

/**
 * Same one-shot pattern for the MCP agent token. A distinct cookie name so the
 * two surfaces can't accidentally read each other's secret.
 */
export const MCP_ONCE_KEY_COOKIE = "tk_mcp_once";
