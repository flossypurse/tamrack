/**
 * In-process MCP client for the Smart UI.
 *
 * Wraps Tamrack's own MCP server (the one served at /api/mcp) using the
 * MCP SDK's `InMemoryTransport` — no HTTP round-trip, no auth, no
 * serialization across a network. Same pattern as
 * `webui/scripts/mcp-smoke-test.ts`. Lifecycle: build a fresh client +
 * server pair per Smart UI query, call one-or-more tools, close. Tool
 * registration is fast (no I/O at startup) so per-request instantiation
 * is cheap and keeps state isolated.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createMcpServer } from "@/app/api/mcp/server";
import { runWithMcpAuth } from "@/app/api/mcp/lib/auth-context";

import { normalizeToolEnvelope } from "./normalize-envelope";
import type { ToolCallResult } from "./types";

/**
 * Synthetic auth context used for Smart UI in-process tool calls.
 *
 * Smart UI is a server-side first-party caller; the user has already paid
 * 25 units per dashboard generation, and the planner picks tools based on
 * the user's natural-language query, not on a key's granted scopes.
 *
 * We grant the synthetic context all 5 read scopes so `requireScopes()`
 * inside each tool handler passes. If we add a write-scope tool family
 * later, the Smart UI context will need explicit opt-in for those.
 */
const SMART_UI_INPROC_SCOPES = [
  "tamrack:macro:read",
  "tamrack:regional:read",
  "tamrack:real-estate:read",
  "tamrack:energy:read",
  "tamrack:economy:read",
] as const;

export interface McpClientHandle {
  callTool: (
    tool: string,
    args: Record<string, unknown>,
    timeoutMs?: number,
  ) => Promise<ToolCallResult>;
  close: () => Promise<void>;
}

/**
 * Build a linked client/server pair over `InMemoryTransport`. Caller owns
 * the lifecycle and must call `close()`. The smart-ui route uses a
 * try/finally to guarantee closure even on streaming errors.
 */
export async function createInProcessMcpClient(): Promise<McpClientHandle> {
  const server = createMcpServer();
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  const client = new Client(
    { name: "tamrack-smart-ui", version: "0.1.0" },
    { capabilities: {} },
  );

  // Run client + server `connect()` in parallel — they perform the
  // initialize handshake between each other and both must be live to
  // complete it.
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  async function callTool(
    tool: string,
    args: Record<string, unknown>,
    timeoutMs = 60_000,
  ): Promise<ToolCallResult> {
    const cardId = String(args["__card_id"] ?? tool);
    // Strip the smuggled card_id before passing to the MCP tool — it
    // isn't part of the tool schema.
    const cleanArgs = { ...args };
    delete cleanArgs["__card_id"];

    try {
      // Run the call inside the synthetic auth context so each tool's
      // `requireScopes()` guard finds the AsyncLocalStorage state it
      // expects. Without this, every scoped tool throws McpScopeError
      // because the in-process transport carries no Bearer token.
      const result = await runWithMcpAuth(
        {
          userId: "smart-ui-inproc",
          keyId: null,
          scopes: [...SMART_UI_INPROC_SCOPES],
        },
        () =>
          client.callTool(
            { name: tool, arguments: cleanArgs },
            undefined,
            { timeout: timeoutMs },
          ),
      );
      if (result.isError) {
        const contentArr = Array.isArray(result.content) ? result.content : [];
        const textBlock = contentArr.find(
          (c) => (c as { type?: string }).type === "text",
        ) as { type: "text"; text: string } | undefined;
        return {
          card_id: cardId,
          tool,
          args: cleanArgs,
          status: "error",
          error: textBlock?.text ?? "MCP tool returned isError",
        };
      }
      const structured = result.structuredContent;
      // Project wide-shape envelopes (housing/energy/business) to also
      // carry a top-level `data.points` series so the Smart UI composer
      // + renderer (which only know the macro shape) find data. The
      // public MCP envelope on the wire is untouched — this only mutates
      // the in-process copy.
      const { normalized } = normalizeToolEnvelope(tool, cleanArgs, structured);
      return {
        card_id: cardId,
        tool,
        args: cleanArgs,
        status: "ok",
        data: normalized ?? null,
      };
    } catch (err) {
      return {
        card_id: cardId,
        tool,
        args: cleanArgs,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async function close(): Promise<void> {
    // Both sides need closing. Swallow individual errors — close is
    // best-effort cleanup, the request has already returned to the caller.
    await Promise.allSettled([client.close(), server.close()]);
  }

  return { callTool, close };
}
