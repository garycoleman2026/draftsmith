import { env } from 'cloudflare:workers';
import { hashToken } from './security';
import { normalizeRsn } from './validation';

let schemaPromise: Promise<void> | null = null;

export function getDatabase(): D1Database {
  if (!env.DB) {
    throw new Error('The draft database is not available.');
  }
  return env.DB;
}

export async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = initializeSchema().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

async function initializeSchema() {
  const db = getDatabase();
  // Schema changes are applied exclusively through the versioned Drizzle
  // migrations. Runtime initialization only upgrades legacy credential data.
  await db.prepare('SELECT id FROM drafts LIMIT 1').first();
  const [draftRows, captainRows, playerRows] = await Promise.all([
    db.prepare(`SELECT id, admin_token, admin_token_hash, signup_token, signup_token_hash
                FROM drafts
                WHERE admin_token_hash IS NULL OR (signup_token IS NOT NULL AND signup_token_hash IS NULL)`)
      .all<{ id: string; admin_token: string; admin_token_hash: string | null; signup_token: string | null; signup_token_hash: string | null }>(),
    db.prepare('SELECT id, token FROM captains WHERE token_hash IS NULL')
      .all<{ id: string; token: string }>(),
    db.prepare('SELECT id, name FROM players WHERE normalized_name IS NULL')
      .all<{ id: string; name: string }>(),
  ]);
  const upgrades: D1PreparedStatement[] = [];
  for (const row of draftRows.results) {
    if (!row.admin_token_hash) {
      upgrades.push(db.prepare('UPDATE drafts SET admin_token_hash = ?, admin_token = ? WHERE id = ?')
        .bind(await hashToken(row.admin_token), `retired:${row.id}`, row.id));
    }
    if (row.signup_token && !row.signup_token_hash) {
      upgrades.push(db.prepare('UPDATE drafts SET signup_token_hash = ?, signup_token = NULL WHERE id = ?')
        .bind(await hashToken(row.signup_token), row.id));
    }
  }
  for (const row of captainRows.results) {
    upgrades.push(db.prepare('UPDATE captains SET token_hash = ?, token = ? WHERE id = ?')
      .bind(await hashToken(row.token), `retired:${row.id}`, row.id));
  }
  for (const row of playerRows.results) {
    upgrades.push(db.prepare('UPDATE players SET normalized_name = ? WHERE id = ?')
      .bind(normalizeRsn(row.name), row.id));
  }
  if (upgrades.length) await db.batch(upgrades);
  await db.prepare('PRAGMA optimize').run();
}

export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function makeToken(length = 28) {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}
