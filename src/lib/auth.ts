import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import Google from "next-auth/providers/google";
import { SQLiteAdapter } from "./auth-adapter";
import { getDb } from "./db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: SQLiteAdapter(),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Nodemailer({
      server: {
        host: process.env.MAILGUN_SMTP_HOST,
        port: Number(process.env.MAILGUN_SMTP_PORT || 587),
        auth: {
          user: process.env.MAILGUN_SMTP_USER,
          pass: process.env.MAILGUN_SMTP_PASS,
        },
      },
      from: process.env.EMAIL_FROM,
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
    async jwt({ token, user, trigger }) {
      // On sign-in or explicit update, load fresh data
      if (user || trigger === "update") {
        const userId = (user?.id ?? token.sub) as string;
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

        token.role = dbUser?.role ?? "user";
        token.subscriptionStatus = sub?.status ?? "none";
        token.trialEnd = sub?.trial_end ?? null;
        token.currentPeriodEnd = sub?.current_period_end ?? null;
        token.cancelAtPeriodEnd = sub?.cancel_at_period_end === 1;
      }
      return token;
    },

    async session({ session, token }) {
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
