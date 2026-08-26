import { resolveManagerDraftId } from '../../../../../lib/access-tokens';
import { recordAudit } from '../../../../../lib/audit';
import { ensureSchema, getDatabase, json } from '../../../../../lib/db';
import { getPlayerInsight } from '../../../../../lib/player-insights';
import { clampInteger } from '../../../../../lib/validation';

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const draftId = await resolveManagerDraftId(token);
    if (!draftId) return json({ error: 'This organizer link is not valid.' }, { status: 404 });
    const body = await request.json().catch(() => ({})) as { offset?: unknown; limit?: unknown; refresh?: unknown };
    const offset = clampInteger(body.offset, 0, 120, 0);
    const limit = clampInteger(body.limit, 1, 25, 20);
    const db = getDatabase();
    const [players, count] = await Promise.all([
      db.prepare("SELECT id, name FROM players WHERE draft_id = ? AND signup_status = 'approved' AND withdrawn_at IS NULL ORDER BY sort_order LIMIT ? OFFSET ?")
        .bind(draftId, limit, offset).all<{ id: string; name: string }>(),
      db.prepare("SELECT COUNT(*) AS count FROM players WHERE draft_id = ? AND signup_status = 'approved' AND withdrawn_at IS NULL")
        .bind(draftId).first<{ count: number }>(),
    ]);
    const outcomes: { playerId: string; name: string; ok: boolean; cacheState?: string; error?: string }[] = [];
    for (let index = 0; index < players.results.length; index += 4) {
      const chunk = players.results.slice(index, index + 4);
      outcomes.push(...await Promise.all(chunk.map(async (player) => {
        try {
          const insight = await getPlayerInsight(player.name, { force: body.refresh === true });
          return { playerId: player.id, name: player.name, ok: true, cacheState: insight.cache.state };
        } catch (error) {
          return { playerId: player.id, name: player.name, ok: false, error: error instanceof Error ? error.message : String(error) };
        }
      })));
    }
    const failed = outcomes.filter((outcome) => !outcome.ok);
    await recordAudit(db, {
      draftId, actorType: 'organizer', eventType: 'insights.prefetched',
      metadata: { offset, count: outcomes.length, failures: failed.length },
    });
    return json({ outcomes, nextOffset: offset + outcomes.length, total: count?.count ?? 0, complete: offset + outcomes.length >= (count?.count ?? 0) });
  } catch (error) {
    console.error('prefetch player insights failed', error);
    return json({ error: 'The OSRS data batch could not be refreshed.' }, { status: 500 });
  }
}
