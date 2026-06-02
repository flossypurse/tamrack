/**
 * Transactional email helpers for auth flows.
 *
 * Wraps the existing mailgun.ts sendMail helper. Reads MAILGUN_* / EMAIL_FROM
 * from the environment (same as the existing mailgun integration) and APP_URL
 * at runtime for links.
 *
 * All helpers follow the same failure semantics as sendMail: they never throw,
 * returning { ok: false, error } on failure so callers can log and carry on.
 */
import { sendMail, type SendMailResult } from "./mailgun";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Returns the base APP_URL with no trailing slash. Falls back to localhost. */
function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

// ---------------------------------------------------------------------------
// Invite email
// ---------------------------------------------------------------------------

export interface SendInviteEmailInput {
  recipientEmail: string;
  signupUrl: string;
  /** Optional — used for personalisation if available. */
  recipientName?: string;
}

/**
 * Sends a signup invite email containing a tokenized link.
 * Note: the /signup page/route is not yet built and lands in a later iteration — the URL below is scaffolding.
 */
export async function sendInviteEmail(
  input: SendInviteEmailInput,
): Promise<SendMailResult> {
  const greeting = input.recipientName
    ? `Hi ${escapeHtml(input.recipientName)},`
    : "Hi,";
  const greetingText = input.recipientName
    ? `Hi ${input.recipientName},`
    : "Hi,";

  const subject = "Your Tamrack invite";

  const text = [
    greetingText,
    "",
    "You have been invited to Tamrack. Use the link below to set up your account.",
    "",
    input.signupUrl,
    "",
    "This link expires in 30 days and can only be used once.",
  ].join("\n");

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;">
  <div style="text-align:center;margin-bottom:32px;">
    <h1 style="font-size:20px;font-weight:600;color:#1a1a2e;margin:0;">Tamrack</h1>
    <p style="color:#6b7280;font-size:14px;margin-top:4px;">Alberta's data platform</p>
  </div>
  <p style="color:#374151;font-size:15px;line-height:1.6;">${greeting}</p>
  <p style="color:#374151;font-size:15px;line-height:1.6;">You have been invited to Tamrack. Click below to set up your account.</p>
  <div style="text-align:center;margin:32px 0;">
    <a href="${escapeHtml(input.signupUrl)}"
       style="display:inline-block;padding:12px 32px;background-color:#005daa;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
      Accept invite
    </a>
  </div>
  <p style="color:#9ca3af;font-size:12px;line-height:1.5;">
    This link expires in 30 days and can only be used once.<br/>
    If the button doesn't work, paste this URL into your browser:<br/>
    <span style="color:#6b7280;word-break:break-all;">${escapeHtml(input.signupUrl)}</span>
  </p>
</div>`;

  return sendMail({ to: input.recipientEmail, subject, html, text });
}

// ---------------------------------------------------------------------------
// Password-reset email
// ---------------------------------------------------------------------------

export interface SendPasswordResetEmailInput {
  recipientEmail: string;
  /** The raw reset token — appended to /reset-password?token= */
  resetToken: string;
}

/**
 * Sends a password-reset email. The reset link expires in 1 hour.
 * Note: the /reset-password page/route is not yet built and lands in a later iteration — the URL below is scaffolding.
 */
export async function sendPasswordResetEmail(
  input: SendPasswordResetEmailInput,
): Promise<SendMailResult> {
  const resetUrl = `${appUrl()}/reset-password?token=${encodeURIComponent(input.resetToken)}`;
  const subject = "Reset your Tamrack password";

  const text = [
    "You requested a password reset for your Tamrack account.",
    "",
    `Reset link: ${resetUrl}`,
    "",
    "This link expires in 1 hour and can only be used once.",
    "",
    "If you did not request this, you can ignore this email — your password has not changed.",
  ].join("\n");

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;">
  <div style="text-align:center;margin-bottom:32px;">
    <h1 style="font-size:20px;font-weight:600;color:#1a1a2e;margin:0;">Tamrack</h1>
    <p style="color:#6b7280;font-size:14px;margin-top:4px;">Password reset</p>
  </div>
  <p style="color:#374151;font-size:15px;line-height:1.6;">You requested a password reset for your Tamrack account.</p>
  <div style="text-align:center;margin:32px 0;">
    <a href="${escapeHtml(resetUrl)}"
       style="display:inline-block;padding:12px 32px;background-color:#005daa;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
      Reset password
    </a>
  </div>
  <p style="color:#9ca3af;font-size:12px;line-height:1.5;">
    This link expires in 1 hour and can only be used once.<br/>
    If you did not request this, you can ignore this email — your password has not changed.<br/><br/>
    If the button doesn't work, paste this URL into your browser:<br/>
    <span style="color:#6b7280;word-break:break-all;">${escapeHtml(resetUrl)}</span>
  </p>
</div>`;

  return sendMail({ to: input.recipientEmail, subject, html, text });
}
