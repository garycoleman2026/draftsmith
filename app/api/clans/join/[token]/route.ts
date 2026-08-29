import { requireSessionUser } from '@/lib/auth';
import { recordAudit, requestId } from '@/lib/audit';
import { ensureSchema, getDatabase, json } from '@/lib/db';
import { enforceRateLimit, RateLimitError, rateLimitResponse } from '@/lib/rate-limit';
import { hashToken } from '@/lib/security';

type Invitation = {
  id: string;
  clan_id: string;
  clan_name: string;
  role: string;
  expires_at: string;
};

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const invitation = await loadInvitation(token);
    if (!invitation) return json({ error: 'This clan invitation is invalid, expired, or full.' }, { status: 404 });
    return json({ clan: { id: invitation.clan_id, name: invitation.clan_name }, role: invitation.role, expiresAt: invitation.expires_at });
  } catch (error) {
    return routeError(error, 'The clan invitation could not be opened.');
  }
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    await ensureSchema();
    const user = await requireSessionUser(request);
    await enforceRateLimit({ request, scope: 'join-clan', limit: 20, windowSeconds: 3_600, subject: user.id });
    const { token } = await context.params;
    const invitation = await loadInvitation(token);
    if (!invitation) return json({ error: 'This clan invitation is invalid, expired, or full.' }, { status: 404 });
    const db = getDatabase();
    const existing = await db
      .prepare('SELECT role FROM clan_memberships WHERE clan_id = ? AND user_id = ?')
      .bind(invitation.clan_id, user.id)
      .first<{ role: string }>();
    if (existing) {
      return json({ joined: true, alreadyMember: true, clan: { id: invitation.clan_id, name: invitation.clan_name }, role: existing.role });
    }
    const claimed = await db
      .prepare(
        `UPDATE clan_invites SET use_count = use_count + 1
         WHERE id = ? AND revoked_at IS NULL AND expires_at > ? AND use_count < max_uses
         RETURNING id`,
      )
      .bind(invitation.id, new Date().toISOString())
      .first<{ id: string }>();
    if (!claimed) return json({ error: 'This clan invitation is invalid, expired, or full.' }, { status: 410 });
    const role = invitation.role === 'captain' ? 'captain' : 'member';
    const now = new Date().toISOString();
    await db
      .prepare('INSERT INTO clan_memberships (clan_id, user_id, role, created_at) VALUES (?, ?, ?, ?)')
      .bind(invitation.clan_id, user.id, role, now)
      .run();
    await recordAudit(db, {
      clanId: invitation.clan_id,
      actorUserId: user.id,
      actorType: 'organizer',
      eventType: 'clan.invite_joined',
      metadata: { role },
      requestId: requestId(request),
      createdAt: now,
    });
    return json({ joined: true, clan: { id: invitation.clan_id, name: invitation.clan_name }, role });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    return routeError(error, 'The clan invitation could not be accepted.');
  }
}

async function loadInvitation(token: string) {
  if (!/^[A-Za-z0-9_-]{20,160}$/.test(token)) return null;
  return getDatabase()
    .prepare(
      `SELECT ci.id, ci.clan_id, c.name AS clan_name, ci.role, ci.expires_at
       FROM clan_invites ci JOIN clans c ON c.id = ci.clan_id
       WHERE ci.token_hash = ? AND ci.revoked_at IS NULL AND ci.expires_at > ? AND ci.use_count < ci.max_uses`,
    )
    .bind(await hashToken(token), new Date().toISOString())
    .first<Invitation>();
}

function routeError(error: unknown, fallback: string) {
  const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
  if (status >= 500) console.error(fallback, error);
  return json({ error: error instanceof Error && status < 500 ? error.message : fallback }, { status });
}
