import { recordAudit, requestId } from '@/lib/audit';
import { BingoError, bingoErrorResponse, resolveBingoTeam } from '@/lib/bingo';
import { getRuneliteStatus, issueRunelitePairing, revokeRuneliteDevice } from '@/lib/bingo-runelite';
import { ensureSchema, getDatabase, json } from '@/lib/db';
import { enforceRateLimit, RateLimitError, rateLimitResponse } from '@/lib/rate-limit';

type Context = { params: Promise<{ token: string }> };

export async function GET(request: Request, context: Context) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const team = await resolveBingoTeam(token);
    if (!team) throw new BingoError('This private team link is not valid.', 404);
    await enforceRateLimit({ request, scope: 'bingo-runelite-team-read', limit: 120, windowSeconds: 600 });
    return json(await getRuneliteStatus(team.event_id, team.id));
  } catch (error) { return failure(error, 'load team RuneLite devices'); }
}

export async function POST(request: Request, context: Context) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const team = await resolveBingoTeam(token);
    if (!team) throw new BingoError('This private team link is not valid.', 404);
    await enforceRateLimit({ request, scope: 'bingo-runelite-team', limit: 20, windowSeconds: 3600, subject: team.id });
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    if (body.action === 'issue' && typeof body.memberId === 'string') {
      const result = await issueRunelitePairing({
        eventId: team.event_id, teamId: team.id, memberId: body.memberId, issuedBy: 'team',
      });
      await audit(team.draft_id, request, 'bingo.runelite_pairing_issued', {
        eventId: team.event_id, teamId: team.id, memberId: body.memberId,
      });
      return json(result, { status: 201 });
    }
    if (body.action === 'revoke' && typeof body.deviceId === 'string') {
      const result = await revokeRuneliteDevice({
        deviceId: body.deviceId, eventId: team.event_id, teamId: team.id, actor: 'team',
      });
      await audit(team.draft_id, request, 'bingo.runelite_revoked', {
        eventId: team.event_id, teamId: team.id, deviceId: body.deviceId,
      });
      return json(result);
    }
    throw new BingoError('Choose a player to pair or a device to disconnect.');
  } catch (error) { return failure(error, 'update team RuneLite devices'); }
}

async function audit(draftId: string, request: Request, eventType: string, metadata: Record<string, unknown>) {
  await recordAudit(getDatabase(), {
    draftId, actorType: 'participant', eventType, metadata, requestId: requestId(request),
    createdAt: new Date().toISOString(),
  }).catch(() => undefined);
}
function failure(error: unknown, action: string) {
  if (error instanceof RateLimitError) return rateLimitResponse(error);
  const result = bingoErrorResponse(error);
  if (result.status >= 500) console.error(`Could not ${action}`, error);
  return json({ error: result.message }, { status: result.status });
}
