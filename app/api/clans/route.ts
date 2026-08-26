import { requireSessionUser } from '../../../lib/auth';
import { recordAudit } from '../../../lib/audit';
import { ensureSchema, getDatabase, json } from '../../../lib/db';
import { enforceRateLimit, RateLimitError, rateLimitResponse } from '../../../lib/rate-limit';

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const user = await requireSessionUser(request);
    const result = await getDatabase()
      .prepare(
        `SELECT c.id, c.name, c.slug, cm.role, c.created_at, c.updated_at
         FROM clan_memberships cm JOIN clans c ON c.id = cm.clan_id
         WHERE cm.user_id = ? ORDER BY c.name`,
      )
      .bind(user.id)
      .all();
    return json({ clans: result.results });
  } catch (error) {
    return authError(error, 'Clans could not be loaded.');
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const user = await requireSessionUser(request);
    await enforceRateLimit({ request, scope: 'create-clan', limit: 5, windowSeconds: 3600, subject: user.id });
    const body = (await request.json()) as { name?: unknown };
    const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ').slice(0, 60) : '';
    if (name.length < 2) return json({ error: 'Enter a clan name with at least two characters.' }, { status: 400 });
    const db = getDatabase();
    const slug = await uniqueSlug(name);
    const clanId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.batch([
      db
        .prepare(
          `INSERT INTO clans (id, name, slug, created_by_user_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(clanId, name, slug, user.id, now, now),
      db
        .prepare(
          `INSERT INTO clan_memberships (clan_id, user_id, role, created_at)
           VALUES (?, ?, 'owner', ?)`,
        )
        .bind(clanId, user.id, now),
    ]);
    await recordAudit(db, {
      clanId,
      actorUserId: user.id,
      actorType: 'organizer',
      eventType: 'clan.created',
      metadata: { name },
    });
    return json({ clan: { id: clanId, name, slug, role: 'owner' } }, { status: 201 });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    return authError(error, 'The clan could not be created.');
  }
}

async function uniqueSlug(name: string) {
  const base = name.toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36) || 'clan';
  const db = getDatabase();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = attempt ? `-${attempt + 1}` : '';
    const slug = `${base.slice(0, 40 - suffix.length)}${suffix}`;
    if (!(await db.prepare('SELECT id FROM clans WHERE slug = ?').bind(slug).first())) return slug;
  }
  return `${base.slice(0, 28)}-${crypto.randomUUID().slice(0, 8)}`;
}

function authError(error: unknown, fallback: string) {
  const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
  const message = error instanceof Error && status < 500 ? error.message : fallback;
  if (status >= 500) console.error(fallback, error);
  return json({ error: message }, { status });
}
