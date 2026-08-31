import { recordAudit, requestId } from '@/lib/audit';
import { BingoError, bingoActivityInsert, bingoErrorResponse, requireManagedBingoEvent } from '@/lib/bingo';
import { normalizeBingoTeamColor } from '@/lib/bingo-team-colors';
import { ensureSchema, getDatabase, json } from '@/lib/db';

type Context = { params: Promise<{ token: string; eventId: string; teamId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    await ensureSchema();
    const { token, eventId, teamId } = await context.params;
    const event = await requireManagedBingoEvent(token, eventId, ['owner', 'organizer']);
    if (event.status === 'archived') throw new BingoError('Archived bingo colours cannot be changed.', 409);
    const body = await request.json().catch(() => ({})) as { color?: unknown };
    const color = normalizeBingoTeamColor(body.color);
    if (!color) throw new BingoError('Choose a valid team colour.');
    const db = getDatabase();
    const team = await db.prepare('SELECT id, name FROM bingo_teams WHERE id = ? AND event_id = ?')
      .bind(teamId, eventId).first<{ id: string; name: string }>();
    if (!team) throw new BingoError('That team is not part of this bingo.', 404);
    const now = new Date().toISOString();
    await db.batch([
      db.prepare('UPDATE bingo_teams SET color = ? WHERE id = ? AND event_id = ?').bind(color, team.id, eventId),
      bingoActivityInsert({ eventId, teamId: team.id, type: 'team.color_updated', message: `${team.name}'s colours were changed by an organizer.`, metadata: { color }, now }),
      db.prepare('UPDATE bingo_events SET revision = revision + 1, updated_at = ? WHERE id = ?').bind(now, eventId),
    ]);
    await recordAudit(db, {
      draftId: event.draft_id, actorType: 'organizer', eventType: 'bingo.team_color_updated',
      metadata: { eventId, teamId: team.id, color }, requestId: requestId(request), createdAt: now,
    }).catch(() => undefined);
    return json({ teamId: team.id, color });
  } catch (error) {
    const result = bingoErrorResponse(error);
    if (result.status >= 500) console.error('update managed bingo team colour failed', error);
    return json({ error: result.message }, { status: result.status });
  }
}
