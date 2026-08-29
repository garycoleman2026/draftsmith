import { requireClanRole } from '../../../../../lib/auth';
import { recordAudit } from '../../../../../lib/audit';
import { ensureSchema, getDatabase, json } from '../../../../../lib/db';

const ROLES = new Set(['owner', 'admin', 'captain', 'member']);

export async function GET(request: Request, context: { params: Promise<{ clanId: string }> }) {
  try {
    await ensureSchema();
    const { clanId } = await context.params;
    await requireClanRole(request, clanId, ['owner', 'admin', 'captain', 'member']);
    const result = await getDatabase()
      .prepare(
        `SELECT u.id, u.username, u.display_name, u.avatar_hash, cm.role, cm.created_at
         FROM clan_memberships cm JOIN users u ON u.id = cm.user_id
         WHERE cm.clan_id = ?
         ORDER BY CASE cm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'captain' THEN 2 ELSE 3 END,
                  COALESCE(u.display_name, u.username)`,
      )
      .bind(clanId)
      .all();
    return json({ members: result.results });
  } catch (error) {
    return routeError(error, 'Clan members could not be loaded.');
  }
}

export async function POST(request: Request, context: { params: Promise<{ clanId: string }> }) {
  try {
    await ensureSchema();
    const { clanId } = await context.params;
    const { user } = await requireClanRole(request, clanId, ['owner', 'admin']);
    const body = (await request.json()) as { discordId?: unknown; role?: unknown };
    const discordId = typeof body.discordId === 'string' ? body.discordId.trim() : '';
    const role = typeof body.role === 'string' && ROLES.has(body.role) ? body.role : 'member';
    if (!/^\d{15,22}$/.test(discordId)) {
      return json({ error: 'Enter the member’s numeric Discord user ID.' }, { status: 400 });
    }
    if (role === 'owner') return json({ error: 'Ownership is transferred separately.' }, { status: 400 });
    const db = getDatabase();
    const member = await db.prepare('SELECT id FROM users WHERE discord_id = ?').bind(discordId).first<{ id: string }>();
    if (!member) return json({ error: 'That person must sign in to Terry’s Drafting once before being added.' }, { status: 404 });
    const now = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO clan_memberships (clan_id, user_id, role, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(clan_id, user_id) DO UPDATE SET role = excluded.role`,
      )
      .bind(clanId, member.id, role, now)
      .run();
    await recordAudit(db, {
      clanId,
      actorUserId: user.id,
      actorType: 'organizer',
      eventType: 'clan.member_saved',
      metadata: { memberUserId: member.id, role },
    });
    return json({ saved: true });
  } catch (error) {
    return routeError(error, 'The clan member could not be saved.');
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ clanId: string }> }) {
  try {
    await ensureSchema();
    const { clanId } = await context.params;
    const { user, role: actorRole } = await requireClanRole(request, clanId, ['owner', 'admin']);
    const body = (await request.json()) as { userId?: unknown; role?: unknown };
    const userId = typeof body.userId === 'string' ? body.userId : '';
    const role = typeof body.role === 'string' && ['admin', 'captain', 'member'].includes(body.role) ? body.role : '';
    if (!userId || !role) return json({ error: 'Choose a member and role.' }, { status: 400 });
    const db = getDatabase();
    const target = await db
      .prepare('SELECT role FROM clan_memberships WHERE clan_id = ? AND user_id = ?')
      .bind(clanId, userId)
      .first<{ role: string }>();
    if (!target) return json({ error: 'That person is not a clan member.' }, { status: 404 });
    if (target.role === 'owner') return json({ error: 'Clan ownership is transferred separately.' }, { status: 400 });
    if (actorRole !== 'owner' && (target.role === 'admin' || role === 'admin')) {
      return json({ error: 'Only the clan owner can change administrator access.' }, { status: 403 });
    }
    await db.prepare('UPDATE clan_memberships SET role = ? WHERE clan_id = ? AND user_id = ?').bind(role, clanId, userId).run();
    await recordAudit(db, {
      clanId,
      actorUserId: user.id,
      actorType: 'organizer',
      eventType: 'clan.member_role_changed',
      metadata: { memberUserId: userId, role },
    });
    return json({ saved: true, role });
  } catch (error) {
    return routeError(error, 'The clan member role could not be changed.');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ clanId: string }> }) {
  try {
    await ensureSchema();
    const { clanId } = await context.params;
    const { user, role } = await requireClanRole(request, clanId, ['owner', 'admin']);
    const body = (await request.json()) as { userId?: unknown };
    const userId = typeof body.userId === 'string' ? body.userId : '';
    if (!userId || userId === user.id) return json({ error: 'Choose another member to remove.' }, { status: 400 });
    const db = getDatabase();
    const target = await db
      .prepare('SELECT role FROM clan_memberships WHERE clan_id = ? AND user_id = ?')
      .bind(clanId, userId)
      .first<{ role: string }>();
    if (!target) return json({ error: 'That person is not a clan member.' }, { status: 404 });
    if (target.role === 'owner' || (target.role === 'admin' && role !== 'owner')) {
      return json({ error: 'Only the clan owner can remove an administrator.' }, { status: 403 });
    }
    await db.prepare('DELETE FROM clan_memberships WHERE clan_id = ? AND user_id = ?').bind(clanId, userId).run();
    await recordAudit(db, {
      clanId,
      actorUserId: user.id,
      actorType: 'organizer',
      eventType: 'clan.member_removed',
      metadata: { memberUserId: userId },
    });
    return json({ removed: true });
  } catch (error) {
    return routeError(error, 'The clan member could not be removed.');
  }
}

function routeError(error: unknown, fallback: string) {
  const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
  if (status >= 500) console.error(fallback, error);
  return json({ error: error instanceof Error && status < 500 ? error.message : fallback }, { status });
}
