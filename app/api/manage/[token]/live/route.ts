import { ensureSchema, getDatabase, json } from '../../../../../lib/db';

type DraftRow = { id: string; draft_type: string; team_count: number };

export async function POST(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const db = getDatabase();
    const draft = await db
      .prepare('SELECT id, draft_type, team_count FROM drafts WHERE admin_token = ?')
      .bind(token)
      .first<DraftRow>();
    if (!draft) return json({ error: 'This organizer link is not valid.' }, { status: 404 });
    if (draft.draft_type !== 'live') {
      return json({ error: 'This event is not configured for live captain picking.' }, { status: 409 });
    }
    const [playerCount, captainCount] = await Promise.all([
      db.prepare('SELECT COUNT(*) AS count FROM players WHERE draft_id = ?').bind(draft.id).first<{ count: number }>(),
      db.prepare('SELECT COUNT(*) AS count FROM captains WHERE draft_id = ?').bind(draft.id).first<{ count: number }>(),
    ]);
    if ((captainCount?.count ?? 0) !== draft.team_count) {
      return json({ error: `Choose all ${draft.team_count} captains before starting.` }, { status: 409 });
    }
    if ((playerCount?.count ?? 0) <= draft.team_count) {
      return json({ error: 'Add at least one draftable player before starting.' }, { status: 409 });
    }
    const now = new Date().toISOString();
    await db.batch([
      db.prepare('DELETE FROM live_picks WHERE draft_id = ?').bind(draft.id),
      db
        .prepare(
          `UPDATE drafts SET status = 'live', result_json = NULL,
             live_started_at = ?, registration_open = 0, updated_at = ? WHERE id = ?`,
        )
        .bind(now, now, draft.id),
    ]);
    return json({ started: true, startedAt: now });
  } catch (error) {
    console.error('start live draft failed', error);
    return json({ error: 'The live draft could not be started.' }, { status: 500 });
  }
}
