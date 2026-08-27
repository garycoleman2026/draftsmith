import { recordAudit, requestId } from '@/lib/audit';
import { BingoError, bingoErrorResponse, requireManagedBingoEvent } from '@/lib/bingo';
import { configureRunelite, getRuneliteStatus, revokeRuneliteDevice } from '@/lib/bingo-runelite';
import { ensureSchema, getDatabase, json } from '@/lib/db';
import { enforceRateLimit, RateLimitError, rateLimitResponse } from '@/lib/rate-limit';

type Context = { params: Promise<{ token: string; eventId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    await ensureSchema();
    const { token, eventId } = await context.params;
    await requireManagedBingoEvent(token, eventId);
    await enforceRateLimit({ request, scope: 'bingo-runelite-manage-read', limit: 180, windowSeconds: 600, subject: eventId });
    return json(await getRuneliteStatus(eventId));
  } catch (error) { return failure(error, 'load RuneLite integration'); }
}

export async function PUT(request: Request, context: Context) {
  try {
    await ensureSchema();
    const { token, eventId } = await context.params;
    const event = await requireManagedBingoEvent(token, eventId);
    await enforceRateLimit({ request, scope: 'bingo-runelite-manage', limit: 30, windowSeconds: 3600, subject: eventId });
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const result = await configureRunelite({ eventId, enabled: body.enabled === true, scopes: body.scopes });
    await recordAudit(getDatabase(), {
      draftId: event.draft_id, actorType: 'organizer', eventType: 'bingo.runelite_configured',
      metadata: { eventId, enabled: result.enabled, scopes: result.scopes }, requestId: requestId(request),
      createdAt: new Date().toISOString(),
    }).catch(() => undefined);
    return json(result);
  } catch (error) { return failure(error, 'configure RuneLite integration'); }
}

export async function POST(request: Request, context: Context) {
  try {
    await ensureSchema();
    const { token, eventId } = await context.params;
    const event = await requireManagedBingoEvent(token, eventId);
    await enforceRateLimit({ request, scope: 'bingo-runelite-manage', limit: 30, windowSeconds: 3600, subject: eventId });
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    if (body.action !== 'revoke' || typeof body.deviceId !== 'string') throw new BingoError('Choose a RuneLite device to disconnect.');
    const result = await revokeRuneliteDevice({ deviceId: body.deviceId, eventId, actor: 'organizer' });
    await recordAudit(getDatabase(), {
      draftId: event.draft_id, actorType: 'organizer', eventType: 'bingo.runelite_revoked',
      metadata: { eventId, deviceId: body.deviceId }, requestId: requestId(request), createdAt: result.revokedAt,
    }).catch(() => undefined);
    return json(result);
  } catch (error) { return failure(error, 'disconnect RuneLite device'); }
}

function failure(error: unknown, action: string) {
  if (error instanceof RateLimitError) return rateLimitResponse(error);
  const result = bingoErrorResponse(error);
  if (result.status >= 500) console.error(`Could not ${action}`, error);
  return json({ error: result.message }, { status: result.status });
}
