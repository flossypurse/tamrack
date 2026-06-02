/**
 * Shared helpers for the MCP-agent Bearer tokens surfaced in the account
 * workspace. MCP tokens are minted via the same `tk_*` infrastructure that
 * backs HTTP API keys (see api-keys.ts); the only difference is the naming
 * convention ("mcp · <date>") so usage logs read cleanly per agent.
 *
 * Plain module (no "use server") so constants and the read helper can be
 * imported by both the workspace rail (server component) and the account
 * server actions without being treated as remotely-callable actions.
 */
import { getUserApiKeys } from "./api-keys";

export const MCP_SCOPES = [
  "tamrack:macro:read",
  "tamrack:regional:read",
  "tamrack:real-estate:read",
  "tamrack:energy:read",
  "tamrack:economy:read",
] as const;

export const MCP_NAME_PREFIX = "mcp ·";
export const MCP_KEY_CAP = 5;

export type McpKey = {
  id: string;
  key_prefix: string;
  name: string;
  last_used_at: string | null;
  created_at: string;
};

export async function listActiveMcpKeys(userId: string): Promise<McpKey[]> {
  const all = await getUserApiKeys(userId);
  return all
    .filter((k) => k.revoked_at === null && k.name.startsWith(MCP_NAME_PREFIX))
    .map(({ id, key_prefix, name, last_used_at, created_at }) => ({
      id,
      key_prefix,
      name,
      last_used_at,
      created_at,
    }));
}

export function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
