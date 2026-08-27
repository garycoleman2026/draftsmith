import { recordAudit } from './audit';
import { BingoError, bingoActivityInsert, parseJson } from './bingo';
import { sanitizeBingoTaskRule } from './bingo-rules';
import { buildWiseOldManSignals, type WomRosterSnapshot } from './bingo-wom-reconciliation';
import { ingestVerificationSignal } from './bingo-verification';
import { getDatabase } from './db';
import { normalizeRsn } from './validation';
import { fetchWiseOldManGroup, fetchWiseOldManPlayer, WiseOldManError } from './wise-old-man';
import type { WiseOldManSnapshot } from './wise-old-man-core';

const PLAYER_REQUEST_SPACING_MS = 4_000;
const BASELINE_TOLERANCE_MS = 15 * 60_000;

export type WomSyncPhase = 'baseline' | 'checkpoint' | 'final';
type IntegrationRow = {
  event_id: string; group_id: number | null; sync_interval_hours: number; auto_sync: number; status: string;
  baseline_run_id: string | null; last_sync_at: string | null; next_sync_at: string | null;
  last_error: string | null; created_at: string; updated_at: string;
};
type RunRow = {
  id: string; event_id: string; phase: WomSyncPhase; status: string; source_mode: 'group_bulk' | 'player_details';
  total_count: number; captured_count: number; failed_count: number; reconcile_offset: number;
  signals_count: number; last_request_at: string | null; error_summary: string | null;
  started_at: string; completed_at: string | null;
};
type MemberRow = { id: string; team_id: string; display_name: string; normalized_name: string };
type SnapshotRow = { member_id: string; team_id: string; source_state: string; payload_json: string };
type TaskRow = { id: string; verification_mode: 'manual' | 'screenshot' | 'stat_delta' | 'hybrid'; rule_json: string };

export async function configureWiseOldMan(input: {
  eventId: string; groupId: number | null; syncIntervalHours: number; autoSync: boolean;
}) {
  const db = getDatabase();
  const event = await db.prepare('SELECT id FROM bingo_events WHERE id = ?').bind(input.eventId).first<{ id: string }>();
  if (!event) throw new BingoError('That bingo event does not exist.', 404);
  const groupId = input.groupId === null ? null : Math.max(1, Math.min(2_147_483_647, Math.round(input.groupId)));
  if (input.groupId !== null && (!Number.isFinite(input.groupId) || input.groupId <= 0)) throw new BingoError('Enter a valid Wise Old Man group ID.');
  const interval = Math.max(1, Math.min(24, Math.round(input.syncIntervalHours) || 6));
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO bingo_wom_integrations
      (event_id, group_id, sync_interval_hours, auto_sync, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'idle', ?, ?)
     ON CONFLICT(event_id) DO UPDATE SET group_id = excluded.group_id,
       sync_interval_hours = excluded.sync_interval_hours, auto_sync = excluded.auto_sync,
       updated_at = excluded.updated_at`,
  ).bind(input.eventId, groupId, interval, groupId ? input.autoSync : false, now, now).run();
  return getWiseOldManStatus(input.eventId);
}

export async function startWiseOldManSync(input: { eventId: string; phase: WomSyncPhase }) {
  const db = getDatabase();
  const event = await db.prepare(
    'SELECT id, draft_id, status, started_at, ended_at FROM bingo_events WHERE id = ?',
  ).bind(input.eventId).first<{ id: string; draft_id: string; status: string; started_at: string | null; ended_at: string | null }>();
  if (!event) throw new BingoError('That bingo event does not exist.', 404);
  if (input.phase === 'baseline' && !['draft', 'scheduled', 'live'].includes(event.status)) {
    throw new BingoError('Capture the baseline before the event is completed.', 409);
  }
  if (input.phase !== 'baseline' && !['live', 'complete'].includes(event.status)) {
    throw new BingoError('Checkpoints can only run for a live or newly completed event.', 409);
  }
  await ensureIntegration(input.eventId);
  const integration = await loadIntegration(input.eventId);
  if (input.phase !== 'baseline' && !integration?.baseline_run_id) throw new BingoError('Capture a Wise Old Man baseline first.', 409);
  const active = await db.prepare(
    "SELECT * FROM bingo_wom_sync_runs WHERE event_id = ? AND status IN ('running', 'reconciling') ORDER BY started_at DESC LIMIT 1",
  ).bind(input.eventId).first<RunRow>();
  if (active) return { ...(await getWiseOldManStatus(input.eventId)), run: runView(active), resumed: true };
  const total = await db.prepare(
    'SELECT COUNT(*) AS count FROM bingo_team_members btm JOIN bingo_teams bt ON bt.id = btm.team_id WHERE bt.event_id = ?',
  ).bind(input.eventId).first<{ count: number }>();
  if (!(total?.count ?? 0)) throw new BingoError('This bingo event has no team members.', 409);
  const runId = crypto.randomUUID();
  const now = new Date().toISOString();
  const sourceMode = integration?.group_id ? 'group_bulk' : 'player_details';
  await db.batch([
    db.prepare(
      `INSERT INTO bingo_wom_sync_runs
        (id, event_id, phase, status, source_mode, total_count, captured_count, failed_count,
         reconcile_offset, signals_count, started_at)
       VALUES (?, ?, ?, 'running', ?, ?, 0, 0, 0, 0, ?)`,
    ).bind(runId, input.eventId, input.phase, sourceMode, total?.count ?? 0, now),
    db.prepare("UPDATE bingo_wom_integrations SET status = 'running', last_error = NULL, updated_at = ? WHERE event_id = ?")
      .bind(now, input.eventId),
    db.prepare('UPDATE bingo_events SET baseline_status = ?, updated_at = ? WHERE id = ?')
      .bind(`${input.phase}:running`, now, input.eventId),
  ]);
  if (sourceMode === 'group_bulk') await captureGroupRun(runId, integration!.group_id!);
  const run = await loadRun(input.eventId, runId);
  return { ...(await getWiseOldManStatus(input.eventId)), run: runView(run!), resumed: false };
}

export async function continueWiseOldManSync(input: { eventId: string; runId: string }) {
  let run = await loadRun(input.eventId, input.runId);
  if (!run) throw new BingoError('That Wise Old Man sync no longer exists.', 404);
  if (['complete', 'partial', 'failed'].includes(run.status)) return { ...(await getWiseOldManStatus(input.eventId)), run: runView(run) };
  if (run.status === 'running') {
    if (run.source_mode === 'group_bulk') {
      await setRunReconciling(run.id);
    } else {
      const retryAfterMs = requestDelay(run.last_request_at);
      if (retryAfterMs > 0) return { ...(await getWiseOldManStatus(input.eventId)), run: runView(run), retryAfterMs };
      await captureNextPlayer(run);
    }
    run = (await loadRun(input.eventId, input.runId))!;
  }
  if (run.status === 'reconciling') await reconcileRunStep(run);
  run = (await loadRun(input.eventId, input.runId))!;
  return { ...(await getWiseOldManStatus(input.eventId)), run: runView(run) };
}

export async function getWiseOldManStatus(eventId: string) {
  const db = getDatabase();
  const [integration, latest, baselineCoverage] = await Promise.all([
    loadIntegration(eventId),
    db.prepare('SELECT * FROM bingo_wom_sync_runs WHERE event_id = ? ORDER BY started_at DESC LIMIT 1')
      .bind(eventId).first<RunRow>(),
    db.prepare(
      `SELECT COUNT(*) AS count FROM bingo_player_snapshots bps
       JOIN bingo_wom_integrations bwi ON bwi.baseline_run_id = bps.sync_run_id
       WHERE bwi.event_id = ? AND bps.source_state NOT IN ('error', 'missing')`,
    ).bind(eventId).first<{ count: number }>(),
  ]);
  return {
    configured: Boolean(integration),
    groupId: integration?.group_id ?? null,
    syncIntervalHours: integration?.sync_interval_hours ?? 6,
    autoSync: Boolean(integration?.auto_sync && integration.group_id),
    status: integration?.status ?? 'idle',
    baselineRunId: integration?.baseline_run_id ?? null,
    baselineCoverage: baselineCoverage?.count ?? 0,
    lastSyncAt: integration?.last_sync_at ?? null,
    nextSyncAt: integration?.next_sync_at ?? null,
    lastError: integration?.last_error ?? null,
    latestRun: latest ? runView(latest) : null,
  };
}

async function captureGroupRun(runId: string, groupId: number) {
  const db = getDatabase();
  const run = await db.prepare('SELECT * FROM bingo_wom_sync_runs WHERE id = ?').bind(runId).first<RunRow>();
  if (!run) return;
  try {
    const snapshots = await fetchWiseOldManGroup(groupId);
    const byName = new Map(snapshots.map((snapshot) => [snapshot.normalizedName, snapshot]));
    const members = await eventMembers(run.event_id);
    for (let index = 0; index < members.length; index += 50) {
      const statements = members.slice(index, index + 50).map((member) => {
        const snapshot = byName.get(member.normalized_name) ?? null;
        return snapshotStatement(run, member, snapshot, snapshot ? 'group_bulk' : 'missing', snapshot ? null : 'Player is not in the configured WOM group.');
      });
      if (statements.length) await db.batch(statements);
    }
    await refreshCaptureCounts(run.id, true);
  } catch (error) {
    await failRun(run, error);
  }
}

async function captureNextPlayer(run: RunRow) {
  const db = getDatabase();
  const member = await db.prepare(
    `SELECT btm.id, btm.team_id, btm.display_name, btm.normalized_name
     FROM bingo_team_members btm JOIN bingo_teams bt ON bt.id = btm.team_id
     WHERE bt.event_id = ? AND NOT EXISTS (
       SELECT 1 FROM bingo_player_snapshots bps WHERE bps.sync_run_id = ? AND bps.member_id = btm.id
     ) ORDER BY btm.display_name LIMIT 1`,
  ).bind(run.event_id, run.id).first<MemberRow>();
  if (!member) { await refreshCaptureCounts(run.id, true); return; }
  const requestedAt = new Date().toISOString();
  await db.prepare('UPDATE bingo_wom_sync_runs SET last_request_at = ? WHERE id = ?').bind(requestedAt, run.id).run();
  try {
    const snapshot = await fetchWiseOldManPlayer(member.display_name);
    await snapshotStatement(run, member, snapshot, 'player_details', null).run();
  } catch (error) {
    if (error instanceof WiseOldManError && error.status === 429) {
      await db.prepare('UPDATE bingo_wom_sync_runs SET last_request_at = ? WHERE id = ?')
        .bind(new Date(Date.now() + 56_000).toISOString(), run.id).run();
      return;
    }
    await snapshotStatement(run, member, null, 'error', error instanceof Error ? error.message : 'Player snapshot failed.').run();
  }
  await refreshCaptureCounts(run.id, false);
}

async function refreshCaptureCounts(runId: string, captureFinished: boolean) {
  const db = getDatabase();
  const counts = await db.prepare(
    `SELECT COUNT(*) AS attempted,
       SUM(CASE WHEN source_state IN ('error', 'missing') THEN 1 ELSE 0 END) AS failed
     FROM bingo_player_snapshots WHERE sync_run_id = ?`,
  ).bind(runId).first<{ attempted: number; failed: number | null }>();
  const run = await db.prepare('SELECT total_count FROM bingo_wom_sync_runs WHERE id = ?').bind(runId).first<{ total_count: number }>();
  const attempted = counts?.attempted ?? 0;
  const failed = counts?.failed ?? 0;
  const finished = captureFinished || attempted >= (run?.total_count ?? 0);
  await db.prepare(
    "UPDATE bingo_wom_sync_runs SET captured_count = ?, failed_count = ?, status = CASE WHEN ? THEN 'reconciling' ELSE status END WHERE id = ?",
  ).bind(Math.max(0, attempted - failed), failed, finished, runId).run();
}

async function reconcileRunStep(run: RunRow) {
  const integration = await loadIntegration(run.event_id);
  const baselineRunId = integration?.baseline_run_id ?? null;
  if (!baselineRunId && run.phase !== 'baseline') {
    await failRun(run, new Error('No baseline snapshot is available.'));
    return;
  }
  if (run.phase === 'baseline') { await finalizeRun(run); return; }
  const db = getDatabase();
  const [taskRows, event] = await Promise.all([
    db.prepare('SELECT id, verification_mode, rule_json FROM bingo_tasks WHERE event_id = ? ORDER BY sort_order')
      .bind(run.event_id).all<TaskRow>(),
    db.prepare('SELECT started_at, ended_at FROM bingo_events WHERE id = ?').bind(run.event_id)
      .first<{ started_at: string | null; ended_at: string | null }>(),
  ]);
  const tasks = taskRows.results.map((task) => ({
    id: task.id,
    rule: sanitizeBingoTaskRule(parseJson(task.rule_json, {}), task.verification_mode),
  }));
  const individualTasks = tasks.filter((task) => task.rule.scope.type !== 'team_total');
  const rows = await snapshotRows(run.id, 5, run.reconcile_offset);
  let signals = 0;
  if (rows.length) {
    const baseline = await baselineRows(baselineRunId!, rows.map((row) => row.member_id));
    const current = validWindowRows(toRoster(rows), event?.started_at ?? null, event?.ended_at ?? null, false);
    const validBaseline = validWindowRows(toRoster(baseline), event?.started_at ?? null, event?.ended_at ?? null, true);
    signals += await ingestGeneratedSignals(run, buildWiseOldManSignals({ runId: run.id, tasks: individualTasks, baseline: validBaseline, current }));
    await db.prepare('UPDATE bingo_wom_sync_runs SET reconcile_offset = reconcile_offset + ?, signals_count = signals_count + ? WHERE id = ?')
      .bind(rows.length, signals, run.id).run();
  }
  const nextOffset = run.reconcile_offset + rows.length;
  if (nextOffset < run.captured_count) return;
  const teamTasks = tasks.filter((task) => task.rule.scope.type === 'team_total');
  if (teamTasks.length) {
    const [currentRows, baseRows] = await Promise.all([
      snapshotRows(run.id),
      snapshotRows(baselineRunId!),
    ]);
    const current = validWindowRows(toRoster(currentRows), event?.started_at ?? null, event?.ended_at ?? null, false);
    const baseline = validWindowRows(toRoster(baseRows), event?.started_at ?? null, event?.ended_at ?? null, true);
    const teamSignals = await ingestGeneratedSignals(run, buildWiseOldManSignals({ runId: run.id, tasks: teamTasks, baseline, current }));
    await db.prepare('UPDATE bingo_wom_sync_runs SET signals_count = signals_count + ? WHERE id = ?').bind(teamSignals, run.id).run();
  }
  await finalizeRun((await loadRun(run.event_id, run.id))!);
}

async function ingestGeneratedSignals(run: RunRow, generated: ReturnType<typeof buildWiseOldManSignals>) {
  let count = 0;
  for (const item of generated) {
    try {
      const result = await ingestVerificationSignal({
        eventId: run.event_id, teamId: item.teamId, memberId: item.memberId, signal: item.signal, allowComplete: true,
      });
      if (!result.duplicate) count += 1;
    } catch (error) {
      if (error instanceof BingoError && [400, 409].includes(error.status)) continue;
      throw error;
    }
  }
  return count;
}

async function finalizeRun(run: RunRow) {
  const db = getDatabase();
  const integration = await loadIntegration(run.event_id);
  const now = new Date().toISOString();
  const status = run.captured_count ? run.failed_count ? 'partial' : 'complete' : 'failed';
  const nextSyncAt = run.phase === 'final' ? null
    : new Date(Date.now() + (integration?.sync_interval_hours ?? 6) * 60 * 60_000).toISOString();
  const event = await db.prepare('SELECT draft_id, title FROM bingo_events WHERE id = ?').bind(run.event_id)
    .first<{ draft_id: string; title: string }>();
  await db.batch([
    db.prepare('UPDATE bingo_wom_sync_runs SET status = ?, completed_at = ? WHERE id = ?').bind(status, now, run.id),
    db.prepare(
      `UPDATE bingo_wom_integrations SET status = ?, baseline_run_id = CASE WHEN ? = 'baseline' AND ? > 0 THEN ? ELSE baseline_run_id END,
       last_sync_at = ?, next_sync_at = ?, last_error = ?, updated_at = ? WHERE event_id = ?`,
    ).bind(status, run.phase, run.captured_count, run.id, now, nextSyncAt,
      status === 'failed' ? run.error_summary ?? 'No player snapshots were captured.' : null, now, run.event_id),
    db.prepare('UPDATE bingo_events SET baseline_status = ?, revision = revision + 1, updated_at = ? WHERE id = ?')
      .bind(`${run.phase}:${status}`, now, run.event_id),
    bingoActivityInsert({
      eventId: run.event_id, type: `wom.${run.phase}.${status}`,
      message: `Wise Old Man ${run.phase} sync ${status}: ${run.captured_count} captured, ${run.failed_count} unavailable.`, now,
    }),
  ]);
  await recordAudit(db, {
    draftId: event?.draft_id ?? null, actorType: 'system', eventType: `bingo.wom_${run.phase}_${status}`,
    metadata: { eventId: run.event_id, runId: run.id, captured: run.captured_count, failed: run.failed_count, signals: run.signals_count },
    createdAt: now,
  }).catch(() => undefined);
}

async function failRun(run: RunRow, error: unknown) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const message = error instanceof Error ? error.message.slice(0, 500) : 'Wise Old Man sync failed.';
  await db.batch([
    db.prepare("UPDATE bingo_wom_sync_runs SET status = 'failed', error_summary = ?, completed_at = ? WHERE id = ?")
      .bind(message, now, run.id),
    db.prepare("UPDATE bingo_wom_integrations SET status = 'failed', last_error = ?, updated_at = ? WHERE event_id = ?")
      .bind(message, now, run.event_id),
    db.prepare('UPDATE bingo_events SET baseline_status = ?, updated_at = ? WHERE id = ?')
      .bind(`${run.phase}:failed`, now, run.event_id),
  ]);
}

function snapshotStatement(run: RunRow, member: MemberRow, snapshot: WiseOldManSnapshot | null, sourceState: string, error: string | null) {
  const now = new Date().toISOString();
  return getDatabase().prepare(
    `INSERT INTO bingo_player_snapshots
      (id, event_id, member_id, sync_run_id, phase, source_state, schema_version, provider_updated_at, payload_json, captured_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
     ON CONFLICT(sync_run_id, member_id) DO UPDATE SET source_state = excluded.source_state,
       provider_updated_at = excluded.provider_updated_at, payload_json = excluded.payload_json, captured_at = excluded.captured_at`,
  ).bind(crypto.randomUUID(), run.event_id, member.id, run.id, `wom:${run.phase}:${run.id}`, sourceState,
    snapshot?.providerUpdatedAt ?? null, JSON.stringify(snapshot ?? { error }), now);
}

async function snapshotRows(runId: string, limit?: number, offset = 0) {
  const suffix = limit ? ' LIMIT ? OFFSET ?' : '';
  const bindings: Array<string | number> = limit ? [runId, limit, offset] : [runId];
  const result = await getDatabase().prepare(
    `SELECT bps.member_id, btm.team_id, bps.source_state, bps.payload_json
     FROM bingo_player_snapshots bps JOIN bingo_team_members btm ON btm.id = bps.member_id
     WHERE bps.sync_run_id = ? AND bps.source_state NOT IN ('error', 'missing') ORDER BY bps.member_id${suffix}`,
  ).bind(...bindings).all<SnapshotRow>();
  return result.results;
}

async function baselineRows(runId: string, memberIds: string[]) {
  if (!memberIds.length) return [];
  const placeholders = memberIds.map(() => '?').join(',');
  const result = await getDatabase().prepare(
    `SELECT bps.member_id, btm.team_id, bps.source_state, bps.payload_json
     FROM bingo_player_snapshots bps JOIN bingo_team_members btm ON btm.id = bps.member_id
     WHERE bps.sync_run_id = ? AND bps.member_id IN (${placeholders}) AND bps.source_state NOT IN ('error', 'missing')`,
  ).bind(runId, ...memberIds).all<SnapshotRow>();
  return result.results;
}

function toRoster(rows: SnapshotRow[]): WomRosterSnapshot[] {
  return rows.flatMap((row) => {
    const snapshot = parseJson<WiseOldManSnapshot | null>(row.payload_json, null);
    return snapshot?.schemaVersion === 1 ? [{ memberId: row.member_id, teamId: row.team_id, snapshot }] : [];
  });
}

function validWindowRows(rows: WomRosterSnapshot[], startedAt: string | null, endedAt: string | null, baseline: boolean) {
  if (!startedAt) return rows;
  const start = Date.parse(startedAt);
  const end = endedAt ? Date.parse(endedAt) : Date.now() + 5 * 60_000;
  return rows.filter((row) => {
    const observed = Date.parse(row.snapshot.snapshotAt);
    if (!Number.isFinite(observed)) return false;
    return baseline
      ? observed >= start - BASELINE_TOLERANCE_MS && observed <= start + 5 * 60_000
      : observed >= start - 5 * 60_000 && observed <= end + 5 * 60_000;
  });
}

async function eventMembers(eventId: string) {
  const result = await getDatabase().prepare(
    `SELECT btm.id, btm.team_id, btm.display_name, btm.normalized_name
     FROM bingo_team_members btm JOIN bingo_teams bt ON bt.id = btm.team_id
     WHERE bt.event_id = ? ORDER BY btm.display_name`,
  ).bind(eventId).all<MemberRow>();
  return result.results.map((member) => ({ ...member, normalized_name: normalizeRsn(member.normalized_name || member.display_name) }));
}

async function ensureIntegration(eventId: string) {
  const now = new Date().toISOString();
  await getDatabase().prepare(
    `INSERT INTO bingo_wom_integrations (event_id, sync_interval_hours, auto_sync, status, created_at, updated_at)
     VALUES (?, 6, 0, 'idle', ?, ?) ON CONFLICT(event_id) DO NOTHING`,
  ).bind(eventId, now, now).run();
}
function loadIntegration(eventId: string) {
  return getDatabase().prepare('SELECT * FROM bingo_wom_integrations WHERE event_id = ?').bind(eventId).first<IntegrationRow>();
}
function loadRun(eventId: string, runId: string) {
  return getDatabase().prepare('SELECT * FROM bingo_wom_sync_runs WHERE id = ? AND event_id = ?').bind(runId, eventId).first<RunRow>();
}
async function setRunReconciling(runId: string) {
  await getDatabase().prepare("UPDATE bingo_wom_sync_runs SET status = 'reconciling' WHERE id = ? AND status = 'running'").bind(runId).run();
}
function requestDelay(lastRequestAt: string | null) {
  if (!lastRequestAt) return 0;
  return Math.max(0, Date.parse(lastRequestAt) + PLAYER_REQUEST_SPACING_MS - Date.now());
}
function runView(run: RunRow) {
  return {
    id: run.id, phase: run.phase, status: run.status, sourceMode: run.source_mode,
    totalCount: run.total_count, capturedCount: run.captured_count, failedCount: run.failed_count,
    reconcileOffset: run.reconcile_offset, signalsCount: run.signals_count,
    errorSummary: run.error_summary, startedAt: run.started_at, completedAt: run.completed_at,
  };
}
