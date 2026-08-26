import { ensureSchema, getDatabase, json } from '../../../../../lib/db';
import { validateRosterRules } from '../../../../../lib/constraints';
import { createHashedCredential, resolveManagerDraftId } from '../../../../../lib/access-tokens';
import { recordAudit } from '../../../../../lib/audit';

type DraftRow = { id: string; team_count: number };

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const db = getDatabase();
    const draftId = await resolveManagerDraftId(token);
    const draft = draftId
      ? await db.prepare('SELECT id, team_count FROM drafts WHERE id = ?').bind(draftId).first<DraftRow>()
      : null;
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
      .prepare(`SELECT id, name FROM players WHERE draft_id = ? AND signup_status = 'approved'
                AND withdrawn_at IS NULL AND id IN (${placeholders})`)
      .bind(draft.id, ...playerIds)
      .all<{ id: string; name: string }>();
    if (playerResult.results.length !== playerIds.length) {
      return json({ error: 'Every captain must come from this event roster.' }, { status: 400 });
    }
    const [allPlayers, constraintResult] = await Promise.all([
      db.prepare("SELECT id FROM players WHERE draft_id = ? AND signup_status = 'approved' AND withdrawn_at IS NULL")
        .bind(draft.id).all<{ id: string }>(),
      db
        .prepare("SELECT constraint_type, enforcement, player_a_id, player_b_id FROM draft_constraints WHERE draft_id = ?")
        .bind(draft.id)
        .all<{ constraint_type: 'together' | 'apart'; enforcement: 'hard' | 'soft'; player_a_id: string; player_b_id: string }>(),
    ]);
    const ruleError = validateRosterRules({
      playerIds: allPlayers.results.map((player) => player.id),
      teamCount: draft.team_count,
      captains: playerIds.map((playerId, teamIndex) => ({ playerId, teamIndex })),
      rules: constraintResult.results.map((rule) => ({
        type: rule.constraint_type,
        enforcement: rule.enforcement,
        playerAId: rule.player_a_id,
        playerBId: rule.player_b_id,
      })),
    });
    if (ruleError) return json({ error: ruleError }, { status: 409 });
    const playerById = new Map(playerResult.results.map((player) => [player.id, player] as const));
    const credentials = await Promise.all(playerIds.map(() => createHashedCredential()));
    const captains = playerIds.map((playerId, teamIndex) => ({
      id: crypto.randomUUID(), playerId, name: playerById.get(playerId)!.name,
      teamIndex, ...credentials[teamIndex],
    }));
    const now = new Date().toISOString();
    await db.batch([
      db.prepare('DELETE FROM live_picks WHERE draft_id = ?').bind(draft.id),
      db.prepare('DELETE FROM live_turn_actions WHERE draft_id = ?').bind(draft.id),
      db.prepare('DELETE FROM captains WHERE draft_id = ?').bind(draft.id),
      ...captains.map((captain) =>
        db
          .prepare(
            `INSERT INTO captains (id, draft_id, player_id, team_index, token, token_hash)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(captain.id, draft.id, captain.playerId, captain.teamIndex, captain.retired, captain.hash),
      ),
      db
        .prepare(
          `UPDATE drafts SET status = 'rankings', result_json = NULL,
             live_started_at = NULL, live_paused_at = NULL, live_turn_started_at = NULL,
             live_revision = live_revision + 1, updated_at = ? WHERE id = ?`,
        )
        .bind(now, draft.id),
    ]);
    await recordAudit(db, {
      draftId: draft.id,
      actorType: 'organizer',
      eventType: 'captains.assigned',
      metadata: { captainPlayerIds: playerIds },
      createdAt: now,
    });
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const draftId = await resolveManagerDraftId(token);
    if (!draftId) return json({ error: 'This organizer link is not valid.' }, { status: 404 });
    const body = (await request.json()) as { frozen?: unknown; captainId?: unknown };
    if (typeof body.frozen !== 'boolean') return json({ error: 'Choose whether rankings are frozen.' }, { status: 400 });
    const captainId = typeof body.captainId === 'string' ? body.captainId : null;
    const now = new Date().toISOString();
    const db = getDatabase();
    const statement = captainId
      ? db.prepare('UPDATE captains SET rankings_frozen_at = ? WHERE draft_id = ? AND id = ?')
        .bind(body.frozen ? now : null, draftId, captainId)
      : db.prepare('UPDATE captains SET rankings_frozen_at = ? WHERE draft_id = ?')
        .bind(body.frozen ? now : null, draftId);
    await statement.run();
    await recordAudit(db, {
      draftId, actorType: 'organizer', eventType: body.frozen ? 'rankings.frozen' : 'rankings.reopened',
      metadata: { captainId }, createdAt: now,
    });
    return json({ frozen: body.frozen, frozenAt: body.frozen ? now : null, captainId });
  } catch (error) {
    console.error('freeze rankings failed', error);
    return json({ error: 'Ranking access could not be updated.' }, { status: 500 });
  }
}
