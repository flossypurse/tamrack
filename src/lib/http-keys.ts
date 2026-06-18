/**
 * Shared helpers for the self-serve HTTP API keys surfaced in the account
 * workspace. HTTP keys and MCP tokens are the SAME `tk_*` credential (see
 * api-keys.ts) — same table, same minting, same read scopes; the only
 * difference is the naming convention ("http · <date>" vs "mcp · <date>") so
 * usage logs read cleanly per surface and each list can filter to its own.
 *
 * Plain module (no "use server") so constants and the read helper can be
 * imported by both the workspace rail (server component) and the account
 * server actions without being treated as remotely-callable actions.
 */
import { getUserApiKeys } from "./api-keys";

/**
 * Read scopes granted to a self-serve HTTP key. Identical to MCP_SCOPES and
 * the invite-claim founder key — every Tamrack credential is read-only over
 * the same five domains while invite-only.
 */
export const HTTP_SCOPES = [
  "tamrack:macro:read",
  "tamrack:regional:read",
  "tamrack:real-estate:read",
  "tamrack:energy:read",
  "tamrack:economy:read",
] as const;

export const HTTP_NAME_PREFIX = "http ·";
export const HTTP_KEY_CAP = 5;

export type HttpKey = {
  id: string;
  key_prefix: string;
  name: string;
  last_used_at: string | null;
  created_at: string;
};

export async function listActiveHttpKeys(userId: string): Promise<HttpKey[]> {
  const all = await getUserApiKeys(userId);
  return all
    .filter((k) => k.revoked_at === null && k.name.startsWith(HTTP_NAME_PREFIX))
    .map(({ id, key_prefix, name, last_used_at, created_at }) => ({
      id,
      key_prefix,
      name,
      last_used_at,
      created_at,
    }));
}
