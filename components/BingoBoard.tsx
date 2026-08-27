'use client';

import type { BingoViewData, BingoViewTask } from '../lib/bingo-view-types';
import { bingoRuleSummary } from '../lib/bingo-rules';

export function BingoBoard({
  data, teamId, selectedTaskId, onSelect,
}: {
  data: BingoViewData;
  teamId?: string | null;
  selectedTaskId?: string | null;
  onSelect?: (task: BingoViewTask) => void;
}) {
  const gridSize = data.event.gridSize;
  const minWidth = Math.max(760, gridSize * 148);
  return (
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
          const selected = selectedTaskId === task.id;
          const style = data.event.mode === 'lockout' && ownerTeams[0]
            ? { borderColor: ownerTeams[0].color, boxShadow: `inset 0 0 0 3px ${ownerTeams[0].color}55, 0 3px 0 #5c431f` }
            : undefined;
          const content = (
            <>
              <div className="flex items-start justify-between gap-2">
                <span className="text-[9px] font-black uppercase tracking-[0.1em] text-[#77623d]">
                  {task.freeSpace ? '◆ Free' : ownPending ? '⌛ Pending' : ownerTeams.length ? '✓ Complete' : task.concealed ? '???' : task.category}
                </span>
                <span className="shrink-0 rounded bg-[#5b4526]/10 px-1.5 py-0.5 text-[10px] font-black text-[#5e4828]">
                  {task.points === null ? '?' : task.freeSpace ? 'FREE' : `${task.points} pt${task.points === 1 ? '' : 's'}`}
                </span>
              </div>
              <p className="mt-2 text-sm font-black leading-tight text-[#332616]">{task.title}</p>
              <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-[#6f5c3c]">{task.description || (task.concealed ? 'Complete another task to reveal this square.' : task.difficulty)}</p>
              {!task.concealed && !task.freeSpace ? <p className="mt-2 line-clamp-1 text-[9px] font-bold uppercase tracking-[0.04em] text-[#80642b]">{bingoRuleSummary(task.rule)}</p> : null}
              {ownerTeams.length ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {ownerTeams.map((team) => <span key={team.id} className="rounded px-1.5 py-1 text-[9px] font-black text-white" style={{ backgroundColor: team.color }}>{team.name}</span>)}
                </div>
              ) : ownPending ? <p className="mt-3 text-[10px] font-black text-[#946716]">Awaiting organizer review</p> : null}
              {proofLabels.length ? <p className="mt-2 line-clamp-1 text-[9px] font-black uppercase tracking-[0.04em] text-[#4f7049]" title={proofLabels.join(' · ')}>Proof: {proofLabels.join(' · ')}</p> : null}
            </>
          );
          const className = `parchment-card min-h-36 w-full p-3 text-left transition ${selected ? 'ring-4 ring-[#517347]/35' : ''} ${onSelect ? 'hover:-translate-y-0.5 hover:brightness-105' : ''}`;
          return onSelect ? (
            <button type="button" className={className} style={style} onClick={() => onSelect(task)} key={task.id}>{content}</button>
          ) : <article className={className} style={style} key={task.id}>{content}</article>;
        })}
      </div>
    </div>
  );
}

function formatProofSource(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
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
