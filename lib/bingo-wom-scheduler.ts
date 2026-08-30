import { continueWiseOldManSync, startWiseOldManSync } from './bingo-wom';
import { getDatabase } from './db';
export { isDueWiseOldManSync } from './bingo-wom-scheduler-core';

type DueRow = { event_id: string; next_sync_at: string };

export async function runDueWiseOldManSyncs(limit = 2) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const rows = await db.prepare(`SELECT bwi.event_id, bwi.next_sync_at
    FROM bingo_wom_integrations bwi JOIN bingo_events be ON be.id = bwi.event_id
    WHERE bwi.auto_sync = 1 AND bwi.group_id IS NOT NULL AND bwi.baseline_run_id IS NOT NULL
      AND be.status = 'live' AND bwi.next_sync_at IS NOT NULL AND bwi.next_sync_at <= ?
      AND bwi.status NOT IN ('running', 'reconciling')
    ORDER BY bwi.next_sync_at LIMIT ?`).bind(now, Math.max(1, Math.min(5, limit))).all<DueRow>();
  const results: Array<{ eventId: string; status: string; error?: string }> = [];
  for (const row of rows.results) {
    const leaseUntil = new Date(Date.now() + 15 * 60_000).toISOString();
    const lease = await db.prepare(`UPDATE bingo_wom_integrations SET status = 'scheduled', next_sync_at = ?, updated_at = ?
      WHERE event_id = ? AND next_sync_at = ? AND status NOT IN ('running', 'reconciling')`)
      .bind(leaseUntil, now, row.event_id, row.next_sync_at).run();
    if (!lease.meta.changes) continue;
    try {
      const started = await startWiseOldManSync({ eventId: row.event_id, phase: 'checkpoint' });
      let run = started.run;
      let turns = 0;
      while (!['complete', 'partial', 'failed'].includes(run.status) && turns < 500) {
        run = (await continueWiseOldManSync({ eventId: row.event_id, runId: run.id })).run;
        turns += 1;
      }
      results.push({ eventId: row.event_id, status: run.status });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : 'Background sync failed.';
      await db.prepare(`UPDATE bingo_wom_integrations SET status = 'failed', last_error = ?, next_sync_at = ?, updated_at = ? WHERE event_id = ?`)
        .bind(message, new Date(Date.now() + 30 * 60_000).toISOString(), new Date().toISOString(), row.event_id).run();
      results.push({ eventId: row.event_id, status: 'failed', error: message });
    }
  }
  return { checked: rows.results.length, ran: results.length, results };
}
