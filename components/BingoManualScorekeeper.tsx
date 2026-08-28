'use client';

import { useMemo, useState } from 'react';
import type { BingoViewData } from '../lib/bingo-view-types';
import type { BingoTaskImageKind } from '../lib/bingo-rules';

export function BingoManualScorekeeper({
  data, base, onRefresh, onNotice, onError,
}: {
  data: BingoViewData;
  base: string;
  onRefresh: () => Promise<void>;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const firstTask = data.tasks[0];
  const firstTeam = data.teams[0];
  const initialProgress = data.manualProgress.find((item) => item.taskId === firstTask?.id && item.teamId === firstTeam?.id);
  const [taskId, setTaskId] = useState(firstTask?.id ?? '');
  const [teamId, setTeamId] = useState(firstTeam?.id ?? '');
  const [memberId, setMemberId] = useState(firstTeam?.members[0]?.id ?? '');
  const [progressValue, setProgressValue] = useState(String(initialProgress?.progressValue ?? 0));
  const [targetValue, setTargetValue] = useState(String(initialProgress?.targetValue ?? firstTask?.rule.verifier.amount ?? 1));
  const [reason, setReason] = useState('');
  const [working, setWorking] = useState('');
  const [title, setTitle] = useState(firstTask?.title ?? '');
  const [description, setDescription] = useState(firstTask?.description ?? '');
  const [category, setCategory] = useState(firstTask?.category ?? '');
  const [imageKind, setImageKind] = useState<BingoTaskImageKind>(firstTask?.rule.presentation.imageKind ?? 'none');
  const [imageKey, setImageKey] = useState(firstTask?.rule.presentation.imageKey ?? '');
  const [notes, setNotes] = useState(firstTask?.rule.details.notes ?? '');
  const [exclusions, setExclusions] = useState(firstTask?.rule.details.exclusions ?? '');
  const [sourceUrl, setSourceUrl] = useState(firstTask?.rule.details.sourceUrl ?? '');
  const task = data.tasks.find((item) => item.id === taskId) ?? data.tasks[0];
  const team = data.teams.find((item) => item.id === teamId) ?? data.teams[0];
  const progress = data.manualProgress.find((item) => item.taskId === task?.id && item.teamId === team?.id);
  const completionCount = useMemo(() => data.completions.filter((item) => item.taskId === task?.id && item.teamId === team?.id).length, [data.completions, task?.id, team?.id]);
  const scorekeepingOpen = ['live', 'complete'].includes(data.event.status);

  function chooseTask(nextTaskId: string) {
    const nextTask = data.tasks.find((item) => item.id === nextTaskId);
    if (!nextTask) return;
    const nextProgress = data.manualProgress.find((item) => item.taskId === nextTaskId && item.teamId === team?.id);
    setTaskId(nextTaskId); setTitle(nextTask.title); setDescription(nextTask.description); setCategory(nextTask.category);
    setImageKind(nextTask.rule.presentation.imageKind); setImageKey(nextTask.rule.presentation.imageKey);
    setNotes(nextTask.rule.details.notes); setExclusions(nextTask.rule.details.exclusions); setSourceUrl(nextTask.rule.details.sourceUrl);
    setProgressValue(String(nextProgress?.progressValue ?? 0));
    setTargetValue(String(nextProgress?.targetValue ?? nextTask.rule.verifier.amount ?? 1));
  }

  function chooseTeam(nextTeamId: string) {
    const nextTeam = data.teams.find((item) => item.id === nextTeamId);
    if (!nextTeam) return;
    const nextProgress = data.manualProgress.find((item) => item.taskId === task?.id && item.teamId === nextTeamId);
    setTeamId(nextTeamId); setMemberId(nextTeam.members[0]?.id ?? '');
    setProgressValue(String(nextProgress?.progressValue ?? 0));
    setTargetValue(String(nextProgress?.targetValue ?? task?.rule.verifier.amount ?? 1));
  }

  async function apply(action: 'set_progress' | 'complete' | 'reopen' | 'reset_progress' | 'edit_content') {
    if (!task) return;
    if (reason.trim().length < 3) { onError('Add a short organizer reason before making a manual change.'); return; }
    if (['complete', 'reopen'].includes(action) && !window.confirm(action === 'complete' ? `Mark ${task.title} complete for ${team?.name}?` : `Reopen ${task.title} for ${team?.name} and remove its latest score?`)) return;
    setWorking(action); onError('');
    try {
      const response = await fetch(`${base}/tasks/${encodeURIComponent(task.id)}/manual`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action, teamId: team?.id, memberId: memberId || null,
          progressValue: Number(progressValue), targetValue: Number(targetValue), reason,
          title, description, category,
          presentation: { imageKind, imageKey }, details: { notes, exclusions, sourceUrl },
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'The manual change could not be saved.');
      onNotice({
        set_progress: 'Manual progress saved.', complete: 'Tile marked complete and scored.',
        reopen: 'Latest completion reopened and its score removed.', reset_progress: 'Manual progress reset.',
        edit_content: 'Tile wording, artwork, and notes updated without changing its scoring rule.',
      }[action]);
      if (action === 'complete') setProgressValue(targetValue);
      if (action === 'reset_progress') setProgressValue('0');
      setReason(''); await onRefresh();
    } catch (cause) { onError(cause instanceof Error ? cause.message : 'The manual change could not be saved.'); }
    finally { setWorking(''); }
  }

  if (!task || !team) return null;
  return (
    <section className="parchment-panel p-5 text-[#342817]">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.12em] text-[#80642b]">Manual scorekeeper</p><h2 className="fantasy-title mt-1 text-2xl font-bold">Correct progress safely.</h2></div><span className="rounded bg-[#6a512b]/10 px-2 py-1 text-[9px] font-black uppercase text-[#6a511f]">Audited</span></div>
      <p className="mt-2 text-xs leading-relaxed text-[#6e5e43]">Set exact progress, complete a tile, or reopen the latest completion. Every action requires a reason and appears in the event history.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-[10px] font-black uppercase text-[#65583f] sm:col-span-2">Tile<select className="realm-field mt-1 h-11 w-full px-3 text-xs normal-case" value={task.id} onChange={(event) => chooseTask(event.target.value)}>{data.tasks.map((item) => <option key={item.id} value={item.id}>#{item.sortOrder + 1} · {item.title}</option>)}</select></label>
        <label className="text-[10px] font-black uppercase text-[#65583f]">Team<select className="realm-field mt-1 h-11 w-full px-3 text-xs normal-case" value={team.id} onChange={(event) => chooseTeam(event.target.value)}>{data.teams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="text-[10px] font-black uppercase text-[#65583f]">Player <span className="normal-case opacity-70">optional</span><select className="realm-field mt-1 h-11 w-full px-3 text-xs normal-case" value={memberId} onChange={(event) => setMemberId(event.target.value)}><option value="">Organizer entry</option>{team.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
        <label className="text-[10px] font-black uppercase text-[#65583f]">Current progress<input className="realm-field mt-1 h-11 w-full px-3 text-sm" min={0} step="any" type="number" value={progressValue} onChange={(event) => setProgressValue(event.target.value)} /></label>
        <label className="text-[10px] font-black uppercase text-[#65583f]">Target<input className="realm-field mt-1 h-11 w-full px-3 text-sm" min={0.000001} step="any" type="number" value={targetValue} onChange={(event) => setTargetValue(event.target.value)} /></label>
        <label className="text-[10px] font-black uppercase text-[#65583f] sm:col-span-2">Required organizer reason<textarea className="realm-field mt-1 min-h-20 w-full p-3 text-sm normal-case" maxLength={500} placeholder="Why is this being entered or corrected?" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      </div>
      <div className="mt-3 rounded border border-[#8b6a32]/25 bg-[#f5e5b8]/65 p-3 text-xs text-[#5c4a30]"><b>{completionCount} scored completion{completionCount === 1 ? '' : 's'}</b> · manual progress {progress ? `${progress.progressValue} / ${progress.targetValue}` : 'not set'}</div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2"><button className="gold-button px-3 py-2.5 text-xs" disabled={!scorekeepingOpen || Boolean(working)} onClick={() => void apply('set_progress')} type="button">{working === 'set_progress' ? 'Saving…' : 'Save exact progress'}</button><button className="gold-button px-3 py-2.5 text-xs" disabled={!scorekeepingOpen || Boolean(working) || task.freeSpace} onClick={() => void apply('complete')} type="button">{working === 'complete' ? 'Scoring…' : 'Mark complete'}</button><button className="scroll-button px-3 py-2.5 text-xs" disabled={!scorekeepingOpen || !completionCount || Boolean(working)} onClick={() => void apply('reopen')} type="button">{working === 'reopen' ? 'Reopening…' : 'Reopen latest completion'}</button><button className="scroll-button px-3 py-2.5 text-xs" disabled={!scorekeepingOpen || !progress || Boolean(working)} onClick={() => void apply('reset_progress')} type="button">Reset manual progress</button></div>
      {!scorekeepingOpen ? <p className="mt-3 text-[10px] font-bold text-[#7a5c26]">Progress controls open when the event starts. Tile wording can still be clarified below.</p> : null}

      <details className="mt-5 border-t border-[#8b6a32]/25 pt-4">
        <summary className="cursor-pointer text-xs font-black uppercase text-[#6a511f]">Edit this tile’s visible content</summary>
        <p className="mt-2 text-[10px] leading-relaxed text-[#6e5e43]">Safe during a live event: title, description, category, artwork, notes, exclusions, and source link. Points, verifier, prerequisites, and proof rules stay fixed.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-[10px] font-black uppercase text-[#65583f] sm:col-span-2">Title<input className="realm-field mt-1 h-10 w-full px-3 text-sm normal-case" value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="text-[10px] font-black uppercase text-[#65583f] sm:col-span-2">Description<textarea className="realm-field mt-1 min-h-20 w-full p-3 text-sm normal-case" value={description} onChange={(event) => setDescription(event.target.value)} /></label><label className="text-[10px] font-black uppercase text-[#65583f]">Category<input className="realm-field mt-1 h-10 w-full px-3 text-sm normal-case" value={category} onChange={(event) => setCategory(event.target.value)} /></label><label className="text-[10px] font-black uppercase text-[#65583f]">Artwork type<select className="realm-field mt-1 h-10 w-full px-3 text-sm" value={imageKind} onChange={(event) => setImageKind(event.target.value as BingoTaskImageKind)}><option value="none">None</option><option value="item">Item</option><option value="boss">Boss</option></select></label><label className="text-[10px] font-black uppercase text-[#65583f] sm:col-span-2">Wiki image name<input className="realm-field mt-1 h-10 w-full px-3 text-sm normal-case" value={imageKey} onChange={(event) => setImageKey(event.target.value)} /></label><label className="text-[10px] font-black uppercase text-[#65583f] sm:col-span-2">Notes<textarea className="realm-field mt-1 min-h-20 w-full p-3 text-sm normal-case" value={notes} onChange={(event) => setNotes(event.target.value)} /></label><label className="text-[10px] font-black uppercase text-[#65583f] sm:col-span-2">Exclusions<textarea className="realm-field mt-1 min-h-20 w-full p-3 text-sm normal-case" value={exclusions} onChange={(event) => setExclusions(event.target.value)} /></label><label className="text-[10px] font-black uppercase text-[#65583f] sm:col-span-2">Source URL<input className="realm-field mt-1 h-10 w-full px-3 text-xs normal-case" type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} /></label></div>
        <button className="iron-button mt-3 w-full px-3 py-2.5 text-xs" disabled={Boolean(working)} onClick={() => void apply('edit_content')} type="button">{working === 'edit_content' ? 'Updating…' : 'Update visible tile content'}</button>
      </details>
    </section>
  );
}
