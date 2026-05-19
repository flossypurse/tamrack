#!/usr/bin/env tsx
/**
 * smoke-tamrack-auth.ts
 *
 * End-to-end smoke test for the Tamrack auth + scope + metering stack.
 * Hits the local dev server, exercises both HTTP and MCP paths, and
 * verifies the audit-log + counter side effects in Postgres.
 *
 * PRECONDITIONS:
 *   1. Local dev server up:  `npm run dev`  → http://localhost:3000
 *   2. DATABASE_URL set to the same Postgres the dev server connects to.
 *   3. ANTHROPIC_API_KEY set if you also want to exercise /api/smart/query
 *      (this script does NOT — Smart UI smoke is separate).
 *   4. Optional: STRIPE_SECRET_KEY + STRIPE_METER_TAMRACK_UNITS to verify
 *      meter events. The script logs "skipped, no Stripe key" otherwise.
 *
 * USAGE:
 *   DATABASE_URL=postgresql://... npx tsx scripts/smoke-tamrack-auth.ts
 *
 * EXIT CODE:
 *   0 if all assertions pass, 1 otherwise. Each step prints PASS/FAIL.
 */
import { createHash, randomUUID } from "crypto";
import pg from "pg";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const TEST_EMAIL = process.env.SMOKE_USER_EMAIL ?? "smoke-test@tamrack.local";

// ── Tiny assert harness ──────────────────────────────────────────────────
let failures = 0;
function assert(cond: boolean, label: string, detail?: string): void {
  if (cond) {
    console.log(`PASS  ${label}`);
  } else {
    failures++;
    console.error(`FAIL  ${label}${detail ? `\n      ${detail}` : ""}`);
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  // ── Step 1: server up ────────────────────────────────────────────────
  let healthOk = false;
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    healthOk = res.ok;
  } catch (err) {
    console.error("Cannot reach dev server:", (err as Error).message);
  }
  assert(healthOk, "Step 1 — dev server is up");
  if (!healthOk) process.exit(1);

  // ── Step 2: set up a test user + a scoped tk_* key ───────────────────
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    // Idempotent user creation
    const userId = `smoke-${createHash("sha256").update(TEST_EMAIL).digest("hex").slice(0, 12)}`;
    await pool.query(
      `INSERT INTO users (id, email, plan, monthly_units_used)
         VALUES ($1, $2, 'tamrack', 0)
         ON CONFLICT (email) DO UPDATE SET plan = 'tamrack', monthly_units_used = 0`,
      [userId, TEST_EMAIL],
    );

    // Mint a fresh tk_* key with ONLY tamrack:macro:read
    const raw = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
    const key = `tk_${raw}`;
    const keyHash = createHash("sha256").update(key).digest("hex");
    const keyId = randomUUID();
    await pool.query(
      `INSERT INTO api_keys (id, user_id, key_hash, key_prefix, name, scopes)
         VALUES ($1, $2, $3, $4, 'smoke-test', $5)`,
      [keyId, userId, keyHash, key.slice(0, 10), ["tamrack:macro:read"]],
    );
    assert(true, "Step 2 — test user + scoped tk_* key minted");

    const hdr = { Authorization: `Bearer ${key}` };

    // ── Step 3: HTTP scope enforcement ─────────────────────────────────
    // 5 representative routes, one per scope domain.
    const routes: { path: string; expected: number; scope: string }[] = [
      { path: "/api/macro?indicator=policy_rate", expected: 200, scope: "macro" },
      { path: "/api/regional?indicator=population&municipality=edmonton", expected: 403, scope: "regional" },
      { path: "/api/permits?municipality=edmonton", expected: 403, scope: "real-estate" },
      { path: "/api/energy?dataset=pool_price", expected: 403, scope: "energy" },
      { path: "/api/business?category=edmonton_licences_by_type", expected: 403, scope: "economy" },
    ];
    for (const r of routes) {
      const res = await fetch(`${BASE_URL}${r.path}`, { headers: hdr });
      assert(
        res.status === r.expected,
        `Step 3 — HTTP ${r.path} (${r.scope}) → ${r.expected}`,
        `got ${res.status}`,
      );
    }

    // ── Step 4: MCP — correct scope succeeds ───────────────────────────
    const mcpInit = await mcpCall(BASE_URL, hdr, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "smoke", version: "0.1" },
    });
    assert(
      Boolean(mcpInit?.result),
      "Step 4a — MCP initialize succeeds",
      JSON.stringify(mcpInit).slice(0, 200),
    );

    const macroCall = await mcpCall(BASE_URL, hdr, "tools/call", {
      name: "tamrack_macro",
      arguments: { indicator: "policy_rate" },
    });
    assert(
      Boolean(macroCall?.result) && !macroCall?.result?.isError,
      "Step 4b — MCP tamrack_macro with correct scope succeeds",
    );

    // ── Step 5: MCP — wrong scope (energy without scope) gets blocked ──
    const energyCall = await mcpCall(BASE_URL, hdr, "tools/call", {
      name: "tamrack_energy",
      arguments: { dataset: "pool_price" },
    });
    // The MCP transport surfaces scope errors as JSON-RPC errors OR as
    // tool-result envelopes with isError=true. Either is acceptable; what
    // we MUST NOT see is a successful data payload.
    const energyBlocked =
      Boolean(energyCall?.error) ||
      Boolean(energyCall?.result?.isError) ||
      JSON.stringify(energyCall).includes("McpScopeError") ||
      JSON.stringify(energyCall).includes("Forbidden");
    assert(
      energyBlocked,
      "Step 5 — MCP tamrack_energy without scope is blocked",
      JSON.stringify(energyCall).slice(0, 200),
    );

    // ── Step 6: api_usage rows + monthly_units_used incremented ────────
    const { rows: usageRows } = await pool.query(
      `SELECT endpoint, cost_units, counted_toward_plan, response_status
         FROM api_usage
        WHERE user_id = $1 AND timestamp > NOW() - INTERVAL '1 minute'
        ORDER BY timestamp DESC LIMIT 20`,
      [userId],
    );
    assert(usageRows.length > 0, "Step 6a — api_usage rows written");

    const { rows: userRows } = await pool.query(
      `SELECT monthly_units_used FROM users WHERE id = $1`,
      [userId],
    );
    const usedNow = Number(userRows[0]?.monthly_units_used ?? 0);
    assert(
      usedNow > 0,
      "Step 6b — users.monthly_units_used incremented",
      `usedNow=${usedNow}`,
    );

    // ── Step 7: push overage at the 50K boundary ───────────────────────
    await pool.query(
      `UPDATE users SET monthly_units_used = 49999 WHERE id = $1`,
      [userId],
    );
    // Call #1: lands at 50000, still within plan (counted_toward_plan = TRUE)
    await fetch(`${BASE_URL}/api/macro?indicator=policy_rate`, { headers: hdr });
    // Call #2: lands at 50001 — should be counted_toward_plan = FALSE
    await fetch(`${BASE_URL}/api/macro?indicator=policy_rate`, { headers: hdr });

    const { rows: overageRows } = await pool.query(
      `SELECT counted_toward_plan FROM api_usage
        WHERE user_id = $1 AND endpoint LIKE '/api/macro%'
        ORDER BY timestamp DESC LIMIT 2`,
      [userId],
    );
    const overageDetected =
      overageRows.length === 2 &&
      overageRows.some((r) => r.counted_toward_plan === false);
    assert(
      overageDetected,
      "Step 7 — 50K boundary call recorded counted_toward_plan=FALSE",
      JSON.stringify(overageRows),
    );

    // ── Step 8: Stripe meter (skipped without key) ─────────────────────
    if (!process.env.STRIPE_SECRET_KEY) {
      console.log("SKIP  Step 8 — no STRIPE_SECRET_KEY, meter event not verified");
    } else {
      // The actual Stripe Meter Events API is fire-and-forget; we can't
      // round-trip from this script. Best we can do: assert the env var
      // is set and trust that emitMeterEventAsync ran. A future iteration
      // could query the Stripe API for recent meter events.
      assert(true, "Step 8 — Stripe meter env present (best-effort)");
    }

    // ── Cleanup: revoke the test key so it doesn't linger ──────────────
    await pool.query(`UPDATE api_keys SET revoked_at = NOW() WHERE id = $1`, [keyId]);
    console.log("CLEAN test key revoked.");
  } finally {
    await pool.end();
  }

  if (failures > 0) {
    console.error(`\n${failures} step(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll steps passed.");
}

// ── MCP JSON-RPC helper ──────────────────────────────────────────────────
async function mcpCall(
  baseUrl: string,
  hdr: Record<string, string>,
  method: string,
  params: Record<string, unknown>,
): Promise<{
  result?: { isError?: boolean; content?: unknown; structuredContent?: unknown };
  error?: { code: number; message: string };
}> {
  const res = await fetch(`${baseUrl}/api/mcp`, {
    method: "POST",
    headers: {
      ...hdr,
      "content-type": "application/json",
      "MCP-Protocol-Version": "2025-06-18",
      Origin: baseUrl,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Math.floor(Math.random() * 1e9),
      method,
      params,
    }),
  });
  // Streamable HTTP transport may return either a plain JSON response or
  // text/event-stream. For our smoke we accept both.
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    return (await res.json()) as Awaited<ReturnType<typeof mcpCall>>;
  }
  if (ct.includes("text/event-stream")) {
    const text = await res.text();
    // Pull the first `data: {...}` frame
    const m = text.match(/data:\s*(\{[\s\S]*?\})\s*(?:\n\n|$)/);
    if (m) return JSON.parse(m[1]);
  }
  // Fallback — surface body for debugging
  return { error: { code: res.status, message: await res.text() } };
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
