import { waitUntil } from 'cloudflare:workers';
import { recordAudit } from './audit';
import { getDatabase } from './db';
import { getPlayerInsight } from './player-insights';

export function scheduleBingoSnapshot(eventId: string, phase: 'start' | 'end') {
  try { waitUntil(captureBingoSnapshot(eventId, phase)); }
  catch { void captureBingoSnapshot(eventId, phase); }
}

export async function captureBingoSnapshot(eventId: string, phase: 'start' | 'end') {
  const db = getDatabase();
  const now = new Date().toISOString();
  await db.prepare('UPDATE bingo_events SET baseline_status = ?, updated_at = ? WHERE id = ?')
    .bind(`${phase}:running`, now, eventId).run();
  const members = await db.prepare(
    `SELECT btm.id, btm.display_name
     FROM bingo_team_members btm JOIN bingo_teams bt ON bt.id = btm.team_id
     WHERE bt.event_id = ? ORDER BY btm.display_name`,
  ).bind(eventId).all<{ id: string; display_name: string }>();
  let captured = 0;
  let failed = 0;
  for (let index = 0; index < members.results.length; index += 4) {
    const group = members.results.slice(index, index + 4);
    await Promise.all(group.map(async (member) => {
      try {
        const insight = await getPlayerInsight(member.display_name, { maxAgeMs: 15 * 60 * 1000 });
        const capturedAt = new Date().toISOString();
        await db.prepare(
          `INSERT INTO bingo_player_snapshots
            (id, event_id, member_id, phase, source_state, payload_json, captured_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(member_id, phase) DO UPDATE SET source_state = excluded.source_state,
             payload_json = excluded.payload_json, captured_at = excluded.captured_at`,
        ).bind(crypto.randomUUID(), eventId, member.id, phase, insight.cache.state, JSON.stringify(insight), capturedAt).run();
        captured += 1;
      } catch { failed += 1; }
    }));
  }
  const completedAt = new Date().toISOString();
  const finalStatus = failed ? captured ? `${phase}:partial` : `${phase}:failed` : `${phase}:complete`;
  await db.prepare('UPDATE bingo_events SET baseline_status = ?, updated_at = ? WHERE id = ?')
    .bind(finalStatus, completedAt, eventId).run();
  await recordAudit(db, {
    draftId: await eventDraftId(eventId), actorType: 'system', eventType: `bingo.snapshot_${phase}`,
    metadata: { eventId, captured, failed }, createdAt: completedAt,
  }).catch(() => undefined);
  return { captured, failed };
}

async function eventDraftId(eventId: string) {
  const row = await getDatabase().prepare('SELECT draft_id FROM bingo_events WHERE id = ?').bind(eventId).first<{ draft_id: string }>();
  return row?.draft_id ?? null;
}
