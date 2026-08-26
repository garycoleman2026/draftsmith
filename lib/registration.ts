import type { getDatabase } from './db';

type Database = ReturnType<typeof getDatabase>;

export async function promoteWaitlist(db: Database, draftId: string, capacity: number) {
  const approved = await db
    .prepare("SELECT COUNT(*) AS count FROM players WHERE draft_id = ? AND signup_status = 'approved' AND withdrawn_at IS NULL")
    .bind(draftId)
    .first<{ count: number }>();
  const available = Math.max(0, capacity - (approved?.count ?? 0));
  if (!available) return [];
  const waiting = await db
    .prepare("SELECT id FROM players WHERE draft_id = ? AND signup_status = 'waitlisted' AND withdrawn_at IS NULL ORDER BY sort_order LIMIT ?")
    .bind(draftId, available)
    .all<{ id: string }>();
  if (!waiting.results.length) return [];
  const now = new Date().toISOString();
  await db.batch([
    ...waiting.results.map((player) =>
      db.prepare("UPDATE players SET signup_status = 'approved', updated_at = ? WHERE id = ?")
        .bind(now, player.id),
    ),
    db.prepare('UPDATE captains SET submitted_at = NULL, rankings_frozen_at = NULL WHERE draft_id = ?').bind(draftId),
    db.prepare("UPDATE drafts SET status = 'registration', result_json = NULL, updated_at = ? WHERE id = ?")
      .bind(now, draftId),
  ]);
  return waiting.results.map((player) => player.id);
}
