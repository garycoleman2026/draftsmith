import { ensureSchema, getDatabase, json } from '../../../../../lib/db';
import { validateRosterRules } from '../../../../../lib/constraints';
import { resolveManagerDraftId } from '../../../../../lib/access-tokens';
import { recordAudit } from '../../../../../lib/audit';

type DraftRow = { id: string; team_count: number; live_started_at: string | null };

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const db = getDatabase();
    const draft = await findDraft(token);
    if (!draft) return json({ error: 'This organizer link is not valid.' }, { status: 404 });
    if (draft.live_started_at) {
      return json({ error: 'Constraints cannot change after a live draft starts.' }, { status: 409 });
    }
    const body = (await request.json()) as {
      type?: unknown; playerAId?: unknown; playerBId?: unknown; enforcement?: unknown; penalty?: unknown;
    };
    const type = body.type === 'together' || body.type === 'apart' ? body.type : null;
    const enforcement = body.enforcement === 'soft' ? 'soft' : 'hard';
    const penalty = Number.isInteger(body.penalty) ? Math.max(1, Math.min(1000, Number(body.penalty))) : 100;
    const rawA = typeof body.playerAId === 'string' ? body.playerAId : '';
    const rawB = typeof body.playerBId === 'string' ? body.playerBId : '';
    if (!type || !rawA || !rawB || rawA === rawB) {
      return json({ error: 'Choose two different players and a valid rule.' }, { status: 400 });
    }
    const [playerAId, playerBId] = rawA.localeCompare(rawB) <= 0 ? [rawA, rawB] : [rawB, rawA];
    const playerResult = await db
      .prepare('SELECT id FROM players WHERE draft_id = ? AND id IN (?, ?)')
      .bind(draft.id, playerAId, playerBId)
      .all<{ id: string }>();
    if (playerResult.results.length !== 2) {
      return json({ error: 'Both players must belong to this event.' }, { status: 400 });
    }
    const existing = await db
      .prepare(
        `SELECT id, constraint_type FROM draft_constraints
         WHERE draft_id = ? AND player_a_id = ? AND player_b_id = ?`,
      )
      .bind(draft.id, playerAId, playerBId)
      .first<{ id: string; constraint_type: string }>();
    if (existing) {
      return json(
        { error: existing.constraint_type === type ? 'That rule already exists.' : 'Those players already have the opposite rule.' },
        { status: 409 },
      );
    }
    const [allPlayers, captains, currentRules] = await Promise.all([
      db.prepare("SELECT id FROM players WHERE draft_id = ? AND signup_status = 'approved' AND withdrawn_at IS NULL")
        .bind(draft.id).all<{ id: string }>(),
      db
        .prepare('SELECT player_id, team_index FROM captains WHERE draft_id = ?')
        .bind(draft.id)
        .all<{ player_id: string; team_index: number }>(),
      db
        .prepare('SELECT constraint_type, enforcement, player_a_id, player_b_id FROM draft_constraints WHERE draft_id = ?')
        .bind(draft.id)
        .all<{ constraint_type: 'together' | 'apart'; enforcement: 'hard' | 'soft'; player_a_id: string; player_b_id: string }>(),
    ]);
    const ruleError = validateRosterRules({
      playerIds: allPlayers.results.map((player) => player.id),
      teamCount: draft.team_count,
      captains: captains.results.map((captain) => ({
        playerId: captain.player_id,
        teamIndex: captain.team_index,
      })),
      rules: [
        ...currentRules.results.map((rule) => ({
          type: rule.constraint_type,
          enforcement: rule.enforcement,
          playerAId: rule.player_a_id,
          playerBId: rule.player_b_id,
        })),
        { type, enforcement, playerAId, playerBId },
      ],
    });
    if (ruleError) return json({ error: ruleError }, { status: 409 });
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.batch([
      db
        .prepare(
          `INSERT INTO draft_constraints
            (id, draft_id, constraint_type, enforcement, penalty, player_a_id, player_b_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(id, draft.id, type, enforcement, penalty, playerAId, playerBId, now),
      db
        .prepare("UPDATE drafts SET result_json = NULL, status = 'collecting', updated_at = ? WHERE id = ?")
        .bind(now, draft.id),
    ]);
    await recordAudit(db, {
      draftId: draft.id, actorType: 'organizer', eventType: 'constraint.created',
      metadata: { id, type, enforcement, penalty, playerAId, playerBId }, createdAt: now,
    });
    return json({ id, type, enforcement, penalty, playerAId, playerBId }, { status: 201 });
  } catch (error) {
    console.error('save constraint failed', error);
    return json({ error: 'The roster rule could not be saved.' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const db = getDatabase();
    const draft = await findDraft(token);
    if (!draft) return json({ error: 'This organizer link is not valid.' }, { status: 404 });
    if (draft.live_started_at) {
      return json({ error: 'Constraints cannot change after a live draft starts.' }, { status: 409 });
    }
    const body = (await request.json()) as { id?: unknown };
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return json({ error: 'Choose a rule to remove.' }, { status: 400 });
    const now = new Date().toISOString();
    await db.batch([
      db.prepare('DELETE FROM draft_constraints WHERE id = ? AND draft_id = ?').bind(id, draft.id),
      db
        .prepare("UPDATE drafts SET result_json = NULL, status = 'collecting', updated_at = ? WHERE id = ?")
        .bind(now, draft.id),
    ]);
    await recordAudit(db, {
      draftId: draft.id, actorType: 'organizer', eventType: 'constraint.removed', metadata: { id }, createdAt: now,
    });
    return json({ removed: true });
  } catch (error) {
    console.error('remove constraint failed', error);
    return json({ error: 'The roster rule could not be removed.' }, { status: 500 });
  }
}

async function findDraft(token: string) {
  const id = await resolveManagerDraftId(token);
  if (!id) return null;
  return getDatabase().prepare('SELECT id, team_count, live_started_at FROM drafts WHERE id = ?').bind(id).first<DraftRow>();
}
