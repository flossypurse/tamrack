import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GET /api/admin/crm — list contacts with latest activity
export async function GET(req: NextRequest) {
  const pool = await getDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const q = searchParams.get("q");

  let sql = `
    SELECT c.*,
      (SELECT content FROM crm_activities a WHERE a.contact_id = c.id ORDER BY a.created_at DESC LIMIT 1) as last_activity,
      (SELECT created_at FROM crm_activities a WHERE a.contact_id = c.id ORDER BY a.created_at DESC LIMIT 1) as last_activity_at
    FROM crm_contacts c
    WHERE 1=1
  `;
  const params: (string | number)[] = [];
  let idx = 1;

  if (status) {
    sql += ` AND c.status = $${idx++}`;
    params.push(status);
  }
  if (q) {
    sql += ` AND (c.name ILIKE $${idx} OR c.email ILIKE $${idx} OR c.organization ILIKE $${idx} OR c.municipality ILIKE $${idx})`;
    params.push(`%${q}%`);
    idx++;
  }

  sql += ` ORDER BY c.updated_at DESC`;

  const { rows } = await pool.query(sql, params);

  // Pipeline counts
  const { rows: pipeline } = await pool.query(
    `SELECT status, COUNT(*)::int as count FROM crm_contacts GROUP BY status ORDER BY status`
  );

  return NextResponse.json({ contacts: rows, pipeline });
}

// POST /api/admin/crm — create contact
export async function POST(req: NextRequest) {
  const pool = await getDb();
  const body = await req.json();
  const { name, email, phone, organization, role, municipality, status, source, notes } = body;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const { rows } = await pool.query(
    `INSERT INTO crm_contacts (name, email, phone, organization, role, municipality, status, source, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [name, email || "", phone || "", organization || "", role || "", municipality || "", status || "lead", source || "", notes || ""]
  );

  // If notes provided, also create an initial activity
  if (notes) {
    await pool.query(
      `INSERT INTO crm_activities (contact_id, type, content) VALUES ($1, 'note', $2)`,
      [rows[0].id, notes]
    );
  }

  return NextResponse.json(rows[0], { status: 201 });
}

// PUT /api/admin/crm — update contact
export async function PUT(req: NextRequest) {
  const pool = await getDb();
  const body = await req.json();
  const { id, ...fields } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const allowed = ["name", "email", "phone", "organization", "role", "municipality", "status", "source", "notes"];
  const sets: string[] = [];
  const params: (string | number)[] = [];
  let idx = 1;

  for (const key of allowed) {
    if (key in fields) {
      sets.push(`${key} = $${idx++}`);
      params.push(fields[key]);
    }
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  sets.push(`updated_at = NOW()`);
  params.push(id);

  const { rows } = await pool.query(
    `UPDATE crm_contacts SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    params
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  return NextResponse.json(rows[0]);
}

// DELETE /api/admin/crm — delete contact
export async function DELETE(req: NextRequest) {
  const pool = await getDb();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await pool.query(`DELETE FROM crm_contacts WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
