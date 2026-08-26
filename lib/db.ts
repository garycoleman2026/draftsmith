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
      roster_mode TEXT NOT NULL DEFAULT 'import',
      signup_token TEXT,
      registration_open INTEGER NOT NULL DEFAULT 0,
      live_started_at TEXT,
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
      source TEXT NOT NULL DEFAULT 'import',
      created_at TEXT,
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
      score INTEGER,
      avoid INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (captain_id, player_id),
      FOREIGN KEY (captain_id) REFERENCES captains(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS survey_questions (
      id TEXT PRIMARY KEY NOT NULL,
      draft_id TEXT NOT NULL,
      label TEXT NOT NULL,
      field_type TEXT NOT NULL,
      required INTEGER NOT NULL DEFAULT 0,
      options_json TEXT,
      sort_order INTEGER NOT NULL,
      FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS survey_answers (
      question_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (question_id, player_id),
      FOREIGN KEY (question_id) REFERENCES survey_questions(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS draft_constraints (
      id TEXT PRIMARY KEY NOT NULL,
      draft_id TEXT NOT NULL,
      constraint_type TEXT NOT NULL,
      player_a_id TEXT NOT NULL,
      player_b_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE CASCADE,
      FOREIGN KEY (player_a_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY (player_b_id) REFERENCES players(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS live_picks (
      id TEXT PRIMARY KEY NOT NULL,
      draft_id TEXT NOT NULL,
      captain_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      pick_number INTEGER NOT NULL,
      turn_number INTEGER NOT NULL,
      picked_at TEXT NOT NULL,
      FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE CASCADE,
      FOREIGN KEY (captain_id) REFERENCES captains(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    )`),
  ]);

  await ensureColumn(db, 'drafts', 'roster_mode', "TEXT NOT NULL DEFAULT 'import'");
  await ensureColumn(db, 'drafts', 'signup_token', 'TEXT');
  await ensureColumn(db, 'drafts', 'registration_open', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'drafts', 'live_started_at', 'TEXT');
  await ensureColumn(db, 'players', 'source', "TEXT NOT NULL DEFAULT 'import'");
  await ensureColumn(db, 'players', 'created_at', 'TEXT');
  await ensureColumn(db, 'rankings', 'score', 'INTEGER');

  await db.batch([
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS drafts_signup_token_unique ON drafts(signup_token)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_players_draft_id ON players(draft_id)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_captains_draft_id ON captains(draft_id)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_survey_questions_draft_id ON survey_questions(draft_id)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_survey_answers_player_id ON survey_answers(player_id)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_draft_constraints_draft_id ON draft_constraints(draft_id)'),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS draft_constraints_pair_unique
      ON draft_constraints(draft_id, constraint_type, player_a_id, player_b_id)`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_live_picks_draft_id ON live_picks(draft_id)'),
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS live_picks_player_unique ON live_picks(draft_id, player_id)'),
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS live_picks_number_unique ON live_picks(draft_id, pick_number)'),
  ]);
  await db.prepare('PRAGMA optimize').run();
}

async function ensureColumn(
  db: D1Database,
  table: 'drafts' | 'players' | 'rankings',
  column: string,
  definition: string,
) {
  const info = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  if (!info.results.some((item) => item.name === column)) {
    await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
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
