import { ensureSchema, getDatabase, json } from '../../../../lib/db';
import type { DraftResult, DraftType } from '../../../../lib/types';

type DraftRow = {
  id: string;
  title: string;
  draft_type: DraftType;
  team_count: number;
  status: string;
  result_json: string | null;
  created_at: string;
};

type PlayerRow = { id: string; name: string; sort_order: number };
type CaptainRow = {
  id: string;
  name: string;
  team_index: number;
  token: string;
  submitted_at: string | null;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const db = getDatabase();
    const draft = await db
      .prepare(
        `SELECT id, title, draft_type, team_count, status, result_json, created_at
         FROM drafts WHERE admin_token = ?`,
      )
      .bind(token)
      .first<DraftRow>();
    if (!draft) return json({ error: 'This organizer link is not valid.' }, { status: 404 });

    const [playerResult, captainResult] = await Promise.all([
      db
        .prepare('SELECT id, name, sort_order FROM players WHERE draft_id = ? ORDER BY sort_order')
        .bind(draft.id)
        .all<PlayerRow>(),
      db
        .prepare(
          `SELECT c.id, p.name, c.team_index, c.token, c.submitted_at
           FROM captains c
           JOIN players p ON p.id = c.player_id
           WHERE c.draft_id = ?
           ORDER BY c.team_index`,
        )
        .bind(draft.id)
        .all<CaptainRow>(),
    ]);

    let result: DraftResult | null = null;
    if (draft.result_json) {
      try {
        result = JSON.parse(draft.result_json) as DraftResult;
      } catch {
        result = null;
      }
    }

    return json({
      draft: {
        title: draft.title,
        draftType: draft.draft_type,
        teamCount: draft.team_count,
        status: draft.status,
        createdAt: draft.created_at,
      },
      players: playerResult.results,
      captains: captainResult.results.map((captain) => ({
        id: captain.id,
        name: captain.name,
        teamIndex: captain.team_index,
        path: `/rank/${captain.token}`,
        submittedAt: captain.submitted_at,
      })),
      result,
    });
  } catch (error) {
    console.error('load organizer failed', error);
    return json({ error: 'The draft could not be loaded.' }, { status: 500 });
  }
}
