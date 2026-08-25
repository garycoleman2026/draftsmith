import { assignTeams } from '../../../../../lib/draft';
import { ensureSchema, getDatabase, json } from '../../../../../lib/db';
import type { DraftType } from '../../../../../lib/types';

type DraftRow = { id: string; draft_type: DraftType };
type PlayerRow = { id: string; name: string; sort_order: number };
type CaptainRow = {
  id: string;
  player_id: string;
  team_index: number;
  name: string;
  submitted_at: string | null;
};
type RankingRow = { captain_id: string; player_id: string; rank: number; avoid: number };

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

    const [playerResult, captainResult, rankingResult] = await Promise.all([
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
        .all<CaptainRow>(),
      db
        .prepare(
          `SELECT r.captain_id, r.player_id, r.rank, r.avoid
           FROM rankings r JOIN captains c ON c.id = r.captain_id
           WHERE c.draft_id = ?`,
        )
        .bind(draft.id)
        .all<RankingRow>(),
    ]);

    const captains = captainResult.results;
    if (!captains.length || captains.some((captain) => !captain.submitted_at)) {
      return json({ error: 'Wait until every captain has submitted a ranking.' }, { status: 409 });
    }

    const result = assignTeams({
      draftId: draft.id,
      draftType: draft.draft_type,
      players: playerResult.results,
      captains,
      rankings: rankingResult.results,
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
