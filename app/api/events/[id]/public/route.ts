import { ensureSchema, getDatabase, json } from '../../../../../lib/db';
import type { DraftResult } from '../../../../../lib/types';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await context.params;
  const db = getDatabase();
  const draft = await db.prepare(`SELECT id, title, draft_type, team_count, status, result_json, public_slug, created_at
    FROM drafts WHERE public_slug = ?`).bind(id).first<{
      id: string; title: string; draft_type: string; team_count: number; status: string;
      result_json: string | null; public_slug: string | null; created_at: string;
    }>();
  if (!draft || draft.status === 'archived') return json({ error: 'This public event page is unavailable.' }, { status: 404 });
  const [players, answers] = await Promise.all([
    db.prepare("SELECT id, name, signup_status FROM players WHERE draft_id = ? AND signup_status = 'approved' AND withdrawn_at IS NULL ORDER BY sort_order")
      .bind(draft.id).all<{ id: string; name: string; signup_status: string }>(),
    db.prepare(`SELECT sa.player_id, sq.id AS question_id, sq.label, sa.value
      FROM survey_answers sa JOIN survey_questions sq ON sq.id = sa.question_id
      WHERE sq.draft_id = ? AND sq.visibility = 'public' ORDER BY sq.sort_order`)
      .bind(draft.id).all<{ player_id: string; question_id: string; label: string; value: string }>(),
  ]);
  const byPlayer = new Map<string, typeof answers.results>();
  for (const answer of answers.results) byPlayer.set(answer.player_id, [...(byPlayer.get(answer.player_id) ?? []), answer]);
  let result: DraftResult | null = null;
  try { result = draft.result_json ? JSON.parse(draft.result_json) as DraftResult : null; } catch { result = null; }
  return json({
    draft: { title: draft.title, draftType: draft.draft_type, teamCount: draft.team_count, status: draft.status, createdAt: draft.created_at },
    players: players.results.map((player) => ({ ...player, answers: (byPlayer.get(player.id) ?? []).map((answer) => ({ questionId: answer.question_id, label: answer.label, value: answer.value })) })),
    result,
  });
}
