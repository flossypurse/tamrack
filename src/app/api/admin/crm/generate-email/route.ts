import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

// POST /api/admin/crm/generate-email
export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  const { contact_id } = await req.json();

  if (!contact_id) {
    return NextResponse.json({ error: "contact_id is required" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Email generation service not configured" }, { status: 500 });
  }

  const pool = await getDb();

  // Fetch contact details
  const { rows: contactRows } = await pool.query(
    `SELECT * FROM crm_contacts WHERE id = $1`,
    [contact_id]
  );
  if (contactRows.length === 0) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }
  const contact = contactRows[0];

  // Fetch recent activity history for context
  const { rows: activityRows } = await pool.query(
    `SELECT type, content, created_at FROM crm_activities WHERE contact_id = $1 ORDER BY created_at DESC LIMIT 10`,
    [contact_id]
  );

  const activityContext = activityRows.length > 0
    ? activityRows.map((a: { type: string; content: string; created_at: string }) =>
        `[${a.type}] ${new Date(a.created_at).toLocaleDateString()}: ${a.content}`
      ).join("\n")
    : "No previous interactions.";

  const systemPrompt = `You are helping Cully Wakelin write outreach emails for Alberta Pulse (albertapulsecheck.ca), a data platform that provides free interactive charts and dashboards about Alberta's economy, real estate, demographics, energy, and municipalities.

Cully is a software engineer based in Parkland County, Alberta. He's building Alberta Pulse as a suite of tools:
- Pulse Charts: Free public charts and data visualizations covering 135+ pages of Alberta data
- Pulse EDO ($299/mo): Premium analytics for Economic Development Officers — community profiles, peer comparison, alerts, council-ready reports
- Pulse Real Estate ($49/mo): Market intelligence for real estate professionals — neighbourhood stats, listing presentation tools

The tone should be:
- Genuine and human — not salesy or corporate. Like a neighbour who built something useful and wants to share it.
- Brief — 3-5 short paragraphs max. Nobody reads long cold emails.
- Specific — reference their municipality, role, or organization if known. Show you did your homework.
- Value-first — lead with what they'd find useful, not what you're selling.
- No fake urgency, no "limited time offers", no "I'd love to pick your brain". Just be real.

The call to action should be soft — invite them to check out the site, offer a quick walkthrough, or ask if it'd be useful for their work. Don't push for a meeting.

Return ONLY valid JSON with two fields:
{
  "subject": "the email subject line",
  "body": "the email body as plain text with newlines"
}

Do not wrap in markdown code blocks. Just raw JSON.`;

  const userPrompt = `Generate an outreach email for this contact:

Name: ${contact.name}
Email: ${contact.email}
Organization: ${contact.organization || "Unknown"}
Role: ${contact.role || "Unknown"}
Municipality: ${contact.municipality || "Unknown"}
Source: ${contact.source || "Unknown"}
Pipeline status: ${contact.status}
Notes: ${contact.notes || "None"}

Previous interactions:
${activityContext}

${contact.status === "lead" ? "This is a first-touch cold email. Keep it warm and brief." : ""}
${contact.status === "contacted" ? "We've reached out before. This is a follow-up — reference that we connected previously." : ""}
${contact.status === "replied" ? "They've replied to us before. This should feel like continuing a conversation." : ""}
${contact.status === "demo" ? "We're at the demo stage. This should be about scheduling or following up on a demo." : ""}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [
          { role: "user", content: userPrompt },
        ],
        system: systemPrompt,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Anthropic API error:", err);
      return NextResponse.json({ error: "Failed to generate email" }, { status: 500 });
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || "";

    // Parse JSON from response (handle potential markdown wrapping)
    let parsed: { subject: string; body: string };
    try {
      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse LLM response:", text);
      return NextResponse.json({ error: "Failed to parse generated email" }, { status: 500 });
    }

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    console.error("Generate email failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to generate email" }, { status: 500 });
  }
}
