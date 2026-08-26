'use client';

import { useEffect, useState } from 'react';
import type { DraftResult, PlayerAnswer } from '../lib/types';
import { ResultGrid } from './ResultGrid';
import { SiteHeader } from './SiteHeader';

type PublicData = {
  draft: { title: string; draftType: string; teamCount: number; status: string; createdAt: string };
  players: { id: string; name: string; answers: PlayerAnswer[] }[];
  result: DraftResult | null;
};

export function PublicEvent({ slug }: { slug: string }) {
  const [data, setData] = useState<PublicData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void fetch(`/api/events/${encodeURIComponent(slug)}/public`).then(async (response) => {
      const next = await response.json() as PublicData & { error?: string };
      if (!response.ok) throw new Error(next.error || 'Event unavailable.');
      if (active) setData(next);
    }).catch((caught) => active && setError(caught instanceof Error ? caught.message : 'Event unavailable.'));
    return () => { active = false; };
  }, [slug]);
  return <main className="realm-bg min-h-screen text-[#eadcb9]">
    <SiteHeader badge="Public event" />
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
      {error ? <p className="wood-panel mx-auto max-w-xl p-8 text-center font-bold">{error}</p> : null}
      {!data && !error ? <p className="text-center text-sm font-bold">Loading event…</p> : null}
      {data ? <>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#c69b3c]">Clan bingo event</p>
        <h1 className="fantasy-title mt-3 text-5xl font-bold text-[#f5df9b]">{data.draft.title}</h1>
        <p className="mt-3 text-sm text-[#b5a888]">{data.players.length} participants · {data.draft.teamCount} teams · {data.draft.status}</p>
        {data.result ? <div className="mt-10"><ResultGrid result={data.result} title={data.draft.title} /></div> :
          <div className="parchment-panel mt-8 p-6 text-[#2d2316]"><h2 className="fantasy-title text-3xl font-bold">Registered adventurers</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.players.map((player) => <article className="parchment-card p-4" key={player.id}><p className="font-black">{player.name}</p>{player.answers.map((answer) => <p className="mt-2 text-xs" key={answer.questionId}><b>{answer.label}:</b> {answer.value}</p>)}</article>)}</div>
          </div>}
      </> : null}
    </section>
  </main>;
}
