'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { absoluteUrl, copyText, initials } from '../lib/client';
import { DRAFT_TYPE_LABELS, type DraftResult, type DraftType } from '../lib/types';
import { ResultGrid } from './ResultGrid';
import { SiteHeader } from './SiteHeader';

type DashboardData = {
  draft: {
    title: string;
    draftType: DraftType;
    teamCount: number;
    status: string;
    createdAt: string;
  };
  players: { id: string; name: string; sort_order: number }[];
  captains: {
    id: string;
    name: string;
    teamIndex: number;
    path: string;
    submittedAt: string | null;
  }[];
  result: DraftResult | null;
};

export function Manager({ token }: { token: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch(`/api/manage/${encodeURIComponent(token)}`, { cache: 'no-store' });
      const next = (await response.json()) as DashboardData & { error?: string };
      if (!response.ok) throw new Error(next.error || 'The draft could not be loaded.');
      setData(next);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The draft could not be loaded.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const firstLoad = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(true), 15000);
    return () => {
      window.clearTimeout(firstLoad);
      window.clearInterval(interval);
    };
  }, [load]);

  async function runDraft() {
    setRunning(true);
    setError('');
    try {
      const response = await fetch(`/api/manage/${encodeURIComponent(token)}/run`, { method: 'POST' });
      const next = (await response.json()) as { result?: DraftResult; error?: string };
      if (!response.ok || !next.result) throw new Error(next.error || 'The teams could not be generated.');
      setData((current) => (current ? { ...current, result: next.result!, draft: { ...current.draft, status: 'complete' } } : current));
      window.setTimeout(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The teams could not be generated.');
    } finally {
      setRunning(false);
    }
  }

  async function copy(label: string, value: string) {
    await copyText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(''), 1800);
  }

  if (loading) {
    return (
      <main className="realm-bg min-h-screen text-[#eadcb9]">
        <SiteHeader badge="Organizer" />
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
          <div className="h-9 w-72 animate-pulse rounded bg-[#d2a94e]/20" />
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((item) => <div className="h-40 animate-pulse rounded border border-[#8b6a32]/50 bg-[#d8c28a]/20" key={item} />)}
          </div>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="realm-bg min-h-screen text-[#eadcb9]">
        <SiteHeader badge="Organizer" />
        <section className="mx-auto max-w-xl px-5 py-20 text-center">
          <p className="text-5xl">↗</p>
          <h1 className="fantasy-title mt-5 text-3xl font-bold text-[#f5df9b]">Organizer link unavailable</h1>
          <p className="mt-3 text-[#b5a888]">{error || 'Check that the whole private organizer link was copied.'}</p>
          <Link className="gold-button mt-7 inline-block px-5 py-3 text-sm" href="/">Start a new draft</Link>
        </section>
      </main>
    );
  }

  const readyCount = data.captains.filter((captain) => captain.submittedAt).length;
  const allReady = readyCount === data.captains.length;
  const allCaptainLinks = data.captains
    .map((captain) => `${captain.name}: ${absoluteUrl(captain.path)}`)
    .join('\n');

  return (
    <main className="realm-bg min-h-screen text-[#eadcb9]">
      <SiteHeader badge="Organizer board" />
      <section className="mx-auto max-w-7xl px-5 pb-20 pt-8 sm:px-8 sm:pt-12">
        <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c69b3c]">Organizer board</p>
            <h1 className="fantasy-title mt-3 text-4xl font-bold leading-none text-[#f5df9b] sm:text-6xl">{data.draft.title}</h1>
            <p className="mt-3 text-sm font-semibold text-[#b5a888]">
              {DRAFT_TYPE_LABELS[data.draft.draftType]} · {data.draft.teamCount} teams · {data.players.length} players
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="scroll-button px-4 py-2.5 text-xs"
            >
              Refresh status
            </button>
            <button
              type="button"
              onClick={() => void copy('admin', window.location.href)}
              className="scroll-button px-4 py-2.5 text-xs"
            >
              {copied === 'admin' ? 'Link copied' : 'Copy organizer link'}
            </button>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="parchment-panel p-5 sm:p-8">
            <div className="flex flex-col gap-3 border-b border-[#173f35]/10 pb-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.12em] text-[#6e7d77]">Captain rankings</p>
                <h2 className="fantasy-title mt-1 text-3xl font-bold">{readyCount} of {data.captains.length} ready</h2>
                <p className="mt-2 text-sm text-[#68766f]">Send each captain only the link next to their name.</p>
              </div>
              <button
                type="button"
                onClick={() => void copy('all', allCaptainLinks)}
                className="iron-button self-start px-4 py-2.5 text-xs"
              >
                {copied === 'all' ? 'Copied all links' : 'Copy all links'}
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {data.captains.map((captain) => (
                <article className="parchment-card p-4" key={captain.id}>
                  <div className="flex items-center gap-3">
                    <span className="brand-rune grid h-11 w-11 place-items-center rounded-full text-sm font-black text-[#f4d77c]">{initials(captain.name)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black">{captain.name}</p>
                      <p className={`mt-0.5 text-xs font-bold ${captain.submittedAt ? 'text-[#2d6f5e]' : 'text-[#9a6e1a]'}`}>
                        {captain.submittedAt ? '✓ Ranking submitted' : '○ Waiting for ranking'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void copy(captain.id, absoluteUrl(captain.path))}
                      className="scroll-button flex-1 px-3 py-2 text-xs"
                    >
                      {copied === captain.id ? 'Copied' : 'Copy link'}
                    </button>
                    <a
                      href={captain.path}
                      target="_blank"
                      rel="noreferrer"
                      className="scroll-button px-3 py-2 text-xs"
                    >
                      Open ↗
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="wood-panel p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#d7ae50]">Run the draft</p>
              <span className={`rounded-full px-3 py-1 text-[11px] font-black ${allReady ? 'bg-[#b9e3cd] text-[#174536]' : 'bg-white/10 text-[#c3d2cc]'}`}>
                {allReady ? 'Ready' : `${data.captains.length - readyCount} waiting`}
              </span>
            </div>
            <h2 className="fantasy-title mt-4 text-3xl font-bold leading-none">
              {data.result ? 'Run it again?' : allReady ? 'Everyone has weighed in.' : 'Rankings come first.'}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[#cfc3a5]">
              {data.result
                ? 'Rerunning replaces the current result using the latest captain rankings.'
                : 'The button unlocks when every captain has submitted a complete ranked list.'}
            </p>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#d6ad4e] transition-all" style={{ width: `${(readyCount / data.captains.length) * 100}%` }} />
            </div>
            <button
              type="button"
              disabled={!allReady || running}
              onClick={() => void runDraft()}
              className="gold-button mt-6 w-full px-5 py-3.5 text-sm"
            >
              {running ? 'Building teams…' : data.result ? 'Run draft again' : 'Run the draft →'}
            </button>
            <p className="mt-4 text-xs leading-relaxed text-[#b8aa87]">Avoid choices are treated as hard preferences. They are overridden only if every available team would otherwise be blocked.</p>
          </aside>
        </div>

        {error ? <p role="alert" className="mt-5 rounded-xl border border-[#d25839]/25 bg-[#fff0ea] px-4 py-3 text-sm font-bold text-[#9b3c26]">{error}</p> : null}
        {data.result ? (
          <div className="mt-12 scroll-mt-6" id="results">
            <ResultGrid result={data.result} title={data.draft.title} />
          </div>
        ) : null}
      </section>
    </main>
  );
}
