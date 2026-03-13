import { randomUUID } from "crypto";
import type { Adapter, AdapterUser, AdapterAccount } from "next-auth/adapters";
import { getDb } from "./db";

export function PostgresAdapter(): Adapter {
  return {
    async createUser(user) {
      console.log(`[auth-adapter] createUser: email=${user.email}`);
      const pool = await getDb();
      const id = randomUUID();
      await pool.query(
        `INSERT INTO users (id, email, name, image, email_verified) VALUES ($1, $2, $3, $4, $5)`,
        [id, user.email, user.name ?? null, user.image ?? null, user.emailVerified?.toISOString() ?? null]
      );

      // Auto-assign admin role
      if (process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL) {
        await pool.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [id]);
      }

      // Create 14-day trial subscription
      const trialStart = new Date().toISOString();
      const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      await pool.query(
        `INSERT INTO subscriptions (id, user_id, status, trial_start, trial_end) VALUES ($1, $2, 'trialing', $3, $4)`,
        [`trial_${id}`, id, trialStart, trialEnd]
      );

      return {
        id,
        email: user.email,
        name: user.name ?? null,
        image: user.image ?? null,
        emailVerified: user.emailVerified ?? null,
      };
    },

    async getUser(id) {
      const pool = await getDb();
      const { rows } = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
      if (!rows[0]) return null;
      return toAdapterUser(rows[0]);
    },

    async getUserByEmail(email) {
      const pool = await getDb();
      const { rows } = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
      console.log(`[auth-adapter] getUserByEmail: email=${email}, found=${!!rows[0]}`);
      if (!rows[0]) return null;
      return toAdapterUser(rows[0]);
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const pool = await getDb();
      const { rows } = await pool.query(
        `SELECT u.* FROM users u JOIN accounts a ON u.id = a.user_id WHERE a.provider = $1 AND a.provider_account_id = $2`,
        [provider, providerAccountId]
      );
      if (!rows[0]) return null;
      return toAdapterUser(rows[0]);
    },

    async updateUser(user) {
      const pool = await getDb();
      const { rows: existing } = await pool.query(`SELECT * FROM users WHERE id = $1`, [user.id]);
      const ex = existing[0];
      await pool.query(
        `UPDATE users SET name = $1, email = $2, image = $3, email_verified = $4, updated_at = NOW() WHERE id = $5`,
        [
          user.name ?? ex.name,
          user.email ?? ex.email,
          user.image ?? ex.image,
          user.emailVerified?.toISOString() ?? ex.email_verified,
          user.id,
        ]
      );
      const { rows: updated } = await pool.query(`SELECT * FROM users WHERE id = $1`, [user.id]);
      return toAdapterUser(updated[0]);
    },

    async deleteUser(id) {
      const pool = await getDb();
      await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
      return null;
    },

    async linkAccount(account) {
      const pool = await getDb();
      const id = randomUUID();
      await pool.query(
        `INSERT INTO accounts (id, user_id, type, provider, provider_account_id, refresh_token, access_token, expires_at, token_type, scope, id_token)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
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
          account.id_token ?? null,
        ]
      );
      return account as AdapterAccount;
    },

    async unlinkAccount({ provider, providerAccountId }) {
      const pool = await getDb();
      await pool.query(
        `DELETE FROM accounts WHERE provider = $1 AND provider_account_id = $2`,
        [provider, providerAccountId]
      );
      return undefined;
    },

    async createSession(session) {
      console.log(`[auth-adapter] createSession: userId=${session.userId}`);
      const pool = await getDb();
      await pool.query(
        `INSERT INTO sessions (session_token, user_id, expires) VALUES ($1, $2, $3)`,
        [session.sessionToken, session.userId, session.expires.toISOString()]
      );
      return session;
    },

    async getSessionAndUser(sessionToken) {
      const pool = await getDb();
      const { rows } = await pool.query(
        `SELECT s.session_token, s.user_id, s.expires, u.* FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.session_token = $1`,
        [sessionToken]
      );
      if (!rows[0]) return null;
      const row = rows[0];
      return {
        session: {
          sessionToken: row.session_token,
          userId: row.user_id,
          expires: new Date(row.expires),
        },
        user: toAdapterUser(row),
      };
    },

    async updateSession(session) {
      if (session.expires) {
        const pool = await getDb();
        await pool.query(
          `UPDATE sessions SET expires = $1 WHERE session_token = $2`,
          [session.expires.toISOString(), session.sessionToken]
        );
      }
      return null;
    },

    async deleteSession(sessionToken) {
      const pool = await getDb();
      await pool.query(`DELETE FROM sessions WHERE session_token = $1`, [sessionToken]);
      return null;
    },

    async createVerificationToken(token) {
      console.log(`[auth-adapter] createVerificationToken: identifier=${token.identifier}, expires=${token.expires.toISOString()}`);
      const pool = await getDb();
      await pool.query(
        `INSERT INTO verification_tokens (identifier, token, expires) VALUES ($1, $2, $3)`,
        [token.identifier, token.token, token.expires.toISOString()]
      );
      return token;
    },

    async useVerificationToken({ identifier, token }) {
      console.log(`[auth-adapter] useVerificationToken: identifier=${identifier}, token=${token.substring(0, 8)}...`);
      const pool = await getDb();
      const { rows } = await pool.query(
        `SELECT * FROM verification_tokens WHERE identifier = $1 AND token = $2`,
        [identifier, token]
      );
      const row = rows[0] as { identifier: string; token: string; expires: string } | undefined;
      console.log(`[auth-adapter] useVerificationToken result: ${row ? `found, expires=${row.expires}` : "NOT FOUND"}`);
      if (!row) return null;
      await pool.query(
        `DELETE FROM verification_tokens WHERE identifier = $1 AND token = $2`,
        [identifier, token]
      );
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
