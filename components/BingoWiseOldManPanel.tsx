'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BingoViewData, BingoViewWomRun } from '../lib/bingo-view-types';

type SyncResponse = BingoViewData['wiseOldMan'] & {
  run: BingoViewWomRun;
  retryAfterMs?: number;
  resumed?: boolean;
  error?: string;
};

export function BingoWiseOldManPanel({ data, base, onRefresh, onNotice, onError }: {
  data: BingoViewData;
  base: string;
  onRefresh: () => Promise<void>;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [groupId, setGroupId] = useState(data.wiseOldMan.groupId?.toString() ?? '');
  const [intervalHours, setIntervalHours] = useState(data.wiseOldMan.syncIntervalHours);
  const [autoSync, setAutoSync] = useState(data.wiseOldMan.autoSync);
  const [working, setWorking] = useState('');
  const [progress, setProgress] = useState<BingoViewWomRun | null>(data.wiseOldMan.latestRun);
  const initialized = useRef(false);
  const autoAttempt = useRef('');

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setGroupId(data.wiseOldMan.groupId?.toString() ?? '');
    setIntervalHours(data.wiseOldMan.syncIntervalHours);
    setAutoSync(data.wiseOldMan.autoSync);
  }, [data.wiseOldMan]);

  const request = useCallback(async (body: Record<string, unknown>) => {
    const response = await fetch(`${base}/wom`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const result = await response.json() as SyncResponse;
    if (!response.ok) throw new Error(result.error || 'Wise Old Man sync could not continue.');
    return result;
  }, [base]);

  const startSync = useCallback(async (phase: 'baseline' | 'checkpoint' | 'final', automatic = false) => {
    if (working) return;
    setWorking(phase); onError('');
    try {
      let result = await request({ action: 'start', phase });
      setProgress(result.run);
      let turns = 0;
      while (['running', 'reconciling'].includes(result.run.status) && turns < 500) {
        const delay = Math.max(100, Math.min(60_000, result.retryAfterMs ?? (result.run.status === 'running' && result.run.sourceMode === 'player_details' ? 4_000 : 150)));
        await new Promise((resolve) => window.setTimeout(resolve, delay));
        result = await request({ action: 'continue', runId: result.run.id });
        setProgress(result.run); turns += 1;
      }
      if (turns >= 500) throw new Error('The sync paused after too many steps. Press the same sync button to resume it.');
      await onRefresh();
      const label = phase === 'baseline' ? 'baseline' : phase === 'final' ? 'final reconciliation' : 'checkpoint';
      onNotice(`Wise Old Man ${label} ${result.run.status}: ${result.run.capturedCount} players captured and ${result.run.signalsCount} evidence signals recorded.`);
    } catch (cause) {
      if (!automatic) onError(cause instanceof Error ? cause.message : 'Wise Old Man sync failed.');
    } finally { setWorking(''); }
  }, [onError, onNotice, onRefresh, request, working]);

  useEffect(() => {
    const next = data.wiseOldMan.nextSyncAt;
    const active = data.wiseOldMan.latestRun && ['running', 'reconciling'].includes(data.wiseOldMan.latestRun.status);
    if (!data.wiseOldMan.autoSync || !data.wiseOldMan.groupId || data.event.status !== 'live' || !next || active || Date.parse(next) > Date.now()) return;
    const key = `${data.event.id}:${next}`;
    if (autoAttempt.current === key) return;
    autoAttempt.current = key;
    void startSync('checkpoint', true);
  }, [data.event.id, data.event.status, data.wiseOldMan.autoSync, data.wiseOldMan.groupId, data.wiseOldMan.latestRun, data.wiseOldMan.nextSyncAt, startSync]);

  async function save() {
    setWorking('configure'); onError('');
    try {
      await request({ action: 'configure', groupId: groupId.trim() || null, syncIntervalHours: intervalHours, autoSync });
      await onRefresh(); onNotice('Wise Old Man sync settings saved.');
    } catch (cause) { onError(cause instanceof Error ? cause.message : 'Wise Old Man settings could not be saved.'); }
    finally { setWorking(''); }
  }

  const run = progress ?? data.wiseOldMan.latestRun;
  const womNeeded = data.tasks.some((task) => task.rule.proof.sources.includes('wise_old_man'));
  return (
    <section className="wood-panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-black uppercase tracking-[0.12em] text-[#d7ae50]">Wise Old Man bridge</p><h3 className="fantasy-title mt-1 text-2xl font-bold text-[#f2d98f]">Event gains, not guesswork.</h3></div>
        <span className={`rounded px-2 py-1 text-[9px] font-black uppercase ${womNeeded ? 'bg-[#d7ae50] text-[#24180b]' : 'bg-white/10 text-[#b8aa87]'}`}>{womNeeded ? 'Used by board' : 'Optional'}</span>
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-[#b8aa87]">A WOM group ID turns each checkpoint into one bulk request. Without one, Terry checks players one at a time at a safe pace. No forced player updates are sent.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <label className="text-[9px] font-black uppercase text-[#c8b990]">WOM group ID (recommended)<input className="dark-field mt-1 h-10 w-full px-3 text-xs" inputMode="numeric" placeholder="e.g. 12345" value={groupId} onChange={(event) => setGroupId(event.target.value.replace(/\D/g, '').slice(0, 10))} /></label>
        <label className="text-[9px] font-black uppercase text-[#c8b990]">Checkpoint interval<select className="dark-field mt-1 h-10 w-full px-2 text-xs" value={intervalHours} onChange={(event) => setIntervalHours(Number(event.target.value))}><option value={1}>Every hour</option><option value={2}>Every 2 hours</option><option value={3}>Every 3 hours</option><option value={6}>Every 6 hours</option><option value={12}>Every 12 hours</option><option value={24}>Daily</option></select></label>
      </div>
      <label className="mt-3 flex items-start gap-2 text-[10px] text-[#c8b990]"><input type="checkbox" checked={autoSync} disabled={!groupId} onChange={(event) => setAutoSync(event.target.checked)} /><span>Auto-check while this organizer room is open. Available only with a group ID.</span></label>
      <button className="scroll-button mt-3 w-full px-3 py-2 text-xs" disabled={Boolean(working)} onClick={() => void save()}>{working === 'configure' ? 'Saving…' : 'Save WOM settings'}</button>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[9px] font-black uppercase">
        <Metric label="Baseline" value={`${data.wiseOldMan.baselineCoverage}/${data.teams.reduce((sum, team) => sum + team.members.length, 0)}`} />
        <Metric label="Captured" value={run ? `${run.capturedCount}/${run.totalCount}` : '—'} />
        <Metric label="Signals" value={run?.signalsCount.toString() ?? '0'} />
      </div>
      {run ? <div className="mt-3 rounded border border-white/10 bg-black/20 p-3 text-[10px] text-[#c8b990]"><div className="flex justify-between gap-2"><b className="uppercase text-[#ead18d]">{run.phase} · {run.status}</b><span>{run.sourceMode === 'group_bulk' ? 'Group bulk' : 'Safe roster queue'}</span></div><div className="mt-2 h-2 overflow-hidden rounded bg-black/35"><div className="h-full rounded bg-[#83a267]" style={{ width: `${runPercent(run)}%` }} /></div>{run.failedCount ? <p className="mt-2 text-[#e7b296]">{run.failedCount} player{run.failedCount === 1 ? '' : 's'} unavailable; manual proof still works.</p> : null}{run.errorSummary ? <p className="mt-2 text-[#e7b296]">{run.errorSummary}</p> : null}</div> : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <button className="scroll-button px-2 py-2 text-[10px]" disabled={Boolean(working) || !['draft', 'scheduled', 'live'].includes(data.event.status)} onClick={() => void startSync('baseline')}>{working === 'baseline' ? 'Syncing…' : data.wiseOldMan.baselineRunId ? 'Refresh baseline' : 'Capture baseline'}</button>
        <button className="scroll-button px-2 py-2 text-[10px]" disabled={Boolean(working) || data.event.status !== 'live' || !data.wiseOldMan.baselineRunId} onClick={() => void startSync('checkpoint')}>{working === 'checkpoint' ? 'Syncing…' : 'Run checkpoint'}</button>
        <button className="gold-button px-2 py-2 text-[10px]" disabled={Boolean(working) || !['live', 'complete'].includes(data.event.status) || !data.wiseOldMan.baselineRunId} onClick={() => void startSync('final')}>{working === 'final' ? 'Reconciling…' : 'Final reconcile'}</button>
      </div>
      <p className="mt-3 text-[9px] leading-relaxed text-[#9f9272]">Ask players to update WOM—or use its RuneLite plugin and log out—shortly before the baseline and final sync. Baselines older than 15 minutes are excluded from automatic proof.</p>
      {data.wiseOldMan.groupId ? <a className="mt-2 inline-block text-[10px] font-black text-[#c9d894] underline" href={`https://wiseoldman.net/groups/${data.wiseOldMan.groupId}`} target="_blank" rel="noreferrer">Open WOM group ↗</a> : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded border border-white/10 bg-black/20 p-2"><strong className="block text-sm text-[#ead18d]">{value}</strong><span className="text-[#9f9272]">{label}</span></div>; }
function runPercent(run: BingoViewWomRun) {
  if (['complete', 'partial', 'failed'].includes(run.status)) return 100;
  if (!run.totalCount) return 0;
  const capture = Math.min(1, (run.capturedCount + run.failedCount) / run.totalCount) * 70;
  const reconcile = Math.min(1, run.reconcileOffset / Math.max(1, run.capturedCount)) * 30;
  return Math.max(2, Math.min(100, capture + reconcile));
}
