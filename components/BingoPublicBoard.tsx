'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BingoViewData } from '../lib/bingo-view-types';
import { BingoBoard, BingoStandings } from './BingoBoard';
import { SiteHeader } from './SiteHeader';

export function BingoPublicBoard({ slug }: { slug: string }) {
  const [data, setData] = useState<BingoViewData | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/bingo/events/${encodeURIComponent(slug)}`, { cache: 'no-store' });
      const next = await response.json() as BingoViewData & { error?: string };
      if (!response.ok) throw new Error(next.error || 'The public board could not be loaded.');
      setData(next); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The public board could not be loaded.'); }
  }, [slug]);
  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 5_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [load]);

  if (!data) return <LoadingScreen error={error} />;
  return (
    <main className="realm-bg min-h-screen text-[#eadcb9]">
      <SiteHeader badge="Spectator board" />
      <section className="mx-auto max-w-[1500px] px-4 pb-20 pt-8 sm:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#c69b3c]">Live clan bingo</p><h1 className="fantasy-title mt-2 text-4xl font-bold text-[#f5df9b] sm:text-6xl">{data.event.title}</h1><p className="mt-3 text-sm text-[#b7aa8a]">{formatMode(data.event.mode)} · {statusLabel(data.event.status)}{data.event.spectatorDelaySeconds ? ` · ${data.event.spectatorDelaySeconds}s spectator delay` : ''}</p></div>
          <p className="rounded border border-[#8b6d2c] bg-[#2c2417] px-4 py-2 text-xs font-bold text-[#ddc27b]">Board refreshes every 5 seconds</p>
        </div>
        {error ? <p className="mt-5 rounded border border-[#b75b42] bg-[#4a2118] px-4 py-3 text-sm">{error}</p> : null}
        <div className="wood-panel mt-7 p-4 sm:p-6"><BingoStandings data={data} /></div>
        <div className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_330px]">
          <section className="parchment-panel p-4 sm:p-6"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.12em] text-[#80642b]">The board</p><h2 className="fantasy-title text-3xl font-bold">{data.event.mode === 'lockout' ? 'First claim owns the square.' : 'Every verified task counts.'}</h2></div><span className="seal-badge px-3 py-1.5 text-[10px] font-black uppercase">Revision {data.event.revision}</span></div><BingoBoard data={data} /></section>
          <aside className="space-y-5"><section className="wood-panel p-5"><p className="text-xs font-black uppercase tracking-[0.14em] text-[#d7ae50]">Evidence confidence</p><p className="mt-2 text-xs leading-relaxed text-[#b9ab89]">Every scored square names how it was proven. RuneLite observations, Wise Old Man snapshots, screenshots, and organizer review remain visibly distinct.</p><div className="mt-3 flex flex-wrap gap-2">{confidenceCounts(data).map(([confidence, count]) => <span className="rounded bg-[#d7ae50]/15 px-2 py-1 text-[10px] font-black uppercase text-[#ead18d]" key={confidence}>{confidence}: {count}</span>)}{!data.completions.length ? <span className="text-xs text-[#9f9272]">No accepted proof yet.</span> : null}</div></section><section className="wood-panel p-5"><p className="text-xs font-black uppercase tracking-[0.14em] text-[#d7ae50]">Hall activity</p><div className="mt-5 space-y-4">{data.activity.map((item) => <article className="border-l-2 border-[#b7903c] pl-3" key={item.id}><p className="text-sm font-black">{item.message}</p><p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-[#9f9272]">{relativeTime(item.createdAt)}</p></article>)}{!data.activity.length ? <p className="text-sm text-[#a99c7c]">The hall is quiet—for now.</p> : null}</div></section></aside>
        </div>
      </section>
    </main>
  );
}

function LoadingScreen({ error }: { error: string }) { return <main className="realm-bg grid min-h-screen place-items-center px-5 text-[#eadcb9]"><section className="wood-panel max-w-lg p-8 text-center"><p className="fantasy-title text-3xl font-bold">Opening the bingo hall…</p>{error ? <p className="mt-4 text-sm text-[#e8b69c]">{error}</p> : null}</section></main>; }
function formatMode(value: string) {
  return ({
    lockout: 'Shared lockout', classic: 'Classic lines', points: 'Points hunt', blackout: 'Blackout race',
    progression: 'Progression path', categories: 'Category challenge',
  } as Record<string, string>)[value] ?? 'Custom bingo';
}
function confidenceCounts(data: BingoViewData) {
  const counts = new Map<string, number>();
  data.completions.forEach((completion) => counts.set(completion.verificationConfidence, (counts.get(completion.verificationConfidence) ?? 0) + 1));
  return [...counts.entries()].sort((left, right) => right[1] - left[1]);
}
function statusLabel(value: string) { return value === 'live' ? 'Live now' : value === 'complete' ? 'Complete' : value === 'scheduled' ? 'Scheduled' : 'Board preview'; }
function relativeTime(value: string) { const seconds = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 1000)); if (seconds < 60) return `${seconds}s ago`; if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`; return new Date(value).toLocaleString(); }
