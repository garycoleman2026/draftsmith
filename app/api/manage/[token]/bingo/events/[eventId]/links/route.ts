import { createHashedCredential } from '@/lib/access-tokens';
import { recordAudit, requestId } from '@/lib/audit';
import { BingoError, bingoErrorResponse, requireManagedBingoEvent } from '@/lib/bingo';
import { ensureSchema, getDatabase, json } from '@/lib/db';

export async function POST(request: Request, context: { params: Promise<{ token: string; eventId: string }> }) {
  try {
    await ensureSchema();
    const { token, eventId } = await context.params;
    const event = await requireManagedBingoEvent(token, eventId, ['owner', 'organizer']);
    const body = await request.json().catch(() => ({})) as { teamId?: unknown };
    const requestedTeamId = typeof body.teamId === 'string' ? body.teamId : null;
    const query = requestedTeamId
      ? getDatabase().prepare('SELECT id, name FROM bingo_teams WHERE event_id = ? AND id = ?').bind(eventId, requestedTeamId)
      : getDatabase().prepare('SELECT id, name FROM bingo_teams WHERE event_id = ? ORDER BY source_team_index').bind(eventId);
    const teams = await query.all<{ id: string; name: string }>();
    if (!teams.results.length) throw new BingoError('No matching bingo team was found.', 404);
    const issued = await Promise.all(teams.results.map(async (team) => ({ team, credential: await createHashedCredential() })));
    const now = new Date().toISOString();
    await getDatabase().batch([
      ...issued.map(({ team, credential }) => getDatabase().prepare('UPDATE bingo_teams SET access_token_hash = ? WHERE id = ? AND event_id = ?')
        .bind(credential.hash, team.id, eventId)),
      getDatabase().prepare('UPDATE bingo_events SET revision = revision + 1, updated_at = ? WHERE id = ?').bind(now, eventId),
    ]);
    await recordAudit(getDatabase(), {
      draftId: event.draft_id, actorType: 'organizer', eventType: 'bingo.team_links_rotated',
      metadata: { eventId, teamIds: issued.map(({ team }) => team.id) }, requestId: requestId(request), createdAt: now,
    }).catch(() => undefined);
    return json({
      teamLinks: issued.map(({ team, credential }) => ({ teamId: team.id, teamName: team.name, path: `/bingo/team/${credential.token}` })),
    });
  } catch (error) {
    const result = bingoErrorResponse(error);
    if (result.status >= 500) console.error('rotate bingo links failed', error);
    return json({ error: result.message }, { status: result.status });
  }
}
