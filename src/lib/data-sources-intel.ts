/**
 * Named-entity intel layer.
 *
 * Reads from the `intel_operators` Postgres table, seeded out-of-band from a
 * private workspace source by `scripts/seed-intel-operators.ts`. Consumers
 * (currently the `alberta_entities` MCP tool) call the functions here; they
 * never reach into the seed source.
 */
import { getDb } from "./db";

export type IntelOperatorSource = "aba" | "gprc";

export interface IntelOperator {
  id: string;
  source: IntelOperatorSource | string;
  source_member_id: string | null;
  source_url: string | null;
  name: string;
  description: string | null;
  categories: string[];
  street_address: string | null;
  address_line2: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  region: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  website: string | null;
  hours: string | null;
  social: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

export interface IntelOperatorFilters {
  name_query?: string;
  category?: string;
  city?: string;
  source?: IntelOperatorSource | "all";
  has_email?: boolean;
  has_website?: boolean;
  limit?: number;
  offset?: number;
}

const ROW_FIELDS = `
  id,
  source,
  source_member_id,
  source_url,
  name,
  description,
  categories,
  street_address,
  address_line2,
  city,
  postal_code,
  country,
  region,
  phone,
  fax,
  email,
  website,
  hours,
  social,
  created_at,
  updated_at
`;

export async function searchIntelOperators(
  filters: IntelOperatorFilters = {},
): Promise<{ rows: IntelOperator[]; total: number }> {
  const pool = await getDb();

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.name_query) {
    params.push(`%${filters.name_query.toLowerCase()}%`);
    conditions.push(`LOWER(name) LIKE $${params.length}`);
  }
  if (filters.category) {
    params.push(filters.category);
    conditions.push(`$${params.length} = ANY(categories)`);
  }
  if (filters.city) {
    params.push(filters.city.toLowerCase());
    conditions.push(`LOWER(city) = $${params.length}`);
  }
  if (filters.source && filters.source !== "all") {
    params.push(filters.source);
    conditions.push(`source = $${params.length}`);
  }
  if (filters.has_email) {
    conditions.push(`email IS NOT NULL AND email <> ''`);
  }
  if (filters.has_website) {
    conditions.push(`website IS NOT NULL AND website <> ''`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);

  const countParams = [...params];
  const { rows: countRows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM intel_operators ${where}`,
    countParams,
  );
  const total = parseInt(countRows[0]?.count ?? "0", 10);

  params.push(limit, offset);
  const { rows } = await pool.query<IntelOperator>(
    `SELECT ${ROW_FIELDS}
     FROM intel_operators
     ${where}
     ORDER BY name
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return { rows, total };
}

export async function getIntelOperator(id: string): Promise<IntelOperator | null> {
  const pool = await getDb();
  const { rows } = await pool.query<IntelOperator>(
    `SELECT ${ROW_FIELDS} FROM intel_operators WHERE id = $1 LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function listOperatorCategories(): Promise<{ category: string; count: number }[]> {
  const pool = await getDb();
  const { rows } = await pool.query<{ category: string; count: string }>(
    `SELECT category, COUNT(*)::text AS count
     FROM intel_operators, UNNEST(categories) AS category
     GROUP BY category
     ORDER BY COUNT(*) DESC, category ASC`,
  );
  return rows.map((r) => ({ category: r.category, count: parseInt(r.count, 10) }));
}
