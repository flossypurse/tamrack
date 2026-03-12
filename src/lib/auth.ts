import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import Google from "next-auth/providers/google";
import { SQLiteAdapter } from "./auth-adapter";
import { getDb } from "./db";

// Send magic link via Mailgun HTTP API (avoids SMTP port issues on Railway)
async function sendVerificationRequest(params: {
  identifier: string;
  url: string;
  provider: { from?: string };
  token: string;
  theme: { colorScheme?: string; logo?: string; brandColor?: string };
  request: Request;
}) {
  const { identifier: email, url } = params;
  const domain = process.env.MAILGUN_DOMAIN || "email.albertapulsecheck.ca";
  const apiKey = process.env.MAILGUN_API_KEY;
  const from = process.env.EMAIL_FROM || "Alberta Pulse <noreply@email.albertapulsecheck.ca>";

  if (!apiKey) {
    // Fallback: log the link for development
    console.log(`[auth] Magic link for ${email}: ${url}`);
    return;
  }

  const body = new FormData();
  body.append("from", from);
  body.append("to", email);
  body.append("subject", "Sign in to Alberta Pulse Check");
  body.append(
    "html",
    `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="font-size: 20px; font-weight: 600; color: #1a1a2e; margin: 0;">Alberta Pulse Check</h1>
        <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Economic intelligence for Alberta</p>
      </div>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">Click the button below to sign in. This link expires in 24 hours.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${url}" style="display: inline-block; padding: 12px 32px; background-color: #005daa; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Sign in</a>
      </div>
      <p style="color: #9ca3af; font-size: 12px; line-height: 1.5;">If you didn't request this email, you can safely ignore it.<br/>This link can only be used once.</p>
    </div>`
  );

  const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[auth] Mailgun error: ${res.status} ${text}`);
    throw new Error(`Failed to send magic link email: ${res.status}`);
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  debug: true,
  trustHost: true,
  adapter: SQLiteAdapter(),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Nodemailer({
      // Server config is unused when sendVerificationRequest is provided,
      // but NextAuth requires it to be present
      server: "smtp://unused:unused@localhost:25",
      from: process.env.EMAIL_FROM || "Alberta Pulse <noreply@email.albertapulsecheck.ca>",
      sendVerificationRequest,
    }),
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      console.log(`[auth] signIn callback: user=${user?.email}, provider=${account?.provider}`);
      return true;
    },

    async redirect({ url, baseUrl }) {
      console.log(`[auth] redirect callback: url=${url}, baseUrl=${baseUrl}`);
      // Allow relative URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allow same-origin URLs
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },

    async jwt({ token, user, trigger }) {
      console.log(`[auth] jwt callback: trigger=${trigger}, hasUser=${!!user}, sub=${token.sub}`);
      try {
        // On sign-in or explicit update, load fresh data
        if (user || trigger === "update") {
          const userId = (user?.id ?? token.sub) as string;
          console.log(`[auth] jwt: loading user data for ${userId}`);
          const db = getDb();

          const dbUser = db.prepare(`SELECT role FROM users WHERE id = ?`).get(userId) as { role: string } | undefined;
          const sub = db.prepare(
            `SELECT status, trial_end, current_period_end, cancel_at_period_end FROM subscriptions WHERE user_id = ?`
          ).get(userId) as {
            status: string;
            trial_end: string | null;
            current_period_end: string | null;
            cancel_at_period_end: number;
          } | undefined;

          console.log(`[auth] jwt: role=${dbUser?.role}, subStatus=${sub?.status}, trialEnd=${sub?.trial_end}`);
          token.role = dbUser?.role ?? "user";
          token.subscriptionStatus = sub?.status ?? "none";
          token.trialEnd = sub?.trial_end ?? null;
          token.currentPeriodEnd = sub?.current_period_end ?? null;
          token.cancelAtPeriodEnd = sub?.cancel_at_period_end === 1;
        }
      } catch (err) {
        console.error(`[auth] jwt callback ERROR:`, err);
      }
      return token;
    },

    async session({ session, token }) {
      console.log(`[auth] session callback: sub=${token.sub}`);
      session.user.id = token.sub as string;
      session.user.role = token.role as string;
      session.user.subscriptionStatus = token.subscriptionStatus as string;
      session.user.trialEnd = token.trialEnd as string | null;
      session.user.currentPeriodEnd = token.currentPeriodEnd as string | null;
      session.user.cancelAtPeriodEnd = token.cancelAtPeriodEnd as boolean;
      return session;
    },
  },
});

// Type augmentation
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      subscriptionStatus: string;
      trialEnd: string | null;
      currentPeriodEnd: string | null;
      cancelAtPeriodEnd: boolean;
    };
  }
}

declare module "next-auth" {
  interface JWT {
    role?: string;
    subscriptionStatus?: string;
    trialEnd?: string | null;
    currentPeriodEnd?: string | null;
    cancelAtPeriodEnd?: boolean;
  }
}
