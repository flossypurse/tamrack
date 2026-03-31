import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import * as nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// POST /api/admin/crm/send-email
export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  const { contact_id, to, subject, body } = await req.json();

  if (!to || !subject || !body) {
    return NextResponse.json(
      { error: "to, subject, and body are required" },
      { status: 400 }
    );
  }

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return NextResponse.json(
      { error: "Email service not configured" },
      { status: 500 }
    );
  }

  try {
    const info = await transporter.sendMail({
      from: `Cully Wakelin <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html: body.replace(/\n/g, "<br>"),
    });

    // Log the email as a CRM activity if we have a contact_id
    if (contact_id) {
      const pool = await getDb();
      await pool.query(
        `INSERT INTO crm_activities (contact_id, type, content) VALUES ($1, 'email', $2)`,
        [contact_id, `Subject: ${subject}\n\n${body}`]
      );
      await pool.query(
        `UPDATE crm_contacts SET updated_at = NOW() WHERE id = $1`,
        [contact_id]
      );
    }

    return NextResponse.json({
      ok: true,
      messageId: info.messageId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Email send failed:", message);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
