import { type CaptainRow, type ConstraintRow } from '../../../../lib/draft';
import { getLiveTurn, type LivePickRow, type LiveTurnActionRow } from '../../../../lib/live';
import { ensureSchema, getDatabase, json } from '../../../../lib/db';
import { resolveCaptainId } from '../../../../lib/access-tokens';
import { recordAudit } from '../../../../lib/audit';
import { isExpired } from '../../../../lib/validation';
import { scheduleDiscordEvent } from '../../../../lib/discord-webhooks';
import type { DraftResult, DraftType } from '../../../../lib/types';

type CaptainDraftRow = {
  captain_id: string;
  captain_player_id: string;
  captain_name: string;
  draft_id: string;
  title: string;
  draft_type: DraftType;
  team_count: number;
  status: string;
  result_json: string | null;
  submitted_at: string | null;
  ranking_revision: number;
  rankings_frozen_at: string | null;
  ranking_deadline: string | null;
  live_started_at: string | null;
  live_order: 'snake' | 'linear' | 'random' | 'third_round_reversal';
  live_pick_seconds: number;
  live_auto_pick: number;
  live_paused_at: string | null;
  live_turn_started_at: string | null;
};
type PlayerRow = { id: string; name: string; sort_order: number };
type RankingQueryRow = { player_id: string; rank: number; score: number | null; avoid: number };
type AnswerRow = { player_id: string; question_id: string; label: string; value: string };
type PickQueryRow = LivePickRow & { player_name: string };

async function findCaptain(token: string) {
  const captainId = await resolveCaptainId(token);
  if (!captainId) return null;
  return getDatabase()
    .prepare(
      `SELECT c.id AS captain_id, c.player_id AS captain_player_id,
              p.name AS captain_name, c.draft_id, c.submitted_at, c.ranking_revision,
              c.rankings_frozen_at, d.ranking_deadline,
              d.title, d.draft_type, d.team_count, d.status, d.result_json,
              d.live_started_at, d.live_order, d.live_pick_seconds, d.live_auto_pick,
              d.live_paused_at, d.live_turn_started_at
       FROM captains c
       JOIN players p ON p.id = c.player_id
       JOIN drafts d ON d.id = c.draft_id
       WHERE c.id = ?`,
    )
    .bind(captainId)
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
    const [playerResult, captainResult, rankingResult, answerResult, constraintResult, pickResult, actionResult] =
      await Promise.all([
        db
          .prepare("SELECT id, name, sort_order FROM players WHERE draft_id = ? AND signup_status = 'approved' AND withdrawn_at IS NULL ORDER BY sort_order")
          .bind(captain.draft_id)
          .all<PlayerRow>(),
        db
          .prepare(
            `SELECT c.id, c.player_id, c.team_index, p.name
             FROM captains c JOIN players p ON p.id = c.player_id
             WHERE c.draft_id = ? AND p.signup_status = 'approved' AND p.withdrawn_at IS NULL
             ORDER BY c.team_index`,
          )
          .bind(captain.draft_id)
          .all<CaptainRow>(),
        db
          .prepare('SELECT player_id, rank, score, avoid FROM rankings WHERE captain_id = ? ORDER BY rank')
          .bind(captain.captain_id)
          .all<RankingQueryRow>(),
        db
          .prepare(
            `SELECT sa.player_id, sa.question_id, sq.label, sa.value
             FROM survey_answers sa
             JOIN survey_questions sq ON sq.id = sa.question_id
             WHERE sq.draft_id = ? AND sq.visibility IN ('captains', 'public')
             ORDER BY sq.sort_order`,
          )
          .bind(captain.draft_id)
          .all<AnswerRow>(),
        db
          .prepare(
            `SELECT constraint_type, player_a_id, player_b_id
             FROM draft_constraints WHERE draft_id = ?`,
          )
          .bind(captain.draft_id)
          .all<ConstraintRow>(),
        db
          .prepare(
            `SELECT lp.captain_id, lp.player_id, lp.pick_number, lp.turn_number,
                    lp.picked_at, p.name AS player_name
             FROM live_picks lp JOIN players p ON p.id = lp.player_id
             WHERE lp.draft_id = ? ORDER BY lp.pick_number`,
          )
          .bind(captain.draft_id)
          .all<PickQueryRow>(),
        db
          .prepare(`SELECT captain_id, turn_number, action, player_ids_json, created_at
                    FROM live_turn_actions WHERE draft_id = ? ORDER BY turn_number`)
          .bind(captain.draft_id)
          .all<LiveTurnActionRow>(),
      ]);
    const captainPlayerIds = new Set(captainResult.results.map((row) => row.player_id));
    const players = playerResult.results.filter((player) => !captainPlayerIds.has(player.id));
    const rankingByPlayer = new Map(
      rankingResult.results.map((ranking) => [ranking.player_id, ranking] as const),
    );
    const answersByPlayer = new Map<string, AnswerRow[]>();
    for (const answer of answerResult.results) {
      const answers = answersByPlayer.get(answer.player_id) ?? [];
      answers.push(answer);
      answersByPlayer.set(answer.player_id, answers);
    }
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

    const picks = pickResult.results;
    const currentTurn = captain.live_started_at
      ? getLiveTurn({
          totalPlayers: playerResult.results.length,
          captains: captainResult.results,
          picks,
          actions: actionResult.results,
          order: captain.live_order,
          randomSeed: captain.draft_id,
        })
      : null;
    const pickedIds = new Set(picks.map((pick) => pick.player_id));

    return json({
      draft: {
        title: captain.title,
        draftType: captain.draft_type,
        teamCount: captain.team_count,
        status: captain.status,
      },
      captain: {
        id: captain.captain_id,
        playerId: captain.captain_player_id,
        name: captain.captain_name,
        submittedAt: captain.submitted_at,
        revision: captain.ranking_revision,
        frozenAt: captain.rankings_frozen_at,
        rankingDeadline: captain.ranking_deadline,
        canEditRankings: !captain.rankings_frozen_at && !captain.live_started_at && !isExpired(captain.ranking_deadline),
      },
      players: orderedPlayers.map((player, index) => ({
        id: player.id,
        name: player.name,
        score: rankingByPlayer.get(player.id)?.score ?? scoreFromRank(index + 1, orderedPlayers.length),
        avoid: Boolean(rankingByPlayer.get(player.id)?.avoid),
        answers: (answersByPlayer.get(player.id) ?? []).map((answer) => ({
          questionId: answer.question_id,
          label: answer.label,
          value: answer.value,
        })),
      })),
      live: captain.draft_type === 'live' ? {
        started: Boolean(captain.live_started_at),
        order: captain.live_order,
        pickSeconds: captain.live_pick_seconds,
        autoPick: Boolean(captain.live_auto_pick),
        paused: Boolean(captain.live_paused_at),
        turnStartedAt: captain.live_turn_started_at,
        currentCaptain: currentTurn ? {
          id: currentTurn.captain.id,
          name: currentTurn.captain.name,
          teamIndex: currentTurn.captain.team_index,
          turnNumber: currentTurn.turnNumber,
        } : null,
        captains: captainResult.results.map((item) => ({
          id: item.id,
          playerId: item.player_id,
          name: item.name,
          teamIndex: item.team_index,
        })),
        picks: picks.map((pick) => ({
          captainId: pick.captain_id,
          playerId: pick.player_id,
          playerName: pick.player_name,
          pickNumber: pick.pick_number,
          turnNumber: pick.turn_number,
        })),
        availablePlayerIds: players.filter((player) => !pickedIds.has(player.id)).map((player) => player.id),
        constraints: constraintResult.results.map((constraint) => ({
          type: constraint.constraint_type,
          playerAId: constraint.player_a_id,
          playerBId: constraint.player_b_id,
        })),
      } : null,
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
    if (captain.rankings_frozen_at || captain.live_started_at || isExpired(captain.ranking_deadline)) {
      return json({ error: 'Rankings are frozen for this event.' }, { status: 409 });
    }
    const body = (await request.json()) as { rankings?: unknown };
    const rawRankings = Array.isArray(body.rankings) ? body.rankings : [];
    const rankings = rawRankings
      .filter(
        (ranking): ranking is { playerId: string; rank: number; score?: number; avoid: boolean } =>
          Boolean(ranking) &&
          typeof ranking === 'object' &&
          typeof (ranking as { playerId?: unknown }).playerId === 'string' &&
          Number.isInteger((ranking as { rank?: unknown }).rank) &&
          typeof (ranking as { avoid?: unknown }).avoid === 'boolean',
      )
      .map((ranking) => ({
        playerId: ranking.playerId,
        rank: Number(ranking.rank),
        score: Number.isInteger(ranking.score) ? Number(ranking.score) : null,
        avoid: ranking.avoid,
      }));

    const db = getDatabase();
    const [playerResult, captainPlayerResult] = await Promise.all([
      db.prepare('SELECT id FROM players WHERE draft_id = ?').bind(captain.draft_id).all<{ id: string }>(),
      db.prepare('SELECT player_id FROM captains WHERE draft_id = ?').bind(captain.draft_id).all<{ player_id: string }>(),
    ]);
    const captainPlayerIds = new Set(captainPlayerResult.results.map((row) => row.player_id));
    const eligibleIds = playerResult.results.map((player) => player.id).filter((id) => !captainPlayerIds.has(id));
    const submittedIds = new Set(rankings.map((ranking) => ranking.playerId));
    const ranks = new Set(rankings.map((ranking) => ranking.rank));
    const hasEveryPlayer =
      rankings.length === eligibleIds.length &&
      submittedIds.size === eligibleIds.length &&
      eligibleIds.every((id) => submittedIds.has(id));
    const hasEveryRank =
      ranks.size === eligibleIds.length && eligibleIds.every((_, index) => ranks.has(index + 1));
    const validScores = rankings.every(
      (ranking) => ranking.score === null || (ranking.score >= 1 && ranking.score <= 10),
    );
    if (!hasEveryPlayer || !hasEveryRank || !validScores) {
      return json({ error: 'Score every available player from 1 to 10.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const revision = captain.ranking_revision + 1;
    await db.batch([
      db.prepare('DELETE FROM rankings WHERE captain_id = ?').bind(captain.captain_id),
      ...rankings.map((ranking) =>
        db
          .prepare(
            'INSERT INTO rankings (captain_id, player_id, rank, score, avoid) VALUES (?, ?, ?, ?, ?)',
          )
          .bind(
            captain.captain_id,
            ranking.playerId,
            ranking.rank,
            ranking.score ?? scoreFromRank(ranking.rank, eligibleIds.length),
            ranking.avoid ? 1 : 0,
          ),
      ),
      db.prepare(
        `INSERT INTO ranking_revisions (id, captain_id, revision, rankings_json, submitted_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).bind(crypto.randomUUID(), captain.captain_id, revision, JSON.stringify(rankings), now),
      db.prepare('UPDATE captains SET submitted_at = ?, ranking_revision = ? WHERE id = ?')
        .bind(now, revision, captain.captain_id),
      db
        .prepare(
          `UPDATE drafts SET status = 'rankings', result_json = NULL, updated_at = ? WHERE id = ?`,
        )
        .bind(now, captain.draft_id),
    ]);
    await recordAudit(db, {
      draftId: captain.draft_id,
      actorType: 'captain',
      actorReference: captain.captain_id,
      eventType: 'captain.rankings_submitted',
      metadata: { revision, playerCount: rankings.length },
      createdAt: now,
    });
    scheduleDiscordEvent(captain.draft_id, 'captain.rankings_submitted', {
      username: "Terry's Drafting",
      embeds: [{ title: `${captain.captain_name} submitted rankings`, description: `Revision ${revision}`, color: 0x3f6a45 }],
    });
    return json({ submittedAt: now, revision });
  } catch (error) {
    console.error('save ranking failed', error);
    return json({ error: 'Your scores could not be saved. Please try again.' }, { status: 500 });
  }
}

function scoreFromRank(rank: number, playerCount: number) {
  if (playerCount <= 1) return 10;
  return Math.max(1, Math.min(10, Math.round(10 - ((rank - 1) * 9) / (playerCount - 1))));
}
