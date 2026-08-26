import { type CaptainRow, type ConstraintRow, getTargetTeamSizes, type PlayerRow } from '../../../../../lib/draft';
import {
  buildLiveResult,
  getLiveTurn,
  getTogetherGroupIds,
  hasApartConflict,
  type LivePickRow,
} from '../../../../../lib/live';
import { ensureSchema, getDatabase, json } from '../../../../../lib/db';

type CaptainDraftRow = {
  captain_id: string;
  captain_player_id: string;
  draft_id: string;
  draft_type: string;
  status: string;
  live_started_at: string | null;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const db = getDatabase();
    const captain = await db
      .prepare(
        `SELECT c.id AS captain_id, c.player_id AS captain_player_id, c.draft_id,
                d.draft_type, d.status, d.live_started_at
         FROM captains c JOIN drafts d ON d.id = c.draft_id WHERE c.token = ?`,
      )
      .bind(token)
      .first<CaptainDraftRow>();
    if (!captain) return json({ error: 'This captain link is not valid.' }, { status: 404 });
    if (captain.draft_type !== 'live' || !captain.live_started_at || captain.status !== 'live') {
      return json({ error: 'The organizer has not started the live draft.' }, { status: 409 });
    }
    const body = (await request.json()) as { playerId?: unknown };
    const playerId = typeof body.playerId === 'string' ? body.playerId : '';
    if (!playerId) return json({ error: 'Choose an available player.' }, { status: 400 });

    const [playerResult, captainResult, pickResult, constraintResult] = await Promise.all([
      db
        .prepare('SELECT id, name, sort_order FROM players WHERE draft_id = ? ORDER BY sort_order')
        .bind(captain.draft_id)
        .all<PlayerRow>(),
      db
        .prepare(
          `SELECT c.id, c.player_id, c.team_index, p.name
           FROM captains c JOIN players p ON p.id = c.player_id
           WHERE c.draft_id = ? ORDER BY c.team_index`,
        )
        .bind(captain.draft_id)
        .all<CaptainRow>(),
      db
        .prepare(
          `SELECT captain_id, player_id, pick_number, turn_number, picked_at
           FROM live_picks WHERE draft_id = ? ORDER BY pick_number`,
        )
        .bind(captain.draft_id)
        .all<LivePickRow>(),
      db
        .prepare(
          `SELECT constraint_type, player_a_id, player_b_id
           FROM draft_constraints WHERE draft_id = ?`,
        )
        .bind(captain.draft_id)
        .all<ConstraintRow>(),
    ]);
    const captains = captainResult.results;
    const picks = pickResult.results;
    const current = getLiveTurn({ totalPlayers: playerResult.results.length, captains, picks });
    if (!current || current.captain.id !== captain.captain_id) {
      return json({ error: current ? `It is ${current.captain.name}’s turn.` : 'The draft is already complete.' }, { status: 409 });
    }
    const captainPlayerIds = new Set(captains.map((item) => item.player_id));
    const pickedIds = new Set(picks.map((pick) => pick.player_id));
    if (captainPlayerIds.has(playerId) || pickedIds.has(playerId) || !playerResult.results.some((player) => player.id === playerId)) {
      return json({ error: 'That player is no longer available.' }, { status: 409 });
    }

    const constraints = constraintResult.results;
    const togetherIds = new Set(getTogetherGroupIds(playerId, playerResult.results, constraints));
    const otherCaptain = captains.find(
      (item) => togetherIds.has(item.player_id) && item.id !== captain.captain_id,
    );
    if (otherCaptain) {
      return json({ error: `That together rule reserves this group for ${otherCaptain.name}’s team.` }, { status: 409 });
    }
    const incoming = playerResult.results.filter(
      (player) => togetherIds.has(player.id) && !captainPlayerIds.has(player.id) && !pickedIds.has(player.id),
    );
    const sortedCaptains = [...captains].sort((a, b) => a.team_index - b.team_index);
    const captainPosition = sortedCaptains.findIndex((item) => item.id === captain.captain_id);
    const targetSize = getTargetTeamSizes(playerResult.results.length, captains.length)[captainPosition] ?? 1;
    const currentTeamIds = new Set([
      captain.captain_player_id,
      ...picks.filter((pick) => pick.captain_id === captain.captain_id).map((pick) => pick.player_id),
    ]);
    if (currentTeamIds.size + incoming.length > targetSize) {
      return json({ error: 'That together group is too large for the remaining team slots.' }, { status: 409 });
    }
    if (hasApartConflict(currentTeamIds, new Set(incoming.map((player) => player.id)), constraints)) {
      return json({ error: 'That pick would break an apart rule.' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const newPicks: LivePickRow[] = incoming.map((player, index) => ({
      captain_id: captain.captain_id,
      player_id: player.id,
      pick_number: picks.length + index,
      turn_number: current.turnNumber,
      picked_at: now,
    }));
    const updatedPicks = [...picks, ...newPicks];
    const draftableCount = playerResult.results.length - captains.length;
    const complete = updatedPicks.length >= draftableCount;
    const result = complete
      ? buildLiveResult({ players: playerResult.results, captains, picks: updatedPicks })
      : null;
    await db.batch([
      ...newPicks.map((pick) =>
        db
          .prepare(
            `INSERT INTO live_picks
              (id, draft_id, captain_id, player_id, pick_number, turn_number, picked_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            captain.draft_id,
            pick.captain_id,
            pick.player_id,
            pick.pick_number,
            pick.turn_number,
            pick.picked_at,
          ),
      ),
      db
        .prepare(
          `UPDATE drafts SET status = ?, result_json = ?, updated_at = ? WHERE id = ?`,
        )
        .bind(complete ? 'complete' : 'live', result ? JSON.stringify(result) : null, now, captain.draft_id),
    ]);
    return json({
      picked: incoming.map((player) => ({ id: player.id, name: player.name })),
      complete,
      result,
    });
  } catch (error) {
    console.error('save live pick failed', error);
    return json({ error: 'That pick could not be saved. Refresh and try again.' }, { status: 500 });
  }
}
