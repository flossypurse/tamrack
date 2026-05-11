/**
 * Seed the `intel_operators` table from one or more raw JSON files.
 *
 * Each input JSON must be an array of records with at least { name } and
 * ideally { source, source_url, member_id, name, description, categories[],
 * street_address, address_line2, city, postal_code, country, region, phone,
 * fax, email, website, hours, social }.
 *
 * The seeder is IDEMPOTENT: re-running with the same input upserts on
 * (source, source_member_id). Stable UUIDs are derived from that pair so
 * IDs persist across re-seeds.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx scripts/seed-intel-operators.ts \
 *     <source-key>:<path-to-json> [<source-key>:<path-to-json> ...]
 *
 *   The source-key is the short label that lands in the `source` column
 *   (e.g. "aba", "gprc"). It overrides whatever `source` field is in the
 *   raw record so the column stays clean for filtering.
 *
 * Example:
 *   DATABASE_URL=... npx tsx scripts/seed-intel-operators.ts \
 *     aba:/path/to/aba-raw.json gprc:/path/to/gprc-raw.json
 */
import { readFileSync } from "fs";
import { createHash } from "crypto";
import { getDb } from "@/lib/db";

interface RawOperator {
  name?: unknown;
  source_url?: unknown;
  member_id?: unknown;
  description?: unknown;
  categories?: unknown;
  street_address?: unknown;
  address_line2?: unknown;
  city?: unknown;
  postal_code?: unknown;
  country?: unknown;
  region?: unknown;
  phone?: unknown;
  fax?: unknown;
  email?: unknown;
  website?: unknown;
  hours?: unknown;
  social?: unknown;
  [key: string]: unknown;
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function stringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function socialObj(v: unknown): Record<string, string> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string" && val.trim().length > 0) out[k] = val.trim();
  }
  return Object.keys(out).length > 0 ? out : null;
}

// Stable UUIDv5-ish: sha1(source + ":" + memberId), formatted as a UUID.
function stableId(source: string, memberId: string): string {
  const h = createHash("sha1").update(`${source}:${memberId}`).digest("hex");
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    "5" + h.slice(13, 16), // version-5 nibble
    ((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0") + h.slice(18, 20),
    h.slice(20, 32),
  ].join("-");
}

async function loadFile(path: string, source: string): Promise<number> {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  const records: RawOperator[] = Array.isArray(parsed) ? parsed : Object.values(parsed).flat() as RawOperator[];

  const pool = await getDb();

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const r of records) {
    const name = str(r.name);
    if (!name) {
      skipped++;
      continue;
    }
    const memberId = str(r.member_id) ?? createHash("sha1").update(`${source}:${name}`).digest("hex").slice(0, 16);
    const id = stableId(source, memberId);

    const result = await pool.query(
      `INSERT INTO intel_operators (
         id, source, source_member_id, source_url, name, description,
         categories, street_address, address_line2, city, postal_code,
         country, region, phone, fax, email, website, hours, social, raw
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11,
         $12, $13, $14, $15, $16, $17, $18, $19, $20
       )
       ON CONFLICT (source, source_member_id) DO UPDATE SET
         source_url       = EXCLUDED.source_url,
         name             = EXCLUDED.name,
         description      = EXCLUDED.description,
         categories       = EXCLUDED.categories,
         street_address   = EXCLUDED.street_address,
         address_line2    = EXCLUDED.address_line2,
         city             = EXCLUDED.city,
         postal_code      = EXCLUDED.postal_code,
         country          = EXCLUDED.country,
         region           = EXCLUDED.region,
         phone            = EXCLUDED.phone,
         fax              = EXCLUDED.fax,
         email            = EXCLUDED.email,
         website          = EXCLUDED.website,
         hours            = EXCLUDED.hours,
         social           = EXCLUDED.social,
         raw              = EXCLUDED.raw,
         updated_at       = NOW()
       RETURNING (xmax = 0) AS inserted`,
      [
        id,
        source,
        memberId,
        str(r.source_url),
        name,
        str(r.description),
        stringArray(r.categories),
        str(r.street_address),
        str(r.address_line2),
        str(r.city),
        str(r.postal_code),
        str(r.country),
        str(r.region),
        str(r.phone),
        str(r.fax),
        str(r.email),
        str(r.website),
        str(r.hours),
        socialObj(r.social),
        JSON.stringify(r),
      ],
    );

    if (result.rows[0]?.inserted) inserted++;
    else updated++;
  }

  console.log(`  [${source}] ${path}: inserted=${inserted} updated=${updated} skipped=${skipped} total_in_file=${records.length}`);
  return inserted + updated;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("usage: tsx scripts/seed-intel-operators.ts <source-key>:<path-to-json> [...]");
    process.exit(2);
  }

  let total = 0;
  for (const arg of args) {
    const colonAt = arg.indexOf(":");
    if (colonAt <= 0) {
      console.error(`bad arg "${arg}" — expected <source-key>:<path>`);
      process.exit(2);
    }
    const source = arg.slice(0, colonAt);
    const path = arg.slice(colonAt + 1);
    total += await loadFile(path, source);
  }

  const pool = await getDb();
  const { rows } = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM intel_operators`);
  console.log(`\nupserted ${total} rows. table now has ${rows[0]?.count ?? "?"} operators.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
