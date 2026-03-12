import { randomUUID } from "crypto";
import type { Adapter, AdapterUser, AdapterAccount } from "next-auth/adapters";
import { getDb } from "./db";

export function SQLiteAdapter(): Adapter {
  const db = getDb();

  return {
    createUser(user) {
      console.log(`[auth-adapter] createUser: email=${user.email}`);
      const id = randomUUID();
      db.prepare(
        `INSERT INTO users (id, email, name, image, email_verified) VALUES (?, ?, ?, ?, ?)`
      ).run(id, user.email, user.name ?? null, user.image ?? null, user.emailVerified?.toISOString() ?? null);

      // Auto-assign admin role
      if (process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL) {
        db.prepare(`UPDATE users SET role = 'admin' WHERE id = ?`).run(id);
      }

      // Create 14-day trial subscription
      const trialStart = new Date().toISOString();
      const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      db.prepare(
        `INSERT INTO subscriptions (id, user_id, status, trial_start, trial_end) VALUES (?, ?, 'trialing', ?, ?)`
      ).run(`trial_${id}`, id, trialStart, trialEnd);

      return {
        id,
        email: user.email,
        name: user.name ?? null,
        image: user.image ?? null,
        emailVerified: user.emailVerified ?? null,
      };
    },

    getUser(id) {
      const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as Record<string, string> | undefined;
      if (!row) return null;
      return toAdapterUser(row);
    },

    getUserByEmail(email) {
      const row = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email) as Record<string, string> | undefined;
      console.log(`[auth-adapter] getUserByEmail: email=${email}, found=${!!row}`);
      if (!row) return null;
      return toAdapterUser(row);
    },

    getUserByAccount({ provider, providerAccountId }) {
      const row = db.prepare(
        `SELECT u.* FROM users u JOIN accounts a ON u.id = a.user_id WHERE a.provider = ? AND a.provider_account_id = ?`
      ).get(provider, providerAccountId) as Record<string, string> | undefined;
      if (!row) return null;
      return toAdapterUser(row);
    },

    updateUser(user) {
      const existing = db.prepare(`SELECT * FROM users WHERE id = ?`).get(user.id) as Record<string, string>;
      db.prepare(
        `UPDATE users SET name = ?, email = ?, image = ?, email_verified = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(
        user.name ?? existing.name,
        user.email ?? existing.email,
        user.image ?? existing.image,
        user.emailVerified?.toISOString() ?? existing.email_verified,
        user.id
      );
      const updated = db.prepare(`SELECT * FROM users WHERE id = ?`).get(user.id) as Record<string, string>;
      return toAdapterUser(updated);
    },

    deleteUser(id) {
      db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
      return null;
    },

    linkAccount(account) {
      const id = randomUUID();
      db.prepare(
        `INSERT INTO accounts (id, user_id, type, provider, provider_account_id, refresh_token, access_token, expires_at, token_type, scope, id_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        account.userId,
        account.type,
        account.provider,
        account.providerAccountId,
        account.refresh_token ?? null,
        account.access_token ?? null,
        account.expires_at ?? null,
        account.token_type ?? null,
        account.scope ?? null,
        account.id_token ?? null
      );
      return account as AdapterAccount;
    },

    unlinkAccount({ provider, providerAccountId }) {
      db.prepare(
        `DELETE FROM accounts WHERE provider = ? AND provider_account_id = ?`
      ).run(provider, providerAccountId);
      return undefined;
    },

    createSession(session) {
      console.log(`[auth-adapter] createSession: userId=${session.userId}`);
      db.prepare(
        `INSERT INTO sessions (session_token, user_id, expires) VALUES (?, ?, ?)`
      ).run(session.sessionToken, session.userId, session.expires.toISOString());
      return session;
    },

    getSessionAndUser(sessionToken) {
      const row = db.prepare(
        `SELECT s.session_token, s.user_id, s.expires, u.* FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.session_token = ?`
      ).get(sessionToken) as Record<string, string> | undefined;
      if (!row) return null;
      return {
        session: {
          sessionToken: row.session_token,
          userId: row.user_id,
          expires: new Date(row.expires),
        },
        user: toAdapterUser(row),
      };
    },

    updateSession(session) {
      if (session.expires) {
        db.prepare(`UPDATE sessions SET expires = ? WHERE session_token = ?`).run(
          session.expires.toISOString(),
          session.sessionToken
        );
      }
      return null;
    },

    deleteSession(sessionToken) {
      db.prepare(`DELETE FROM sessions WHERE session_token = ?`).run(sessionToken);
      return null;
    },

    createVerificationToken(token) {
      console.log(`[auth-adapter] createVerificationToken: identifier=${token.identifier}, expires=${token.expires.toISOString()}`);
      db.prepare(
        `INSERT INTO verification_tokens (identifier, token, expires) VALUES (?, ?, ?)`
      ).run(token.identifier, token.token, token.expires.toISOString());
      return token;
    },

    useVerificationToken({ identifier, token }) {
      console.log(`[auth-adapter] useVerificationToken: identifier=${identifier}, token=${token.substring(0, 8)}...`);
      const row = db.prepare(
        `SELECT * FROM verification_tokens WHERE identifier = ? AND token = ?`
      ).get(identifier, token) as { identifier: string; token: string; expires: string } | undefined;
      console.log(`[auth-adapter] useVerificationToken result: ${row ? `found, expires=${row.expires}` : "NOT FOUND"}`);
      if (!row) return null;
      db.prepare(
        `DELETE FROM verification_tokens WHERE identifier = ? AND token = ?`
      ).run(identifier, token);
      return { identifier: row.identifier, token: row.token, expires: new Date(row.expires) };
    },
  };
}

function toAdapterUser(row: Record<string, string>): AdapterUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name || null,
    image: row.image || null,
    emailVerified: row.email_verified ? new Date(row.email_verified) : null,
  };
}
