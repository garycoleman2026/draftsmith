import { resolveManagerDraftId } from '../../../../../lib/access-tokens';
import { recordAudit } from '../../../../../lib/audit';
import { ensureSchema, getDatabase, json } from '../../../../../lib/db';
import { autoPickCurrent, commitLivePass, LiveDraftError, undoLastLiveAction } from '../../../../../lib/live-service';
import type { LiveOrder } from '../../../../../lib/types';
import { clampInteger } from '../../../../../lib/validation';
import { scheduleDiscordEvent } from '../../../../../lib/discord-webhooks';

type DraftRow = {
  id: string; draft_type: string; team_count: number; live_started_at: string | null;
  live_paused_at: string | null; live_order: LiveOrder; live_pick_seconds: number; live_auto_pick: number;
};

async function findDraft(token: string) {
  const id = await resolveManagerDraftId(token);
  if (!id) return null;
  return getDatabase().prepare(`SELECT id, draft_type, team_count, live_started_at, live_paused_at,
    live_order, live_pick_seconds, live_auto_pick FROM drafts WHERE id = ?`).bind(id).first<DraftRow>();
}

export async function POST(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const draft = await findDraft(token);
    if (!draft) return json({ error: 'This organizer link is not valid.' }, { status: 404 });
    if (draft.draft_type !== 'live') return json({ error: 'This event is not configured for live captain picking.' }, { status: 409 });
    const db = getDatabase();
    const [playerCount, captainCount] = await Promise.all([
      db.prepare("SELECT COUNT(*) AS count FROM players WHERE draft_id = ? AND signup_status = 'approved' AND withdrawn_at IS NULL")
        .bind(draft.id).first<{ count: number }>(),
      db.prepare(`SELECT COUNT(*) AS count FROM captains c JOIN players p ON p.id = c.player_id
                  WHERE c.draft_id = ? AND p.signup_status = 'approved' AND p.withdrawn_at IS NULL`)
        .bind(draft.id).first<{ count: number }>(),
    ]);
    if ((captainCount?.count ?? 0) !== draft.team_count) return json({ error: `Choose all ${draft.team_count} captains before starting.` }, { status: 409 });
    if ((playerCount?.count ?? 0) <= draft.team_count) return json({ error: 'Add at least one draftable player before starting.' }, { status: 409 });
    const now = new Date().toISOString();
    await db.batch([
      db.prepare('DELETE FROM live_picks WHERE draft_id = ?').bind(draft.id),
      db.prepare('DELETE FROM live_turn_actions WHERE draft_id = ?').bind(draft.id),
      db.prepare(`UPDATE drafts SET status = 'live', result_json = NULL, live_started_at = ?,
                  live_paused_at = NULL, live_turn_started_at = ?, registration_open = 0,
                  live_revision = live_revision + 1, updated_at = ? WHERE id = ?`)
        .bind(now, now, now, draft.id),
      db.prepare('UPDATE captains SET rankings_frozen_at = COALESCE(rankings_frozen_at, ?) WHERE draft_id = ?')
        .bind(now, draft.id),
    ]);
    await recordAudit(db, { draftId: draft.id, actorType: 'organizer', eventType: 'live.started', createdAt: now });
    scheduleDiscordEvent(draft.id, 'live.started', {
      username: "Terry's Drafting", embeds: [{ title: 'The live draft has started', description: 'Captains are now on the clock.', color: 0xb58a2f }],
    });
    return json({ started: true, startedAt: now });
  } catch (error) {
    console.error('start live draft failed', error);
    return json({ error: 'The live draft could not be started.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const draft = await findDraft(token);
    if (!draft) return json({ error: 'This organizer link is not valid.' }, { status: 404 });
    if (draft.draft_type !== 'live') return json({ error: 'This is not a live draft.' }, { status: 409 });
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? '');
    const db = getDatabase();
    const now = new Date().toISOString();
    if (action === 'pause' || action === 'resume') {
      if (!draft.live_started_at) return json({ error: 'Start the live draft first.' }, { status: 409 });
      await db.prepare(`UPDATE drafts SET live_paused_at = ?, live_turn_started_at = ?,
                        live_revision = live_revision + 1, updated_at = ? WHERE id = ?`)
        .bind(action === 'pause' ? now : null, action === 'resume' ? now : null, now, draft.id).run();
      await recordAudit(db, { draftId: draft.id, actorType: 'organizer', eventType: `live.${action}d`, createdAt: now });
      return json({ paused: action === 'pause', pausedAt: action === 'pause' ? now : null });
    }
    if (action === 'pass' || action === 'skip') return json(await commitLivePass(draft.id, action));
    if (action === 'undo') return json(await undoLastLiveAction(draft.id));
    if (action === 'tick') return json({ outcome: await autoPickCurrent(draft.id, body.force === true) });
    if (action === 'configure') {
      const order = ['snake', 'linear', 'random', 'third_round_reversal'].includes(String(body.order))
        ? String(body.order) as LiveOrder : draft.live_order;
      if (draft.live_started_at && order !== draft.live_order) return json({ error: 'Pick order cannot change after the live draft starts.' }, { status: 409 });
      const pickSeconds = clampInteger(body.pickSeconds, 0, 3600, draft.live_pick_seconds);
      const autoPick = typeof body.autoPick === 'boolean' ? body.autoPick : Boolean(draft.live_auto_pick);
      await db.prepare(`UPDATE drafts SET live_order = ?, live_pick_seconds = ?, live_auto_pick = ?,
                        live_revision = live_revision + 1, updated_at = ? WHERE id = ?`)
        .bind(order, pickSeconds, autoPick ? 1 : 0, now, draft.id).run();
      await recordAudit(db, {
        draftId: draft.id, actorType: 'organizer', eventType: 'live.configured',
        metadata: { order, pickSeconds, autoPick }, createdAt: now,
      });
      return json({ order, pickSeconds, autoPick });
    }
    return json({ error: 'Choose a valid live-draft control.' }, { status: 400 });
  } catch (error) {
    if (error instanceof LiveDraftError) return json({ error: error.message }, { status: error.status });
    console.error('live control failed', error);
    return json({ error: 'The live draft control could not be applied.' }, { status: 500 });
  }
}
