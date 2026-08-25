import { env } from 'cloudflare:workers';

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
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS drafts (
      id TEXT PRIMARY KEY NOT NULL,
      admin_token TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      draft_type TEXT NOT NULL,
      team_count INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'collecting',
      result_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY NOT NULL,
      draft_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS captains (
      id TEXT PRIMARY KEY NOT NULL,
      draft_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      team_index INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      submitted_at TEXT,
      FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
      UNIQUE (draft_id, team_index),
      UNIQUE (draft_id, player_id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS rankings (
      captain_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      rank INTEGER NOT NULL,
      avoid INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (captain_id, player_id),
      FOREIGN KEY (captain_id) REFERENCES captains(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    )`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_players_draft_id ON players(draft_id)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_captains_draft_id ON captains(draft_id)'),
  ]);
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
