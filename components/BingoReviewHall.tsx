'use client';

import { useMemo, useState, type ReactNode } from 'react';
import type { BingoViewClaim, BingoViewData, BingoViewVerificationCandidate } from '../lib/bingo-view-types';

type ReviewTab = 'review' | 'tracking' | 'archive';
type ClaimAction = 'approve' | 'reject' | 'reopen';

export function BingoReviewHall({ data, base, working, onReview, onResolve }: {
  data: BingoViewData;
  base: string;
  working: string;
  onReview: (claimId: string, action: ClaimAction, reviewNote?: string) => Promise<boolean>;
  onResolve: (candidateId: string, action: 'accept' | 'dismiss' | 'reopen') => Promise<void>;
}) {
  const [tab, setTab] = useState<ReviewTab>('review');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [archiveStatus, setArchiveStatus] = useState('all');
  const [search, setSearch] = useState('');
  const pendingClaims = data.claims.filter((claim) => claim.status === 'pending');
  const pendingCandidateIds = new Set(pendingClaims.flatMap((claim) => claim.verificationCandidateId ? [claim.verificationCandidateId] : []));
  const ready = data.verification.candidates.filter((candidate) => candidate.status === 'ready' && !pendingCandidateIds.has(candidate.id));
  const tracking = data.verification.candidates.filter((candidate) => candidate.status === 'progress');
  const dismissed = data.verification.candidates.filter((candidate) => candidate.status === 'dismissed');
  const approved = data.claims.filter((claim) => claim.status === 'approved');
  const rejected = data.claims.filter((claim) => claim.status === 'rejected');
  const archiveClaims = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('en-US');
    return data.claims.filter((claim) => {
      if (archiveStatus !== 'all' && claim.status !== archiveStatus) return false;
      if (!query) return true;
      const task = data.tasks.find((item) => item.id === claim.taskId)?.title ?? '';
      const team = data.teams.find((item) => item.id === claim.teamId)?.name ?? '';
      return `${task} ${team} ${claim.claimedByName} ${claim.verificationSource}`.toLocaleLowerCase('en-US').includes(query);
    });
  }, [archiveStatus, data.claims, data.tasks, data.teams, search]);

  async function reviewClaim(claim: BingoViewClaim, action: ClaimAction) {
    const note = notes[claim.id]?.trim() ?? '';
    if (action === 'reopen' && claim.status === 'approved'
      && !window.confirm('Reverse this approval? Its points will be removed and progression tiles may relock. Later completions will stay recorded.')) return;
    const saved = await onReview(claim.id, action, note);
    if (saved) setNotes((current) => ({ ...current, [claim.id]: '' }));
  }

  return (
    <section className="wood-panel scroll-mt-5 p-5 sm:p-7" id="review">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#d7ae50]">Review hall</p>
          <h2 className="fantasy-title mt-1 text-3xl font-bold text-[#f2d98f]">Proof, decisions, and history.</h2>
          <p className="mt-2 text-xs text-[#c8b990]">Owners, organizers, and scorekeepers can review here.</p>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center text-[9px] font-black uppercase tracking-[0.05em] sm:min-w-[440px]">
          <Metric label="Needs review" value={pendingClaims.length + ready.length} tone="text-[#f0cf68]" />
          <Metric label="Tracking" value={tracking.length} tone="text-[#b8d69e]" />
          <Metric label="Approved" value={approved.length} tone="text-[#b8d69e]" />
          <Metric label="Rejected" value={rejected.length} tone="text-[#e3a58a]" />
        </div>
      </div>

      {!data.event.requiresReview ? <p className="mt-4 rounded border border-[#6f873d]/45 bg-[#253019] px-4 py-3 text-xs font-bold text-[#d9e7aa]">Auto-score is on. Ready manual, screenshot, RuneLite, and Wise Old Man proof scores without waiting.</p> : null}

      <div aria-label="Review hall sections" className="mt-5 flex flex-wrap gap-2" role="tablist">
        <Tab active={tab === 'review'} count={pendingClaims.length + ready.length} onClick={() => setTab('review')}>Needs review</Tab>
        <Tab active={tab === 'tracking'} count={tracking.length} onClick={() => setTab('tracking')}>Still tracking</Tab>
        <Tab active={tab === 'archive'} count={data.claims.length + dismissed.length} onClick={() => setTab('archive')}>Evidence archive</Tab>
      </div>

      {tab === 'review' ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {pendingClaims.map((claim) => <ClaimCard
            base={base} claim={claim} data={data} key={claim.id} note={notes[claim.id] ?? ''}
            onNote={(value) => setNotes((current) => ({ ...current, [claim.id]: value }))}
            onReview={reviewClaim} working={working}
          />)}
          {ready.map((candidate) => <CandidateCard candidate={candidate} data={data} key={candidate.id} working={working} onResolve={onResolve} />)}
          {!pendingClaims.length && !ready.length ? <Empty className="lg:col-span-2">Nothing is waiting. New screenshots and ready automated proof will appear here.</Empty> : null}
        </div>
      ) : null}

      {tab === 'tracking' ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {tracking.map((candidate) => <CandidateCard candidate={candidate} data={data} key={candidate.id} working={working} onResolve={onResolve} />)}
          {!tracking.length ? <Empty className="lg:col-span-2">No RuneLite or Wise Old Man tasks are still counting.</Empty> : null}
        </div>
      ) : null}

      {tab === 'archive' ? (
        <div className="mt-5">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_190px]">
            <input aria-label="Search evidence archive" className="dark-field h-10 px-3 text-xs normal-case" placeholder="Search task, team, or player" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select aria-label="Filter evidence status" className="dark-field h-10 px-2 text-xs" value={archiveStatus} onChange={(event) => setArchiveStatus(event.target.value)}>
              <option value="all">All decisions</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="pending">Pending</option><option value="withdrawn">Withdrawn</option>
            </select>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {archiveClaims.map((claim) => <ClaimCard
              archive base={base} claim={claim} data={data} key={claim.id} note={notes[claim.id] ?? ''}
              onNote={(value) => setNotes((current) => ({ ...current, [claim.id]: value }))}
              onReview={reviewClaim} working={working}
            />)}
            {archiveStatus === 'all' && !search.trim() ? dismissed.map((candidate) => <CandidateCard archive candidate={candidate} data={data} key={candidate.id} working={working} onResolve={onResolve} />) : null}
            {!archiveClaims.length && !(archiveStatus === 'all' && !search.trim() && dismissed.length) ? <Empty className="lg:col-span-2">No proof matches this filter.</Empty> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ClaimCard({ claim, data, base, working, note, archive = false, onNote, onReview }: {
  claim: BingoViewClaim;
  data: BingoViewData;
  base: string;
  working: string;
  note: string;
  archive?: boolean;
  onNote: (value: string) => void;
  onReview: (claim: BingoViewClaim, action: ClaimAction) => Promise<void>;
}) {
  const task = data.tasks.find((item) => item.id === claim.taskId);
  const team = data.teams.find((item) => item.id === claim.teamId);
  const pending = claim.status === 'pending';
  const screenshotHref = claim.evidenceUploadId ? `${base}/evidence/${encodeURIComponent(claim.evidenceUploadId)}` : null;
  return (
    <article className="rounded border border-[#9d7932]/60 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="font-black text-[#f2d98f]">{task?.title ?? 'Task'}</p><p className="mt-1 text-xs text-[#c8b990]">{team?.name ?? 'Team'} · {claim.claimedByName}</p></div>
        <span className={`shrink-0 rounded px-2 py-1 text-[9px] font-black uppercase ${statusClass(claim.status)}`}>{claim.status}</span>
      </div>
      <p className="mt-2 text-[9px] font-black uppercase tracking-[0.06em] text-[#d7ae50]">{label(claim.verificationSource)} · {label(claim.verificationConfidence)} · {new Date(claim.submittedAt).toLocaleString()}</p>
      {claim.note ? <p className="mt-3 text-xs leading-relaxed text-[#e0d1aa]">{claim.note}</p> : null}
      {claim.reviewNote ? <p className="mt-3 rounded border border-white/10 bg-black/20 p-2 text-xs text-[#d7c9a5]"><b>Reviewer:</b> {claim.reviewNote}</p> : null}
      {screenshotHref ? <a className="mt-3 block overflow-hidden rounded border border-[#9d7932]/50 bg-black/30" href={screenshotHref} target="_blank" rel="noreferrer">
        {/* Authenticated proof stays on its private route instead of passing through an image optimizer. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={`Screenshot proof for ${task?.title ?? 'bingo task'}`} className="max-h-48 w-full object-contain" loading="lazy" src={screenshotHref} />
      </a> : null}
      <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-black">
        {screenshotHref ? <a className="text-[#d9e7aa] underline" href={screenshotHref} target="_blank" rel="noreferrer">View full screenshot ↗</a> : null}
        {claim.evidenceUrl ? <a className="text-[#d9e7aa] underline" href={claim.evidenceUrl} target="_blank" rel="noreferrer">Open proof link ↗</a> : null}
        {!claim.evidenceUploadId && !claim.evidenceUrl ? <span className="text-[#a99c7d]">No attached image</span> : null}
      </div>
      {pending ? <>
        <input className="realm-field mt-3 h-10 w-full px-3 text-xs normal-case" placeholder="Review note (required when rejecting)" value={note} onChange={(event) => onNote(event.target.value)} />
        <div className="mt-2 grid grid-cols-2 gap-2"><button className="gold-button px-3 py-2 text-xs" disabled={working.endsWith(claim.id)} onClick={() => void onReview(claim, 'approve')}>Approve & score</button><button className="scroll-button px-3 py-2 text-xs" disabled={working.endsWith(claim.id) || !note.trim()} onClick={() => void onReview(claim, 'reject')}>Reject</button></div>
      </> : archive && claim.status === 'approved' ? <button className="scroll-button mt-3 w-full px-3 py-2 text-xs" disabled={working.endsWith(claim.id)} onClick={() => void onReview(claim, 'reopen')}>Reverse approval</button>
        : archive && claim.status === 'rejected' ? <button className="scroll-button mt-3 w-full px-3 py-2 text-xs" disabled={working.endsWith(claim.id)} onClick={() => void onReview(claim, 'reopen')}>Reopen for review</button> : null}
    </article>
  );
}

function CandidateCard({ candidate, data, working, archive = false, onResolve }: {
  candidate: BingoViewVerificationCandidate;
  data: BingoViewData;
  working: string;
  archive?: boolean;
  onResolve: (candidateId: string, action: 'accept' | 'dismiss' | 'reopen') => Promise<void>;
}) {
  const task = data.tasks.find((item) => item.id === candidate.taskId);
  const team = data.teams.find((item) => item.id === candidate.teamId);
  return (
    <article className="rounded border border-[#71874e]/50 bg-[#1a2515]/70 p-4">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-black text-[#e2ebb9]">{task?.title ?? 'Automated proof'}</p><p className="mt-1 text-xs text-[#b7c59d]">{team?.name ?? 'Team'} · {candidate.summary}</p></div><span className={`shrink-0 rounded px-2 py-1 text-[9px] font-black uppercase ${statusClass(candidate.status)}`}>{candidate.status}</span></div>
      <div className="mt-3 h-2 overflow-hidden rounded bg-black/35"><div className="h-full rounded bg-[#83a267]" style={{ width: progressWidth(candidate) }} /></div>
      <p className="mt-2 text-[9px] font-black uppercase tracking-[0.05em] text-[#c9d894]">{candidate.sourceSummary.split(',').map(label).join(' + ')} · {label(candidate.confidence)} · updated {new Date(candidate.updatedAt).toLocaleString()}</p>
      {candidate.status === 'ready' ? <div className="mt-3 grid grid-cols-2 gap-2"><button className="gold-button px-3 py-2 text-xs" disabled={working.endsWith(candidate.id)} onClick={() => void onResolve(candidate.id, 'accept')}>Accept & score</button><button className="scroll-button px-3 py-2 text-xs" disabled={working.endsWith(candidate.id)} onClick={() => void onResolve(candidate.id, 'dismiss')}>Dismiss</button></div> : null}
      {candidate.status === 'progress' ? <button className="scroll-button mt-3 w-full px-3 py-2 text-xs" disabled={working.endsWith(candidate.id)} onClick={() => void onResolve(candidate.id, 'dismiss')}>Dismiss progress</button> : null}
      {archive && candidate.status === 'dismissed' ? <button className="scroll-button mt-3 w-full px-3 py-2 text-xs" disabled={working.endsWith(candidate.id)} onClick={() => void onResolve(candidate.id, 'reopen')}>Reopen from evidence</button> : null}
    </article>
  );
}

function Tab({ active, count, children, onClick }: { active: boolean; count: number; children: ReactNode; onClick: () => void }) {
  return <button aria-selected={active} className={`${active ? 'gold-button' : 'scroll-button'} px-4 py-2.5 text-xs`} onClick={onClick} role="tab" type="button">{children} · {count}</button>;
}
function Metric({ label: text, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="rounded border border-white/10 bg-black/20 p-2"><strong className={`block text-lg ${tone}`}>{value}</strong><span className="text-[#9f9272]">{text}</span></div>;
}
function Empty({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`rounded border border-dashed border-white/15 p-6 text-center text-sm text-[#ad9f7f] ${className}`}>{children}</p>;
}
function label(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function statusClass(status: string) {
  if (status === 'approved' || status === 'accepted') return 'bg-[#d8e3bd] text-[#36512f]';
  if (status === 'rejected' || status === 'dismissed') return 'bg-[#efd0c0] text-[#7b3421]';
  if (status === 'ready') return 'bg-[#ead8a9] text-[#6f4e16]';
  return 'bg-[#d8c8aa] text-[#5f4c31]';
}
function progressWidth(candidate: BingoViewVerificationCandidate) {
  if (candidate.status === 'ready' || candidate.status === 'accepted') return '100%';
  if (!candidate.targetValue) return '0%';
  if (candidate.details.comparator === 'at_most') return `${Math.max(2, Math.min(100, candidate.targetValue / Math.max(candidate.progressValue, 0.000001) * 100))}%`;
  if (candidate.details.comparator === 'equals') return `${Math.max(2, Math.min(100, (1 - Math.abs(candidate.progressValue - candidate.targetValue) / candidate.targetValue) * 100))}%`;
  return `${Math.max(2, Math.min(100, candidate.progressValue / candidate.targetValue * 100))}%`;
}
