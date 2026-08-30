import { createHashedCredential } from '@/lib/access-tokens';
import { canManageBingoEvent, requireSessionUser } from '@/lib/auth';
import { ensureSchema, getDatabase, json } from '@/lib/db';
import type { BingoEventRole } from '@/lib/types';

type Context = { params: Promise<{ slug: string }> };

export async function GET(request: Request, context: Context) {
  try {
    await ensureSchema();
    const user = await requireSessionUser(request);
    const eventId = (await context.params).slug;
    const actorRole = await canManageBingoEvent(user.id, eventId, ['owner', 'organizer']);
    if (!actorRole) return json({ error: 'You cannot manage helpers for this bingo.' }, { status: 403 });
    const db = getDatabase();
    const [people, invites] = await Promise.all([
      db.prepare(`SELECT bec.user_id AS userId, bec.role, bec.created_at AS createdAt,
                         COALESCE(u.display_name, u.username) AS name
                  FROM bingo_event_collaborators bec JOIN users u ON u.id = bec.user_id
                  WHERE bec.event_id = ? ORDER BY bec.created_at`).bind(eventId).all(),
      db.prepare(`SELECT id, role, expires_at AS expiresAt, max_uses AS maxUses, use_count AS useCount, created_at AS createdAt
                  FROM bingo_event_invites WHERE event_id = ? AND revoked_at IS NULL AND expires_at > ? AND use_count < max_uses
                  ORDER BY created_at DESC`).bind(eventId, new Date().toISOString()).all(),
    ]);
    return json({ actorRole, collaborators: people.results, invites: invites.results });
  } catch (error) { return authError(error, 'Helpers could not be loaded.'); }
}

export async function POST(request: Request, context: Context) {
  try {
    await ensureSchema();
    const user = await requireSessionUser(request);
    const eventId = (await context.params).slug;
    const actorRole = await canManageBingoEvent(user.id, eventId, ['owner', 'organizer']);
    if (!actorRole) return json({ error: 'You cannot invite helpers to this bingo.' }, { status: 403 });
    const body = await request.json().catch(() => ({})) as { role?: unknown };
    const role: BingoEventRole = body.role === 'organizer' ? 'organizer' : 'scorekeeper';
    if (role === 'organizer' && actorRole !== 'owner') return json({ error: 'Only the event owner can invite another organizer.' }, { status: 403 });
    const credential = await createHashedCredential();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 14 * 86_400_000).toISOString();
    const id = crypto.randomUUID();
    await getDatabase().prepare(`INSERT INTO bingo_event_invites
      (id, event_id, token_hash, role, created_by_user_id, expires_at, max_uses, use_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 20, 0, ?)`)
      .bind(id, eventId, credential.hash, role, user.id, expiresAt, now.toISOString()).run();
    return json({ id, role, path: `/bingo/collaborate/${credential.token}`, expiresAt, maxUses: 20, useCount: 0 }, { status: 201 });
  } catch (error) { return authError(error, 'The helper link could not be created.'); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    await ensureSchema();
    const user = await requireSessionUser(request);
    const eventId = (await context.params).slug;
    const actorRole = await canManageBingoEvent(user.id, eventId, ['owner', 'organizer']);
    if (!actorRole) return json({ error: 'You cannot remove helpers from this bingo.' }, { status: 403 });
    const body = await request.json().catch(() => ({})) as { userId?: unknown; inviteId?: unknown };
    const db = getDatabase();
    if (typeof body.inviteId === 'string' && body.inviteId) {
      const invite = await db.prepare('SELECT role FROM bingo_event_invites WHERE id = ? AND event_id = ?')
        .bind(body.inviteId, eventId).first<{ role: BingoEventRole }>();
      if (invite?.role === 'organizer' && actorRole !== 'owner') return json({ error: 'Only the owner can revoke an organizer invitation.' }, { status: 403 });
      await db.prepare('UPDATE bingo_event_invites SET revoked_at = ? WHERE id = ? AND event_id = ?')
        .bind(new Date().toISOString(), body.inviteId, eventId).run();
      return json({ removed: true });
    }
    if (typeof body.userId === 'string' && body.userId) {
      const target = await db.prepare('SELECT role FROM bingo_event_collaborators WHERE event_id = ? AND user_id = ?')
        .bind(eventId, body.userId).first<{ role: BingoEventRole }>();
      if (target?.role === 'organizer' && actorRole !== 'owner') return json({ error: 'Only the owner can remove an organizer.' }, { status: 403 });
      await db.prepare('DELETE FROM bingo_event_collaborators WHERE event_id = ? AND user_id = ?').bind(eventId, body.userId).run();
      return json({ removed: true });
    }
    return json({ error: 'Choose a helper or invite to remove.' }, { status: 400 });
  } catch (error) { return authError(error, 'That helper could not be removed.'); }
}

function authError(error: unknown, fallback: string) {
  const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
  return json({ error: error instanceof Error && status < 500 ? error.message : fallback }, { status });
}
