'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { collectNewBingoCompletions } from '../lib/bingo-notifications';
import type { BingoViewData } from '../lib/bingo-view-types';
import { BingoTaskArtwork } from './BingoTaskArtwork';

type Completion = BingoViewData['completions'][number];
type BurstStyle = CSSProperties & {
  '--burst-x': string;
  '--burst-y': string;
  '--burst-delay': string;
  '--burst-color': string;
  '--burst-origin-x': string;
  '--burst-origin-y': string;
};

const BURST_PARTICLES = Array.from({ length: 24 }, (_, index) => {
  const angle = index / 12 * Math.PI * 2;
  const distance = 70 + index % 4 * 18;
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    delay: index % 6 * 24,
    color: ['#e9ce63', '#8fbd68', '#f3e8b5', '#c88835'][index % 4],
    originX: index < 12 ? 38 : 62,
    originY: index < 12 ? 34 : 29,
  };
});

export function BingoCompletionCelebration({ data }: { data: BingoViewData }) {
  const seenCompletionIds = useRef(new Set(data.completions.map((completion) => completion.id)));
  const [recent, setRecent] = useState<Completion[]>([]);
  const celebrationKey = recent.map((completion) => completion.id).join(':');

  useEffect(() => {
    const newlyCompleted = collectNewBingoCompletions(data.completions, seenCompletionIds.current);
    if (newlyCompleted.length) setRecent((current) => [...current, ...newlyCompleted].slice(-4));
  }, [data.completions]);

  useEffect(() => {
    if (!celebrationKey) return undefined;
    const timer = window.setTimeout(() => setRecent([]), 6_500);
    return () => window.clearTimeout(timer);
  }, [celebrationKey]);

  const notices = useMemo(() => recent.map((completion) => ({
    completion,
    task: data.tasks.find((task) => task.id === completion.taskId),
    team: data.teams.find((team) => team.id === completion.teamId),
  })), [data.tasks, data.teams, recent]);

  return (
    <div aria-atomic="true" aria-live="polite">
      {notices.length ? <div key={celebrationKey}>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[80] overflow-hidden">
        {BURST_PARTICLES.map((particle, index) => <span className="bingo-firework-particle" key={index} style={{
          '--burst-x': `${particle.x}px`, '--burst-y': `${particle.y}px`, '--burst-delay': `${particle.delay}ms`,
          '--burst-color': particle.color, '--burst-origin-x': `${particle.originX}%`, '--burst-origin-y': `${particle.originY}%`,
        } as BurstStyle} />)}
      </div>
      <section className="bingo-completion-toast fixed inset-x-4 bottom-4 z-[90] mx-auto max-w-xl rounded border-2 border-[#7fa15c] bg-[#142011]/95 p-4 text-[#f1e1b6] shadow-2xl" role="status">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#d7ae50]">Bingo update</p><h2 className="fantasy-title mt-1 text-2xl font-bold text-[#f4e6a7]">{notices.length === 1 ? 'Tile completed!' : `${notices.length} tiles completed!`}</h2></div>
          <button aria-label="Dismiss completion notice" className="scroll-button shrink-0 px-2.5 py-1.5 text-xs" onClick={() => setRecent([])} type="button">Close</button>
        </div>
        <div className="mt-3 grid gap-2">{notices.map(({ completion, task, team }) => <article className="flex items-center gap-3 rounded border border-white/10 bg-black/25 p-2.5" key={completion.id} style={{ borderLeftColor: team?.color, borderLeftWidth: 4 }}>
          {task ? <BingoTaskArtwork alt="" className="h-11 w-11 shrink-0" rule={task.rule} /> : <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#52764a] text-xl">✓</span>}
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-[#f2d98f]">{task?.title ?? 'Bingo tile'}</p><p className="mt-0.5 truncate text-xs text-[#d1c5a4]">For {team?.name ?? 'Team'} · by {completion.claimedByName}</p></div>
          <strong className="shrink-0 text-sm text-[#b8d69e]">+{completion.points} pts</strong>
        </article>)}</div>
      </section>
      </div> : null}
    </div>
  );
}
