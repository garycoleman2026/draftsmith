'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { absoluteUrl, copyText } from '../lib/client';
import type { BingoTaskDefinition } from '../lib/bingo-types';
import type { BingoEventRules } from '../lib/bingo-rules';
import type { BingoViewData, BingoViewTask, BingoViewVerificationCandidate } from '../lib/bingo-view-types';
import type { BingoVerificationSignal } from '../lib/bingo-verification';
import type { BingoBoardScope, BingoMode } from '../lib/types';
import { BingoBoard, BingoStandings } from './BingoBoard';
import { BingoCollaboratorsPanel } from './BingoCollaboratorsPanel';
import { BingoMaker } from './BingoMaker';
import { BingoManualScorekeeper } from './BingoManualScorekeeper';
import { BingoPlanningSummary } from './BingoPlanningSummary';
import { BingoReviewHall } from './BingoReviewHall';
import { BingoRuneliteOrganizerPanel } from './BingoRuneliteOrganizerPanel';
import { BingoVerificationPanel } from './BingoVerificationPanel';
import { BingoWiseOldManPanel } from './BingoWiseOldManPanel';
import { SiteHeader } from './SiteHeader';

type IssuedLink = { teamId: string; teamName: string; path: string };

export function BingoOrganizer({ token, eventId }: { token: string; eventId: string }) {
  const [data, setData] = useState<BingoViewData | null>(null);
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<BingoMode>('points');
  const [boardScope, setBoardScope] = useState<BingoBoardScope>('per_team');
  const [requiresReview, setRequiresReview] = useState(true);
  const [publicSpectator, setPublicSpectator] = useState(true);
  const [publicListed, setPublicListed] = useState(false);
  const [spectatorDelaySeconds, setSpectatorDelaySeconds] = useState(0);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [templateName, setTemplateName] = useState('My clan board');
  const [templateSummary, setTemplateSummary] = useState('A reusable OSRS clan bingo board.');
  const [templateCategory, setTemplateCategory] = useState('Mixed');
  const [templateTags, setTemplateTags] = useState('clan bingo, custom board');
  const [templatePublic, setTemplatePublic] = useState(false);
  const [publishedTemplatePath, setPublishedTemplatePath] = useState('');
  const [issuedLinks, setIssuedLinks] = useState<IssuedLink[]>([]);
  const [copied, setCopied] = useState('');
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [verificationPreview, setVerificationPreview] = useState<{
    matches?: Array<{ taskId: string; title: string; sortOrder: number }>;
    duplicate?: boolean;
    candidates?: BingoViewVerificationCandidate[];
  } | null>(null);
  const initialized = useRef(false);
  const base = `/api/manage/${encodeURIComponent(token)}/bingo/events/${encodeURIComponent(eventId)}`;

  const load = useCallback(async (quiet = false) => {
    try {
      const response = await fetch(base, { cache: 'no-store' });
      const next = await response.json() as BingoViewData & { error?: string };
      if (!response.ok) throw new Error(next.error || 'The organizer board could not be loaded.');
      setData(next);
      if (!initialized.current) {
        initialized.current = true;
        setTitle(next.event.title); setMode(next.event.mode); setBoardScope(next.event.boardScope); setRequiresReview(next.event.requiresReview);
        setPublicSpectator(next.event.publicSpectator); setPublicListed(next.event.publicListed); setSpectatorDelaySeconds(next.event.spectatorDelaySeconds);
        setStartAt(toLocalInput(next.event.startAt)); setEndAt(toLocalInput(next.event.endAt));
        setTemplateName(`${next.event.title} board`);
      }
      if (!quiet) setError('');
    } catch (cause) { if (!quiet) setError(cause instanceof Error ? cause.message : 'The organizer board could not be loaded.'); }
  }, [base]);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(true), 4_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [load]);

  async function run(action: string, path: string, init: RequestInit, message: string) {
    setWorking(action); setError(''); setSuccess('');
    try {
      const response = await fetch(path, init);
      const result = await response.json() as Record<string, unknown> & { error?: string };
      if (!response.ok) throw new Error(result.error || 'That change could not be saved.');
      setSuccess(message); await load(true); return result;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'That change could not be saved.'); return null; }
    finally { setWorking(''); }
  }

  async function saveSettings() {
    await run('settings', base, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        title, mode, boardScope: mode === 'lockout' ? 'shared' : boardScope, requiresReview, publicSpectator,
        publicListed: publicSpectator && publicListed,
        spectatorDelaySeconds, startAt: toIso(startAt), endAt: toIso(endAt),
      }),
    }, 'Event settings saved.');
  }

  async function saveBoard(tasks: BingoTaskDefinition[], rules: BingoEventRules) {
    await run('tasks', `${base}/tasks`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        tasks, rules, gridSize: rules.layout.rows,
      }),
    }, `The ${tasks.length}-tile custom board and its rules were saved.`);
  }

  async function lifecycle(action: 'start' | 'pause' | 'resume' | 'complete') {
    if (action === 'complete' && data) {
      const womNeeded = data.tasks.some((task) => task.rule.proof.sources.includes('wise_old_man'));
      const finalReady = data.wiseOldMan.latestRun?.phase === 'final'
        && ['complete', 'partial'].includes(data.wiseOldMan.latestRun.status);
      if (womNeeded && !finalReady && !window.confirm('Wise Old Man final reconciliation has not finished. Complete the event anyway? You can still run it immediately afterward.')) return;
    }
    await run(action, base, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) },
      action === 'start' ? 'The bingo is live.' : action === 'pause' ? 'The bingo is paused. New claims are closed.' : action === 'resume' ? 'The bingo has resumed.' : 'The event is complete. Final verified candidates can still be reviewed.');
  }

  async function rotateLinks(teamId?: string) {
    const result = await run(teamId ? `link-${teamId}` : 'links', `${base}/links`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId }),
    }, teamId ? 'A fresh private team link was issued.' : 'Fresh private links were issued for every team.');
    if (Array.isArray(result?.teamLinks)) {
      const next = result.teamLinks as IssuedLink[];
      setIssuedLinks((current) => teamId ? [...current.filter((item) => item.teamId !== teamId), ...next] : next);
    }
  }

  async function review(claimId: string, action: 'approve' | 'reject' | 'reopen', reviewNote = '') {
    if (action === 'reject' && !reviewNote.trim()) { setError('Add a short note so the team knows what to fix.'); return false; }
    const result = await run(`${action}-${claimId}`, `${base}/claims/${encodeURIComponent(claimId)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, reviewNote }),
    }, action === 'approve' ? 'Claim approved and the scoreboard updated.' : action === 'reject' ? 'Claim returned to the team.' : 'The decision was reversed and the claim is back in review.');
    return Boolean(result);
  }

  async function postAnnouncement() {
    if (!announcement.trim()) return;
    const result = await run('announcement', `${base}/announcements`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: announcement }),
    }, 'Announcement posted to the hall and connected Discord channel.');
    if (result) setAnnouncement('');
  }

  async function saveTemplate() {
    const result = await run('template', `/api/manage/${encodeURIComponent(token)}/bingo/templates`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        eventId, name: templateName, summary: templateSummary, category: templateCategory,
        tags: templateTags, visibility: templatePublic ? 'public' : 'private',
      }),
    }, templatePublic ? 'This board is published in the community template gallery.' : 'This board is now available as a private reusable template.');
    setPublishedTemplatePath(typeof result?.publicPath === 'string' ? result.publicPath : '');
  }

  async function resolveCandidate(candidateId: string, action: 'accept' | 'dismiss' | 'reopen') {
    await run(`verification-${action}-${candidateId}`, `${base}/verification/candidates/${encodeURIComponent(candidateId)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    }, action === 'accept' ? 'Verified evidence accepted and added to the score.' : action === 'dismiss' ? 'Verification candidate dismissed.' : 'Verification candidate reopened from its evidence.');
  }

  async function replayVerification() {
    await run('verification-replay', `${base}/verification`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'replay' }),
    }, 'Stored verification signals were replayed without duplicating progress.');
  }

  async function submitVerificationSignal(input: { teamId: string; memberId: string | null; signal: BingoVerificationSignal }, dryRun: boolean) {
    const result = await run(dryRun ? 'verification-preview' : 'verification-ingest', `${base}/verification`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        action: dryRun ? 'dry_run' : 'ingest', ...input,
      }),
    }, dryRun ? 'Signal preview complete.' : 'Verification signal recorded and matched idempotently.');
    if (result) setVerificationPreview(result as typeof verificationPreview);
  }

  async function copy(label: string, value: string) { await copyText(value); setCopied(label); window.setTimeout(() => setCopied(''), 1_500); }

  if (!data) return <LoadingScreen error={error} />;
  const structuralLocked = ['live', 'paused', 'complete', 'archived'].includes(data.event.status);
  const canConfigure = data.viewer.accessRole !== 'scorekeeper';
  const needsReview = data.claims.filter((claim) => claim.status === 'pending').length
    + data.verification.candidates.filter((candidate) => candidate.status === 'ready').length;
  const allLinks = issuedLinks.map((item) => `${item.teamName}: ${absoluteUrl(item.path)}`).join('\n');
  const taskDefinitions = tasksToDefinitions(data.tasks);
  const teamSize = Math.max(1, Math.min(...data.teams.map((team) => team.members.length)));
  const readiness = bingoReadiness(data);
  return (
    <main className="realm-bg min-h-screen text-[#eadcb9]">
      <SiteHeader badge="Bingo organizer" />
      <section className="mx-auto max-w-[1500px] px-4 pb-20 pt-8 sm:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#c69b3c]">Event control room · {data.event.status}</p><h1 className="fantasy-title mt-2 text-4xl font-bold text-[#f5df9b] sm:text-6xl">{data.event.title}</h1><p className="mt-3 text-sm text-[#b7aa8a]">Configure the board, share one private link per team, review proof, and publish the live scoreboard.</p></div>
          <div className="flex flex-wrap gap-2"><a className="gold-button px-4 py-2.5 text-xs" href="#review">Review hall{needsReview ? ` · ${needsReview}` : ''}</a>{data.event.publicSpectator ? <><button className="scroll-button px-4 py-2.5 text-xs" onClick={() => void copy('public', absoluteUrl(data.event.publicPath))}>{copied === 'public' ? 'Copied spectator link' : 'Copy spectator link'}</button><a className="scroll-button px-4 py-2.5 text-xs" href={data.event.publicPath} target="_blank" rel="noreferrer">Open spectator board ↗</a></> : null}<a className="iron-button px-3 py-2.5 text-xs" href={`${base}/export?format=csv`}>Export CSV</a><a className="iron-button px-3 py-2.5 text-xs" href={`${base}/export?format=discord`}>Discord text</a>{canConfigure && data.event.status === 'live' ? <><button className="scroll-button px-4 py-2.5 text-xs" disabled={working === 'pause'} onClick={() => void lifecycle('pause')}>Pause</button><button className="gold-button px-4 py-2.5 text-xs" disabled={working === 'complete'} onClick={() => void lifecycle('complete')}>Complete event</button></> : canConfigure && data.event.status === 'paused' ? <><button className="gold-button px-4 py-2.5 text-xs" disabled={working === 'resume'} onClick={() => void lifecycle('resume')}>Resume bingo</button><button className="scroll-button px-4 py-2.5 text-xs" disabled={working === 'complete'} onClick={() => void lifecycle('complete')}>Complete event</button></> : canConfigure && ['draft', 'scheduled'].includes(data.event.status) ? <button className="gold-button px-4 py-2.5 text-xs" disabled={working === 'start' || readiness.blockers.length > 0} onClick={() => void lifecycle('start')}>{working === 'start' ? 'Starting…' : 'Start bingo →'}</button> : null}</div>
        </div>
        {success ? <p role="status" className="mt-5 rounded border border-[#3e775d] bg-[#dcebd9] px-4 py-3 text-sm font-bold text-[#245340]">{success}</p> : null}
        {error ? <p role="alert" className="mt-5 rounded border border-[#b75b42] bg-[#f4d5c7] px-4 py-3 text-sm font-bold text-[#7f321f]">{error}</p> : null}

        <div className="wood-panel mt-7 p-4 sm:p-6"><BingoStandings data={data} /></div>

        <div className="mt-5"><BingoReviewHall data={data} base={base} working={working} onReview={review} onResolve={resolveCandidate} /></div>

        {canConfigure ? <section className="parchment-panel mt-5 p-5 text-[#392d1b] sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.12em] text-[#80642b]">Ready check</p><h2 className="fantasy-title mt-1 text-2xl font-bold">{readiness.blockers.length ? 'A few things before the horn sounds.' : 'The hall is ready.'}</h2><div className="mt-2 flex flex-wrap gap-2 text-xs">{readiness.items.map((item) => <span className={`rounded border px-2.5 py-1 font-bold ${item.ready ? 'border-[#62835d]/40 bg-[#dbe6c7] text-[#355332]' : 'border-[#a75e44]/35 bg-[#efd1bd] text-[#723b2b]'}`} key={item.label}>{item.ready ? '✓' : '!' } {item.label}</span>)}</div>{readiness.warnings.length ? <p className="mt-3 text-xs text-[#6b5736]">Worth a look: {readiness.warnings.join(' · ')}</p> : null}</div><span className="seal-badge shrink-0 px-3 py-2 text-xs font-black">{readiness.blockers.length ? `${readiness.blockers.length} blocker${readiness.blockers.length === 1 ? '' : 's'}` : 'Ready to start'}</span></div></section> : null}

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          {canConfigure ? <section className="parchment-panel p-5 sm:p-7">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#80642b]">Event settings</p><h2 className="fantasy-title mt-1 text-3xl font-bold">Set the rules of the hall.</h2>
            <fieldset className="mt-5 grid gap-3 sm:grid-cols-2" disabled={!canConfigure}>
              <label className="text-[10px] font-black uppercase text-[#65583f] sm:col-span-2">Event title<input className="realm-field mt-1 h-11 w-full px-3 text-sm normal-case" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
              <label className="text-[10px] font-black uppercase text-[#65583f]">Bingo type<select className="realm-field mt-1 h-11 w-full px-3 text-sm" value={mode} disabled={structuralLocked} onChange={(event) => { const next = event.target.value as BingoMode; setMode(next); if (next === 'lockout') setBoardScope('shared'); }}><option value="points">Points hunt</option><option value="classic">Classic lines</option><option value="lockout">Shared lockout</option><option value="blackout">Blackout race</option><option value="progression">Progression / center-out</option><option value="categories">Category conquest</option></select></label>
              <label className="text-[10px] font-black uppercase text-[#65583f]">Board behavior<select className="realm-field mt-1 h-11 w-full px-3 text-sm" value={mode === 'lockout' ? 'shared' : boardScope} disabled={structuralLocked || mode === 'lockout'} onChange={(event) => setBoardScope(event.target.value as BingoBoardScope)}><option value="per_team">Separate board per team</option><option value="shared">Shared unlock frontier</option></select></label>
              <label className="text-[10px] font-black uppercase text-[#65583f]">Spectator delay (seconds)<input className="realm-field mt-1 h-11 w-full px-3 text-sm" type="number" min={0} max={3600} value={spectatorDelaySeconds} onChange={(event) => setSpectatorDelaySeconds(Number(event.target.value))} /></label>
              <label className="text-[10px] font-black uppercase text-[#65583f]">Planned start<input className="realm-field mt-1 h-11 w-full px-3 text-xs normal-case" type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} /></label>
              <label className="text-[10px] font-black uppercase text-[#65583f]">Planned end<input className="realm-field mt-1 h-11 w-full px-3 text-xs normal-case" type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} /></label>
              <label className="flex items-center gap-2 text-sm font-bold text-[#4e402b]"><input type="checkbox" checked={requiresReview} onChange={(event) => setRequiresReview(event.target.checked)} /> Organizer reviews claims</label>
              <label className="text-[10px] font-black uppercase text-[#65583f] sm:col-span-2">Who can watch<select className="realm-field mt-1 h-11 w-full px-3 text-sm normal-case" value={!publicSpectator ? 'private' : publicListed ? 'public' : 'unlisted'} onChange={(event) => { const value = event.target.value; setPublicSpectator(value !== 'private'); setPublicListed(value === 'public'); }}><option value="private">Private · teams and organizers</option><option value="unlisted">Anyone with the link</option><option value="public">Publicly listed</option></select></label>
            </fieldset>
            <div className="mt-4"><BingoPlanningSummary tasks={taskDefinitions} teamSize={teamSize} startAt={startAt} endAt={endAt} /></div>
            <button className="gold-button mt-5 px-5 py-3 text-sm" disabled={!canConfigure || working === 'settings'} onClick={() => void saveSettings()}>{working === 'settings' ? 'Saving…' : canConfigure ? 'Save event settings' : 'Scorekeeper view'}</button>
          </section> : null}

          {canConfigure ? <section className="parchment-panel p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.12em] text-[#80642b]">Private team doors</p><h2 className="fantasy-title mt-1 text-3xl font-bold">Issue the captain links.</h2></div><button className="iron-button px-3 py-2 text-xs" disabled={working === 'links'} onClick={() => void rotateLinks()}>{working === 'links' ? 'Rotating…' : 'Issue / rotate all'}</button></div>
            <p className="mt-3 text-xs leading-relaxed text-[#6e5e43]">Private links are shown once when issued. Copy them before leaving this page. Rotating a link immediately retires the older one.</p>
            <div className="mt-4 space-y-2">{data.teams.map((team) => { const link = issuedLinks.find((item) => item.teamId === team.id); return <article className="parchment-card flex flex-wrap items-center gap-2 p-3" key={team.id}><span className="h-8 w-2 rounded" style={{ background: team.color }} /><div className="min-w-36 flex-1"><p className="font-black">{team.name}</p><p className="text-[10px] text-[#746244]">{team.members.length} members</p></div>{link ? <><button className="scroll-button px-3 py-2 text-xs" onClick={() => void copy(team.id, absoluteUrl(link.path))}>{copied === team.id ? 'Copied' : 'Copy link'}</button><a className="scroll-button px-3 py-2 text-xs" href={link.path} target="_blank" rel="noreferrer">Open ↗</a></> : <button className="scroll-button px-3 py-2 text-xs" disabled={working === `link-${team.id}`} onClick={() => void rotateLinks(team.id)}>Issue link</button>}</article>; })}</div>
            <button className="iron-button mt-4 w-full px-4 py-2.5 text-xs" disabled={!allLinks} onClick={() => void copy('all', allLinks)}>{copied === 'all' ? 'Copied every link' : 'Copy all newly issued links'}</button>
          </section> : null}
        </div>

        <section className="parchment-panel mt-5 p-5 sm:p-7">
          <div className="flex flex-col gap-4 border-b border-[#8b6a32]/25 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div><p className="text-xs font-black uppercase tracking-[0.12em] text-[#80642b]">No-code custom bingo maker</p><h2 className="fantasy-title mt-1 text-3xl font-bold">Build the clan’s game, not just a spreadsheet.</h2><p className="mt-2 max-w-3xl text-xs leading-relaxed text-[#6e5e43]">Choose a layout, arrange OSRS presets, define who contributes, set proof sources, and add unlock rules. Advanced boards still copy cleanly to and from spreadsheets.</p></div>
            {data.viewer.accessRole === 'owner' ? <div className="grid min-w-72 gap-2 sm:min-w-[520px] sm:grid-cols-[minmax(0,1fr)_170px]"><input aria-label="Reusable template name" className="realm-field h-11 w-full px-3 text-sm" value={templateName} onChange={(event) => setTemplateName(event.target.value)} /><select aria-label="Template category" className="realm-field h-11 w-full px-3 text-xs" value={templateCategory} onChange={(event) => setTemplateCategory(event.target.value)}>{['Mixed', 'Bossing', 'Raids', 'Skilling', 'Speed', 'Progression', 'Casual', 'Competitive'].map((item) => <option key={item}>{item}</option>)}</select><input aria-label="Template summary" className="realm-field h-11 w-full px-3 text-xs normal-case sm:col-span-2" maxLength={240} value={templateSummary} onChange={(event) => setTemplateSummary(event.target.value)} placeholder="What makes this board useful?" /><input aria-label="Template tags" className="realm-field h-11 w-full px-3 text-xs normal-case" value={templateTags} onChange={(event) => setTemplateTags(event.target.value)} placeholder="raids, weekend, mixed levels" /><label className="flex items-center gap-2 rounded border border-[#8b6a32]/30 bg-white/20 px-3 text-[10px] font-black uppercase text-[#5d4b30]"><input type="checkbox" checked={templatePublic} onChange={(event) => setTemplatePublic(event.target.checked)} /> Publish publicly</label><button className="iron-button px-4 py-2.5 text-xs sm:col-span-2" disabled={!templateName || working === 'template'} onClick={() => void saveTemplate()}>{working === 'template' ? 'Saving…' : templatePublic ? 'Publish community template' : 'Save private template'}</button>{publishedTemplatePath ? <a className="text-center text-xs font-black text-[#315b39] underline sm:col-span-2" href={publishedTemplatePath} target="_blank" rel="noreferrer">Open published template ↗</a> : null}</div> : null}
          </div>
          <div className="mt-5"><BingoMaker initialTasks={taskDefinitions} initialRules={data.event.rules} mode={data.event.mode} boardScope={data.event.boardScope} disabled={structuralLocked || !canConfigure} saving={working === 'tasks'} teamSize={teamSize} startAt={startAt} endAt={endAt} onSave={saveBoard} /></div>
          <div className="mt-5 rounded border border-[#8b6a32]/30 bg-[#f5e5b8]/70 p-4 text-xs leading-relaxed text-[#66563d]"><b>WOM baseline:</b> {data.wiseOldMan.baselineCoverage} players · <b>Last sync:</b> {data.wiseOldMan.lastSyncAt ? new Date(data.wiseOldMan.lastSyncAt).toLocaleString() : 'Not run'} · <b>Worker:</b> {data.event.baselineStatus.replace(':', ' · ')}</div>
        </section>

        <div className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_390px]">
          <section className="parchment-panel min-w-0 p-4 sm:p-6"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.12em] text-[#80642b]">Live board preview</p><h2 className="fantasy-title text-3xl font-bold">{data.tasks.length} tiles · revision {data.event.revision}</h2></div></div><BingoBoard data={data} evidenceHref={(uploadId) => `${base}/evidence/${encodeURIComponent(uploadId)}`} /></section>
          <aside className="space-y-5">
            {canConfigure ? <section className="wood-panel p-5"><p className="text-xs font-black uppercase tracking-[0.12em] text-[#d7ae50]">Hall announcement</p><textarea className="realm-field mt-3 min-h-24 w-full p-3 text-xs normal-case" maxLength={500} placeholder="Tell every team about a rule, break, or deadline…" value={announcement} onChange={(event) => setAnnouncement(event.target.value)} /><button className="scroll-button mt-2 w-full px-3 py-2 text-xs" disabled={!announcement.trim() || working === 'announcement'} onClick={() => void postAnnouncement()}>{working === 'announcement' ? 'Posting…' : 'Post announcement'}</button></section> : null}
            <BingoCollaboratorsPanel eventId={eventId} accessRole={data.viewer.accessRole ?? 'owner'} onNotice={setSuccess} onError={setError} />
            <BingoManualScorekeeper data={data} base={base} onRefresh={() => load(true)} onNotice={setSuccess} onError={setError} />
            {canConfigure ? <BingoRuneliteOrganizerPanel base={base} onNotice={setSuccess} onError={setError} /> : null}
            {canConfigure ? <BingoWiseOldManPanel data={data} base={base} onRefresh={() => load(true)} onNotice={setSuccess} onError={setError} /> : null}
            <BingoVerificationPanel hideQueue data={data} working={working} preview={verificationPreview} onResolve={resolveCandidate} onReplay={replayVerification} onSignal={submitVerificationSignal} />
            <section className="parchment-panel p-5"><p className="text-xs font-black uppercase tracking-[0.12em] text-[#80642b]">Recent hall activity</p><div className="mt-3 space-y-3">{data.activity.slice(0, 10).map((item) => <article className="border-l-2 border-[#88682e] pl-3 text-xs" key={item.id}><p className="font-bold">{item.message}</p><p className="mt-1 text-[10px] text-[#75664b]">{new Date(item.createdAt).toLocaleString()}</p></article>)}</div></section>
          </aside>
        </div>
      </section>
    </main>
  );
}

function tasksToDefinitions(tasks: BingoViewTask[]): BingoTaskDefinition[] {
  return tasks.map((task) => ({
    title: task.title, description: task.description, points: task.points ?? 0, category: task.category,
    difficulty: (task.difficulty ?? 'medium') as BingoTaskDefinition['difficulty'],
    verificationMode: task.verificationMode ?? 'manual', repeatable: task.repeatable,
    maxCompletions: task.maxCompletions, hidden: task.hidden, freeSpace: task.freeSpace, iconKey: task.iconKey, rule: task.rule,
  }));
}
function toLocalInput(value: string | null) { if (!value) return ''; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }
function toIso(value: string) { return value ? new Date(value).toISOString() : null; }
function LoadingScreen({ error }: { error: string }) { return <main className="realm-bg grid min-h-screen place-items-center px-5 text-[#eadcb9]"><section className="wood-panel max-w-lg p-8 text-center"><p className="fantasy-title text-3xl font-bold">Opening the organizer hall…</p>{error ? <p className="mt-4 text-sm text-[#e8b69c]">{error}</p> : null}</section></main>; }

function bingoReadiness(data: BingoViewData) {
  const expected = data.event.gridSize ** 2;
  const estimated = data.tasks.filter((task) => {
    const planning = task.rule.planning;
    return Boolean(planning.fixedHours || planning.efficientUnitsPerHour
      || planning.efficientKillsPerHour && planning.dropRateDenominator && planning.dropRateNumerator);
  }).length;
  const named = data.tasks.filter((task) => task.title.trim() && !/^task\s+\d+$/i.test(task.title)).length;
  const items = [
    { label: `${data.teams.length} teams`, ready: data.teams.length >= 2 },
    { label: `${data.tasks.length}/${expected} tiles`, ready: data.tasks.length === expected },
    { label: 'Tasks named', ready: named === expected },
    { label: data.event.publicSpectator ? 'Spectator link on' : 'Private event', ready: true },
  ];
  return {
    items,
    blockers: items.filter((item) => !item.ready),
    warnings: [
      estimated < expected ? `${expected - estimated} task${expected - estimated === 1 ? '' : 's'} without a time estimate` : '',
      data.tasks.some((task) => task.difficulty === 'experimental') ? 'experimental tasks are included' : '',
      data.event.endAt ? '' : 'no planned end date',
    ].filter(Boolean),
  };
}
