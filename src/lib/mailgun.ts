// Shared Mailgun HTTP-API helper.
//
// Single source of truth for outbound email. Both NextAuth's magic-link
// flow (src/lib/auth.ts) and the access-request notifications go through
// `sendMail`. The access-request Resonate workflow (iter 3) will call
// the helpers further down for admin notification + requester approval.
//
// Failure semantics: `sendMail` NEVER throws. On HTTP non-2xx it returns
// `{ ok: false, error }` and lets callers decide. The workflow owns retry
// (Resonate-default exp backoff); ad-hoc callers can log + carry on.

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  from?: string;
}

export interface SendMailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const domain = process.env.MAILGUN_DOMAIN || "email.tamrack.ca";
  const apiKey = process.env.MAILGUN_API_KEY;
  const from = input.from || process.env.EMAIL_FROM || "Tamrack <noreply@email.tamrack.ca>";

  if (!apiKey) {
    // Dev fallback: log instead of sending so local flows still work.
    console.log(
      `[mailgun] (no MAILGUN_API_KEY) to=${input.to} subject=${JSON.stringify(input.subject)}`
    );
    return { ok: true, messageId: undefined };
  }

  const body = new FormData();
  body.append("from", from);
  body.append("to", input.to);
  body.append("subject", input.subject);
  body.append("html", input.html);
  if (input.text) body.append("text", input.text);
  if (input.replyTo) body.append("h:Reply-To", input.replyTo);

  let res: Response;
  try {
    res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
      },
      body,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[mailgun] network error: ${msg}`);
    return { ok: false, error: `network: ${msg}` };
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`[mailgun] HTTP ${res.status}: ${errText}`);
    return { ok: false, error: `${res.status} ${errText}` };
  }

  let messageId: string | undefined;
  try {
    const json = (await res.json()) as { id?: string };
    messageId = json.id;
  } catch {
    // Mailgun returned 2xx without parseable JSON — still a success.
  }

  return { ok: true, messageId };
}

// ---------------------------------------------------------------------------
// Access-request helpers (iter 2 prep; wired by Resonate workflow in iter 3).
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface AdminNotificationInput {
  name: string;
  email: string;
  intent?: string;
  adminUrl: string;
}

/**
 * Email Cully (or whoever NOTIFY_TO points at) that a new access request
 * has landed. Reply-To is set to the requester so a one-tap reply lands
 * in their inbox.
 */
export async function sendAccessRequestAdminNotification(
  input: AdminNotificationInput
): Promise<SendMailResult> {
  const to = process.env.NOTIFY_TO || "cullywakelin@gmail.com";
  const intentLine = input.intent && input.intent.length > 0 ? input.intent : "(no intent provided)";
  const subject = `Tamrack access request: ${input.name}`;

  const text = `Name: ${input.name}\nEmail: ${input.email}\n\nIntent:\n${intentLine}\n\nReview: ${input.adminUrl}\n`;

  const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="font-size: 20px; font-weight: 600; color: #1a1a2e; margin: 0;">Tamrack</h1>
      <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">New access request</p>
    </div>
    <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 4px 0;"><strong>Name:</strong> ${escapeHtml(input.name)}</p>
      <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 4px 0;"><strong>Email:</strong> ${escapeHtml(input.email)}</p>
      <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 16px 0 4px 0;"><strong>Intent:</strong></p>
      <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${escapeHtml(intentLine)}</p>
    </div>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${input.adminUrl}" style="display: inline-block; padding: 12px 32px; background-color: #005daa; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Review request</a>
    </div>
    <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; text-align: center;">Reply directly to message the requester.</p>
  </div>`;

  return sendMail({
    to,
    subject,
    html,
    text,
    replyTo: input.email,
  });
}

export interface AccessApprovalInput {
  name: string;
  email: string;
  inviteUrl: string;
}

/**
 * Email the requester their invite URL once Cully has approved them.
 * Subject is declarative (Cully voice — no exclamation).
 */
export async function sendAccessRequestApproval(
  input: AccessApprovalInput
): Promise<SendMailResult> {
  const subject = "Your Tamrack access is ready";

  const text = `Hi ${input.name},\n\nYour Tamrack access is ready. Click the link below to claim your invite:\n\n${input.inviteUrl}\n\nThis link can only be used once.\n`;

  const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="font-size: 20px; font-weight: 600; color: #1a1a2e; margin: 0;">Tamrack</h1>
      <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Community intelligence for Alberta</p>
    </div>
    <p style="color: #374151; font-size: 15px; line-height: 1.6;">Hi ${escapeHtml(input.name)}, your Tamrack access is ready.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${input.inviteUrl}" style="display: inline-block; padding: 12px 32px; background-color: #005daa; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Click to claim your invite</a>
    </div>
    <p style="color: #9ca3af; font-size: 12px; line-height: 1.5;">This link can only be used once.<br/>If the button doesn't work, paste this URL into your browser:<br/><span style="color: #6b7280; word-break: break-all;">${escapeHtml(input.inviteUrl)}</span></p>
  </div>`;

  return sendMail({
    to: input.email,
    subject,
    html,
    text,
  });
}
