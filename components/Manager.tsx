'use client';

import { useCallback, useEffect, useState } from 'react';
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
    void load();
    const interval = window.setInterval(() => void load(true), 15000);
    return () => window.clearInterval(interval);
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
      <main className="min-h-screen bg-[#f3efe4] text-[#14251f]">
        <SiteHeader badge="Organizer" />
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
          <div className="h-9 w-72 animate-pulse rounded-xl bg-[#173f35]/10" />
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((item) => <div className="h-40 animate-pulse rounded-3xl bg-white/70" key={item} />)}
          </div>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-[#f3efe4] text-[#14251f]">
        <SiteHeader badge="Organizer" />
        <section className="mx-auto max-w-xl px-5 py-20 text-center">
          <p className="text-5xl">↗</p>
          <h1 className="mt-5 text-3xl font-black tracking-[-0.04em]">Organizer link unavailable</h1>
          <p className="mt-3 text-[#68766f]">{error || 'Check that the whole private organizer link was copied.'}</p>
          <a className="mt-7 inline-block rounded-xl bg-[#173f35] px-5 py-3 text-sm font-black text-white" href="/">Start a new draft</a>
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
    <main className="min-h-screen bg-[#f3efe4] text-[#14251f]">
      <SiteHeader badge="Organizer board" />
      <section className="mx-auto max-w-7xl px-5 pb-20 pt-8 sm:px-8 sm:pt-12">
        <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d25839]">Organizer board</p>
            <h1 className="mt-3 text-4xl font-black leading-none tracking-[-0.045em] sm:text-6xl">{data.draft.title}</h1>
            <p className="mt-3 text-sm font-semibold text-[#63736c]">
              {DRAFT_TYPE_LABELS[data.draft.draftType]} · {data.draft.teamCount} teams · {data.players.length} players
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl border border-[#173f35]/15 bg-white/70 px-4 py-2.5 text-xs font-black text-[#173f35]"
            >
              Refresh status
            </button>
            <button
              type="button"
              onClick={() => void copy('admin', window.location.href)}
              className="rounded-xl border border-[#173f35]/15 bg-white/70 px-4 py-2.5 text-xs font-black text-[#173f35]"
            >
              {copied === 'admin' ? 'Link copied' : 'Copy organizer link'}
            </button>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-[28px] border border-[#173f35]/12 bg-[#fffdf7] p-5 shadow-[0_20px_55px_rgba(23,63,53,.08)] sm:p-8">
            <div className="flex flex-col gap-3 border-b border-[#173f35]/10 pb-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.12em] text-[#6e7d77]">Captain rankings</p>
                <h2 className="mt-1 text-3xl font-black tracking-[-0.04em]">{readyCount} of {data.captains.length} ready</h2>
                <p className="mt-2 text-sm text-[#68766f]">Send each captain only the link next to their name.</p>
              </div>
              <button
                type="button"
                onClick={() => void copy('all', allCaptainLinks)}
                className="self-start rounded-xl bg-[#173f35] px-4 py-2.5 text-xs font-black text-white"
              >
                {copied === 'all' ? 'Copied all links' : 'Copy all links'}
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {data.captains.map((captain) => (
                <article className="rounded-2xl border border-[#173f35]/12 bg-white p-4" key={captain.id}>
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-[#dce8df] text-sm font-black text-[#173f35]">{initials(captain.name)}</span>
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
                      className="flex-1 rounded-xl border border-[#173f35]/15 px-3 py-2 text-xs font-black text-[#173f35]"
                    >
                      {copied === captain.id ? 'Copied' : 'Copy link'}
                    </button>
                    <a
                      href={captain.path}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-[#173f35]/15 px-3 py-2 text-xs font-black text-[#173f35]"
                    >
                      Open ↗
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="rounded-[28px] bg-[#173f35] p-6 text-white sm:p-8">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ef9a78]">Run the draft</p>
              <span className={`rounded-full px-3 py-1 text-[11px] font-black ${allReady ? 'bg-[#b9e3cd] text-[#174536]' : 'bg-white/10 text-[#c3d2cc]'}`}>
                {allReady ? 'Ready' : `${data.captains.length - readyCount} waiting`}
              </span>
            </div>
            <h2 className="mt-4 text-3xl font-black leading-none tracking-[-0.04em]">
              {data.result ? 'Run it again?' : allReady ? 'Everyone has weighed in.' : 'Rankings come first.'}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[#c5d3ce]">
              {data.result
                ? 'Rerunning replaces the current result using the latest captain rankings.'
                : 'The button unlocks when every captain has submitted a complete ranked list.'}
            </p>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#ef9a78] transition-all" style={{ width: `${(readyCount / data.captains.length) * 100}%` }} />
            </div>
            <button
              type="button"
              disabled={!allReady || running}
              onClick={() => void runDraft()}
              className="mt-6 w-full rounded-xl bg-[#e16948] px-5 py-3.5 text-sm font-black text-white shadow-[0_4px_0_#9f3c26] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-[#60776f] disabled:shadow-none disabled:hover:translate-y-0"
            >
              {running ? 'Building teams…' : data.result ? 'Run draft again' : 'Run the draft →'}
            </button>
            <p className="mt-4 text-xs leading-relaxed text-[#9fb5ad]">Avoid choices are treated as hard preferences. They are overridden only if every available team would otherwise be blocked.</p>
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
