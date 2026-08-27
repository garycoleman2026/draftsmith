'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  parseStandaloneBingoRoster,
  STANDALONE_BINGO_ROSTER_EXAMPLE,
} from '../lib/bingo-roster';
import { absoluteUrl, copyText } from '../lib/client';

export type StandaloneBingoTemplateOption = {
  value: string;
  name: string;
  summary: string;
  meta: string;
};

type CreatedBingo = {
  id: string;
  managePath: string;
  publicPath: string;
  teamLinks: { teamId: string; teamName: string; path: string }[];
};

export function StandaloneBingoCreator({ templates }: { templates: StandaloneBingoTemplateOption[] }) {
  const [title, setTitle] = useState('');
  const [template, setTemplate] = useState(templates[0]?.value ?? 'builtin:points');
  const [rosterText, setRosterText] = useState('');
  const [website, setWebsite] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CreatedBingo | null>(null);
  const [copied, setCopied] = useState('');
  const roster = useMemo(() => parseStandaloneBingoRoster(rosterText), [rosterText]);
  const selectedTemplate = templates.find((item) => item.value === template);

  async function createEvent() {
    if (roster.errors.length) {
      setError(roster.errors[0]);
      return;
    }
    setWorking(true);
    setError('');
    setCreated(null);
    try {
      const [kind, id] = template.split(':', 2);
      const response = await fetch('/api/bingo/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          teams: roster.teams,
          templateKey: kind === 'builtin' ? id : undefined,
          templateId: kind === 'community' ? id : undefined,
          website,
        }),
      });
      const result = await response.json() as CreatedBingo & { error?: string };
      if (!response.ok || !result.managePath) throw new Error(result.error || 'The bingo hall could not be created.');
      setCreated(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The bingo hall could not be created.');
    } finally {
      setWorking(false);
    }
  }

  async function copy(label: string, value: string) {
    await copyText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(''), 1_500);
  }

  async function copyAllLinks() {
    if (!created) return;
    const lines = [
      `Organizer: ${absoluteUrl(created.managePath)}`,
      `Spectator: ${absoluteUrl(created.publicPath)}`,
      '',
      ...created.teamLinks.map((link) => `${link.teamName}: ${absoluteUrl(link.path)}`),
    ];
    await copy('all', lines.join('\n'));
  }

  return (
    <section className="mt-10 scroll-mt-24" id="create">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#c69b3c]">Start with teams you already have</p>
          <h2 className="fantasy-title mt-2 text-3xl font-bold text-[#f5df9b] sm:text-4xl">Paste the rosters. Open the bingo hall.</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#b9ac8d]">No draft required. Each blank-line section becomes a team; its first player becomes the team lead for display purposes. You can completely redesign the board before starting.</p>
        </div>
        <Link className="scroll-button inline-flex justify-center px-4 py-2.5 text-xs" href="/templates">Browse every template ↗</Link>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
        <div className="parchment-panel p-5 sm:p-7">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-[10px] font-black uppercase tracking-[0.09em] text-[#65583f]">Event title
              <input className="realm-field mt-1 h-11 w-full px-3 text-sm normal-case" maxLength={80} placeholder="August clan bingo" value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="text-[10px] font-black uppercase tracking-[0.09em] text-[#65583f]">Starting board
              <select className="realm-field mt-1 h-11 w-full px-3 text-sm normal-case" value={template} onChange={(event) => setTemplate(event.target.value)}>
                {templates.map((item) => <option key={item.value} value={item.value}>{item.name} · {item.meta}</option>)}
              </select>
            </label>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#6e5e43]">{selectedTemplate?.summary}</p>

          <div className="mt-5 flex flex-wrap items-end justify-between gap-2">
            <label className="text-[10px] font-black uppercase tracking-[0.09em] text-[#65583f]">Team rosters</label>
            <button className="text-xs font-black text-[#587044] underline" type="button" onClick={() => setRosterText(STANDALONE_BINGO_ROSTER_EXAMPLE)}>Load an editable example</button>
          </div>
          <textarea
            className="realm-field mt-2 min-h-72 w-full p-4 font-mono text-xs leading-relaxed normal-case"
            placeholder={STANDALONE_BINGO_ROSTER_EXAMPLE}
            value={rosterText}
            onChange={(event) => setRosterText(event.target.value)}
          />
          <label className="hidden" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#6e5e43]">Separate teams with a blank line. Put the team name first, then one OSRS name per line. Comma-separated players work too.</p>
            <span className="rounded bg-[#6a512b]/10 px-3 py-2 text-xs font-black text-[#5d4828]">{roster.teams.length} teams · {roster.playerCount} players</span>
          </div>
          {roster.errors.length && rosterText.trim() ? <div className="mt-4 rounded border border-[#a75e44]/45 bg-[#efd1bd] p-3 text-xs text-[#723b2b]" role="alert"><b>Fix before creating:</b>{roster.errors.slice(0, 3).map((item) => <p className="mt-1" key={item}>{item}</p>)}</div> : null}
          {error ? <p className="mt-4 rounded border border-[#a75e44]/45 bg-[#efd1bd] px-4 py-3 text-sm font-bold text-[#723b2b]" role="alert">{error}</p> : null}
          <button className="gold-button mt-5 px-6 py-3 text-sm" disabled={working || !title.trim() || roster.errors.length > 0} onClick={() => void createEvent()}>
            {working ? 'Forging your bingo hall…' : 'Create bingo and private links →'}
          </button>
        </div>

        <aside className="wood-panel p-5 sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#d7ae50]">Roster preview</p>
          <div className="mt-4 max-h-[520px] space-y-3 overflow-auto pr-1">
            {roster.teams.map((team, index) => <article className="rounded border border-white/10 bg-black/20 p-4" key={`${team.name}-${index}`}>
              <div className="flex items-center justify-between gap-2"><p className="font-black text-[#f2d98f]">{team.name || `Team ${index + 1}`}</p><span className="text-[10px] font-black text-[#9f9272]">{team.players.length}</span></div>
              <p className="mt-2 text-xs leading-relaxed text-[#c8bb99]">{team.players.length ? team.players.join(' · ') : 'Add at least one OSRS name.'}</p>
              {team.players[0] ? <p className="mt-2 text-[10px] uppercase tracking-[0.08em] text-[#8fbe8d]">Lead · {team.players[0]}</p> : null}
            </article>)}
            {!roster.teams.length ? <div className="rounded border border-dashed border-white/15 p-6 text-center text-sm text-[#a99c7d]">Your parsed teams will appear here before anything is created.</div> : null}
          </div>
          <div className="mt-5 border-t border-white/10 pt-5 text-xs leading-relaxed text-[#a99c7d]">
            <p><b className="text-[#e8d8ad]">After creation:</b> edit all tasks and rules, copy each private team board, choose public visibility, connect Wise Old Man, and issue RuneLite pairing codes.</p>
          </div>
        </aside>
      </div>

      {created ? <section className="mt-5 rounded border border-[#7a9b68]/60 bg-[#172719] p-5 text-[#dce8c9] sm:p-7" role="status">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#a8ca8e]">Bingo hall created</p>
        <h3 className="fantasy-title mt-2 text-3xl font-bold text-[#f2d98f]">Save these private links now.</h3>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#becbab]">The organizer link controls the event. Team links allow claims and RuneLite pairing. They are shown here once for anonymous organizers.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a className="gold-button px-4 py-2.5 text-xs" href={created.managePath}>Open organizer room →</a>
          <button className="scroll-button px-4 py-2.5 text-xs" onClick={() => void copy('organizer', absoluteUrl(created.managePath))}>{copied === 'organizer' ? 'Organizer link copied' : 'Copy organizer link'}</button>
          <button className="scroll-button px-4 py-2.5 text-xs" onClick={() => void copyAllLinks()}>{copied === 'all' ? 'All links copied' : 'Copy organizer + team links'}</button>
          <a className="scroll-button px-4 py-2.5 text-xs" href={created.publicPath} target="_blank" rel="noreferrer">Preview spectator board ↗</a>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{created.teamLinks.map((link) => <article className="rounded border border-white/10 bg-black/20 p-3" key={link.teamId}><p className="text-sm font-black text-[#eedca8]">{link.teamName}</p><div className="mt-2 flex gap-3 text-xs"><button className="text-[#cfe3a9] underline" onClick={() => void copy(link.teamId, absoluteUrl(link.path))}>{copied === link.teamId ? 'Copied' : 'Copy private link'}</button><a className="text-[#cfe3a9] underline" href={link.path} target="_blank" rel="noreferrer">Open ↗</a></div></article>)}</div>
      </section> : null}
    </section>
  );
}
