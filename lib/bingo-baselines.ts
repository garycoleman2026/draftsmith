import { waitUntil } from 'cloudflare:workers';
import { continueWiseOldManSync, startWiseOldManSync, type WomSyncPhase } from './bingo-wom';
import { getDatabase } from './db';

export function scheduleBingoSnapshot(eventId: string, phase: 'start' | 'end') {
  try { waitUntil(captureBingoSnapshot(eventId, phase)); }
  catch { void captureBingoSnapshot(eventId, phase); }
}

export async function captureBingoSnapshot(eventId: string, phase: 'start' | 'end') {
  const syncPhase: WomSyncPhase = phase === 'start' ? 'baseline' : 'final';
  const db = getDatabase();
  const integration = await db.prepare('SELECT group_id FROM bingo_wom_integrations WHERE event_id = ?')
    .bind(eventId).first<{ group_id: number | null }>();
  if (!integration?.group_id) {
    const now = new Date().toISOString();
    await db.prepare('UPDATE bingo_events SET baseline_status = ?, updated_at = ? WHERE id = ?')
      .bind(`${syncPhase}:pending`, now, eventId).run();
    return { captured: 0, failed: 0, pending: true };
  }
  const started = await startWiseOldManSync({ eventId, phase: syncPhase });
  let run = started.run;
  let turns = 0;
  while (['running', 'reconciling'].includes(run.status) && run.sourceMode === 'group_bulk' && turns < 100) {
    const continued = await continueWiseOldManSync({ eventId, runId: run.id });
    run = continued.run;
    turns += 1;
  }
  return { captured: run.capturedCount, failed: run.failedCount, pending: false };
}
