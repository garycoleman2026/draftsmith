'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { absoluteUrl, copyText, initials } from '../lib/client';
import { DRAFT_TYPE_LABELS, type DraftResult, type DraftType, type PlayerAnswer, type RosterMode, type SurveyQuestion } from '../lib/types';
import { PlayerIntel } from './PlayerIntel';
import { ResultGrid } from './ResultGrid';
import { SiteHeader } from './SiteHeader';

type DashboardPlayer = {
  id: string;
  name: string;
  sort_order: number;
  source: string;
  created_at: string | null;
  answers: PlayerAnswer[];
};

type DashboardCaptain = {
  id: string;
  playerId: string;
  name: string;
  teamIndex: number;
  path: string;
  submittedAt: string | null;
};

type DashboardConstraint = {
  id: string;
  type: 'together' | 'apart';
  playerA: { id: string; name: string };
  playerB: { id: string; name: string };
};

type DashboardLive = {
  started: boolean;
  startedAt: string | null;
  picks: { captainId: string; playerId: string; playerName: string; pickNumber: number; turnNumber: number; pickedAt: string }[];
  availablePlayerIds: string[];
  currentCaptain: { id: string; name: string; teamIndex: number; turnNumber: number } | null;
};

type DashboardData = {
  draft: {
    title: string;
    draftType: DraftType;
    teamCount: number;
    rosterMode: RosterMode;
    status: string;
    createdAt: string;
  };
  joinPath: string | null;
  registrationOpen: boolean;
  surveyQuestions: Required<SurveyQuestion>[];
  players: DashboardPlayer[];
  captains: DashboardCaptain[];
  constraints: DashboardConstraint[];
  live: DashboardLive | null;
  result: DraftResult | null;
};

export function Manager({ token }: { token: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [captainSelection, setCaptainSelection] = useState<string[]>([]);
  const [ruleType, setRuleType] = useState<'together' | 'apart'>('together');
  const [playerAId, setPlayerAId] = useState('');
  const [playerBId, setPlayerBId] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState('');

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch(`/api/manage/${encodeURIComponent(token)}`, { cache: 'no-store' });
      const next = (await response.json()) as DashboardData & { error?: string };
      if (!response.ok) throw new Error(next.error || 'The draft could not be loaded.');
      setData(next);
      setCaptainSelection((current) => {
        if (current.length === next.draft.teamCount && current.some(Boolean)) return current;
        return Array.from(
          { length: next.draft.teamCount },
          (_, index) => next.captains.find((captain) => captain.teamIndex === index)?.playerId ?? '',
        );
      });
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The draft could not be loaded.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const firstLoad = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(true), 10000);
    return () => {
      window.clearTimeout(firstLoad);
      window.clearInterval(interval);
    };
  }, [load]);

  async function mutate(action: string, path: string, init: RequestInit, message: string) {
    setWorking(action);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(path, init);
      const next = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(next.error || 'That change could not be saved.');
      await load(true);
      setSuccess(message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That change could not be saved.');
    } finally {
      setWorking('');
    }
  }

  async function saveCaptains() {
    await mutate(
      'captains',
      `/api/manage/${encodeURIComponent(token)}/captains`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerIds: captainSelection }),
      },
      'Captain seats saved. Fresh private links are ready below.',
    );
  }

  async function addConstraint() {
    await mutate(
      'constraint',
      `/api/manage/${encodeURIComponent(token)}/constraints`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: ruleType, playerAId, playerBId }),
      },
      'Roster rule added.',
    );
    setPlayerAId('');
    setPlayerBId('');
  }

  async function removeConstraint(id: string) {
    await mutate(
      `remove-${id}`,
      `/api/manage/${encodeURIComponent(token)}/constraints`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      },
      'Roster rule removed.',
    );
  }

  async function toggleRegistration() {
    if (!data) return;
    await mutate(
      'registration',
      `/api/manage/${encodeURIComponent(token)}/registration`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ open: !data.registrationOpen }),
      },
      data.registrationOpen ? 'Public registration is now closed.' : 'Public registration is now open.',
    );
  }

  async function startLiveDraft() {
    await mutate(
      'live',
      `/api/manage/${encodeURIComponent(token)}/live`,
      { method: 'POST' },
      'Live draft started. Captain boards are updating now.',
    );
  }

  async function runDraft() {
    setWorking('run');
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/manage/${encodeURIComponent(token)}/run`, { method: 'POST' });
      const next = (await response.json()) as { result?: DraftResult; error?: string };
      if (!response.ok || !next.result) throw new Error(next.error || 'The teams could not be generated.');
      setData((current) => current ? { ...current, result: next.result!, draft: { ...current.draft, status: 'complete' } } : current);
      setSuccess('Teams generated.');
      window.setTimeout(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The teams could not be generated.');
    } finally {
      setWorking('');
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

  const isLive = data.draft.draftType === 'live';
  const readyCount = data.captains.filter((captain) => captain.submittedAt).length;
  const captainsReady = data.captains.length === data.draft.teamCount;
  const allReady = captainsReady && readyCount === data.captains.length;
  const captainSelectionValid = captainSelection.length === data.draft.teamCount && captainSelection.every(Boolean) && new Set(captainSelection).size === data.draft.teamCount;
  const allCaptainLinks = data.captains.map((captain) => `${captain.name}: ${absoluteUrl(captain.path)}`).join('\n');
  const joinUrl = data.joinPath ? absoluteUrl(data.joinPath) : '';

  return (
    <main className="realm-bg min-h-screen text-[#eadcb9]">
      <SiteHeader badge="Organizer board" />
      <section className="mx-auto max-w-7xl px-5 pb-20 pt-8 sm:px-8 sm:pt-12">
        <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c69b3c]">Organizer board</p>
            <h1 className="fantasy-title mt-3 text-4xl font-bold leading-none text-[#f5df9b] sm:text-6xl">{data.draft.title}</h1>
            <p className="mt-3 text-sm font-semibold text-[#b5a888]">
              {DRAFT_TYPE_LABELS[data.draft.draftType]} · {data.draft.teamCount} teams · {data.players.length} registered
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void load()} className="scroll-button px-4 py-2.5 text-xs">Refresh status</button>
            <button type="button" onClick={() => void copy('admin', window.location.href)} className="scroll-button px-4 py-2.5 text-xs">
              {copied === 'admin' ? 'Link copied' : 'Copy organizer link'}
            </button>
          </div>
        </div>

        {success ? <p role="status" className="mb-5 rounded-xl border border-[#2d6f5e]/20 bg-[#e6f3eb] px-4 py-3 text-sm font-bold text-[#245b4c]">{success}</p> : null}
        {error ? <p role="alert" className="mb-5 rounded-xl border border-[#d25839]/25 bg-[#fff0ea] px-4 py-3 text-sm font-bold text-[#9b3c26]">{error}</p> : null}

        {data.joinPath ? (
          <section className="parchment-panel mb-5 p-5 sm:p-7">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.12em] text-[#6e7d77]">Public signup</p>
                <h2 className="fantasy-title mt-1 text-3xl font-bold">{data.players.length} adventurer{data.players.length === 1 ? '' : 's'} registered</h2>
                <p className="mt-2 text-sm text-[#68766f]">Share this one link. Every signup is added to this event roster with their survey answers.</p>
                <div className="mt-4 flex max-w-3xl gap-2 rounded border border-[#8b6a32]/40 bg-[#f2dfad]/75 p-2">
                  <code className="min-w-0 flex-1 truncate px-2 py-2 text-xs font-bold text-[#5a4728]">{joinUrl}</code>
                  <button type="button" className="iron-button px-3 py-2 text-xs" onClick={() => void copy('join', joinUrl)}>{copied === 'join' ? 'Copied' : 'Copy signup link'}</button>
                  <a className="iron-button px-3 py-2 text-xs" href={data.joinPath} target="_blank" rel="noreferrer">Open ↗</a>
                </div>
                {data.surveyQuestions.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {data.surveyQuestions.map((question) => <span className="rounded bg-[#d8c490] px-2.5 py-1.5 text-[11px] font-black text-[#645231]" key={question.id}>{question.label}{question.required ? ' *' : ''}</span>)}
                  </div>
                ) : null}
              </div>
              <div className="wood-panel min-w-56 p-5 text-center">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#d7ae50]">Registration</p>
                <p className="fantasy-title mt-2 text-2xl font-bold">{data.registrationOpen ? 'Open' : 'Closed'}</p>
                <button type="button" disabled={working === 'registration' || Boolean(data.live?.started)} onClick={() => void toggleRegistration()} className="gold-button mt-4 w-full px-4 py-2.5 text-xs">
                  {working === 'registration' ? 'Saving…' : data.registrationOpen ? 'Close signups' : 'Reopen signups'}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-2">
          <section className="parchment-panel p-5 sm:p-7">
            <div className="border-b border-[#173f35]/10 pb-5">
              <p className="text-sm font-black uppercase tracking-[0.12em] text-[#6e7d77]">Captain seats</p>
              <h2 className="fantasy-title mt-1 text-3xl font-bold">Choose {data.draft.teamCount} captains.</h2>
              <p className="mt-2 text-sm text-[#68766f]">Saving new seats creates fresh captain links and clears earlier scores or live picks.</p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {captainSelection.map((playerId, index) => (
                <label className="text-xs font-black uppercase tracking-[0.08em] text-[#65583f]" key={index}>
                  Team {index + 1}
                  <select
                    className="realm-field mt-2 h-11 w-full px-3 text-sm font-bold normal-case tracking-normal outline-none"
                    value={playerId}
                    disabled={Boolean(data.live?.started)}
                    onChange={(event) => setCaptainSelection((current) => current.map((value, slot) => slot === index ? event.target.value : value))}
                  >
                    <option value="">Select a captain</option>
                    {data.players.map((player) => (
                      <option value={player.id} disabled={captainSelection.some((selected, slot) => slot !== index && selected === player.id)} key={player.id}>{player.name}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <button type="button" disabled={!captainSelectionValid || working === 'captains' || Boolean(data.live?.started)} onClick={() => void saveCaptains()} className="gold-button mt-5 px-5 py-3 text-sm">
              {working === 'captains' ? 'Saving seats…' : captainsReady ? 'Save / reassign captains' : 'Create captain links →'}
            </button>
          </section>

          <section className="parchment-panel p-5 sm:p-7">
            <div className="border-b border-[#173f35]/10 pb-5">
              <p className="text-sm font-black uppercase tracking-[0.12em] text-[#6e7d77]">Roster rules</p>
              <h2 className="fantasy-title mt-1 text-3xl font-bold">Keep together or apart.</h2>
              <p className="mt-2 text-sm text-[#68766f]">Together rules can chain into groups. Live drafts enforce the whole group as one pick.</p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <select className="realm-field h-11 px-3 text-sm font-bold outline-none" value={ruleType} disabled={Boolean(data.live?.started)} onChange={(event) => setRuleType(event.target.value as 'together' | 'apart')}>
                <option value="together">Keep together</option>
                <option value="apart">Keep apart</option>
              </select>
              <select className="realm-field h-11 min-w-0 px-3 text-sm font-bold outline-none" value={playerAId} disabled={Boolean(data.live?.started)} onChange={(event) => setPlayerAId(event.target.value)}>
                <option value="">First player</option>
                {data.players.map((player) => <option value={player.id} key={player.id}>{player.name}</option>)}
              </select>
              <select className="realm-field h-11 min-w-0 px-3 text-sm font-bold outline-none" value={playerBId} disabled={Boolean(data.live?.started)} onChange={(event) => setPlayerBId(event.target.value)}>
                <option value="">Second player</option>
                {data.players.map((player) => <option value={player.id} key={player.id}>{player.name}</option>)}
              </select>
            </div>
            <button type="button" disabled={!playerAId || !playerBId || playerAId === playerBId || working === 'constraint' || Boolean(data.live?.started)} onClick={() => void addConstraint()} className="iron-button mt-3 px-4 py-2.5 text-xs">
              {working === 'constraint' ? 'Adding rule…' : 'Add roster rule'}
            </button>
            <div className="mt-5 space-y-2">
              {data.constraints.map((constraint) => (
                <div className={`flex items-center gap-3 rounded border px-3 py-2.5 text-sm font-bold ${constraint.type === 'together' ? 'border-[#78905f]/45 bg-[#dce1b9]' : 'border-[#b76549]/45 bg-[#edc4ae]'}`} key={constraint.id}>
                  <span className="min-w-0 flex-1">{constraint.playerA.name} <span className="text-[10px] uppercase tracking-[0.08em]">{constraint.type}</span> {constraint.playerB.name}</span>
                  <button type="button" disabled={working === `remove-${constraint.id}` || Boolean(data.live?.started)} onClick={() => void removeConstraint(constraint.id)} className="rounded border border-current px-2 py-1 text-[10px] uppercase">Remove</button>
                </div>
              ))}
              {!data.constraints.length ? <p className="rounded border border-dashed border-[#8b6a32]/35 px-4 py-5 text-center text-sm text-[#77694f]">No together/apart rules yet.</p> : null}
            </div>
          </section>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="parchment-panel p-5 sm:p-8">
            <div className="flex flex-col gap-3 border-b border-[#173f35]/10 pb-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.12em] text-[#6e7d77]">Captain boards</p>
                <h2 className="fantasy-title mt-1 text-3xl font-bold">{isLive ? `${data.live?.picks.length ?? 0} live picks made` : `${readyCount} of ${data.captains.length} ready`}</h2>
                <p className="mt-2 text-sm text-[#68766f]">Send each captain only the private link next to their name.</p>
              </div>
              <button type="button" disabled={!data.captains.length} onClick={() => void copy('all', allCaptainLinks)} className="iron-button self-start px-4 py-2.5 text-xs">
                {copied === 'all' ? 'Copied all links' : 'Copy all links'}
              </button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {data.captains.map((captain) => {
                const captainPicks = data.live?.picks.filter((pick) => pick.captainId === captain.id) ?? [];
                return (
                  <article className="parchment-card p-4" key={captain.id}>
                    <div className="flex items-center gap-3">
                      <span className="brand-rune grid h-11 w-11 place-items-center rounded-full text-sm font-black text-[#f4d77c]">{initials(captain.name)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black">Team {captain.teamIndex + 1} · {captain.name}</p>
                        <p className={`mt-0.5 text-xs font-bold ${isLive ? 'text-[#6b5b3c]' : captain.submittedAt ? 'text-[#2d6f5e]' : 'text-[#9a6e1a]'}`}>
                          {isLive ? `${captainPicks.length} pick${captainPicks.length === 1 ? '' : 's'}${data.live?.currentCaptain?.id === captain.id ? ' · choosing now' : ''}` : captain.submittedAt ? '✓ Scores submitted' : '○ Waiting for scores'}
                        </p>
                      </div>
                    </div>
                    {captainPicks.length ? <p className="mt-3 text-xs leading-relaxed text-[#67583e]">{captainPicks.map((pick) => pick.playerName).join(' · ')}</p> : null}
                    <div className="mt-4 flex gap-2">
                      <button type="button" onClick={() => void copy(captain.id, absoluteUrl(captain.path))} className="scroll-button flex-1 px-3 py-2 text-xs">{copied === captain.id ? 'Copied' : 'Copy link'}</button>
                      <a href={captain.path} target="_blank" rel="noreferrer" className="scroll-button px-3 py-2 text-xs">Open ↗</a>
                    </div>
                  </article>
                );
              })}
              {!data.captains.length ? <p className="rounded border border-dashed border-[#8b6a32]/35 px-4 py-8 text-center text-sm text-[#77694f] sm:col-span-2">Choose and save captains above to create their private links.</p> : null}
            </div>
          </section>

          <aside className="wood-panel p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#d7ae50]">{isLive ? 'Live control' : 'Run the draft'}</p>
              <span className={`rounded-full px-3 py-1 text-[11px] font-black ${(isLive ? data.live?.started : allReady) ? 'bg-[#b9e3cd] text-[#174536]' : 'bg-white/10 text-[#c3d2cc]'}`}>
                {isLive ? data.live?.started ? 'Live' : 'Setup' : allReady ? 'Ready' : `${Math.max(0, data.captains.length - readyCount)} waiting`}
              </span>
            </div>
            <h2 className="fantasy-title mt-4 text-3xl font-bold leading-none">
              {isLive
                ? data.result ? 'Live draft complete.' : data.live?.started ? data.live.currentCaptain ? `${data.live.currentCaptain.name} is on the clock.` : 'Finishing the board.' : 'Start when everyone is ready.'
                : data.result ? 'Run it again?' : allReady ? 'Everyone has weighed in.' : 'Captain scores come first.'}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[#cfc3a5]">
              {isLive
                ? 'Starting closes public registration and enables the pick button on each captain’s private board.'
                : data.result ? 'Rerunning replaces the current result using the newest scores and roster rules.' : 'The generator unlocks when every captain submits a complete private score sheet.'}
            </p>
            {isLive ? (
              <button type="button" disabled={!captainsReady || working === 'live' || Boolean(data.live?.started) || data.players.length <= data.draft.teamCount} onClick={() => void startLiveDraft()} className="gold-button mt-6 w-full px-5 py-3.5 text-sm">
                {working === 'live' ? 'Opening live board…' : data.live?.started ? 'Live draft underway' : 'Start live draft →'}
              </button>
            ) : (
              <>
                <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-[#d6ad4e] transition-all" style={{ width: `${data.captains.length ? (readyCount / data.captains.length) * 100 : 0}%` }} />
                </div>
                <button type="button" disabled={!allReady || working === 'run'} onClick={() => void runDraft()} className="gold-button mt-6 w-full px-5 py-3.5 text-sm">
                  {working === 'run' ? 'Building teams…' : data.result ? 'Run draft again' : 'Run the draft →'}
                </button>
              </>
            )}
            <p className="mt-4 text-xs leading-relaxed text-[#b8aa87]">Together/apart rules are enforced first. Avoids are honored where team capacity makes that possible.</p>
          </aside>
        </div>

        <details className="parchment-panel mt-5 p-5 sm:p-7">
          <summary className="cursor-pointer list-none font-black"><span className="fantasy-title text-2xl">Browse the full roster</span> <span className="ml-2 text-xs text-[#6e7d77]">{data.players.length} players · surveys and live stats</span></summary>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.players.map((player) => (
              <article className="parchment-card p-4" key={player.id}>
                <p className="font-black">{player.name}</p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#7c6d50]">{player.source === 'signup' ? 'Public signup' : 'Imported roster'}</p>
                <PlayerIntel name={player.name} answers={player.answers} />
              </article>
            ))}
          </div>
        </details>

        {data.result ? <div className="mt-12 scroll-mt-6" id="results"><ResultGrid result={data.result} title={data.draft.title} /></div> : null}
      </section>
    </main>
  );
}
