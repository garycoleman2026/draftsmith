'use client';

import { useCallback, useEffect, useState } from 'react';
import { absoluteUrl, copyText } from '../lib/client';

type BingoEventSummary = {
  id: string; title: string; mode: string; status: string; task_count: number; pending_count: number;
  created_at: string; managePath: string; publicPath: string;
};
type TemplateChoice = { key?: string; id?: string; name: string; description: string; mode: string; boardScope: string; gridSize?: number; source?: string; category?: string; visibility?: string; publicPath?: string | null; ratingAverage?: number | null };
type IssuedLink = { teamId: string; teamName: string; path: string };

export function BingoLaunchpad({ token, hasResult, draftTitle }: { token: string; hasResult: boolean; draftTitle: string }) {
  const [events, setEvents] = useState<BingoEventSummary[]>([]);
  const [templates, setTemplates] = useState<TemplateChoice[]>([]);
  const [title, setTitle] = useState(`${draftTitle} bingo`);
  const [templateChoice, setTemplateChoice] = useState('builtin:points');
  const [issuedLinks, setIssuedLinks] = useState<IssuedLink[]>([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);
  const base = `/api/manage/${encodeURIComponent(token)}/bingo`;

  const load = useCallback(async () => {
    const [eventResponse, templateResponse] = await Promise.all([
      fetch(`${base}/events`, { cache: 'no-store' }), fetch(`${base}/templates`, { cache: 'no-store' }),
    ]);
    const eventData = await eventResponse.json() as { events?: BingoEventSummary[]; error?: string };
    const templateData = await templateResponse.json() as { builtin?: TemplateChoice[]; custom?: TemplateChoice[]; error?: string };
    if (!eventResponse.ok) throw new Error(eventData.error || 'Bingo events could not be loaded.');
    const nextTemplates = [...(templateData.builtin ?? []), ...(templateData.custom ?? [])];
    setEvents(eventData.events ?? []); setTemplates(nextTemplates);
    const preferred = window.localStorage.getItem('terrys_preferred_bingo_template');
    if (preferred && nextTemplates.some((template) => preferred === (template.id ? `custom:${template.id}` : `builtin:${template.key}`))) {
      setTemplateChoice(preferred);
    }
  }, [base]);
  useEffect(() => {
    const initial = window.setTimeout(() => void load().catch((cause) => setError(cause instanceof Error ? cause.message : 'Bingo events could not be loaded.')), 0);
    return () => window.clearTimeout(initial);
  }, [load]);

  async function createEvent() {
    setWorking(true); setError(''); setSuccess(''); setIssuedLinks([]);
    try {
      const [kind, id] = templateChoice.split(':', 2);
      const selected = templates.find((template) => (kind === 'custom' ? template.id : template.key) === id);
      const response = await fetch(`${base}/events`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, templateKey: kind === 'builtin' ? id : undefined, templateId: kind === 'custom' ? id : undefined,
          mode: selected?.mode, boardScope: selected?.boardScope,
        }),
      });
      const result = await response.json() as { managePath?: string; teamLinks?: IssuedLink[]; error?: string };
      if (!response.ok || !result.managePath) throw new Error(result.error || 'The bingo event could not be created.');
      setIssuedLinks(result.teamLinks ?? []); setSuccess('The bingo hall is ready. Copy the private team links now, then open the organizer room.');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The bingo event could not be created.'); }
    finally { setWorking(false); }
  }

  async function copyAll() {
    await copyText(issuedLinks.map((link) => `${link.teamName}: ${absoluteUrl(link.path)}`).join('\n'));
    setCopied(true); window.setTimeout(() => setCopied(false), 1_500);
  }

  async function deleteTemplate(template: TemplateChoice) {
    if (!template.id || !window.confirm(`Remove “${template.name}”? Published gallery links will stop working.`)) return;
    setWorking(true); setError('');
    try {
      const response = await fetch(`${base}/templates`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ templateId: template.id }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'The template could not be removed.');
      if (templateChoice === `custom:${template.id}`) setTemplateChoice('builtin:points');
      setSuccess('The saved template was removed.'); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The template could not be removed.'); }
    finally { setWorking(false); }
  }

  return (
    <section className="wood-panel mt-5 p-5 sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-xs font-black uppercase tracking-[0.15em] text-[#d7ae50]">After the draft · bingo hall</p><h2 className="fantasy-title mt-2 text-3xl font-bold sm:text-4xl">Turn these teams into a live clan event.</h2><p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#c8bb99]">Terry snapshots the drafted rosters, gives every team a private claim board, and publishes a live spectator scoreboard with organizer-reviewed evidence.</p></div>
        <a className="scroll-button inline-flex justify-center px-4 py-2.5 text-xs" href="/bingo" target="_blank" rel="noreferrer">Preview the bingo hall ↗</a>
      </div>
      {error ? <p role="alert" className="mt-5 rounded border border-[#b75b42]/60 bg-[#4a2118] px-4 py-3 text-sm text-[#f0c3b0]">{error}</p> : null}
      {success ? <p role="status" className="mt-5 rounded border border-[#67906e]/60 bg-[#193728] px-4 py-3 text-sm text-[#cbe5c5]">{success}</p> : null}
      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded border border-[#9d7932]/55 bg-black/20 p-4 sm:p-5">
          <h3 className="font-black text-[#f2d98f]">Open a new bingo event</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_260px]">
            <label className="text-[10px] font-black uppercase tracking-[0.08em] text-[#c4b48c]">Event title<input className="dark-field mt-1 h-11 w-full px-3 text-sm normal-case" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label className="text-[10px] font-black uppercase tracking-[0.08em] text-[#c4b48c]">Starting board<select className="dark-field mt-1 h-11 w-full px-3 text-sm normal-case" value={templateChoice} onChange={(event) => setTemplateChoice(event.target.value)}>{templates.filter((item) => item.key).map((item) => <option value={`builtin:${item.key}`} key={item.key}>{item.name}</option>)}{templates.filter((item) => item.id).map((item) => <option value={`custom:${item.id}`} key={item.id}>{item.source === 'community' ? 'Community' : item.source === 'clan' ? 'Clan' : 'Saved'} · {item.name}{item.ratingAverage ? ` · ${item.ratingAverage.toFixed(1)}★` : ''}</option>)}</select></label>
          </div>
          <p className="mt-3 text-xs text-[#a99c7d]">{templates.find((item) => templateChoice.endsWith(item.key ?? item.id ?? ''))?.description ?? 'Pick a built-in, private, clan, or community board.'} <a className="font-black text-[#d9e7aa] underline" href="/templates" target="_blank" rel="noreferrer">Browse gallery ↗</a></p>
          <button className="gold-button mt-4 px-5 py-3 text-sm" disabled={!hasResult || !title.trim() || working} onClick={() => void createEvent()}>{working ? 'Forging the hall…' : hasResult ? 'Create bingo event →' : 'Finish the draft first'}</button>
          {templates.some((template) => template.id && template.source === 'saved') ? <details className="mt-4 rounded border border-white/10 bg-black/15 p-3"><summary className="cursor-pointer text-[10px] font-black uppercase tracking-[0.1em] text-[#d7ae50]">Manage saved templates</summary><div className="mt-3 space-y-2">{templates.filter((template) => template.id && template.source === 'saved').map((template) => <div className="flex items-center gap-2 rounded border border-white/10 p-2 text-xs" key={template.id}><span className="min-w-0 flex-1 truncate text-[#e3d4ad]">{template.name} · {template.visibility}</span>{template.publicPath ? <a className="text-[#d9e7aa] underline" href={template.publicPath} target="_blank" rel="noreferrer">View</a> : null}<button className="text-[#e5b39a] underline" disabled={working} onClick={() => void deleteTemplate(template)}>Remove</button></div>)}</div></details> : null}
          {issuedLinks.length ? <div className="mt-5 rounded border border-[#d4ad4d]/45 bg-[#11170f] p-4"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-[0.1em] text-[#d7ae50]">New private links</p><button className="scroll-button px-3 py-2 text-xs" onClick={() => void copyAll()}>{copied ? 'Copied all' : 'Copy all links'}</button></div><div className="mt-3 space-y-2">{issuedLinks.map((link) => <div className="flex items-center gap-2 text-xs" key={link.teamId}><span className="min-w-0 flex-1 truncate text-[#e3d4ad]">{link.teamName}</span><button className="text-[#cdda9e] underline" onClick={() => void copyText(absoluteUrl(link.path))}>Copy</button><a className="text-[#cdda9e] underline" href={link.path} target="_blank" rel="noreferrer">Open ↗</a></div>)}</div></div> : null}
        </div>
        <div className="rounded border border-[#9d7932]/55 bg-black/20 p-4 sm:p-5">
          <div className="flex items-center justify-between"><h3 className="font-black text-[#f2d98f]">Existing bingo events</h3><span className="rounded bg-white/10 px-2 py-1 text-[10px] font-black">{events.length}</span></div>
          <div className="mt-4 max-h-96 space-y-3 overflow-auto">{events.map((event) => <article className="rounded border border-white/10 bg-black/20 p-3" key={event.id}><div className="flex flex-wrap items-start gap-2"><div className="min-w-40 flex-1"><p className="font-black text-[#edd99f]">{event.title}</p><p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-[#9f9272]">{event.mode} · {event.status} · {event.task_count} tiles · {event.pending_count} pending</p></div><a className="gold-button px-3 py-2 text-xs" href={event.managePath}>Manage</a><a className="scroll-button px-3 py-2 text-xs" href={event.publicPath} target="_blank" rel="noreferrer">Watch ↗</a></div></article>)}{!events.length ? <p className="rounded border border-dashed border-white/15 p-5 text-center text-sm text-[#a99c7d]">No bingo events have been created from this draft.</p> : null}</div>
        </div>
      </div>
    </section>
  );
}
