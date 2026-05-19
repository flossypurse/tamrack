/**
 * Per-request auth context for MCP tools.
 *
 * The MCP route authenticates ONCE for the JSON-RPC handshake (no scope
 * requirement at that point because we don't yet know which tool is being
 * called). Per-tool scope enforcement runs inside each tool handler — but
 * the SDK doesn't pass auth state through `server.registerTool` callbacks.
 *
 * AsyncLocalStorage carries the authenticated identity from the route
 * dispatcher down into the tool handlers without threading it through
 * every signature.
 *
 * Tool handlers call `requireScopes()` at the top of their body. If the
 * caller's key doesn't carry the required scope, the helper throws — the
 * SDK turns that into a JSON-RPC error result for the agent.
 *
 * Each Tamrack tool maps to exactly one scope (per charter taxonomy):
 *   - macro tools     → tamrack:macro:read
 *   - regional tool   → tamrack:regional:read
 *   - real-estate     → tamrack:real-estate:read
 *   - energy          → tamrack:energy:read
 *   - economy/business→ tamrack:economy:read
 *
 * The catalog tool (`tamrack_catalog`) is unscoped — every authenticated
 * caller can discover what's available.
 */

import { AsyncLocalStorage } from "node:async_hooks";

export interface McpAuthContext {
  userId: string;
  keyId: string | null;
  /** Empty array = session-auth, treated as no-scope. */
  scopes: string[];
}

const STORAGE = new AsyncLocalStorage<McpAuthContext>();

export function runWithMcpAuth<T>(ctx: McpAuthContext, fn: () => Promise<T>): Promise<T> {
  return STORAGE.run(ctx, fn);
}

export function getMcpAuthContext(): McpAuthContext | undefined {
  return STORAGE.getStore();
}

/**
 * Thrown when a tool handler is invoked without the required scope. The
 * SDK converts thrown errors to JSON-RPC error results, so the agent
 * sees a structured failure rather than a hung call.
 */
export class McpScopeError extends Error {
  readonly required: readonly string[];
  readonly held: readonly string[];

  constructor(required: readonly string[], held: readonly string[]) {
    super(
      `Forbidden: tool requires one of [${required.join(", ")}]; key carries [${held.join(", ") || "<none>"}]`,
    );
    this.name = "McpScopeError";
    this.required = required;
    this.held = held;
  }
}

/**
 * Tool-handler-side scope guard. Any-of semantics: the call passes if the
 * caller has at least one of the required scopes. Tamrack tools always
 * pass a single scope so this collapses to "must hold this scope".
 *
 * Throws {@link McpScopeError} on failure. Returns the auth context on
 * success so handlers can pass userId downstream if they need it.
 */
export function requireScopes(required: readonly string[]): McpAuthContext {
  const ctx = STORAGE.getStore();
  if (!ctx) {
    // The MCP route always runs tools inside `runWithMcpAuth`. Missing
    // context means something is wrong with the wiring, not the caller.
    throw new McpScopeError(required, []);
  }
  if (required.length === 0) return ctx;
  const ok = required.some((s) => ctx.scopes.includes(s));
  if (!ok) {
    throw new McpScopeError(required, ctx.scopes);
  }
  return ctx;
}
