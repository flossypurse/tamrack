/**
 * Second-pass intelligence extraction from existing intel data.
 *
 * Read-only analyses across `intel_operators` (1127 rows) and the current
 * `intel_operator_profiles` (154 enriched profiles). No new LLM calls.
 *
 * Sections:
 *   A. Co-location (operators sharing a normalized street address)
 *   B. Same-domain detection (operators sharing a website hostname)
 *   C. Reverse competitor graph (who's named as competitor by others)
 *   D. Sector clustering by structured fields (ownership x headcount)
 *
 * Usage:
 *   cd tamrack/webui && DATABASE_URL=... npx tsx scripts/analyze-intel-graph.ts
 */
import pg from "pg";

type Operator = {
  id: string;
  name: string | null;
  street_address: string | null;
  city: string | null;
  website: string | null;
  source: string | null;
};

type Profile = {
  operator_id: string;
  structured: Record<string, unknown> | null;
};

function normalizeAddress(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,]/g, "")
    .trim();
}

function isLikelyPoBox(addr: string): boolean {
  // catches "po box 123", "p.o. box 123", "box 2503", "site 4 box 12"
  return /\b(p\.?\s*o\.?\s*)?box\s+\d/.test(addr) || /^box\s+\d/.test(addr);
}

function extractHostname(raw: string): string | null {
  if (!raw) return null;
  try {
    // Tolerate missing protocol
    const withProto = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
    const u = new URL(withProto);
    let host = u.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    return host || null;
  } catch {
    return null;
  }
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

async function main(): Promise<void> {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  const opsRes = await pool.query<Operator>(
    `SELECT id, name, street_address, city, website, source FROM intel_operators`,
  );
  const operators = opsRes.rows;

  const profRes = await pool.query<Profile>(
    `SELECT operator_id, structured
       FROM intel_operator_profiles
       WHERE current = true`,
  );
  const profiles = profRes.rows;

  // ===== A. Co-location =====
  console.log("== A. CO-LOCATION ==");
  const addrClusters = new Map<
    string,
    { addr: string; ops: Operator[]; poBox: boolean }
  >();
  let addrPresent = 0;
  for (const op of operators) {
    if (!op.street_address) continue;
    addrPresent++;
    const norm = normalizeAddress(op.street_address);
    if (!norm) continue;
    const existing = addrClusters.get(norm);
    if (existing) {
      existing.ops.push(op);
    } else {
      addrClusters.set(norm, {
        addr: op.street_address.trim(),
        ops: [op],
        poBox: isLikelyPoBox(norm),
      });
    }
  }
  const sharedAddrs = Array.from(addrClusters.values()).filter(
    (c) => c.ops.length >= 2,
  );
  sharedAddrs.sort((a, b) => b.ops.length - a.ops.length);
  const poBoxClusters = sharedAddrs.filter((c) => c.poBox);
  const realClusters = sharedAddrs.filter((c) => !c.poBox);

  console.log(
    `${sharedAddrs.length} address clusters with 2+ operators ` +
      `(${realClusters.length} real, ${poBoxClusters.length} PO-box-ish)`,
  );
  console.log(
    `coverage: ${addrPresent}/${operators.length} operators have a street_address ` +
      `(${operators.length - addrPresent} null/empty)`,
  );
  console.log("");
  console.log("Top 10 clusters (PO-box flagged):");
  for (const c of sharedAddrs.slice(0, 10)) {
    const flag = c.poBox ? " [PO-BOX-LIKELY]" : "";
    console.log(`  [${c.ops.length} ops] ${c.addr}${flag}`);
    for (const op of c.ops) {
      console.log(`    - ${op.name ?? "(unnamed)"} (${op.city ?? "?"})`);
    }
  }
  console.log("");

  // ===== B. Same-domain detection =====
  console.log("== B. SAME-DOMAIN ==");
  const hostClusters = new Map<string, Operator[]>();
  let webPresent = 0;
  let webMalformed = 0;
  for (const op of operators) {
    if (!op.website) continue;
    webPresent++;
    const host = extractHostname(op.website);
    if (!host) {
      webMalformed++;
      continue;
    }
    const arr = hostClusters.get(host) ?? [];
    arr.push(op);
    hostClusters.set(host, arr);
  }
  const sharedHosts = Array.from(hostClusters.entries())
    .filter(([, ops]) => ops.length >= 2)
    .sort((a, b) => b[1].length - a[1].length);
  console.log(`${sharedHosts.length} hostname clusters with 2+ operators`);
  console.log(
    `coverage: ${webPresent}/${operators.length} operators have a website ` +
      `(${webMalformed} malformed/unparseable)`,
  );
  console.log("");
  console.log("All shared-domain clusters:");
  for (const [host, ops] of sharedHosts) {
    console.log(`  [${ops.length} ops] ${host}`);
    for (const op of ops) {
      console.log(
        `    - ${op.name ?? "(unnamed)"}  src=${op.source ?? "?"}  city=${op.city ?? "?"}`,
      );
    }
  }
  console.log("");

  // ===== C. Reverse competitor graph =====
  console.log("== C. REVERSE COMPETITOR GRAPH ==");
  // Map raw competitor string -> profile count (case-folded key)
  const compCounts = new Map<string, { display: string; count: number }>();
  let profilesWithCompetitors = 0;
  for (const p of profiles) {
    const s = p.structured ?? {};
    const cc = (s as Record<string, unknown>)["competitive_context"];
    if (!cc || typeof cc !== "object") continue;
    const named = asStringArray(
      (cc as Record<string, unknown>)["named_competitors"],
    );
    if (named.length === 0) continue;
    profilesWithCompetitors++;
    // Dedupe within a single profile so we don't double-count
    const seen = new Set<string>();
    for (const raw of named) {
      const key = raw.toLowerCase().trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const cur = compCounts.get(key);
      if (cur) {
        cur.count += 1;
      } else {
        compCounts.set(key, { display: raw.trim(), count: 1 });
      }
    }
  }

  // Build a case-folded operator-name index for fuzzy match (substring either direction)
  const opNameIndex: Array<{ key: string; name: string }> = operators
    .filter((o) => o.name)
    .map((o) => ({ key: o.name!.toLowerCase().trim(), name: o.name! }));

  function findInDirectory(compKey: string): string | null {
    // Exact
    for (const o of opNameIndex) if (o.key === compKey) return o.name;
    // Substring either direction (length-guarded to reduce noise)
    if (compKey.length < 4) return null;
    for (const o of opNameIndex) {
      if (o.key.includes(compKey) || compKey.includes(o.key)) {
        // require min length on the shorter side to avoid 4-char garbage
        const shorter = Math.min(o.key.length, compKey.length);
        if (shorter >= 5) return o.name;
      }
    }
    return null;
  }

  const ranked = Array.from(compCounts.values()).sort(
    (a, b) => b.count - a.count,
  );
  const totalDistinct = ranked.length;
  console.log(
    `${profilesWithCompetitors}/${profiles.length} profiles include named competitors`,
  );
  console.log(`${totalDistinct} distinct competitor name strings mentioned`);
  console.log("");
  console.log("Top 25 most-named competitors:");
  for (const r of ranked.slice(0, 25)) {
    const match = findInDirectory(r.display.toLowerCase().trim());
    const tag = match ? `IN-DIR (${match})` : "external";
    console.log(`  ${r.count.toString().padStart(3)} | ${r.display}  [${tag}]`);
  }
  console.log("");
  // Summary: how many top-named competitors are in directory?
  const inDirCount = ranked
    .slice(0, 25)
    .filter((r) => findInDirectory(r.display.toLowerCase().trim())).length;
  console.log(`in-directory share of top 25: ${inDirCount}/25`);
  console.log("");

  // ===== D. Sector clustering =====
  console.log("== D. SECTOR CLUSTERING (enriched 154) ==");
  const ownershipCounts = new Map<string, number>();
  const headcountCounts = new Map<string, number>();
  const cross = new Map<string, number>(); // key = `${ownership} || ${headcount}`
  for (const p of profiles) {
    const s = (p.structured ?? {}) as Record<string, unknown>;
    const own = asString(s["ownership_type"]) ?? "(unknown)";
    const hc = asString(s["headcount_band"]) ?? "(unknown)";
    ownershipCounts.set(own, (ownershipCounts.get(own) ?? 0) + 1);
    headcountCounts.set(hc, (headcountCounts.get(hc) ?? 0) + 1);
    const key = `${own} || ${hc}`;
    cross.set(key, (cross.get(key) ?? 0) + 1);
  }
  console.log("ownership_type:");
  for (const [k, v] of Array.from(ownershipCounts.entries()).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${v.toString().padStart(3)}  ${k}`);
  }
  console.log("");
  console.log("headcount_band:");
  for (const [k, v] of Array.from(headcountCounts.entries()).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${v.toString().padStart(3)}  ${k}`);
  }
  console.log("");
  console.log("ownership_type x headcount_band:");
  for (const [k, v] of Array.from(cross.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v.toString().padStart(3)}  ${k}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(1);
});
