'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BingoViewData, BingoViewTask } from '../lib/bingo-view-types';
import { BingoBoard, BingoStandings } from './BingoBoard';
import { BingoRuneliteTeamPanel } from './BingoRuneliteTeamPanel';
import { SiteHeader } from './SiteHeader';

export function BingoTeamBoard({ token }: { token: string }) {
  const [data, setData] = useState<BingoViewData | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [memberId, setMemberId] = useState('');
  const [note, setNote] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const load = useCallback(async (quiet = false) => {
    try {
      const response = await fetch(`/api/bingo/team/${encodeURIComponent(token)}`, { cache: 'no-store' });
      const next = await response.json() as BingoViewData & { error?: string };
      if (!response.ok) throw new Error(next.error || 'This team board could not be loaded.');
      setData(next); if (!quiet) setError('');
    } catch (cause) { if (!quiet) setError(cause instanceof Error ? cause.message : 'This team board could not be loaded.'); }
  }, [token]);
  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(true), 4_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [load]);

  const ownTeam = data?.teams.find((team) => team.id === data.viewer.teamId) ?? null;
  const selectedTask = data?.tasks.find((task) => task.id === selectedTaskId) ?? null;
  const ownClaims = useMemo(() => data?.claims.filter((claim) => claim.teamId === data.viewer.teamId) ?? [], [data]);
  const ownCandidates = useMemo(() => data?.verification.candidates.filter((candidate) => candidate.teamId === data.viewer.teamId) ?? [], [data]);

  function selectTask(task: BingoViewTask) {
    setSelectedTaskId(task.id); setError(''); setSuccess('');
    if (!memberId && ownTeam?.members.length) setMemberId(ownTeam.members[0].id);
  }

  async function submitClaim() {
    if (!selectedTask || !memberId) return;
    setWorking(true); setError(''); setSuccess('');
    try {
      let evidenceUploadId: string | null = null;
      if (file) {
        const form = new FormData(); form.set('file', file);
        const uploadResponse = await fetch(`/api/bingo/team/${encodeURIComponent(token)}/evidence`, { method: 'POST', body: form });
        const upload = await uploadResponse.json() as { id?: string; error?: string };
        if (!uploadResponse.ok || !upload.id) throw new Error(upload.error || 'The screenshot could not be uploaded.');
        evidenceUploadId = upload.id;
      }
      const response = await fetch(`/api/bingo/team/${encodeURIComponent(token)}/claims`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: selectedTask.id, memberId, note, evidenceUrl, evidenceUploadId }),
      });
      const result = await response.json() as { status?: string; error?: string };
      if (!response.ok) throw new Error(result.error || 'The claim could not be submitted.');
      setSuccess(result.status === 'approved' ? 'Tile verified and scored.' : 'Claim sent to the organizer for review.');
      setSelectedTaskId(null); setNote(''); setEvidenceUrl(''); setFile(null); setFileKey((value) => value + 1);
      await load(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The claim could not be submitted.'); }
    finally { setWorking(false); }
  }

  if (!data || !ownTeam) return <LoadingScreen error={error} />;
  return (
    <main className="realm-bg min-h-screen text-[#eadcb9]">
      <SiteHeader badge="Private team board" />
      <section className="mx-auto max-w-[1500px] px-4 pb-20 pt-8 sm:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#c69b3c]">{ownTeam.name} · private link</p><h1 className="fantasy-title mt-2 text-4xl font-bold text-[#f5df9b] sm:text-6xl">{data.event.title}</h1><p className="mt-3 text-sm text-[#b7aa8a]">Choose a tile, name the player who completed it, and attach proof. This board refreshes automatically.</p></div>
          <a className="scroll-button inline-flex justify-center px-4 py-2.5 text-xs" href={data.event.publicPath} target="_blank" rel="noreferrer">Open spectator board ↗</a>
        </div>
        {success ? <p role="status" className="mt-5 rounded border border-[#3e775d] bg-[#dcebd9] px-4 py-3 text-sm font-bold text-[#245340]">{success}</p> : null}
        {error ? <p role="alert" className="mt-5 rounded border border-[#b75b42] bg-[#f4d5c7] px-4 py-3 text-sm font-bold text-[#7f321f]">{error}</p> : null}
        <div className="wood-panel mt-7 p-4 sm:p-6"><BingoStandings data={data} /></div>
        <div className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="parchment-panel min-w-0 p-4 sm:p-6">
            <div className="mb-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-[#80642b]">{data.event.status === 'live' ? 'Claims are open' : data.event.status === 'paused' ? 'Bingo paused' : data.event.status === 'complete' ? 'Final board' : 'Board preview'}</p><h2 className="fantasy-title text-3xl font-bold">Choose a square.</h2></div>
            <BingoBoard data={data} teamId={ownTeam.id} selectedTaskId={selectedTaskId} evidenceHref={(uploadId) => `/api/bingo/team/${encodeURIComponent(token)}/evidence?uploadId=${encodeURIComponent(uploadId)}`} onSelect={selectTask} />
          </section>
          <aside className="space-y-5">
            <section className="parchment-panel p-5">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#80642b]">Tile claim</p>
              {selectedTask ? <>
                <h2 className="fantasy-title mt-1 text-2xl font-bold">{selectedTask.title}</h2>
                <p className="mt-2 text-xs leading-relaxed text-[#6e5e43]">{selectedTask.description}</p>
                {!selectedTask.claimable ? <p className="mt-4 rounded border border-[#b37a34]/35 bg-[#efd7a4] p-3 text-xs font-bold text-[#765322]">{selectedTask.freeSpace ? 'The free space is already counted.' : selectedTask.claimBlockedReason || data.event.status !== 'live' ? selectedTask.claimBlockedReason || 'Claims open when the organizer starts the event.' : 'This tile is unavailable.'}</p> : <div className="mt-4 space-y-3">
                  <label className="block text-[10px] font-black uppercase tracking-[0.08em] text-[#665538]">Completed by<select className="realm-field mt-1 h-10 w-full px-3 text-sm" value={memberId} onChange={(event) => setMemberId(event.target.value)}><option value="">Choose a teammate</option>{ownTeam.members.map((member) => <option value={member.id} key={member.id}>{member.name}{member.role === 'captain' ? ' · captain' : ''}</option>)}</select></label>
                  <label className="block text-[10px] font-black uppercase tracking-[0.08em] text-[#665538]">Screenshot (PNG, JPEG, WebP · 5 MB)<input key={fileKey} className="realm-field mt-1 block w-full px-2 py-2 text-xs" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
                  <label className="block text-[10px] font-black uppercase tracking-[0.08em] text-[#665538]">Or HTTPS evidence link<input className="realm-field mt-1 h-10 w-full px-3 text-xs normal-case" type="url" value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} placeholder="https://…" /></label>
                  <label className="block text-[10px] font-black uppercase tracking-[0.08em] text-[#665538]">Claim note<textarea className="realm-field mt-1 min-h-24 w-full p-3 text-sm normal-case" value={note} onChange={(event) => setNote(event.target.value)} placeholder="KC, drop details, or context for the reviewer" /></label>
                  <p className="text-[10px] leading-relaxed text-[#746244]">Verification: {selectedTask.verificationMode?.replace('_', ' ') ?? 'manual'}{data.event.requiresReview ? ' · organizer approval required' : ' · automatic approval'}</p>
                  <button type="button" className="gold-button w-full px-4 py-3 text-sm" disabled={working || !memberId} onClick={() => void submitClaim()}>{working ? file ? 'Uploading proof…' : 'Submitting…' : 'Submit tile claim →'}</button>
                </div>}
              </> : <p className="mt-3 rounded border border-dashed border-[#8b6a32]/40 p-4 text-sm text-[#716144]">Select any square to see its rules and claim status.</p>}
            </section>
            <section className="wood-panel p-5"><p className="text-xs font-black uppercase tracking-[0.12em] text-[#d7ae50]">Team roster & intel</p><div className="mt-4 space-y-3">{ownTeam.members.map((member) => <article className="border-b border-white/10 pb-3" key={member.id}><p className="text-sm font-black text-[#f2d98f]">{member.name}</p><div className="mt-1 flex gap-3 text-[10px] font-bold"><a className="text-[#c9d894] underline" href={`https://secure.runescape.com/m=hiscore_oldschool/hiscorepersonal?user1=${encodeURIComponent(member.name)}`} target="_blank" rel="noreferrer">Official Hiscores ↗</a><a className="text-[#c9d894] underline" href={`https://wiseoldman.net/players/${encodeURIComponent(member.name)}`} target="_blank" rel="noreferrer">Wise Old Man ↗</a></div></article>)}</div></section>
            <BingoRuneliteTeamPanel token={token} members={ownTeam.members} onNotice={setSuccess} onError={setError} />
            <section className="wood-panel p-5"><p className="text-xs font-black uppercase tracking-[0.12em] text-[#d7ae50]">Automated progress</p><div className="mt-3 space-y-2">{ownCandidates.filter((candidate) => ['progress', 'ready'].includes(candidate.status)).slice(0, 8).map((candidate) => <article className="rounded border border-white/10 bg-black/20 p-3 text-xs" key={candidate.id}><div className="flex justify-between gap-2"><b className="text-[#f2d98f]">{data.tasks.find((task) => task.id === candidate.taskId)?.title ?? 'Task'}</b><span className="font-black uppercase text-[#c9d894]">{candidate.status}</span></div><p className="mt-1 text-[10px] text-[#b8aa87]">{candidate.summary}</p><p className="mt-1 text-[9px] uppercase tracking-[0.05em] text-[#d7ae50]">{candidate.sourceSummary.replaceAll('_', ' ')} · {candidate.confidence}</p></article>)}{!ownCandidates.some((candidate) => ['progress', 'ready'].includes(candidate.status)) ? <p className="text-sm text-[#ad9f7f]">RuneLite and Wise Old Man progress will appear here when connected.</p> : null}</div></section>
            <section className="parchment-panel p-5"><p className="text-xs font-black uppercase tracking-[0.12em] text-[#80642b]">Your recent claims</p><div className="mt-3 space-y-2">{ownClaims.slice(0, 8).map((claim) => <article className="rounded border border-[#8b6a32]/30 bg-[#f5e5b8]/60 p-3 text-xs" key={claim.id}><div className="flex justify-between gap-2"><b>{data.tasks.find((task) => task.id === claim.taskId)?.title ?? 'Task'}</b><span className={`font-black uppercase ${claim.status === 'approved' ? 'text-[#38705a]' : claim.status === 'rejected' ? 'text-[#a04028]' : 'text-[#9a6e1a]'}`}>{claim.status}</span></div><p className="mt-1 text-[9px] font-black uppercase tracking-[0.05em] text-[#80642b]">{claim.verificationSource.replaceAll('_', ' ')} · {claim.verificationConfidence}</p>{claim.reviewNote ? <p className="mt-2 text-[#775d3a]">Reviewer: {claim.reviewNote}</p> : null}<div className="mt-2 flex flex-wrap gap-3 text-[10px] font-black">{claim.evidenceUploadId ? <a className="text-[#315b39] underline" href={`/api/bingo/team/${encodeURIComponent(token)}/evidence?uploadId=${encodeURIComponent(claim.evidenceUploadId)}`} target="_blank" rel="noreferrer">View screenshot ↗</a> : null}{claim.evidenceUrl ? <a className="text-[#315b39] underline" href={claim.evidenceUrl} target="_blank" rel="noreferrer">Open proof link ↗</a> : null}</div></article>)}{!ownClaims.length ? <p className="text-sm text-[#75664b]">No claims submitted yet.</p> : null}</div></section>
          </aside>
        </div>
      </section>
    </main>
  );
}

function LoadingScreen({ error }: { error: string }) { return <main className="realm-bg grid min-h-screen place-items-center px-5 text-[#eadcb9]"><section className="wood-panel max-w-lg p-8 text-center"><p className="fantasy-title text-3xl font-bold">Opening your team board…</p>{error ? <p className="mt-4 text-sm text-[#e8b69c]">{error}</p> : null}</section></main>; }
