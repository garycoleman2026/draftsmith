import { recordAudit, requestId } from '@/lib/audit';
import { BingoError, bingoActivityInsert, bingoErrorResponse, loadBingoView, resolveBingoTeam } from '@/lib/bingo';
import { normalizeBingoTeamColor } from '@/lib/bingo-team-colors';
import { ensureSchema, getDatabase, json } from '@/lib/db';
import { enforceRateLimit, RateLimitError, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const team = await resolveBingoTeam(token);
    if (!team) throw new BingoError('This private team link is not valid.', 404);
    return json(await loadBingoView({ eventId: team.event_id, viewer: 'team', teamId: team.id }));
  } catch (error) {
    const result = bingoErrorResponse(error);
    if (result.status >= 500) console.error('load team bingo failed', error);
    return json({ error: result.message }, { status: result.status });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const team = await resolveBingoTeam(token);
    if (!team) throw new BingoError('This private team link is not valid.', 404);
    await enforceRateLimit({ request, scope: 'bingo-team-colour', limit: 30, windowSeconds: 3_600, subject: team.id });
    const body = await request.json().catch(() => ({})) as { color?: unknown };
    const color = normalizeBingoTeamColor(body.color);
    if (!color) throw new BingoError('Choose a valid team colour.');
    const db = getDatabase();
    const event = await db.prepare('SELECT status FROM bingo_events WHERE id = ?')
      .bind(team.event_id).first<{ status: string }>();
    if (!event) throw new BingoError('This bingo event does not exist.', 404);
    if (event.status === 'archived') throw new BingoError('Archived bingo colours cannot be changed.', 409);
    const now = new Date().toISOString();
    await db.batch([
      db.prepare('UPDATE bingo_teams SET color = ? WHERE id = ? AND event_id = ?').bind(color, team.id, team.event_id),
      bingoActivityInsert({ eventId: team.event_id, teamId: team.id, type: 'team.color_updated', message: `${team.name} chose new team colours.`, metadata: { color }, now }),
      db.prepare('UPDATE bingo_events SET revision = revision + 1, updated_at = ? WHERE id = ?').bind(now, team.event_id),
    ]);
    await recordAudit(db, {
      draftId: team.draft_id, actorType: 'captain', actorReference: team.id, eventType: 'bingo.team_color_updated',
      metadata: { eventId: team.event_id, teamId: team.id, color }, requestId: requestId(request), createdAt: now,
    }).catch(() => undefined);
    return json({ teamId: team.id, color });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    const result = bingoErrorResponse(error);
    if (result.status >= 500) console.error('update team bingo colour failed', error);
    return json({ error: result.message }, { status: result.status });
  }
}
