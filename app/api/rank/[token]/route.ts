import { ensureSchema, getDatabase, json } from '../../../../lib/db';
import type { DraftResult, DraftType } from '../../../../lib/types';

type CaptainDraftRow = {
  captain_id: string;
  captain_name: string;
  draft_id: string;
  title: string;
  draft_type: DraftType;
  team_count: number;
  status: string;
  result_json: string | null;
  submitted_at: string | null;
};
type PlayerRow = { id: string; name: string; sort_order: number };
type RankingRow = { player_id: string; rank: number; avoid: number };

async function findCaptain(token: string) {
  return getDatabase()
    .prepare(
      `SELECT c.id AS captain_id, p.name AS captain_name, c.draft_id,
              c.submitted_at, d.title, d.draft_type, d.team_count, d.status, d.result_json
       FROM captains c
       JOIN players p ON p.id = c.player_id
       JOIN drafts d ON d.id = c.draft_id
       WHERE c.token = ?`,
    )
    .bind(token)
    .first<CaptainDraftRow>();
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const captain = await findCaptain(token);
    if (!captain) return json({ error: 'This captain link is not valid.' }, { status: 404 });

    const db = getDatabase();
    const [playerResult, captainPlayerResult, rankingResult] = await Promise.all([
      db
        .prepare('SELECT id, name, sort_order FROM players WHERE draft_id = ? ORDER BY sort_order')
        .bind(captain.draft_id)
        .all<PlayerRow>(),
      db
        .prepare('SELECT player_id FROM captains WHERE draft_id = ?')
        .bind(captain.draft_id)
        .all<{ player_id: string }>(),
      db
        .prepare('SELECT player_id, rank, avoid FROM rankings WHERE captain_id = ? ORDER BY rank')
        .bind(captain.captain_id)
        .all<RankingRow>(),
    ]);
    const captainPlayerIds = new Set(captainPlayerResult.results.map((row) => row.player_id));
    const players = playerResult.results.filter((player) => !captainPlayerIds.has(player.id));
    const rankingByPlayer = new Map(
      rankingResult.results.map((ranking) => [ranking.player_id, ranking] as const),
    );
    const orderedPlayers = [...players].sort((a, b) => {
      const aRank = rankingByPlayer.get(a.id)?.rank;
      const bRank = rankingByPlayer.get(b.id)?.rank;
      if (aRank && bRank) return aRank - bRank;
      if (aRank) return -1;
      if (bRank) return 1;
      return a.sort_order - b.sort_order;
    });

    let result: DraftResult | null = null;
    if (captain.result_json) {
      try {
        result = JSON.parse(captain.result_json) as DraftResult;
      } catch {
        result = null;
      }
    }

    return json({
      draft: {
        title: captain.title,
        draftType: captain.draft_type,
        teamCount: captain.team_count,
        status: captain.status,
      },
      captain: {
        id: captain.captain_id,
        name: captain.captain_name,
        submittedAt: captain.submitted_at,
      },
      players: orderedPlayers.map((player) => ({
        id: player.id,
        name: player.name,
        avoid: Boolean(rankingByPlayer.get(player.id)?.avoid),
      })),
      result,
    });
  } catch (error) {
    console.error('load ranking failed', error);
    return json({ error: 'The ranking could not be loaded.' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const captain = await findCaptain(token);
    if (!captain) return json({ error: 'This captain link is not valid.' }, { status: 404 });
    const body = (await request.json()) as { rankings?: unknown };
    const rawRankings = Array.isArray(body.rankings) ? body.rankings : [];
    const rankings = rawRankings
      .filter(
        (ranking): ranking is { playerId: string; rank: number; avoid: boolean } =>
          Boolean(ranking) &&
          typeof ranking === 'object' &&
          typeof (ranking as { playerId?: unknown }).playerId === 'string' &&
          Number.isInteger((ranking as { rank?: unknown }).rank) &&
          typeof (ranking as { avoid?: unknown }).avoid === 'boolean',
      )
      .map((ranking) => ({
        playerId: ranking.playerId,
        rank: Number(ranking.rank),
        avoid: ranking.avoid,
      }));

    const db = getDatabase();
    const [playerResult, captainPlayerResult] = await Promise.all([
      db
        .prepare('SELECT id FROM players WHERE draft_id = ?')
        .bind(captain.draft_id)
        .all<{ id: string }>(),
      db
        .prepare('SELECT player_id FROM captains WHERE draft_id = ?')
        .bind(captain.draft_id)
        .all<{ player_id: string }>(),
    ]);
    const captainPlayerIds = new Set(captainPlayerResult.results.map((row) => row.player_id));
    const eligibleIds = playerResult.results
      .map((player) => player.id)
      .filter((id) => !captainPlayerIds.has(id));
    const submittedIds = new Set(rankings.map((ranking) => ranking.playerId));
    const ranks = new Set(rankings.map((ranking) => ranking.rank));
    const hasEveryPlayer =
      rankings.length === eligibleIds.length &&
      submittedIds.size === eligibleIds.length &&
      eligibleIds.every((id) => submittedIds.has(id));
    const hasEveryRank =
      ranks.size === eligibleIds.length &&
      eligibleIds.every((_, index) => ranks.has(index + 1));
    if (!hasEveryPlayer || !hasEveryRank) {
      return json({ error: 'Rank every available player exactly once.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    await db.batch([
      db.prepare('DELETE FROM rankings WHERE captain_id = ?').bind(captain.captain_id),
      ...rankings.map((ranking) =>
        db
          .prepare(
            'INSERT INTO rankings (captain_id, player_id, rank, avoid) VALUES (?, ?, ?, ?)',
          )
          .bind(captain.captain_id, ranking.playerId, ranking.rank, ranking.avoid ? 1 : 0),
      ),
      db
        .prepare('UPDATE captains SET submitted_at = ? WHERE id = ?')
        .bind(now, captain.captain_id),
      db
        .prepare(
          `UPDATE drafts
           SET status = 'collecting', result_json = NULL, updated_at = ?
           WHERE id = ?`,
        )
        .bind(now, captain.draft_id),
    ]);

    return json({ submittedAt: now });
  } catch (error) {
    console.error('save ranking failed', error);
    return json({ error: 'Your ranking could not be saved. Please try again.' }, { status: 500 });
  }
}
