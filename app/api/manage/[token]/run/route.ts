import { assignTeams, type CaptainRow, type ConstraintRow, type PlayerRow, type RankingRow } from '../../../../../lib/draft';
import { ensureSchema, getDatabase, json } from '../../../../../lib/db';
import type { DraftType } from '../../../../../lib/types';

type DraftRow = { id: string; draft_type: DraftType };
type CaptainRunRow = CaptainRow & { submitted_at: string | null };

export async function POST(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const db = getDatabase();
    const draft = await db
      .prepare('SELECT id, draft_type FROM drafts WHERE admin_token = ?')
      .bind(token)
      .first<DraftRow>();
    if (!draft) return json({ error: 'This organizer link is not valid.' }, { status: 404 });
    if (draft.draft_type === 'live') {
      return json({ error: 'Start this event’s live captain draft instead.' }, { status: 409 });
    }

    const [playerResult, captainResult, rankingResult, constraintResult] = await Promise.all([
      db
        .prepare('SELECT id, name, sort_order FROM players WHERE draft_id = ? ORDER BY sort_order')
        .bind(draft.id)
        .all<PlayerRow>(),
      db
        .prepare(
          `SELECT c.id, c.player_id, c.team_index, c.submitted_at, p.name
           FROM captains c JOIN players p ON p.id = c.player_id
           WHERE c.draft_id = ? ORDER BY c.team_index`,
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
          `SELECT constraint_type, player_a_id, player_b_id
           FROM draft_constraints WHERE draft_id = ?`,
        )
        .bind(draft.id)
        .all<ConstraintRow>(),
    ]);

    const captains = captainResult.results;
    if (!captains.length || captains.some((captain) => !captain.submitted_at)) {
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
    if (!scoreSheetsCurrent) {
      return json(
        { error: 'At least one captain’s score sheet is out of date. Ask them to open their link and resubmit.' },
        { status: 409 },
      );
    }

    const result = assignTeams({
      draftId: draft.id,
      draftType: draft.draft_type,
      players: playerResult.results,
      captains,
      rankings: rankingResult.results,
      constraints: constraintResult.results,
    });
    const now = new Date().toISOString();
    await db
      .prepare(
        `UPDATE drafts
         SET result_json = ?, status = 'complete', updated_at = ?
         WHERE id = ?`,
      )
      .bind(JSON.stringify(result), now, draft.id)
      .run();

    return json({ result });
  } catch (error) {
    console.error('run draft failed', error);
    return json({ error: 'The teams could not be generated. Please try again.' }, { status: 500 });
  }
}
