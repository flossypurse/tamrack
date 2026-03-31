import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

// GET /api/admin/crm/activities?contact_id=123
export async function GET(req: NextRequest) {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  const pool = await getDb();
  const contactId = new URL(req.url).searchParams.get("contact_id");

  if (!contactId) {
    return NextResponse.json({ error: "contact_id is required" }, { status: 400 });
  }

  const { rows } = await pool.query(
    `SELECT * FROM crm_activities WHERE contact_id = $1 ORDER BY created_at DESC`,
    [contactId]
  );

  return NextResponse.json(rows);
}

// POST /api/admin/crm/activities — add activity to contact
export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  const pool = await getDb();
  const { contact_id, type, content } = await req.json();

  if (!contact_id || !content) {
    return NextResponse.json({ error: "contact_id and content are required" }, { status: 400 });
  }

  const { rows } = await pool.query(
    `INSERT INTO crm_activities (contact_id, type, content) VALUES ($1, $2, $3) RETURNING *`,
    [contact_id, type || "note", content]
  );

  // Touch the contact's updated_at
  await pool.query(`UPDATE crm_contacts SET updated_at = NOW() WHERE id = $1`, [contact_id]);

  return NextResponse.json(rows[0], { status: 201 });
}
