'use client';

import { useMemo, useState } from 'react';
import { BINGO_VERIFIERS } from '../lib/bingo-rules';
import type { BingoViewData, BingoViewVerificationCandidate } from '../lib/bingo-view-types';
import type { BingoVerificationSignal, VerificationSource } from '../lib/bingo-verification';

type Preview = { matches?: Array<{ taskId: string; title: string; sortOrder: number }>; duplicate?: boolean; candidates?: BingoViewVerificationCandidate[] };

export function BingoVerificationPanel({ data, working, preview, onResolve, onReplay, onSignal }: {
  data: BingoViewData;
  working: string;
  preview: Preview | null;
  onResolve: (candidateId: string, action: 'accept' | 'dismiss' | 'reopen') => Promise<void>;
  onReplay: () => Promise<void>;
  onSignal: (input: { teamId: string; memberId: string | null; signal: BingoVerificationSignal }, dryRun: boolean) => Promise<void>;
}) {
  const [teamId, setTeamId] = useState(data.teams[0]?.id ?? '');
  const selectedTeam = data.teams.find((team) => team.id === teamId) ?? data.teams[0];
  const [memberId, setMemberId] = useState(selectedTeam?.members[0]?.id ?? '');
  const [source, setSource] = useState<VerificationSource>('runelite');
  const [signalType, setSignalType] = useState<BingoVerificationSignal['signalType']>('item_acquired');
  const [target, setTarget] = useState('Oathplate helm');
  const [metric, setMetric] = useState('');
  const [value, setValue] = useState('1');
  const [measurement, setMeasurement] = useState<BingoVerificationSignal['measurement']>('occurrence');
  const [participants, setParticipants] = useState('');
  const candidates = data.verification.candidates;
  const ready = candidates.filter((candidate) => candidate.status === 'ready');
  const progress = candidates.filter((candidate) => candidate.status === 'progress');
  const resolved = candidates.filter((candidate) => ['accepted', 'dismissed'].includes(candidate.status));
  const sourceCounts = useMemo(() => candidates.reduce<Record<string, number>>((counts, candidate) => {
    for (const item of candidate.sourceSummary.split(',').filter(Boolean)) counts[item] = (counts[item] ?? 0) + 1;
    return counts;
  }, {}), [candidates]);

  function signal(): BingoVerificationSignal {
    return {
      idempotencyKey: crypto.randomUUID(),
      source,
      signalType,
      target: target.trim(),
      targetId: null,
      metric: metric.trim(),
      value: value === '' ? null : Math.max(0, Number(value) || 0),
      unit: measurement === 'duration' ? 'seconds' : '',
      measurement,
      participants: participants.split(',').map((item) => item.trim()).filter(Boolean),
      tags: [],
      observedAt: new Date().toISOString(),
      metadata: { submittedFrom: 'organizer_verification_lab' },
    };
  }

  return (
    <section className="wood-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-black uppercase tracking-[0.12em] text-[#d7ae50]">Verification queue</p><h3 className="fantasy-title mt-1 text-2xl font-bold text-[#f2d98f]">Evidence with a paper trail.</h3></div>
        <button className="scroll-button px-3 py-2 text-xs" disabled={working === 'verification-replay' || !data.verification.eventCount} onClick={() => void onReplay()}>{working === 'verification-replay' ? 'Replaying…' : 'Replay signals'}</button>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] font-black uppercase tracking-[0.06em]">
        <Metric label="Ready" value={ready.length} tone="text-[#d8c36c]" />
        <Metric label="Tracking" value={progress.length} tone="text-[#a9c798]" />
        <Metric label="Signals" value={data.verification.eventCount} tone="text-[#b8aa87]" />
      </div>
      {Object.keys(sourceCounts).length ? <p className="mt-3 text-[10px] text-[#a99c7d]">{Object.entries(sourceCounts).map(([name, count]) => label(name) + ' ' + count).join(' · ')}</p> : null}

      <div className="mt-4 max-h-[560px] space-y-3 overflow-auto">
        {[...ready, ...progress, ...resolved].map((candidate) => {
          const task = data.tasks.find((item) => item.id === candidate.taskId);
          const team = data.teams.find((item) => item.id === candidate.teamId);
          return <article className="rounded border border-[#9d7932]/60 bg-black/20 p-3" key={candidate.id}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1"><p className="text-sm font-black text-[#f2d98f]">{task?.title ?? 'Task verification'}</p><p className="mt-1 text-[10px] text-[#c8b990]">{team?.name} · {candidate.summary}</p></div>
              <span className={'rounded px-2 py-1 text-[9px] font-black uppercase ' + confidenceClass(candidate.confidence)}>{label(candidate.confidence)}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded bg-black/35"><div className="h-full rounded bg-[#83a267]" style={{ width: progressWidth(candidate) }} /></div>
            <p className="mt-2 text-[9px] uppercase tracking-[0.05em] text-[#a99c7d]">{candidate.sourceSummary.split(',').map(label).join(' + ')} · {label(candidate.status)}</p>
            {candidate.status === 'ready' ? <div className="mt-3 grid grid-cols-2 gap-2"><button className="gold-button px-3 py-2 text-xs" disabled={working.endsWith(candidate.id)} onClick={() => void onResolve(candidate.id, 'accept')}>Accept & score</button><button className="scroll-button px-3 py-2 text-xs" disabled={working.endsWith(candidate.id)} onClick={() => void onResolve(candidate.id, 'dismiss')}>Dismiss</button></div> : null}
            {candidate.status === 'progress' ? <button className="scroll-button mt-3 w-full px-3 py-2 text-xs" disabled={working.endsWith(candidate.id)} onClick={() => void onResolve(candidate.id, 'dismiss')}>Dismiss progress</button> : null}
            {candidate.status === 'dismissed' ? <button className="scroll-button mt-3 w-full px-3 py-2 text-xs" disabled={working.endsWith(candidate.id)} onClick={() => void onResolve(candidate.id, 'reopen')}>Reopen from evidence</button> : null}
          </article>;
        })}
        {!candidates.length ? <p className="rounded border border-dashed border-white/15 p-5 text-center text-sm text-[#ad9f7f]">No automated evidence yet. Wise Old Man and RuneLite signals will appear here without replacing manual claims.</p> : null}
      </div>

      <details className="mt-4 rounded border border-white/10 bg-black/20 p-3">
        <summary className="cursor-pointer text-[10px] font-black uppercase tracking-[0.1em] text-[#d7ae50]">Verification lab</summary>
        <p className="mt-2 text-[10px] leading-relaxed text-[#aa9d7e]">Preview how a normalized RuneLite or Wise Old Man signal matches the current board. Recording is available only during a live event.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <select aria-label="Verification team" className="dark-field h-10 px-2 text-xs" value={teamId} onChange={(event) => { setTeamId(event.target.value); const team = data.teams.find((item) => item.id === event.target.value); setMemberId(team?.members[0]?.id ?? ''); }}>{data.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select>
          <select aria-label="Verification player" className="dark-field h-10 px-2 text-xs" value={memberId} onChange={(event) => setMemberId(event.target.value)}><option value="">Team total</option>{selectedTeam?.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select>
          <select aria-label="Evidence source" className="dark-field h-10 px-2 text-xs" value={source} onChange={(event) => setSource(event.target.value as VerificationSource)}><option value="runelite">RuneLite</option><option value="wise_old_man">Wise Old Man</option><option value="organizer">Organizer source</option></select>
          <select aria-label="Signal type" className="dark-field h-10 px-2 text-xs" value={signalType} onChange={(event) => setSignalType(event.target.value as BingoVerificationSignal['signalType'])}>{BINGO_VERIFIERS.map((type) => <option key={type} value={type}>{label(type)}</option>)}</select>
          <input aria-label="Signal target" className="dark-field h-10 px-3 text-xs normal-case" placeholder="Item, pet, raid, task…" value={target} onChange={(event) => setTarget(event.target.value)} />
          <input aria-label="Signal metric" className="dark-field h-10 px-3 text-xs normal-case" placeholder="Metric: agility, giant_mole…" value={metric} onChange={(event) => setMetric(event.target.value)} />
          <input aria-label="Signal value" className="dark-field h-10 px-3 text-xs" type="number" min={0} placeholder="Value" value={value} onChange={(event) => setValue(event.target.value)} />
          <select aria-label="Measurement type" className="dark-field h-10 px-2 text-xs" value={measurement} onChange={(event) => setMeasurement(event.target.value as BingoVerificationSignal['measurement'])}><option value="occurrence">Occurrence / quantity</option><option value="delta">Gain / delta</option><option value="absolute">Absolute value</option><option value="duration">Duration in seconds</option></select>
          <input aria-label="Signal participants" className="dark-field h-10 px-3 text-xs normal-case sm:col-span-2" placeholder="Participants, comma separated for party rules" value={participants} onChange={(event) => setParticipants(event.target.value)} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button className="scroll-button px-3 py-2 text-xs" disabled={!teamId || working === 'verification-preview'} onClick={() => void onSignal({ teamId, memberId: memberId || null, signal: signal() }, true)}>{working === 'verification-preview' ? 'Checking…' : 'Preview matches'}</button>
          <button className="gold-button px-3 py-2 text-xs" disabled={!teamId || data.event.status !== 'live' || working === 'verification-ingest'} onClick={() => void onSignal({ teamId, memberId: memberId || null, signal: signal() }, false)}>{working === 'verification-ingest' ? 'Recording…' : 'Record test signal'}</button>
        </div>
        {preview ? <div className="mt-3 rounded border border-white/10 bg-black/25 p-3 text-[10px] text-[#c8b990]">{preview.matches ? preview.matches.length ? preview.matches.map((match) => <p key={match.taskId}>Matches tile #{match.sortOrder + 1}: <b>{match.title}</b></p>) : <p>No task rules matched this signal.</p> : <p>{preview.duplicate ? 'Duplicate signal ignored safely.' : (preview.candidates?.length ?? 0) + ' candidate updates recorded.'}</p>}</div> : null}
      </details>
    </section>
  );
}

function Metric({ label: text, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="rounded border border-white/10 bg-black/20 p-2"><strong className={'block text-lg ' + tone}>{value}</strong><span className="text-[#9f9272]">{text}</span></div>;
}
function progressWidth(candidate: BingoViewVerificationCandidate) {
  if (candidate.status === 'ready' || candidate.status === 'accepted') return '100%';
  if (!candidate.targetValue) return '0%';
  if (candidate.details.comparator === 'at_most') {
    if (candidate.progressValue <= 0) return '0%';
    return Math.max(2, Math.min(100, candidate.targetValue / candidate.progressValue * 100)) + '%';
  }
  if (candidate.details.comparator === 'equals') {
    return Math.max(2, Math.min(100, (1 - Math.abs(candidate.progressValue - candidate.targetValue) / candidate.targetValue) * 100)) + '%';
  }
  return Math.max(2, Math.min(100, candidate.progressValue / candidate.targetValue * 100)) + '%';
}
function label(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function confidenceClass(value: string) {
  if (value === 'verified' || value === 'reviewed') return 'bg-[#d8e3bd] text-[#36512f]';
  if (value === 'corroborated') return 'bg-[#d5d0eb] text-[#493c69]';
  if (value === 'observed') return 'bg-[#ead8a9] text-[#6f4e16]';
  return 'bg-[#d8c8aa] text-[#5f4c31]';
}
