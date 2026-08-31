'use client';

import { useEffect, useState } from 'react';
import type { BingoViewData, BingoViewTask } from '../lib/bingo-view-types';
import {
  bingoRuleSummary,
  bingoSpeedTargetSeconds,
  expectedIndividualHours,
  expectedTeamHours,
  formatExpectedHours,
  formatTaskTime,
} from '../lib/bingo-rules';
import { BingoTaskArtwork } from './BingoTaskArtwork';

export function BingoBoard({
  data, teamId, selectedTaskId, evidenceHref, onSelect,
}: {
  data: BingoViewData;
  teamId?: string | null;
  selectedTaskId?: string | null;
  evidenceHref?: (uploadId: string) => string;
  onSelect?: (task: BingoViewTask) => void;
}) {
  const [detailTask, setDetailTask] = useState<BingoViewTask | null>(null);
  const gridSize = data.event.gridSize;
  const minWidth = Math.max(760, gridSize * 148);
  const teamSize = teamId
    ? data.teams.find((team) => team.id === teamId)?.members.length ?? 1
    : Math.max(1, Math.min(...data.teams.map((team) => team.members.length)));

  useEffect(() => {
    if (!detailTask) return undefined;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setDetailTask(null); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [detailTask]);

  return (
    <>
      <div className="overflow-x-auto pb-2">
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`, minWidth }}>
          {data.tasks.map((task) => {
            const owners = data.event.boardScope === 'per_team' && teamId
              ? task.ownerTeamIds.filter((owner) => owner === teamId)
              : task.ownerTeamIds;
            const ownerTeams = owners.flatMap((owner) => data.teams.filter((team) => team.id === owner));
            const proofLabels = [...new Set(data.completions
              .filter((completion) => completion.taskId === task.id && owners.includes(completion.teamId))
              .map((completion) => `${formatProofSource(completion.verificationSource)} · ${completion.verificationConfidence}`))];
            const ownPending = Boolean(teamId && task.pendingTeamIds.includes(teamId));
            const progressRows = data.manualProgress.filter((progress) => progress.taskId === task.id && (!teamId || progress.teamId === teamId));
            const manualProgress = [...progressRows].sort((left, right) =>
              right.progressValue / Math.max(right.targetValue, 0.000001) - left.progressValue / Math.max(left.targetValue, 0.000001))[0];
            const progressTeam = manualProgress ? data.teams.find((team) => team.id === manualProgress.teamId) : null;
            const selected = selectedTaskId === task.id;
            const competitiveOwnership = data.event.mode === 'lockout'
              || data.event.boardScope === 'shared' && data.event.rules.progression.tileOwnership === 'first_team';
            const style = competitiveOwnership && ownerTeams[0]
              ? { borderColor: ownerTeams[0].color, boxShadow: `inset 0 0 0 3px ${ownerTeams[0].color}55, 0 3px 0 #5c431f` }
              : undefined;
            const individualHours = task.concealed ? null : expectedIndividualHours(task.rule);
            const speedTargetSeconds = task.concealed ? null : bingoSpeedTargetSeconds(task.rule);
            return (
              <button
                aria-label={`${task.concealed ? 'Hidden task' : task.title}. Open task details.`}
                className={`parchment-card min-h-40 w-full p-3 text-left transition hover:-translate-y-0.5 hover:brightness-105 ${!task.unlocked && !task.concealed ? 'opacity-75 grayscale-[35%]' : ''} ${selected ? 'ring-4 ring-[#517347]/35' : ''}`}
                key={task.id}
                onClick={() => setDetailTask(task)}
                style={style}
                type="button"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[9px] font-black uppercase tracking-[0.1em] text-[#675331]">
                    {task.freeSpace ? '◆ Free' : ownPending ? '⌛ Pending' : ownerTeams.length ? '✓ Complete' : task.concealed ? '???' : !task.unlocked ? '🔒 Locked' : task.category}
                  </span>
                  <span className="shrink-0 rounded bg-[#5b4526]/10 px-1.5 py-0.5 text-[10px] font-black text-[#4f3b20]">
                    {task.points === null ? '?' : task.freeSpace ? 'FREE' : `${task.points} pt${task.points === 1 ? '' : 's'}`}
                  </span>
                </div>
                {!task.concealed ? <BingoTaskArtwork alt="" className="mx-auto mt-2 h-14 w-14" rule={task.rule} /> : null}
                <p className="mt-2 text-sm font-black leading-tight text-[#332616]">{task.title}</p>
                <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-[#58452d]">{task.description || (task.concealed ? 'Complete another task to reveal this square.' : task.difficulty)}</p>
                {!task.concealed && !task.freeSpace ? <p className="mt-2 line-clamp-1 text-[9px] font-bold uppercase tracking-[0.04em] text-[#6a511f]">{bingoRuleSummary(task.rule)}</p> : null}
                {individualHours !== null ? <p className="mt-2 text-[9px] font-black uppercase tracking-[0.05em] text-[#315b39]">{speedTargetSeconds !== null ? `Speed target · ${formatTaskTime(task.rule)}` : `Expected · ${formatExpectedHours(individualHours)} solo`}</p> : null}
                {ownerTeams.length ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {ownerTeams.map((team) => <span key={team.id} className="rounded px-1.5 py-1 text-[9px] font-black text-white" style={{ backgroundColor: team.color }}>{team.name}</span>)}
                  </div>
                ) : ownPending ? <p className="mt-3 text-[10px] font-black text-[#80540c]">Awaiting organizer review</p> : null}
                {proofLabels.length ? <p className="mt-2 line-clamp-1 text-[9px] font-black uppercase tracking-[0.04em] text-[#315b39]" title={proofLabels.join(' · ')}>Proof: {proofLabels.join(' · ')}</p> : null}
                {manualProgress && !task.concealed ? <div className="mt-2"><div className="flex justify-between gap-2 text-[9px] font-black uppercase text-[#5d4828]"><span className="truncate">{teamId ? 'Progress' : progressTeam?.name ?? 'Progress'}</span><span>{formatProgress(manualProgress.progressValue)} / {formatProgress(manualProgress.targetValue)}</span></div><div className="mt-1 h-1.5 overflow-hidden rounded bg-[#6a512b]/15"><span className="block h-full rounded bg-[#4f7348]" style={{ width: `${Math.min(100, manualProgress.progressValue / Math.max(manualProgress.targetValue, 0.000001) * 100)}%` }} /></div></div> : null}
                <p className="mt-3 text-[9px] font-black uppercase tracking-[0.06em] text-[#5d4828]">View rules & notes →</p>
              </button>
            );
          })}
        </div>
      </div>

      {detailTask ? (
        <TaskDetails
          data={data}
          task={detailTask}
          teamId={teamId}
          teamSize={teamSize}
          evidenceHref={evidenceHref}
          canSelect={Boolean(onSelect) && detailTask.unlocked && !detailTask.concealed && !detailTask.freeSpace}
          onClose={() => setDetailTask(null)}
          onSelect={() => { onSelect?.(detailTask); setDetailTask(null); }}
        />
      ) : null}
    </>
  );
}

function TaskDetails({
  data, task, teamId, teamSize, evidenceHref, canSelect, onClose, onSelect,
}: {
  data: BingoViewData;
  task: BingoViewTask;
  teamId?: string | null;
  teamSize: number;
  evidenceHref?: (uploadId: string) => string;
  canSelect: boolean;
  onClose: () => void;
  onSelect: () => void;
}) {
  const individual = task.concealed ? null : expectedIndividualHours(task.rule);
  const team = task.concealed ? null : expectedTeamHours(task.rule, teamSize);
  const speedTargetSeconds = task.concealed ? null : bingoSpeedTargetSeconds(task.rule);
  const completions = data.completions
    .filter((completion) => completion.taskId === task.id && (!teamId || completion.teamId === teamId))
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt));
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#080805]/80 p-4" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section aria-labelledby="task-detail-title" aria-modal="true" className="parchment-panel my-auto w-full max-w-2xl p-5 sm:p-7" role="dialog">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#6a511f]">Task details · {!task.unlocked ? 'Locked' : task.category}</p><h2 className="fantasy-title mt-2 text-3xl font-bold text-[#2d2316]" id="task-detail-title">{task.title}</h2></div>
          <button aria-label="Close task details" className="scroll-button shrink-0 px-3 py-2 text-xs" onClick={onClose} type="button">Close</button>
        </div>
        {task.concealed ? <p className="mt-5 rounded border border-[#6c6254] bg-[#625746] p-5 text-sm font-bold text-[#fff0c9]">This task is intentionally concealed until its prerequisite is complete.</p> : (
          <>
            <div className="mt-5 grid gap-5 sm:grid-cols-[112px_minmax(0,1fr)]">
              <div className="grid h-28 place-items-center rounded border border-[#8b6a32]/35 bg-[#f7e9bd]/65"><BingoTaskArtwork alt={`${task.rule.presentation.imageKind} artwork for ${task.title}`} className="h-24 w-24" rule={task.rule} /></div>
              <div><p className="text-sm leading-relaxed text-[#4f402a]">{task.description || 'No description has been added.'}</p><p className="mt-3 text-xs font-black uppercase tracking-[0.05em] text-[#6a511f]">{bingoRuleSummary(task.rule)}</p></div>
            </div>
            <dl className="mt-5 grid gap-2 sm:grid-cols-2">
              {speedTargetSeconds !== null ? <Detail label="Required speed time" value={formatTaskTime(task.rule)} /> : <>
                <Detail label="Expected for one player" value={formatExpectedHours(individual)} />
                <Detail label={`Expected with ${teamSize} parallel players`} value={formatExpectedHours(team)} />
                <Detail label="Individual drop rate" value={dropRateLabel(task)} />
                <Detail label="Efficient individual rate" value={rateLabel(task)} />
              </>}
              <Detail label="Accepted proof" value={task.rule.proof.sources.map(formatProofSource).join(' · ')} />
              <Detail label="Completion scope" value={scopeLabel(task)} />
            </dl>
            {task.rule.details.notes ? <Note title="Notes">{task.rule.details.notes}</Note> : null}
            {task.rule.details.exclusions ? <Note title="Exclusions">{task.rule.details.exclusions}</Note> : null}
            {completions.length ? <section className="mt-4 rounded border border-[#52704b]/35 bg-[#dfe8c8]/60 p-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.08em] text-[#3f6039]">Completion proof</h3>
              <div className="mt-3 space-y-3">{completions.map((completion) => {
                const claim = data.claims.find((item) => item.id === completion.claimId);
                const completionTeam = data.teams.find((item) => item.id === completion.teamId);
                return <article className="rounded border border-[#52704b]/25 bg-white/35 p-3" key={completion.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-black text-[#2f492b]">{completionTeam?.name ?? 'Team'} · {claim?.claimedByName ?? 'Recorded completion'}</p><p className="mt-1 text-[9px] font-black uppercase tracking-[0.05em] text-[#55704f]">{formatProofSource(completion.verificationSource)} · {formatProofSource(completion.verificationConfidence)} · {new Date(completion.completedAt).toLocaleString()}</p></div><span className="rounded bg-[#52704b] px-2 py-1 text-[9px] font-black text-white">+{completion.points} pts</span></div>
                  {claim?.note ? <p className="mt-2 text-xs leading-relaxed text-[#42563b]">{claim.note}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-black">{claim?.evidenceUploadId && evidenceHref ? <a className="text-[#315b39] underline" href={evidenceHref(claim.evidenceUploadId)} target="_blank" rel="noreferrer">View screenshot ↗</a> : null}{claim?.evidenceUrl ? <a className="text-[#315b39] underline" href={claim.evidenceUrl} target="_blank" rel="noreferrer">Open proof link ↗</a> : null}</div>
                </article>;
              })}</div>
            </section> : null}
            <p className="mt-4 text-[10px] leading-relaxed text-[#58492f]">{speedTargetSeconds !== null ? 'This is the required completion time, not a practice or attempt-time estimate.' : 'Time estimates are planning averages based on the organizer’s editable rates. Random drops can arrive much sooner—or much later.'}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {canSelect ? <button className="gold-button px-5 py-3 text-sm" onClick={onSelect} type="button">Use this task for a claim →</button> : null}
              {task.rule.details.sourceUrl ? <a className="scroll-button inline-flex px-4 py-3 text-xs" href={task.rule.details.sourceUrl} rel="noreferrer" target="_blank">Open planning source ↗</a> : null}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded border border-[#8b6a32]/30 bg-white/25 p-3"><dt className="text-[9px] font-black uppercase tracking-[0.08em] text-[#675331]">{label}</dt><dd className="mt-1 text-sm font-black text-[#2d2316]">{value}</dd></div>;
}

function Note({ title, children }: { title: string; children: string }) {
  return <section className="mt-4 rounded border border-[#8b6a32]/30 bg-[#f7e9bd]/60 p-4"><h3 className="text-[10px] font-black uppercase tracking-[0.08em] text-[#675331]">{title}</h3><p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#493a25]">{children}</p></section>;
}

function dropRateLabel(task: BingoViewTask) {
  const { dropRateNumerator, dropRateDenominator } = task.rule.planning;
  if (!dropRateNumerator || !dropRateDenominator) return 'Not set';
  return `${dropRateNumerator} / ${new Intl.NumberFormat('en-US').format(dropRateDenominator)}`;
}

function rateLabel(task: BingoViewTask) {
  const { efficientKillsPerHour, efficientUnitsPerHour } = task.rule.planning;
  if (efficientKillsPerHour) return `${efficientKillsPerHour} kills / attempts per hour`;
  if (efficientUnitsPerHour) return `${new Intl.NumberFormat('en-US').format(efficientUnitsPerHour)} ${task.rule.verifier.unit || 'units'} per hour`;
  if (task.rule.planning.fixedHours) return `${formatExpectedHours(task.rule.planning.fixedHours)} attempt budget`;
  return 'Not set';
}

function scopeLabel(task: BingoViewTask) {
  return task.rule.scope.type === 'exact_party'
    ? `Exactly ${task.rule.scope.participantCount ?? '?'} players`
    : task.rule.scope.type.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatProofSource(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatProgress(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

export function BingoStandings({ data }: { data: BingoViewData }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {[...data.teams].sort((left, right) => left.rank - right.rank).map((team) => (
        <article className="rounded border border-white/10 bg-black/20 p-3" key={team.id}>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-xs font-black text-white" style={{ borderColor: team.color, backgroundColor: `${team.color}99` }}>{team.rank}</span>
            <div className="min-w-0"><p className="truncate text-sm font-black text-[#f2d98f]">{team.name}</p><p className="text-[10px] uppercase tracking-[0.08em] text-[#aa9d7e]">{data.event.mode === 'categories' ? `${team.categoryCount} categories · ${team.completedCount} tiles` : data.event.mode === 'blackout' ? `${team.completedCount} tiles complete` : `${team.completedCount} tiles · ${team.lineCount} lines`}</p></div>
            <strong className="ml-auto text-xl text-[#f4d77c]">{team.score}</strong>
          </div>
        </article>
      ))}
    </div>
  );
}
