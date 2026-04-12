import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const VALID_PRODUCTS = ["edo", "learn"] as const;

export async function POST(req: NextRequest) {
  const { email, product } = await req.json();

  if (!email || !product || !VALID_PRODUCTS.includes(product)) {
    return NextResponse.json({ error: "Invalid email or product" }, { status: 400 });
  }

  const pool = await getDb();

  await pool.query(
    `CREATE TABLE IF NOT EXISTS waitlists (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      product TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(email, product)
    )`
  );

  const { rowCount } = await pool.query(
    `SELECT 1 FROM waitlists WHERE email = $1 AND product = $2`,
    [email, product]
  );

  if (rowCount && rowCount > 0) {
    return NextResponse.json({ success: true, alreadyOnList: true });
  }

  await pool.query(
    `INSERT INTO waitlists (email, product) VALUES ($1, $2) ON CONFLICT (email, product) DO NOTHING`,
    [email, product]
  );

  return NextResponse.json({ success: true, alreadyOnList: false });
}
