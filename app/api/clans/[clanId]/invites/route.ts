import { requireClanRole } from '@/lib/auth';
import { recordAudit, requestId } from '@/lib/audit';
import { ensureSchema, getDatabase, json } from '@/lib/db';
import { enforceRateLimit, RateLimitError, rateLimitResponse } from '@/lib/rate-limit';
import { hashToken, randomToken } from '@/lib/security';

const INVITE_ROLES = new Set(['member', 'captain']);

export async function POST(request: Request, context: { params: Promise<{ clanId: string }> }) {
  try {
    await ensureSchema();
    const { clanId } = await context.params;
    const { user } = await requireClanRole(request, clanId, ['owner', 'admin']);
    await enforceRateLimit({ request, scope: 'create-clan-invite', limit: 20, windowSeconds: 3_600, subject: user.id });
    const body = await request.json().catch(() => ({})) as { role?: unknown };
    const role = typeof body.role === 'string' && INVITE_ROLES.has(body.role) ? body.role : 'member';
    const token = randomToken(24);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const db = getDatabase();
    await db
      .prepare(
        `INSERT INTO clan_invites
          (id, clan_id, token_hash, role, created_by_user_id, expires_at, max_uses, use_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 50, 0, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        clanId,
        await hashToken(token),
        role,
        user.id,
        expiresAt.toISOString(),
        now.toISOString(),
      )
      .run();
    await recordAudit(db, {
      clanId,
      actorUserId: user.id,
      actorType: 'organizer',
      eventType: 'clan.invite_created',
      metadata: { role, expiresAt: expiresAt.toISOString() },
      requestId: requestId(request),
      createdAt: now.toISOString(),
    });
    return json({ path: `/clans/join/${token}`, role, expiresAt: expiresAt.toISOString() }, { status: 201 });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    return routeError(error, 'The clan invitation could not be created.');
  }
}

function routeError(error: unknown, fallback: string) {
  const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
  if (status >= 500) console.error(fallback, error);
  return json({ error: error instanceof Error && status < 500 ? error.message : fallback }, { status });
}
