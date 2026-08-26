import { recordAudit } from './audit';
import { getDatabase } from './db';
import { getTargetTeamSizes, type CaptainRow, type ConstraintRow, type PlayerRow } from './draft';
import {
  buildLiveResult,
  getLiveCaptainOrder,
  getLiveTurn,
  getTogetherGroupIds,
  hasApartConflict,
  type LivePickRow,
  type LiveTurnActionRow,
} from './live';
import type { DraftResult, LiveOrder } from './types';
import { scheduleDiscordEvent } from './discord-webhooks';

type LiveDraft = {
  id: string; status: string; draft_type: string; live_started_at: string | null;
  live_order: LiveOrder; live_pick_seconds: number; live_auto_pick: number;
  live_paused_at: string | null; live_turn_started_at: string | null;
};

type LiveState = {
  draft: LiveDraft;
  players: PlayerRow[];
  captains: CaptainRow[];
  picks: LivePickRow[];
  actions: LiveTurnActionRow[];
  constraints: ConstraintRow[];
};

export class LiveDraftError extends Error {
  readonly status: number;
  constructor(message: string, status = 409) { super(message); this.status = status; }
}

export async function loadLiveState(draftId: string): Promise<LiveState> {
  const db = getDatabase();
  const [draft, players, captains, picks, actions, constraints] = await Promise.all([
    db.prepare(`SELECT id, status, draft_type, live_started_at, live_order, live_pick_seconds,
                       live_auto_pick, live_paused_at, live_turn_started_at FROM drafts WHERE id = ?`)
      .bind(draftId).first<LiveDraft>(),
    db.prepare("SELECT id, name, sort_order FROM players WHERE draft_id = ? AND signup_status = 'approved' AND withdrawn_at IS NULL ORDER BY sort_order")
      .bind(draftId).all<PlayerRow>(),
    db.prepare(`SELECT c.id, c.player_id, c.team_index, p.name FROM captains c
                JOIN players p ON p.id = c.player_id WHERE c.draft_id = ?
                AND p.signup_status = 'approved' AND p.withdrawn_at IS NULL ORDER BY c.team_index`)
      .bind(draftId).all<CaptainRow>(),
    db.prepare('SELECT captain_id, player_id, pick_number, turn_number, picked_at FROM live_picks WHERE draft_id = ? ORDER BY pick_number')
      .bind(draftId).all<LivePickRow>(),
    db.prepare('SELECT captain_id, turn_number, action, player_ids_json, created_at FROM live_turn_actions WHERE draft_id = ? ORDER BY turn_number')
      .bind(draftId).all<LiveTurnActionRow>(),
    db.prepare('SELECT constraint_type, enforcement, penalty, player_a_id, player_b_id FROM draft_constraints WHERE draft_id = ?')
      .bind(draftId).all<ConstraintRow>(),
  ]);
  if (!draft) throw new LiveDraftError('This event no longer exists.', 404);
  return {
    draft, players: players.results, captains: captains.results, picks: picks.results,
    actions: actions.results, constraints: constraints.results,
  };
}

export async function commitLivePick(input: {
  draftId: string; requestedByCaptainId?: string | null; playerId: string; action?: 'pick' | 'auto';
}) {
  const state = await loadLiveState(input.draftId);
  requireActive(state);
  const current = getCurrent(state);
  if (!current) throw new LiveDraftError('The draft is already complete.');
  if (input.requestedByCaptainId && current.captain.id !== input.requestedByCaptainId) {
    throw new LiveDraftError(`It is ${current.captain.name}’s turn.`);
  }
  const captainPlayerIds = new Set(state.captains.map((captain) => captain.player_id));
  const pickedIds = new Set(state.picks.map((pick) => pick.player_id));
  if (captainPlayerIds.has(input.playerId) || pickedIds.has(input.playerId) || !state.players.some((player) => player.id === input.playerId)) {
    throw new LiveDraftError('That player is no longer available.');
  }
  const togetherIds = new Set(getTogetherGroupIds(input.playerId, state.players, state.constraints));
  const otherCaptain = state.captains.find((captain) => togetherIds.has(captain.player_id) && captain.id !== current.captain.id);
  if (otherCaptain) throw new LiveDraftError(`That together group is reserved for ${otherCaptain.name}’s team.`);
  const incoming = state.players.filter((player) =>
    togetherIds.has(player.id) && !captainPlayerIds.has(player.id) && !pickedIds.has(player.id));
  if (!incoming.length) throw new LiveDraftError('That player is no longer available.');
  const captainOrder = getLiveCaptainOrder(state.captains, state.draft.live_order, state.draft.id);
  const position = captainOrder.findIndex((captain) => captain.id === current.captain.id);
  const targetSize = getTargetTeamSizes(state.players.length, state.captains.length)[position] ?? 1;
  const currentTeamIds = new Set([
    current.captain.player_id,
    ...state.picks.filter((pick) => pick.captain_id === current.captain.id).map((pick) => pick.player_id),
  ]);
  if (currentTeamIds.size + incoming.length > targetSize) throw new LiveDraftError('That together group is too large for the remaining team slots.');
  if (hasApartConflict(currentTeamIds, new Set(incoming.map((player) => player.id)), state.constraints)) {
    throw new LiveDraftError('That pick would break a hard apart rule.');
  }
  return commitAction(state, current.turnNumber, current.captain, input.action ?? 'pick', incoming);
}

export async function commitLivePass(draftId: string, action: 'pass' | 'skip' = 'pass') {
  const state = await loadLiveState(draftId);
  requireActive(state);
  const current = getCurrent(state);
  if (!current) throw new LiveDraftError('The draft is already complete.');
  return commitAction(state, current.turnNumber, current.captain, action, []);
}

export async function autoPickCurrent(draftId: string, force = false) {
  const state = await loadLiveState(draftId);
  requireActive(state);
  if (!state.draft.live_auto_pick && !force) return null;
  const seconds = state.draft.live_pick_seconds;
  const started = Date.parse(state.draft.live_turn_started_at ?? state.draft.live_started_at ?? '');
  if (!force && (!seconds || !Number.isFinite(started) || Date.now() < started + seconds * 1000)) return null;
  const current = getCurrent(state);
  if (!current) return null;
  const rankings = await getDatabase().prepare(
    `SELECT r.player_id, r.rank, r.score FROM rankings r WHERE r.captain_id = ? ORDER BY r.score DESC, r.rank ASC`,
  ).bind(current.captain.id).all<{ player_id: string; rank: number; score: number | null }>();
  const picked = new Set(state.picks.map((pick) => pick.player_id));
  const captains = new Set(state.captains.map((captain) => captain.player_id));
  const preference = rankings.results.map((row) => row.player_id);
  const candidates = [
    ...preference,
    ...state.players.map((player) => player.id).filter((id) => !preference.includes(id)),
  ].filter((id) => !picked.has(id) && !captains.has(id));
  for (const playerId of candidates) {
    try { return await commitLivePick({ draftId, playerId, action: 'auto' }); }
    catch (error) { if (!(error instanceof LiveDraftError)) throw error; }
  }
  return commitLivePass(draftId, 'skip');
}

export async function undoLastLiveAction(draftId: string) {
  const state = await loadLiveState(draftId);
  const latest = [...state.actions].sort((a, b) => b.turn_number - a.turn_number)[0];
  if (!latest) throw new LiveDraftError('There is no live turn to undo.');
  const now = new Date().toISOString();
  const db = getDatabase();
  await db.batch([
    db.prepare('DELETE FROM live_picks WHERE draft_id = ? AND turn_number = ?').bind(draftId, latest.turn_number),
    db.prepare('DELETE FROM live_turn_actions WHERE draft_id = ? AND turn_number = ?').bind(draftId, latest.turn_number),
    db.prepare(`UPDATE drafts SET status = 'live', result_json = NULL, live_turn_started_at = ?,
                live_revision = live_revision + 1, updated_at = ? WHERE id = ?`).bind(now, now, draftId),
  ]);
  await recordAudit(db, { draftId, actorType: 'organizer', eventType: 'live.undo', metadata: { turnNumber: latest.turn_number }, createdAt: now });
  return { undoneTurn: latest.turn_number };
}

function requireActive(state: LiveState) {
  if (state.draft.draft_type !== 'live' || !state.draft.live_started_at || state.draft.status !== 'live') {
    throw new LiveDraftError('The organizer has not started the live draft.');
  }
  if (state.draft.live_paused_at) throw new LiveDraftError('The live draft is paused.');
}

function getCurrent(state: LiveState) {
  return getLiveTurn({
    totalPlayers: state.players.length, captains: state.captains, picks: state.picks,
    actions: state.actions, order: state.draft.live_order, randomSeed: state.draft.id,
  });
}

async function commitAction(
  state: LiveState,
  turnNumber: number,
  captain: CaptainRow,
  action: 'pick' | 'auto' | 'pass' | 'skip',
  incoming: PlayerRow[],
) {
  const now = new Date().toISOString();
  const newPicks: LivePickRow[] = incoming.map((player, index) => ({
    captain_id: captain.id, player_id: player.id, pick_number: state.picks.length + index,
    turn_number: turnNumber, picked_at: now,
  }));
  const updatedPicks = [...state.picks, ...newPicks];
  const draftableCount = state.players.length - state.captains.length;
  const complete = updatedPicks.length >= draftableCount;
  const result: DraftResult | null = complete
    ? buildLiveResult({ players: state.players, captains: state.captains, picks: updatedPicks })
    : null;
  const db = getDatabase();
  const previousRun = complete
    ? await db.prepare('SELECT COALESCE(MAX(run_number), 0) AS run_number FROM draft_runs WHERE draft_id = ?')
      .bind(state.draft.id).first<{ run_number: number }>()
    : null;
  const runNumber = complete ? (previousRun?.run_number ?? 0) + 1 : null;
  if (result && runNumber) {
    result.runNumber = runNumber;
    result.seed = `${state.draft.id}:live`;
  }
  try {
    await db.batch([
      db.prepare(`INSERT INTO live_turn_actions
        (id, draft_id, captain_id, turn_number, action, player_ids_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), state.draft.id, captain.id, turnNumber, action,
          JSON.stringify(incoming.map((player) => player.id)), now),
      ...newPicks.map((pick) => db.prepare(`INSERT INTO live_picks
        (id, draft_id, captain_id, player_id, pick_number, turn_number, picked_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), state.draft.id, pick.captain_id, pick.player_id,
          pick.pick_number, pick.turn_number, pick.picked_at)),
      db.prepare(`UPDATE drafts SET status = ?, result_json = ?, live_turn_started_at = ?,
                  live_revision = live_revision + 1, updated_at = ? WHERE id = ?`)
        .bind(complete ? 'complete' : 'live', result ? JSON.stringify(result) : null, now, now, state.draft.id),
      ...(result && runNumber ? [db.prepare(`INSERT INTO draft_runs
        (id, draft_id, run_number, source, seed, configuration_json, result_json, fairness_json, created_at)
        VALUES (?, ?, ?, 'live', ?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), state.draft.id, runNumber, result.seed,
          JSON.stringify({ order: state.draft.live_order }), JSON.stringify(result), JSON.stringify({}), now)] : []),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/unique|constraint/i.test(message)) throw new LiveDraftError('That turn was already completed. Refresh the board.');
    throw error;
  }
  await recordAudit(db, {
    draftId: state.draft.id, actorType: action === 'auto' ? 'system' : action === 'pick' ? 'captain' : 'organizer',
    actorReference: captain.id, eventType: `live.${action}`,
    metadata: { turnNumber, playerIds: incoming.map((player) => player.id), complete }, createdAt: now,
  });
  if (action === 'pick' || action === 'auto') {
    scheduleDiscordEvent(state.draft.id, action === 'auto' ? 'live.auto' : 'live.pick', {
      username: "Terry's Drafting",
      embeds: [{
        title: `${captain.name} ${action === 'auto' ? 'auto-picked' : 'picked'}`,
        description: incoming.map((player) => `• ${player.name}`).join('\n'), color: action === 'auto' ? 0xa96332 : 0x3f6a45,
      }],
    });
  }
  if (complete) scheduleDiscordEvent(state.draft.id, 'draft.complete', {
    username: "Terry's Drafting",
    embeds: [{ title: 'Live draft complete', description: 'Every roster slot is filled and the teams are locked.', color: 0xd0a23d }],
  });
  return { picked: incoming.map((player) => ({ id: player.id, name: player.name })), complete, result, turnNumber };
}
