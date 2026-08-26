'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DRAFT_TYPE_LABELS, type DraftResult, type DraftType } from '../lib/types';
import { ResultGrid } from './ResultGrid';
import { SiteHeader } from './SiteHeader';

type Player = { id: string; name: string; avoid: boolean };
type RankingData = {
  draft: { title: string; draftType: DraftType; teamCount: number; status: string };
  captain: { id: string; name: string; submittedAt: string | null };
  players: Player[];
  result: DraftResult | null;
};

export function CaptainRanker({ token }: { token: string }) {
  const [data, setData] = useState<RankingData | null>(null);
  const [order, setOrder] = useState<Player[]>([]);
  const [pasteValue, setPasteValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/rank/${encodeURIComponent(token)}`, { cache: 'no-store' });
      const next = (await response.json()) as RankingData & { error?: string };
      if (!response.ok) throw new Error(next.error || 'The ranking could not be loaded.');
      setData(next);
      setOrder(next.players);
      setPasteValue(next.players.map((player) => player.name).join('\n'));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The ranking could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const firstLoad = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(firstLoad);
  }, [load]);

  const avoidCount = useMemo(() => order.filter((player) => player.avoid).length, [order]);

  function applyPaste() {
    const byName = new Map(order.map((player) => [player.name.toLocaleLowerCase(), player] as const));
    const names = pasteValue
      .split(/\r?\n/)
      .map((line) => normalizeRankingLine(line))
      .filter(Boolean);
    const next: Player[] = [];
    const unknown: string[] = [];
    const seen = new Set<string>();
    for (const name of names) {
      const key = name.toLocaleLowerCase();
      const player = byName.get(key);
      if (!player) {
        unknown.push(name);
      } else if (!seen.has(player.id)) {
        next.push(player);
        seen.add(player.id);
      }
    }
    const missing = order.filter((player) => !seen.has(player.id));
    if (unknown.length || missing.length || next.length !== order.length) {
      const parts = [
        unknown.length ? `Not recognized: ${unknown.slice(0, 4).join(', ')}${unknown.length > 4 ? '…' : ''}` : '',
        missing.length ? `Missing: ${missing.slice(0, 4).map((player) => player.name).join(', ')}${missing.length > 4 ? '…' : ''}` : '',
      ].filter(Boolean);
      setError(`${parts.join(' · ')}. Use every player exactly once.`);
      setSuccess('');
      return;
    }
    setOrder(next);
    setPasteValue(next.map((player) => player.name).join('\n'));
    setError('');
    setSuccess('Pasted order applied. Review the list below, then submit.');
  }

  function movePlayer(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    setOrder((current) => {
      const copy = [...current];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      setPasteValue(copy.map((player) => player.name).join('\n'));
      return copy;
    });
    setSuccess('');
  }

  function toggleAvoid(playerId: string) {
    setOrder((current) =>
      current.map((player) => (player.id === playerId ? { ...player, avoid: !player.avoid } : player)),
    );
    setSuccess('');
  }

  async function submitRanking() {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/rank/${encodeURIComponent(token)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rankings: order.map((player, index) => ({
            playerId: player.id,
            rank: index + 1,
            avoid: player.avoid,
          })),
        }),
      });
      const next = (await response.json()) as { submittedAt?: string; error?: string };
      if (!response.ok || !next.submittedAt) throw new Error(next.error || 'Your ranking could not be saved.');
      setData((current) =>
        current ? { ...current, captain: { ...current.captain, submittedAt: next.submittedAt! }, result: null } : current,
      );
      setSuccess('Ranking submitted. Your organizer can now see that you’re ready.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your ranking could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="realm-bg min-h-screen text-[#eadcb9]">
        <SiteHeader badge="Captain ranking" />
        <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
          <div className="h-10 w-80 animate-pulse rounded bg-[#d2a94e]/20" />
          <div className="mt-8 h-80 animate-pulse rounded border border-[#8b6a32]/50 bg-[#d8c28a]/20" />
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="realm-bg min-h-screen text-[#eadcb9]">
        <SiteHeader badge="Captain ranking" />
        <section className="mx-auto max-w-xl px-5 py-20 text-center">
          <p className="text-5xl">↗</p>
          <h1 className="fantasy-title mt-5 text-3xl font-bold text-[#f5df9b]">Captain link unavailable</h1>
          <p className="mt-3 text-[#b5a888]">{error || 'Ask the organizer to copy your whole captain link again.'}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="realm-bg min-h-screen text-[#eadcb9]">
      <SiteHeader badge={`${data.captain.name} · Captain`} />
      <section className="mx-auto max-w-6xl px-5 pb-20 pt-8 sm:px-8 sm:pt-12">
        <div className="mb-8 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c69b3c]">{data.draft.title}</p>
            <h1 className="fantasy-title mt-3 text-4xl font-bold leading-none text-[#f5df9b] sm:text-6xl">Rank your player pool.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#b5a888]">
              Highest choice first. Your order is combined with the other captains for {DRAFT_TYPE_LABELS[data.draft.draftType].toLowerCase()}.
            </p>
          </div>
          <span className={`self-start rounded-full px-4 py-2 text-xs font-black lg:self-auto ${data.captain.submittedAt ? 'bg-[#cce7d7] text-[#195440]' : 'bg-[#f2e4ad] text-[#5a4510]'}`}>
            {data.captain.submittedAt ? '✓ Submitted — edits allowed' : 'Not submitted yet'}
          </span>
        </div>

        {success ? <p role="status" className="mb-5 rounded-xl border border-[#2d6f5e]/20 bg-[#e6f3eb] px-4 py-3 text-sm font-bold text-[#245b4c]">{success}</p> : null}
        {error ? <p role="alert" className="mb-5 rounded-xl border border-[#d25839]/25 bg-[#fff0ea] px-4 py-3 text-sm font-bold text-[#9b3c26]">{error}</p> : null}

        <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="wood-panel self-start p-6 lg:sticky lg:top-5 sm:p-7">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#d7ae50]">Fast entry</p>
            <h2 className="fantasy-title mt-3 text-2xl font-bold">Paste your ranking.</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#cfc3a5]">Put one player on each line, best to worst. Numbered lists work too.</p>
            <textarea
              className="dark-field mt-5 min-h-64 w-full resize-y p-4 font-mono text-sm leading-7 outline-none placeholder:text-[#8f866f] focus:border-[#d7ae50]"
              value={pasteValue}
              onChange={(event) => setPasteValue(event.target.value)}
              spellCheck={false}
              aria-label="Pasted player ranking"
            />
            <button
              type="button"
              onClick={applyPaste}
              className="gold-button mt-3 w-full px-4 py-3 text-sm"
            >
              Apply pasted order →
            </button>
            <div className="mt-5 rounded border border-[#a4813b]/45 bg-black/20 p-4">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-[#bda873]">Avoid means</p>
              <p className="mt-2 text-sm leading-relaxed text-[#dfd2ae]">“Please don’t place this player on my team.” It doesn’t remove them from the draft.</p>
            </div>
          </aside>

          <section className="parchment-panel p-5 sm:p-7">
            <div className="flex flex-col gap-3 border-b border-[#173f35]/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.12em] text-[#6e7d77]">Review ranking</p>
                <h2 className="fantasy-title mt-1 text-2xl font-bold">{order.length} players · {avoidCount} avoid{avoidCount === 1 ? '' : 's'}</h2>
              </div>
              <p className="text-xs text-[#718079]">Use arrows for small changes</p>
            </div>

            <ol className="mt-4 space-y-2">
              {order.map((player, index) => (
                <li className={`grid grid-cols-[42px_minmax(0,1fr)] gap-3 rounded border p-3 shadow-[0_2px_0_rgba(73,48,20,.28)] sm:grid-cols-[42px_minmax(0,1fr)_auto_auto] sm:items-center ${player.avoid ? 'border-[#a84c31]/60 bg-[#f1c7a7]' : 'border-[#8b6a32]/45 bg-[#fff2ca]/72'}`} key={player.id}>
                  <span className="grid h-10 w-10 place-items-center rounded border border-[#8b6a32]/45 bg-[#dac18b] font-black text-[#5a4325]">{index + 1}</span>
                  <span className="min-w-0 font-black">{player.name}</span>
                  <span className="col-start-2 flex gap-1 sm:col-start-auto" aria-label={`Move ${player.name}`}>
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => movePlayer(index, -1)}
                      className="scroll-button grid h-9 w-9 place-items-center text-sm disabled:opacity-25"
                      aria-label={`Move ${player.name} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index === order.length - 1}
                      onClick={() => movePlayer(index, 1)}
                      className="scroll-button grid h-9 w-9 place-items-center text-sm disabled:opacity-25"
                      aria-label={`Move ${player.name} down`}
                    >
                      ↓
                    </button>
                  </span>
                  <button
                    type="button"
                    aria-pressed={player.avoid}
                    onClick={() => toggleAvoid(player.id)}
                    className={`col-start-2 min-w-24 rounded px-3 py-2 text-xs font-black sm:col-start-auto ${
                      player.avoid
                        ? 'border border-[#b95a35] bg-[#9d4027] text-[#fff2d2] shadow-[0_3px_0_#5f2416]'
                        : 'scroll-button text-[#66583e]'
                    }`}
                  >
                    Avoid: {player.avoid ? 'Yes' : 'No'}
                  </button>
                </li>
              ))}
            </ol>

            <div className="mt-6 flex flex-col gap-3 border-t border-[#173f35]/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-md text-xs leading-relaxed text-[#6a7872]">Submitting replaces your previous ranking. You can come back through this same private link and update it until the organizer runs the draft.</p>
              <button
                type="button"
                disabled={saving || order.length === 0}
                onClick={() => void submitRanking()}
                className="gold-button shrink-0 px-5 py-3 text-sm"
              >
                {saving ? 'Submitting…' : data.captain.submittedAt ? 'Update ranking' : 'Submit ranking →'}
              </button>
            </div>
          </section>
        </div>

        {data.result ? (
          <div className="mt-12">
            <ResultGrid result={data.result} title={data.draft.title} />
          </div>
        ) : null}
      </section>
    </main>
  );
}

function normalizeRankingLine(value: string) {
  return value
    .trim()
    .replace(/^[-•]\s*/, '')
    .replace(/^\d+\s*[.)\-:,]?\s*/, '')
    .replace(/^"|"$/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}
