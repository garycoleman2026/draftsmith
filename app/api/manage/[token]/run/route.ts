import { assignTeams, DraftAssignmentError, type CaptainRow, type ConstraintRow, type PlayerRow, type RankingRow } from '../../../../../lib/draft';
import { ensureSchema, getDatabase, json } from '../../../../../lib/db';
import type { BalancePreset, DraftType } from '../../../../../lib/types';
import { resolveManagerDraftId } from '../../../../../lib/access-tokens';
import { recordAudit } from '../../../../../lib/audit';
import { buildPlayerMetrics, type MetricAnswer } from '../../../../../lib/player-metrics';
import { scheduleDiscordEvent } from '../../../../../lib/discord-webhooks';

type DraftRow = {
  id: string; draft_type: DraftType; balance_preset: BalancePreset; balance_weights_json: string | null;
};
type CaptainRunRow = CaptainRow & { submitted_at: string | null };

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
      ? await db.prepare('SELECT id, draft_type, balance_preset, balance_weights_json FROM drafts WHERE id = ?')
        .bind(draftId).first<DraftRow>()
      : null;
    if (!draft) return json({ error: 'This organizer link is not valid.' }, { status: 404 });
    if (draft.draft_type === 'live') {
      return json({ error: 'Start this event’s live captain draft instead.' }, { status: 409 });
    }

    const body = await request.json().catch(() => ({})) as { seed?: unknown };
    const requestedSeed = typeof body.seed === 'string' ? body.seed.slice(0, 120) : '';
    const [playerResult, captainResult, rankingResult, constraintResult, metricAnswerResult, insightResult, previousRun] = await Promise.all([
      db
        .prepare("SELECT id, name, sort_order, normalized_name FROM players WHERE draft_id = ? AND signup_status = 'approved' AND withdrawn_at IS NULL ORDER BY sort_order")
        .bind(draft.id)
        .all<PlayerRow & { normalized_name: string | null }>(),
      db
        .prepare(
          `SELECT c.id, c.player_id, c.team_index, c.submitted_at, p.name
           FROM captains c JOIN players p ON p.id = c.player_id
           WHERE c.draft_id = ? AND p.signup_status = 'approved' AND p.withdrawn_at IS NULL ORDER BY c.team_index`,
        )
        .bind(draft.id)
        .all<CaptainRunRow>(),
      db
        .prepare(
          `SELECT r.captain_id, r.player_id, r.rank, r.score, r.avoid
           FROM rankings r JOIN captains c ON c.id = r.captain_id
           WHERE c.draft_id = ?`,
        )
        .bind(draft.id)
        .all<RankingRow>(),
      db
        .prepare(
          `SELECT constraint_type, enforcement, penalty, player_a_id, player_b_id
           FROM draft_constraints WHERE draft_id = ?`,
        )
        .bind(draft.id)
        .all<ConstraintRow>(),
      db.prepare(
        `SELECT sa.player_id, sq.balance_metric, sa.value
         FROM survey_answers sa JOIN survey_questions sq ON sq.id = sa.question_id
         WHERE sq.draft_id = ? AND sq.balance_metric IS NOT NULL`,
      ).bind(draft.id).all<MetricAnswer>(),
      db.prepare(
        `SELECT p.id AS player_id, pic.payload_json
         FROM players p LEFT JOIN player_insight_cache pic ON pic.normalized_name = p.normalized_name
         WHERE p.draft_id = ?`,
      ).bind(draft.id).all<{ player_id: string; payload_json: string | null }>(),
      db.prepare('SELECT COALESCE(MAX(run_number), 0) AS run_number FROM draft_runs WHERE draft_id = ?')
        .bind(draft.id).first<{ run_number: number }>(),
    ]);

    const captains = captainResult.results;
    if (!captains.length || (draft.draft_type !== 'random' && captains.some((captain) => !captain.submitted_at))) {
      return json({ error: 'Wait until every captain has submitted a ranking.' }, { status: 409 });
    }
    const captainPlayerIds = new Set(captains.map((captain) => captain.player_id));
    const eligibleIds = new Set(
      playerResult.results.filter((player) => !captainPlayerIds.has(player.id)).map((player) => player.id),
    );
    const scoreSheetsCurrent = captains.every((captain) => {
      const rows = rankingResult.results.filter((ranking) => ranking.captain_id === captain.id);
      const playerIds = new Set(rows.map((ranking) => ranking.player_id));
      const ranks = new Set(rows.map((ranking) => ranking.rank));
      return (
        rows.length === eligibleIds.size &&
        playerIds.size === eligibleIds.size &&
        [...eligibleIds].every((playerId) => playerIds.has(playerId)) &&
        ranks.size === eligibleIds.size &&
        [...eligibleIds].every((_, index) => ranks.has(index + 1))
      );
    });
    if (draft.draft_type !== 'random' && !scoreSheetsCurrent) {
      return json(
        { error: 'At least one captain’s score sheet is out of date. Ask them to open their link and resubmit.' },
        { status: 409 },
      );
    }

    const insights = new Map(insightResult.results.flatMap((row) => {
      if (!row.payload_json) return [];
      try { return [[row.player_id, JSON.parse(row.payload_json) as unknown] as const]; } catch { return []; }
    }));
    const metrics = buildPlayerMetrics(playerResult.results.map((player) => player.id), metricAnswerResult.results, insights);
    const players = playerResult.results.map((player) => ({ ...player, metrics: metrics.get(player.id) }));
    const runNumber = (previousRun?.run_number ?? 0) + 1;
    const seed = requestedSeed || `${draft.id}:run:${runNumber}`;
    const balanceWeights = parseWeights(draft.balance_weights_json);
    const result = assignTeams({
      draftId: draft.id,
      draftType: draft.draft_type,
      players,
      captains,
      rankings: rankingResult.results,
      constraints: constraintResult.results,
      balancePreset: draft.balance_preset,
      balanceWeights,
      seed,
    });
    result.runNumber = runNumber;
    const now = new Date().toISOString();
    await db.batch([
      db.prepare(
        `INSERT INTO draft_runs
          (id, draft_id, run_number, source, seed, configuration_json, result_json, fairness_json, created_at)
         VALUES (?, ?, ?, 'generated', ?, ?, ?, ?, ?)`,
      ).bind(crypto.randomUUID(), draft.id, runNumber, seed,
        JSON.stringify({ draftType: draft.draft_type, balancePreset: draft.balance_preset, balanceWeights }),
        JSON.stringify(result), JSON.stringify(result.fairness ?? {}), now),
      db.prepare(`UPDATE drafts SET result_json = ?, status = 'complete', registration_open = 0, updated_at = ? WHERE id = ?`)
        .bind(JSON.stringify(result), now, draft.id),
      db.prepare('UPDATE captains SET rankings_frozen_at = COALESCE(rankings_frozen_at, ?) WHERE draft_id = ?')
        .bind(now, draft.id),
    ]);
    await recordAudit(db, {
      draftId: draft.id, actorType: 'organizer', eventType: 'draft.generated',
      metadata: { runNumber, seed, fairness: result.fairness }, createdAt: now,
    });
    scheduleDiscordEvent(draft.id, 'draft.generated', {
      username: "Terry's Drafting",
      embeds: [{
        title: `Teams generated · Run ${runNumber}`,
        description: result.teams.map((team) => `**Team ${team.teamIndex + 1} — ${team.captain.name}**\n${team.players.map((player) => player.name).join(', ')}`).join('\n\n').slice(0, 4000),
        color: 0xd0a23d,
      }],
    });

    return json({ result });
  } catch (error) {
    console.error('run draft failed', error);
    if (error instanceof DraftAssignmentError) return json({ error: error.message, code: error.code }, { status: 409 });
    return json({ error: 'The teams could not be generated. Please try again.' }, { status: 500 });
  }
}

function parseWeights(value: string | null) {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    return Object.fromEntries(Object.entries(parsed).flatMap(([key, item]) =>
      typeof item === 'number' && Number.isFinite(item) ? [[key, item]] : [],
    ));
  } catch {
    return undefined;
  }
}
