'use client';

import { useMemo, useState } from 'react';
import type { PlayerAnswer } from '../lib/types';
import { PlayerIntel } from './PlayerIntel';

type LivePlayer = { id: string; name: string; answers?: PlayerAnswer[] };
type LiveState = {
  started: boolean;
  currentCaptain: { id: string; name: string; teamIndex: number; turnNumber: number } | null;
  captains: { id: string; playerId: string; name: string; teamIndex: number }[];
  picks: { captainId: string; playerId: string; playerName: string; pickNumber: number; turnNumber: number }[];
  availablePlayerIds: string[];
  constraints: { type: 'together' | 'apart'; playerAId: string; playerBId: string }[];
};

export function LiveDraftBoard({
  token,
  captainId,
  players,
  live,
  onRefresh,
}: {
  token: string;
  captainId: string;
  players: LivePlayer[];
  live: LiveState;
  onRefresh: () => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [picking, setPicking] = useState('');
  const [error, setError] = useState('');
  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player] as const)), [players]);
  const captainPlayerById = useMemo(
    () => new Map(live.captains.map((captain) => [captain.playerId, { id: captain.playerId, name: captain.name }] as const)),
    [live.captains],
  );
  const nameById = (id: string) => playerById.get(id)?.name || captainPlayerById.get(id)?.name || 'Unknown player';
  const available = live.availablePlayerIds
    .map((id) => playerById.get(id))
    .filter((player): player is LivePlayer => Boolean(player))
    .filter((player) => player.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const myTurn = live.currentCaptain?.id === captainId;

  async function pick(player: LivePlayer) {
    setPicking(player.id);
    setError('');
    try {
      const response = await fetch(`/api/rank/${encodeURIComponent(token)}/pick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: player.id }),
      });
      const next = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(next.error || 'That pick could not be saved.');
      await onRefresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That pick could not be saved.');
    } finally {
      setPicking('');
    }
  }

  if (!live.started) {
    return (
      <section className="wood-panel mx-auto max-w-3xl p-7 text-center sm:p-10">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#d7ae50]">Live draft lobby</p>
        <h2 className="fantasy-title mt-3 text-4xl font-bold">Waiting for the organizer.</h2>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[#cfc3a5]">
          Keep this private link open. The player pool and pick button will appear here when the organizer starts the draft.
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <section className="parchment-panel p-5 sm:p-7">
        <div className="flex flex-col gap-4 border-b border-[#6e5226]/25 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.12em] text-[#6e603f]">Available player pool</p>
            <h2 className="fantasy-title mt-1 text-3xl font-bold">
              {myTurn ? 'Your pick.' : live.currentCaptain ? `${live.currentCaptain.name} is choosing.` : 'Draft complete.'}
            </h2>
            <p className="mt-2 text-xs text-[#6d6048]">The board refreshes automatically. Together rules select the connected group in one turn.</p>
          </div>
          <input
            className="realm-field h-11 w-full px-3 text-sm font-semibold outline-none sm:w-56"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search players"
          />
        </div>
        {error ? <p role="alert" className="mt-5 rounded border border-[#a7442d]/35 bg-[#f3c5a9] px-4 py-3 text-sm font-bold text-[#7d2b1c]">{error}</p> : null}
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {available.map((player) => {
            const rules = live.constraints.filter((rule) => rule.playerAId === player.id || rule.playerBId === player.id);
            return (
              <article className="parchment-card flex min-w-0 flex-col p-4" key={player.id}>
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-black">{player.name}</h3>
                    {rules.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {rules.map((rule, index) => {
                          const otherId = rule.playerAId === player.id ? rule.playerBId : rule.playerAId;
                          return <span className={`rounded px-2 py-1 text-[10px] font-black ${rule.type === 'together' ? 'bg-[#d5d1a0] text-[#38562f]' : 'bg-[#e8b59e] text-[#843723]'}`} key={`${rule.type}-${otherId}-${index}`}>{rule.type === 'together' ? 'With' : 'Apart'}: {nameById(otherId)}</span>;
                        })}
                      </div>
                    ) : <p className="mt-1 text-xs text-[#77694f]">No roster rules</p>}
                  </div>
                  <button
                    type="button"
                    className="gold-button shrink-0 whitespace-nowrap px-3 py-2 text-xs"
                    disabled={!myTurn || Boolean(picking)}
                    onClick={() => void pick(player)}
                  >
                    {picking === player.id ? 'Picking…' : 'Pick'}
                  </button>
                </div>
                <PlayerIntel
                  name={player.name}
                  answers={player.answers}
                  className="mt-4 border-t border-[#8b6a32]/25 pt-3"
                />
              </article>
            );
          })}
          {!available.length ? <p className="py-8 text-center text-sm font-bold text-[#6d6048] md:col-span-2">No available players match that search.</p> : null}
        </div>
      </section>

      <aside className="wood-panel self-start p-5 xl:sticky xl:top-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#d7ae50]">Live teams</p>
        <div className="mt-4 space-y-4">
          {live.captains.map((captain) => {
            const picks = live.picks.filter((pick) => pick.captainId === captain.id).sort((a, b) => a.pickNumber - b.pickNumber);
            return (
              <section className={`rounded border p-3 ${live.currentCaptain?.id === captain.id ? 'border-[#e2ba59] bg-[#4b3a1d]' : 'border-[#8e7441]/45 bg-black/15'}`} key={captain.id}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-black text-[#f2dfab]">Team {captain.teamIndex + 1}</h3>
                  {live.currentCaptain?.id === captain.id ? <span className="rounded bg-[#d7ae50] px-2 py-1 text-[10px] font-black text-[#24180b]">Picking</span> : null}
                </div>
                <p className="mt-1 text-xs font-bold text-[#cfc3a5]">{captain.name} · Captain</p>
                <ol className="mt-3 space-y-1.5">
                  {picks.map((pick) => <li className="rounded bg-black/20 px-2.5 py-2 text-xs font-semibold text-[#e4d6b2]" key={pick.playerId}>{pick.pickNumber + 1}. {pick.playerName}</li>)}
                  {!picks.length ? <li className="text-xs text-[#8f856d]">No picks yet</li> : null}
                </ol>
              </section>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
