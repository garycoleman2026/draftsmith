import { requireClanRole } from '@/lib/auth';
import { recordAudit, requestId } from '@/lib/audit';
import { ensureSchema, getDatabase, json } from '@/lib/db';
import { enforceRateLimit, RateLimitError, rateLimitResponse } from '@/lib/rate-limit';

type Context = { params: Promise<{ clanId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    await ensureSchema();
    const { clanId } = await context.params;
    const { role } = await requireClanRole(request, clanId, ['owner', 'admin', 'captain', 'member']);
    const clan = await getDatabase().prepare(
      `SELECT id, name, slug, description, public_listing, created_at, updated_at FROM clans WHERE id = ?`,
    ).bind(clanId).first<Record<string, string | number>>();
    if (!clan) return json({ error: 'That clan workspace was not found.' }, { status: 404 });
    return json({ clan: { ...clan, role } });
  } catch (error) {
    return routeError(error, 'The clan profile could not be loaded.');
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    await ensureSchema();
    const { clanId } = await context.params;
    const { user } = await requireClanRole(request, clanId, ['owner', 'admin']);
    await enforceRateLimit({ request, scope: 'update-clan-profile', limit: 30, windowSeconds: 3_600, subject: user.id });
    const body = await request.json().catch(() => ({})) as { name?: unknown; description?: unknown; publicListing?: unknown };
    const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ').slice(0, 60) : '';
    if (name.length < 2) return json({ error: 'Enter a clan name with at least two characters.' }, { status: 400 });
    const description = typeof body.description === 'string'
      ? body.description.trim().replace(/\s+/g, ' ').slice(0, 500)
      : '';
    const publicListing = body.publicListing === true;
    const now = new Date().toISOString();
    const db = getDatabase();
    await db.prepare(
      'UPDATE clans SET name = ?, description = ?, public_listing = ?, updated_at = ? WHERE id = ?',
    ).bind(name, description, publicListing ? 1 : 0, now, clanId).run();
    await recordAudit(db, {
      clanId, actorUserId: user.id, actorType: 'organizer', eventType: 'clan.profile_updated',
      metadata: { name, publicListing }, requestId: requestId(request), createdAt: now,
    });
    return json({ saved: true, name, publicPath: publicListing ? `/clans/${await clanSlug(clanId)}` : null });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    return routeError(error, 'The clan profile could not be saved.');
  }
}

async function clanSlug(clanId: string) {
  const row = await getDatabase().prepare('SELECT slug FROM clans WHERE id = ?').bind(clanId).first<{ slug: string }>();
  return row?.slug ?? '';
}

function routeError(error: unknown, fallback: string) {
  const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
  if (status >= 500) console.error(fallback, error);
  return json({ error: error instanceof Error && status < 500 ? error.message : fallback }, { status });
}
