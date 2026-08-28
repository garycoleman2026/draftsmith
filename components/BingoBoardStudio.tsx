'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { BingoTemplateDefinition } from '../lib/bingo-types';
import type { BingoEventRules } from '../lib/bingo-rules';
import type { BingoBoardScope, BingoMode } from '../lib/types';
import { absoluteUrl, copyText } from '../lib/client';
import { BingoMaker } from './BingoMaker';

export type BingoStudioStarter = {
  slug: string;
  name: string;
  summary: string;
  configuration: BingoTemplateDefinition;
};

type SavedBoard = {
  id: string; name: string; summary: string; category: string; tags: string[]; visibility: string;
  publicPath: string | null; configuration: BingoTemplateDefinition; updatedAt: string;
};

export function BingoBoardStudio({ starters, initial }: { starters: BingoStudioStarter[]; initial: BingoStudioStarter }) {
  const [configuration, setConfiguration] = useState(() => structuredClone(initial.configuration));
  const [editorKey, setEditorKey] = useState(0);
  const [starterSlug, setStarterSlug] = useState(initial.slug);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [name, setName] = useState(initial.name);
  const [summary, setSummary] = useState(initial.summary);
  const [category, setCategory] = useState('Mixed');
  const [tags, setTags] = useState('clan bingo, custom board');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [mode, setMode] = useState<BingoMode>(initial.configuration.mode);
  const [boardScope, setBoardScope] = useState<BingoBoardScope>(initial.configuration.boardScope);
  const [savedBoards, setSavedBoards] = useState<SavedBoard[]>([]);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [publicPath, setPublicPath] = useState<string | null>(null);

  const loadSaved = useCallback(async () => {
    try {
      const response = await fetch('/api/bingo/templates', { cache: 'no-store' });
      if (response.status === 401) { setSignedIn(false); return; }
      const result = await response.json() as { templates?: SavedBoard[]; error?: string };
      if (!response.ok) throw new Error(result.error || 'Saved boards could not be loaded.');
      setSignedIn(true); setSavedBoards(result.templates ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Saved boards could not be loaded.');
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSaved(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSaved]);

  function loadConfiguration(next: BingoTemplateDefinition, metadata?: Partial<SavedBoard>) {
    setConfiguration(structuredClone(next));
    setMode(next.mode); setBoardScope(next.boardScope); setEditorKey((value) => value + 1);
    setSavedId(metadata?.id ?? null); setPublicPath(metadata?.publicPath ?? null);
    setName(metadata?.name ?? next.name); setSummary(metadata?.summary ?? next.description);
    setCategory(metadata?.category ?? (next.mode === 'progression' ? 'Progression' : 'Mixed'));
    setTags(metadata?.tags?.join(', ') ?? `clan bingo, ${next.mode}`);
    setVisibility(metadata?.visibility === 'public' ? 'public' : 'private');
    setError(''); setMessage(metadata?.id ? `Loaded “${metadata.name}”.` : 'Starter loaded. Your copy is independent.');
  }

  function chooseStarter(slug: string) {
    const starter = starters.find((item) => item.slug === slug);
    if (!starter) return;
    setStarterSlug(slug); loadConfiguration(starter.configuration, { name: starter.name, summary: starter.summary });
  }

  async function saveBoard(tasks: BingoTemplateDefinition['tasks'], rules: BingoEventRules) {
    setSaving(true); setError(''); setMessage('');
    const winCondition = mode === 'classic' ? 'lines' : mode === 'blackout' ? 'blackout' : mode === 'categories' ? 'categories' : 'points';
    const nextRules: BingoEventRules = { ...rules, scoring: { ...rules.scoring, winCondition } };
    const next: BingoTemplateDefinition = {
      ...configuration,
      key: savedId ?? '',
      name,
      description: summary,
      mode,
      boardScope: mode === 'lockout' ? 'shared' : boardScope,
      winCondition,
      targetValue: nextRules.scoring.targetValue,
      gridSize: nextRules.layout.rows,
      rules: nextRules,
      tasks,
    };
    try {
      const response = await fetch('/api/bingo/templates', {
        method: savedId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: savedId, name, summary, category, tags, visibility, configuration: next, website: '' }),
      });
      const result = await response.json() as SavedBoard & { error?: string };
      if (response.status === 401) { setSignedIn(false); throw new Error('Sign in with Discord to save private boards or publish to the gallery.'); }
      if (!response.ok || !result.id) throw new Error(result.error || 'That board could not be saved.');
      setSignedIn(true); setSavedId(result.id); setPublicPath(result.publicPath); setConfiguration(structuredClone(result.configuration));
      setMessage(result.publicPath ? 'Board saved and published to the community gallery.' : 'Private board saved to your studio.');
      await loadSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That board could not be saved.');
    } finally { setSaving(false); }
  }

  async function removeSavedBoard() {
    if (!savedId || !window.confirm('Remove this saved board? Existing events and public clones are not changed.')) return;
    setWorking('delete'); setError('');
    try {
      const response = await fetch('/api/bingo/templates', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: savedId }),
      });
      const result = await response.json() as { removed?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || 'That board could not be removed.');
      setSavedId(null); setPublicPath(null); setMessage('Saved board removed. The current design remains open as an unsaved copy.');
      await loadSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'That board could not be removed.'); }
    finally { setWorking(''); }
  }

  async function copyShareLink() {
    if (!publicPath) return;
    await copyText(absoluteUrl(publicPath)); setMessage('Public board link copied.');
  }

  return (
    <section className="mx-auto max-w-[1600px] px-4 pb-20 pt-9 sm:px-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#c69b3c]">Draft-free board studio</p><h1 className="fantasy-title mt-2 max-w-5xl text-5xl font-bold text-[#f5df9b] sm:text-7xl">Design now. Run the bingo later.</h1><p className="mt-4 max-w-3xl text-sm leading-relaxed text-[#b9ab89]">Build and save reusable OSRS bingo boards without creating teams, a draft, or a live event. Keep a board private, or publish it for anyone to preview and customize from the marketplace.</p></div>
        <div className="flex flex-wrap gap-2"><Link className="scroll-button px-4 py-2.5 text-xs" href="/templates">Browse marketplace ↗</Link><Link className="gold-button px-4 py-2.5 text-xs" href="/bingo#create">Run a bingo →</Link></div>
      </div>

      <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="parchment-panel p-5 sm:p-7">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-[10px] font-black uppercase text-[#65583f]">Starting board<select className="realm-field mt-1 h-11 w-full px-3 text-sm normal-case" value={starterSlug} onChange={(event) => chooseStarter(event.target.value)}>{starters.map((item) => <option key={item.slug} value={item.slug}>{item.name} · {item.configuration.gridSize}×{item.configuration.gridSize}</option>)}</select></label>
            <label className="text-[10px] font-black uppercase text-[#65583f]">Game style<select className="realm-field mt-1 h-11 w-full px-3 text-sm normal-case" value={mode} onChange={(event) => { const next = event.target.value as BingoMode; setMode(next); if (next === 'lockout') setBoardScope('shared'); }}><option value="points">Points hunt</option><option value="classic">Classic lines</option><option value="lockout">First-to-tile lockout</option><option value="blackout">Blackout</option><option value="progression">Progression / center-out</option><option value="categories">Category conquest</option></select></label>
            <label className="text-[10px] font-black uppercase text-[#65583f]">Team board behavior<select className="realm-field mt-1 h-11 w-full px-3 text-sm normal-case" disabled={mode === 'lockout'} value={mode === 'lockout' ? 'shared' : boardScope} onChange={(event) => setBoardScope(event.target.value as BingoBoardScope)}><option value="per_team">Each team unlocks its own board</option><option value="shared">Teams share one unlock frontier</option></select></label>
            <label className="text-[10px] font-black uppercase text-[#65583f]">Board name<input className="realm-field mt-1 h-11 w-full px-3 text-sm normal-case" maxLength={70} value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className="text-[10px] font-black uppercase text-[#65583f] md:col-span-2">Summary<input className="realm-field mt-1 h-11 w-full px-3 text-sm normal-case" maxLength={240} value={summary} onChange={(event) => setSummary(event.target.value)} /></label>
            <label className="text-[10px] font-black uppercase text-[#65583f]">Marketplace category<select className="realm-field mt-1 h-11 w-full px-3 text-sm normal-case" value={category} onChange={(event) => setCategory(event.target.value)}><option>Mixed</option><option>Bossing</option><option>Raids</option><option>Skilling</option><option>Speed</option><option>Progression</option><option>Casual</option><option>Competitive</option></select></label>
            <label className="text-[10px] font-black uppercase text-[#65583f]">Tags<input className="realm-field mt-1 h-11 w-full px-3 text-sm normal-case" placeholder="weekend, raids, mixed levels" value={tags} onChange={(event) => setTags(event.target.value)} /></label>
            <label className="text-[10px] font-black uppercase text-[#65583f]">Save visibility<select className="realm-field mt-1 h-11 w-full px-3 text-sm normal-case" value={visibility} onChange={(event) => setVisibility(event.target.value as 'private' | 'public')}><option value="private">Private · only in my studio</option><option value="public">Public · list in marketplace</option></select></label>
          </div>
          {error ? <p className="mt-4 rounded border border-[#a75e44]/45 bg-[#efd1bd] px-4 py-3 text-sm font-bold text-[#723b2b]" role="alert">{error}</p> : null}
          {message ? <p className="mt-4 rounded border border-[#62835d]/45 bg-[#dbe6c7] px-4 py-3 text-sm font-bold text-[#355332]" role="status">{message}</p> : null}
          {signedIn === false ? <div className="mt-4 rounded border border-[#8b6a32]/35 bg-[#f3dfaa] p-4 text-sm text-[#5a482d]"><b>Sign in is only required when you save.</b><p className="mt-1 text-xs">You can design the whole board first. Discord sign-in gives your private boards an owner and lets you publish safely.</p><a className="gold-button mt-3 inline-flex px-4 py-2.5 text-xs" href="/api/auth/discord/start?returnTo=/bingo/studio">Sign in with Discord →</a></div> : null}
        </section>

        <aside className="wood-panel p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#d7ae50]">My saved boards</p><p className="mt-1 text-xs text-[#aa9d7e]">{savedBoards.length} reusable design{savedBoards.length === 1 ? '' : 's'}</p></div>{signedIn ? <Link className="text-xs font-black text-[#cfe3a9] underline" href="/dashboard">Account</Link> : null}</div>
          <div className="mt-4 max-h-[360px] space-y-2 overflow-auto pr-1">{savedBoards.map((board) => <button className={`w-full rounded border p-3 text-left ${savedId === board.id ? 'border-[#d7ae50] bg-[#d7ae50]/15' : 'border-white/10 bg-black/20'}`} key={board.id} onClick={() => loadConfiguration(board.configuration, board)} type="button"><div className="flex justify-between gap-2"><b className="text-sm text-[#f2d98f]">{board.name}</b><span className="text-[9px] font-black uppercase text-[#c8bb99]">{board.visibility}</span></div><p className="mt-1 line-clamp-2 text-[10px] text-[#b8aa87]">{board.summary}</p><p className="mt-2 text-[9px] uppercase text-[#d7ae50]">{board.configuration.gridSize}×{board.configuration.gridSize} · {board.configuration.mode}</p></button>)}{signedIn && !savedBoards.length ? <p className="rounded border border-dashed border-white/15 p-4 text-sm text-[#ad9f7f]">Your first saved board will appear here.</p> : null}{signedIn === false ? <p className="rounded border border-dashed border-white/15 p-4 text-sm text-[#ad9f7f]">Sign in to load your private designs.</p> : null}</div>
          {savedId ? <div className="mt-4 border-t border-white/10 pt-4"><div className="flex flex-wrap gap-2">{publicPath ? <><button className="scroll-button px-3 py-2 text-xs" onClick={() => void copyShareLink()} type="button">Copy public link</button><a className="scroll-button px-3 py-2 text-xs" href={publicPath} target="_blank" rel="noreferrer">Open listing ↗</a></> : null}<button className="iron-button px-3 py-2 text-xs" disabled={working === 'delete'} onClick={() => void removeSavedBoard()} type="button">{working === 'delete' ? 'Removing…' : 'Remove saved board'}</button></div></div> : null}
        </aside>
      </div>

      <section className="parchment-panel mt-6 p-4 sm:p-7 text-[#342817]">
        <div className="mb-5 border-b border-[#8b6a32]/25 pb-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-[#6a511f]">Board editor</p><h2 className="fantasy-title mt-1 text-3xl font-bold">Every tile, rule, image, estimate, and unlock is editable.</h2><p className="mt-2 max-w-4xl text-xs leading-relaxed text-[#58492f]">For center-out games, choose Progression above and apply the center-out frontier. A shared frontier lets any team’s completion reveal adjacent tiles; per-team frontiers keep each team’s map independent.</p></div>
        <BingoMaker key={editorKey} boardScope={mode === 'lockout' ? 'shared' : boardScope} disabled={false} initialRules={configuration.rules} initialTasks={configuration.tasks} mode={mode} onSave={saveBoard} saveLabel={savedId ? 'Update saved board →' : visibility === 'public' ? 'Save and publish board →' : 'Save private board →'} saving={saving} />
      </section>
    </section>
  );
}
