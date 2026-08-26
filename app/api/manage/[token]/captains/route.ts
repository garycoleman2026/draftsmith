import { ensureSchema, getDatabase, json, makeToken } from '../../../../../lib/db';
import { validateRosterRules } from '../../../../../lib/constraints';

type DraftRow = { id: string; team_count: number };

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const db = getDatabase();
    const draft = await db
      .prepare('SELECT id, team_count FROM drafts WHERE admin_token = ?')
      .bind(token)
      .first<DraftRow>();
    if (!draft) return json({ error: 'This organizer link is not valid.' }, { status: 404 });
    const body = (await request.json()) as { playerIds?: unknown };
    const playerIds = Array.isArray(body.playerIds)
      ? body.playerIds.filter((id): id is string => typeof id === 'string')
      : [];
    if (playerIds.length !== draft.team_count || new Set(playerIds).size !== draft.team_count) {
      return json({ error: `Choose ${draft.team_count} different captains.` }, { status: 400 });
    }
    const placeholders = playerIds.map(() => '?').join(', ');
    const playerResult = await db
      .prepare(`SELECT id, name FROM players WHERE draft_id = ? AND id IN (${placeholders})`)
      .bind(draft.id, ...playerIds)
      .all<{ id: string; name: string }>();
    if (playerResult.results.length !== playerIds.length) {
      return json({ error: 'Every captain must come from this event roster.' }, { status: 400 });
    }
    const [allPlayers, constraintResult] = await Promise.all([
      db.prepare('SELECT id FROM players WHERE draft_id = ?').bind(draft.id).all<{ id: string }>(),
      db
        .prepare('SELECT constraint_type, player_a_id, player_b_id FROM draft_constraints WHERE draft_id = ?')
        .bind(draft.id)
        .all<{ constraint_type: 'together' | 'apart'; player_a_id: string; player_b_id: string }>(),
    ]);
    const ruleError = validateRosterRules({
      playerIds: allPlayers.results.map((player) => player.id),
      teamCount: draft.team_count,
      captains: playerIds.map((playerId, teamIndex) => ({ playerId, teamIndex })),
      rules: constraintResult.results.map((rule) => ({
        type: rule.constraint_type,
        playerAId: rule.player_a_id,
        playerBId: rule.player_b_id,
      })),
    });
    if (ruleError) return json({ error: ruleError }, { status: 409 });
    const playerById = new Map(playerResult.results.map((player) => [player.id, player] as const));
    const captains = playerIds.map((playerId, teamIndex) => ({
      id: crypto.randomUUID(),
      playerId,
      name: playerById.get(playerId)!.name,
      teamIndex,
      token: makeToken(),
    }));
    const now = new Date().toISOString();
    await db.batch([
      db.prepare('DELETE FROM live_picks WHERE draft_id = ?').bind(draft.id),
      db.prepare('DELETE FROM captains WHERE draft_id = ?').bind(draft.id),
      ...captains.map((captain) =>
        db
          .prepare(
            'INSERT INTO captains (id, draft_id, player_id, team_index, token) VALUES (?, ?, ?, ?, ?)',
          )
          .bind(captain.id, draft.id, captain.playerId, captain.teamIndex, captain.token),
      ),
      db
        .prepare(
          `UPDATE drafts SET status = 'collecting', result_json = NULL,
             live_started_at = NULL, updated_at = ? WHERE id = ?`,
        )
        .bind(now, draft.id),
    ]);
    return json({
      captains: captains.map((captain) => ({
        id: captain.id,
        playerId: captain.playerId,
        name: captain.name,
        teamIndex: captain.teamIndex,
        path: `/rank/${captain.token}`,
      })),
    });
  } catch (error) {
    console.error('save captains failed', error);
    return json({ error: 'The captains could not be saved.' }, { status: 500 });
  }
}
