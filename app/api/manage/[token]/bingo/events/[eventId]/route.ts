import { recordAudit, requestId } from '@/lib/audit';
import { scheduleBingoSnapshot } from '@/lib/bingo-baselines';
import { BingoError, bingoActivityInsert, bingoErrorResponse, loadBingoView, parseJson, requireManagedBingoEvent } from '@/lib/bingo';
import { ensureSchema, getDatabase, json } from '@/lib/db';
import { sanitizeBingoEventRules } from '@/lib/bingo-rules';
import { scheduleDiscordEvent } from '@/lib/discord-webhooks';
import type { BingoBoardScope, BingoMode } from '@/lib/types';

type Context = { params: Promise<{ token: string; eventId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    await ensureSchema();
    const { token, eventId } = await context.params;
    const event = await requireManagedBingoEvent(token, eventId);
    const view = await loadBingoView({ eventId, viewer: 'organizer' });
    return json({ ...view, viewer: { ...view.viewer, accessRole: event.access_role ?? 'owner' } });
  } catch (error) {
    const result = bingoErrorResponse(error);
    if (result.status >= 500) console.error('load managed bingo failed', error);
    return json({ error: result.message }, { status: result.status });
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    await ensureSchema();
    const { token, eventId } = await context.params;
    const event = await requireManagedBingoEvent(token, eventId, ['owner', 'organizer']);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const title = typeof body.title === 'string' ? body.title.trim().replace(/\s+/g, ' ').slice(0, 90) : event.title;
    if (!title) throw new BingoError('Give the bingo event a title.');
    const structuralLocked = ['live', 'paused', 'complete', 'archived'].includes(event.status);
    const mode = structuralLocked ? event.mode : validMode(body.mode ?? event.mode);
    const boardScope = mode === 'lockout' ? 'shared' : structuralLocked ? event.board_scope : validScope(body.boardScope ?? event.board_scope);
    const startAt = validDate(body.startAt);
    const endAt = validDate(body.endAt);
    if (startAt && endAt && Date.parse(endAt) <= Date.parse(startAt)) throw new BingoError('The end time must be after the start time.');
    const requiresReview = body.requiresReview === undefined ? event.requires_review : Boolean(body.requiresReview);
    const publicSpectator = body.publicSpectator === undefined ? event.public_spectator : Boolean(body.publicSpectator);
    const publicListed = publicSpectator && (body.publicListed === undefined ? Boolean(event.public_listed) : Boolean(body.publicListed));
    const spectatorDelaySeconds = clampInteger(body.spectatorDelaySeconds, 0, 3600, event.spectator_delay_seconds);
    const winCondition = mode === 'classic' ? 'lines' : mode === 'blackout' ? 'blackout' : mode === 'categories' ? 'categories' : 'points';
    const targetValue = clampInteger(body.targetValue, 0, 100_000, event.target_value);
    const rules = sanitizeBingoEventRules(parseJson(event.rules_json, {}), event.grid_size, winCondition);
    rules.scoring.winCondition = winCondition;
    rules.scoring.targetValue = targetValue;
    const status = structuralLocked ? event.status : startAt && Date.parse(startAt) > Date.now() ? 'scheduled' : 'draft';
    const now = new Date().toISOString();
    await getDatabase().prepare(
      `UPDATE bingo_events SET title = ?, mode = ?, board_scope = ?, win_condition = ?, target_value = ?,
          requires_review = ?, public_spectator = ?, public_listed = ?, spectator_delay_seconds = ?, start_at = ?, end_at = ?,
          status = ?, rules_json = ?, revision = revision + 1, updated_at = ? WHERE id = ?`,
    ).bind(title, mode, boardScope, winCondition, targetValue, requiresReview ? 1 : 0, publicSpectator ? 1 : 0, publicListed ? 1 : 0,
      spectatorDelaySeconds, startAt, endAt, status, JSON.stringify(rules), now, eventId).run();
    await recordAudit(getDatabase(), {
      draftId: event.draft_id, actorType: 'organizer', eventType: 'bingo.settings_updated',
      metadata: { eventId, mode, boardScope, requiresReview, publicSpectator, publicListed, spectatorDelaySeconds },
      requestId: requestId(request), createdAt: now,
    }).catch(() => undefined);
    return json(await loadBingoView({ eventId, viewer: 'organizer' }));
  } catch (error) {
    const result = bingoErrorResponse(error);
    if (result.status >= 500) console.error('update bingo settings failed', error);
    return json({ error: result.message }, { status: result.status });
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    await ensureSchema();
    const { token, eventId } = await context.params;
    const event = await requireManagedBingoEvent(token, eventId, ['owner', 'organizer']);
    const body = await request.json().catch(() => ({})) as { action?: unknown };
    const action = ['start', 'pause', 'resume', 'complete'].includes(String(body.action)) ? body.action as 'start' | 'pause' | 'resume' | 'complete' : null;
    if (!action) throw new BingoError('Choose start, pause, resume, or complete.');
    const db = getDatabase();
    const now = new Date().toISOString();
    if (action === 'start') {
      if (!['draft', 'scheduled'].includes(event.status)) throw new BingoError('Only a draft or scheduled bingo can be started.', 409);
      const [tasks, teams] = await Promise.all([
        db.prepare('SELECT COUNT(*) AS count FROM bingo_tasks WHERE event_id = ?').bind(eventId).first<{ count: number }>(),
        db.prepare('SELECT COUNT(*) AS count FROM bingo_teams WHERE event_id = ?').bind(eventId).first<{ count: number }>(),
      ]);
      if ((tasks?.count ?? 0) !== event.grid_size * event.grid_size) throw new BingoError(`Save exactly ${event.grid_size * event.grid_size} tasks before starting.`, 409);
      if ((teams?.count ?? 0) < 2) throw new BingoError('A bingo event needs at least two drafted teams.', 409);
      await db.batch([
        db.prepare(`UPDATE bingo_events SET status = 'live', started_at = ?, start_at = COALESCE(start_at, ?),
          revision = revision + 1, updated_at = ? WHERE id = ? AND status IN ('draft', 'scheduled')`).bind(now, now, now, eventId),
        bingoActivityInsert({ eventId, type: 'event.started', message: `${event.title} is live. The hunt begins!`, now }),
      ]);
      scheduleBingoSnapshot(eventId, 'start');
      scheduleDiscordEvent(event.draft_id, 'bingo.started', {
        username: "Terry's Drafting",
        embeds: [{ title: `${event.title} is live`, description: 'The bingo board is open and teams can submit tile claims.', color: 0x5f7f46 }],
      });
    } else if (action === 'pause') {
      if (event.status !== 'live') throw new BingoError('Only a live bingo can be paused.', 409);
      await db.batch([
        db.prepare(`UPDATE bingo_events SET status = 'paused', paused_at = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND status = 'live'`).bind(now, now, eventId),
        bingoActivityInsert({ eventId, type: 'event.paused', message: `${event.title} has been paused by an organizer.`, now }),
      ]);
    } else if (action === 'resume') {
      if (event.status !== 'paused') throw new BingoError('Only a paused bingo can be resumed.', 409);
      await db.batch([
        db.prepare(`UPDATE bingo_events SET status = 'live', paused_at = NULL, revision = revision + 1, updated_at = ? WHERE id = ? AND status = 'paused'`).bind(now, eventId),
        bingoActivityInsert({ eventId, type: 'event.resumed', message: `${event.title} has resumed. The hunt continues!`, now }),
      ]);
    } else {
      if (!['live', 'paused'].includes(event.status)) throw new BingoError('Only a live or paused bingo can be completed.', 409);
      await db.batch([
        db.prepare(`UPDATE bingo_events SET status = 'complete', ended_at = ?, end_at = COALESCE(end_at, ?),
          paused_at = NULL, revision = revision + 1, updated_at = ? WHERE id = ? AND status IN ('live', 'paused')`).bind(now, now, now, eventId),
        bingoActivityInsert({ eventId, type: 'event.completed', message: `${event.title} is complete. The final scores are sealed.`, now }),
      ]);
      scheduleBingoSnapshot(eventId, 'end');
      scheduleDiscordEvent(event.draft_id, 'bingo.completed', {
        username: "Terry's Drafting",
        embeds: [{ title: `${event.title} is complete`, description: 'Final scores are available on the spectator board.', color: 0xd0a23d }],
      });
    }
    await recordAudit(db, {
      draftId: event.draft_id, actorType: 'organizer', eventType: `bingo.${action === 'start' ? 'started' : action === 'complete' ? 'completed' : action === 'pause' ? 'paused' : 'resumed'}`,
      metadata: { eventId }, requestId: requestId(request), createdAt: now,
    }).catch(() => undefined);
    return json(await loadBingoView({ eventId, viewer: 'organizer' }));
  } catch (error) {
    const result = bingoErrorResponse(error);
    if (result.status >= 500) console.error('change bingo lifecycle failed', error);
    return json({ error: result.message }, { status: result.status });
  }
}

function validMode(value: unknown): BingoMode {
  return ['classic', 'points', 'lockout', 'blackout', 'progression', 'categories'].includes(String(value)) ? String(value) as BingoMode : 'points';
}
function validScope(value: unknown): BingoBoardScope { return value === 'shared' ? 'shared' : 'per_team'; }
function validDate(value: unknown) {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function clampInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, Math.round(number))) : fallback;
}
