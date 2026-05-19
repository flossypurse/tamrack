import { NextRequest, NextResponse } from "next/server";
import { sendMail } from "@/lib/mailgun";

// Basic email shape — good enough for placeholder gate; full validation
// lands when the Resonate workflow replaces the inline notification below.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(req: NextRequest) {
  let body: { name?: unknown; email?: unknown; intent?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const intent = typeof body.intent === "string" ? body.intent.trim() : "";

  if (!name || name.length > 200) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  if (!email || !EMAIL_RE.test(email) || email.length > 320) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (intent.length > 2000) {
    return NextResponse.json({ error: "Intent too long" }, { status: 400 });
  }

  // PLACEHOLDER — replaced by Resonate workflow in follow-up PR
  await sendNotification({ name, email, intent });

  return NextResponse.json({ ok: true }, { status: 202 });
}

async function sendNotification(req: { name: string; email: string; intent: string }) {
  const to = process.env.NOTIFY_TO || "cullywakelin@gmail.com";
  const subject = `Tamrack access request: ${req.name}`;
  const intentLine = req.intent ? req.intent : "(no intent provided)";
  const text = `Name: ${req.name}\nEmail: ${req.email}\n\nIntent:\n${intentLine}\n`;
  const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px 20px;">
    <h1 style="font-size: 18px; font-weight: 600; color: #1a1a2e; margin: 0 0 16px 0;">Tamrack access request</h1>
    <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 4px 0;"><strong>Name:</strong> ${escapeHtml(req.name)}</p>
    <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 4px 0;"><strong>Email:</strong> ${escapeHtml(req.email)}</p>
    <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 16px 0 4px 0;"><strong>Intent:</strong></p>
    <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${escapeHtml(intentLine)}</p>
  </div>`;

  // PLACEHOLDER — replaced by Resonate workflow in follow-up PR
  const result = await sendMail({
    to,
    subject,
    text,
    html,
    replyTo: req.email,
  });

  if (!result.ok) {
    // Don't fail the user — the form already collected the data.
    // Resonate workflow in follow-up PR will own retry semantics.
    console.error(`[access-request] sendMail failed: ${result.error}`);
  }
}
