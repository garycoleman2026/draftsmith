'use client';

import { useRef, useState } from 'react';
import { absoluteUrl, copyText, initials } from '../lib/client';
import type { DraftType } from '../lib/types';
import { SiteHeader } from './SiteHeader';

type CreatedDraft = {
  adminPath: string;
  captains: { name: string; teamIndex: number; path: string }[];
};

const DRAFT_OPTIONS: { id: DraftType; title: string; description: string }[] = [
  {
    id: 'balanced',
    title: 'Consensus balance',
    description: 'Combines every captain’s ranking, then spreads strength evenly.',
  },
  {
    id: 'snake',
    title: 'Captain snake',
    description: 'Simulates alternating captain picks using each personal ranking.',
  },
  {
    id: 'random',
    title: 'Random draw',
    description: 'Shuffles the pool while still respecting avoid choices where possible.',
  },
];

export function CreateDraft() {
  const [step, setStep] = useState<'setup' | 'captains' | 'created'>('setup');
  const [title, setTitle] = useState('Game Night Draft');
  const [draftType, setDraftType] = useState<DraftType>('balanced');
  const [teamCount, setTeamCount] = useState(3);
  const [rawList, setRawList] = useState('');
  const [players, setPlayers] = useState<string[]>([]);
  const [captains, setCaptains] = useState<string[]>([]);
  const [created, setCreated] = useState<CreatedDraft | null>(null);
  const [error, setError] = useState('');
  const [importNote, setImportNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  function importPlayers(value: string) {
    setRawList(value);
    const parsed = parsePlayerNames(value);
    setPlayers(parsed.names);
    setImportNote(
      parsed.names.length
        ? `${parsed.names.length} player${parsed.names.length === 1 ? '' : 's'} ready${
            parsed.duplicates ? ` · ${parsed.duplicates} duplicate${parsed.duplicates === 1 ? '' : 's'} removed` : ''
          }`
        : '',
    );
    setError('');
  }

  async function handleFile(file?: File) {
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setError('Use a CSV or TXT file, or paste names into the box.');
      return;
    }
    importPlayers(await file.text());
  }

  function continueToCaptains() {
    if (players.length < teamCount) {
      setError(`Add at least ${teamCount} players for ${teamCount} teams.`);
      return;
    }
    setCaptains(players.slice(0, teamCount));
    setError('');
    setStep('captains');
  }

  function setCaptain(index: number, name: string) {
    setCaptains((current) => current.map((captain, itemIndex) => (itemIndex === index ? name : captain)));
    setError('');
  }

  async function createDraft() {
    if (new Set(captains).size !== teamCount) {
      setError('Choose a different player for each captain spot.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, draftType, teamCount, players, captainNames: captains }),
      });
      const data = (await response.json()) as CreatedDraft & { error?: string };
      if (!response.ok) throw new Error(data.error || 'The draft could not be created.');
      setCreated(data);
      setStep('created');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The draft could not be created.');
    } finally {
      setBusy(false);
    }
  }

  async function copy(label: string, value: string) {
    await copyText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(''), 1800);
  }

  const progressStep = step === 'setup' ? 1 : step === 'captains' ? 2 : 3;

  return (
    <main className="min-h-screen bg-[#f3efe4] text-[#14251f]">
      <SiteHeader badge={step === 'created' ? 'Draft saved' : 'Setup'} />
      <section className="mx-auto max-w-7xl px-5 pb-16 pt-8 sm:px-8 sm:pt-12">
        <div className="mb-8 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-[#d25839]">
              {step === 'created' ? 'Ready to share' : 'New team draft'}
            </p>
            <h1 className="max-w-3xl text-4xl font-black leading-[0.98] tracking-[-0.045em] sm:text-6xl">
              {step === 'created' ? 'Send each captain their link.' : 'Turn captain picks into fair teams.'}
            </h1>
          </div>
          <ol className="flex flex-wrap gap-2 text-xs font-bold" aria-label="Draft progress">
            {['Setup', 'Captains', 'Share links'].map((label, index) => (
              <li
                key={label}
                className={
                  index + 1 <= progressStep
                    ? 'rounded-full bg-[#173f35] px-3 py-2 text-white'
                    : 'rounded-full border border-[#173f35]/15 bg-white/55 px-3 py-2 text-[#5c6e67]'
                }
              >
                {index + 1}&nbsp; {label}
              </li>
            ))}
          </ol>
        </div>

        {step === 'setup' ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
            <section className="rounded-[28px] border border-[#173f35]/12 bg-[#fffdf7] p-5 shadow-[0_20px_55px_rgba(23,63,53,.08)] sm:p-8">
              <div className="mb-7 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.12em] text-[#6e7d77]">Draft settings</p>
                  <h2 className="mt-1 text-2xl font-black tracking-[-0.03em]">Build the player pool</h2>
                </div>
                <span className="rounded-xl bg-[#f2e4ad] px-3 py-2 text-xs font-black text-[#5a4510]">Step 1 of 3</span>
              </div>

              <label className="grid gap-2 text-sm font-bold">
                Draft name
                <input
                  className="h-12 rounded-xl border border-[#173f35]/20 bg-white px-4 font-semibold outline-none focus:border-[#e16948] focus:ring-4 focus:ring-[#e16948]/10"
                  maxLength={80}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Friday clan event"
                />
              </label>

              <fieldset className="mt-6">
                <legend className="mb-2 text-sm font-bold">Draft type</legend>
                <div className="grid gap-3 md:grid-cols-3">
                  {DRAFT_OPTIONS.map((option) => (
                    <label
                      key={option.id}
                      className={`cursor-pointer rounded-2xl border p-4 transition ${
                        draftType === option.id
                          ? 'border-[#173f35] bg-[#e7eee9] shadow-[0_0_0_3px_rgba(23,63,53,.08)]'
                          : 'border-[#173f35]/13 bg-white hover:border-[#173f35]/35'
                      }`}
                    >
                      <input
                        className="sr-only"
                        type="radio"
                        name="draftType"
                        checked={draftType === option.id}
                        onChange={() => setDraftType(option.id)}
                      />
                      <span className="block font-black">{option.title}</span>
                      <span className="mt-1.5 block text-xs leading-relaxed text-[#68766f]">{option.description}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="mt-6">
                <legend className="mb-2 text-sm font-bold">Number of teams</legend>
                <div className="flex flex-wrap gap-2">
                  {[2, 3, 4, 5, 6].map((count) => (
                    <button
                      key={count}
                      type="button"
                      aria-pressed={teamCount === count}
                      onClick={() => setTeamCount(count)}
                      className={`grid h-11 min-w-12 place-items-center rounded-xl border text-sm font-black transition ${
                        teamCount === count
                          ? 'border-[#173f35] bg-[#173f35] text-white'
                          : 'border-[#173f35]/15 bg-white text-[#173f35] hover:border-[#173f35]/40'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="text-sm font-bold" htmlFor="player-list">Player list</label>
                  {importNote ? <span className="text-xs font-bold text-[#2d6f5e]">{importNote}</span> : null}
                </div>
                <textarea
                  id="player-list"
                  className="min-h-48 w-full resize-y rounded-2xl border border-[#173f35]/20 bg-white p-4 font-mono text-sm leading-7 outline-none placeholder:text-[#87938e] focus:border-[#e16948] focus:ring-4 focus:ring-[#e16948]/10"
                  value={rawList}
                  onChange={(event) => importPlayers(event.target.value)}
                  placeholder={'Paste one player per line\nAlex\nJamie\nMorgan\nTaylor'}
                />
                <div
                  className="mt-3 flex flex-col gap-3 rounded-2xl border-2 border-dashed border-[#9aa8a1] bg-[#f8f5ec] p-4 sm:flex-row sm:items-center sm:justify-between"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    void handleFile(event.dataTransfer.files[0]);
                  }}
                >
                  <div>
                    <p className="text-sm font-black">Or upload the list once</p>
                    <p className="mt-0.5 text-xs text-[#68766f]">CSV or TXT · the first column becomes the player name</p>
                  </div>
                  <input
                    ref={fileInput}
                    className="sr-only"
                    type="file"
                    accept=".csv,.txt,text/csv,text/plain"
                    onChange={(event) => void handleFile(event.target.files?.[0])}
                  />
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="rounded-xl border border-[#173f35]/15 bg-white px-4 py-2.5 text-xs font-black text-[#173f35] hover:border-[#173f35]/35"
                  >
                    Choose file
                  </button>
                </div>
              </div>

              {error ? <p role="alert" className="mt-5 rounded-xl border border-[#d25839]/25 bg-[#fff0ea] px-4 py-3 text-sm font-bold text-[#9b3c26]">{error}</p> : null}
              <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[#173f35]/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-sm text-xs leading-relaxed text-[#6a7872]">Captain names come from this one player list. Rankings and avoids are entered through their private links.</p>
                <button
                  className="rounded-xl bg-[#e16948] px-5 py-3 text-sm font-black text-white shadow-[0_4px_0_#a43e27] transition hover:-translate-y-0.5"
                  type="button"
                  onClick={continueToCaptains}
                >
                  Choose captains →
                </button>
              </div>
            </section>

            <aside className="rounded-[28px] bg-[#173f35] p-6 text-[#f8f5ec] sm:p-8">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ef9a78]">How it works</p>
              <h2 className="mt-3 text-3xl font-black leading-none tracking-[-0.04em]">One list.<br />A link per captain.</h2>
              <div className="mt-8 space-y-6">
                {[
                  ['01', 'Pick captains', 'Choose one captain for each team from your uploaded list.'],
                  ['02', 'Share private links', 'Captains paste their order and mark any avoids as yes or no.'],
                  ['03', 'Run the draft', 'When every ranking is in, generate the teams and copy the result.'],
                ].map(([number, itemTitle, copy]) => (
                  <div className="grid grid-cols-[38px_1fr] gap-3" key={number}>
                    <span className="text-sm font-black text-[#ef9a78]">{number}</span>
                    <div>
                      <h3 className="font-black">{itemTitle}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-[#c4d2cd]">{copy}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-9 rounded-2xl border border-white/10 bg-white/7 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#9db5ac]">Privacy</p>
                <p className="mt-2 text-sm leading-relaxed text-[#d4dfdb]">No player accounts are needed. Anyone with a private captain link can update only that captain’s ranking.</p>
              </div>
            </aside>
          </div>
        ) : null}

        {step === 'captains' ? (
          <section className="mx-auto max-w-4xl rounded-[28px] border border-[#173f35]/12 bg-[#fffdf7] p-5 shadow-[0_20px_55px_rgba(23,63,53,.08)] sm:p-8">
            <div className="flex flex-col gap-3 border-b border-[#173f35]/10 pb-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.12em] text-[#6e7d77]">Captain seats</p>
                <h2 className="mt-1 text-3xl font-black tracking-[-0.04em]">Who leads each team?</h2>
                <p className="mt-2 text-sm text-[#68766f]">Captains are fixed to separate teams and won’t rank one another.</p>
              </div>
              <span className="self-start rounded-xl bg-[#f2e4ad] px-3 py-2 text-xs font-black text-[#5a4510]">{players.length} players · {teamCount} teams</span>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {Array.from({ length: teamCount }, (_, index) => (
                <label className="rounded-2xl border border-[#173f35]/13 bg-white p-4" key={index}>
                  <span className="mb-3 flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-[#dce8df] text-xs font-black text-[#173f35]">{index + 1}</span>
                    <span>
                      <span className="block text-xs font-black uppercase tracking-[0.1em] text-[#7a8781]">Team {index + 1}</span>
                      <span className="block font-black">Captain</span>
                    </span>
                  </span>
                  <select
                    className="h-12 w-full rounded-xl border border-[#173f35]/20 bg-white px-3 font-bold outline-none focus:border-[#e16948] focus:ring-4 focus:ring-[#e16948]/10"
                    value={captains[index] || ''}
                    onChange={(event) => setCaptain(index, event.target.value)}
                  >
                    {players.map((player) => (
                      <option key={player} value={player} disabled={captains.some((captain, captainIndex) => captainIndex !== index && captain === player)}>
                        {player}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {error ? <p role="alert" className="mt-5 rounded-xl border border-[#d25839]/25 bg-[#fff0ea] px-4 py-3 text-sm font-bold text-[#9b3c26]">{error}</p> : null}
            <div className="mt-7 flex flex-col-reverse gap-3 border-t border-[#173f35]/10 pt-6 sm:flex-row sm:justify-between">
              <button type="button" onClick={() => setStep('setup')} className="rounded-xl border border-[#173f35]/15 bg-white px-5 py-3 text-sm font-black text-[#173f35]">← Back</button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void createDraft()}
                className="rounded-xl bg-[#e16948] px-5 py-3 text-sm font-black text-white shadow-[0_4px_0_#a43e27] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
              >
                {busy ? 'Creating links…' : 'Create captain links →'}
              </button>
            </div>
          </section>
        ) : null}

        {step === 'created' && created ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section className="rounded-[28px] border border-[#173f35]/12 bg-[#fffdf7] p-5 shadow-[0_20px_55px_rgba(23,63,53,.08)] sm:p-8">
              <div className="flex flex-col gap-3 border-b border-[#173f35]/10 pb-6 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.12em] text-[#6e7d77]">Captain links</p>
                  <h2 className="mt-1 text-3xl font-black tracking-[-0.04em]">Copy, paste, send.</h2>
                  <p className="mt-2 text-sm text-[#68766f]">Each private link opens that captain’s ranking area.</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void copy(
                      'all',
                      created.captains
                        .map((captain) => `${captain.name}: ${absoluteUrl(captain.path)}`)
                        .join('\n'),
                    )
                  }
                  className="self-start rounded-xl border border-[#173f35]/15 bg-white px-4 py-2.5 text-xs font-black text-[#173f35]"
                >
                  {copied === 'all' ? 'Copied all' : 'Copy all links'}
                </button>
              </div>
              <div className="mt-5 space-y-3">
                {created.captains.map((captain) => (
                  <div className="flex flex-col gap-3 rounded-2xl border border-[#173f35]/12 bg-white p-4 sm:flex-row sm:items-center" key={captain.path}>
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#dce8df] text-sm font-black text-[#173f35]">{initials(captain.name)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-black">{captain.name}</p>
                      <p className="truncate text-xs text-[#718079]">{absoluteUrl(captain.path)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copy(captain.path, absoluteUrl(captain.path))}
                      className="rounded-xl bg-[#173f35] px-4 py-2.5 text-xs font-black text-white"
                    >
                      {copied === captain.path ? 'Copied' : 'Copy link'}
                    </button>
                  </div>
                ))}
              </div>
            </section>
            <aside className="rounded-[28px] bg-[#173f35] p-6 text-white sm:p-8">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ef9a78]">Organizer link</p>
              <h2 className="mt-3 text-2xl font-black tracking-[-0.03em]">Keep this one for yourself.</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#c5d3ce]">Track captain progress, run the draft, and copy the final teams from your organizer board.</p>
              <a
                href={created.adminPath}
                className="mt-6 block rounded-xl bg-[#e16948] px-5 py-3 text-center text-sm font-black text-white shadow-[0_4px_0_#9f3c26]"
              >
                Open organizer board →
              </a>
              <button
                type="button"
                onClick={() => void copy('admin', absoluteUrl(created.adminPath))}
                className="mt-3 w-full rounded-xl border border-white/15 px-5 py-3 text-sm font-black text-white"
              >
                {copied === 'admin' ? 'Organizer link copied' : 'Copy organizer link'}
              </button>
              <p className="mt-5 text-xs leading-relaxed text-[#9fb5ad]">Bookmark it. Anyone with this link can run the draft and view the results.</p>
            </aside>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function parsePlayerNames(value: string) {
  let lines = value.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines.length === 1 && value.includes(',') && !value.trim().startsWith('"')) {
    lines = value.split(',');
  }
  const seen = new Set<string>();
  const names: string[] = [];
  let duplicates = 0;
  for (const line of lines) {
    const firstCell = readFirstCell(line).trim().replace(/^[-•]\s*/, '').replace(/\s+/g, ' ');
    if (!firstCell || /^(name|player|player name)$/i.test(firstCell)) continue;
    const key = firstCell.toLocaleLowerCase();
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    names.push(firstCell.slice(0, 80));
  }
  return { names, duplicates };
}

function readFirstCell(line: string) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('"')) return trimmed.split(/[\t,;]/, 1)[0] ?? '';
  let value = '';
  for (let index = 1; index < trimmed.length; index += 1) {
    if (trimmed[index] === '"' && trimmed[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (trimmed[index] === '"') {
      break;
    } else {
      value += trimmed[index];
    }
  }
  return value;
}
