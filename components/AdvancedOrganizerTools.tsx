'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DraftResult } from '../lib/types';

type Data = {
  draft: {
    id: string; title: string; status: string; draftType: string; registrationCapacity: number;
    signupApprovalMode: boolean; registrationDeadline: string | null; rankingDeadline: string | null;
    answersVisibility: string; publicPath: string | null; clanId: string | null; archivedAt: string | null;
  };
  registrationOpen: boolean;
  players: { id: string; name: string; signup_status: string; withdrawn_at: string | null }[];
  captains: { id: string; name: string; rankingsFrozenAt: string | null }[];
  live: null | {
    started: boolean; paused: boolean; order: string; pickSeconds: number; autoPick: boolean;
    currentCaptain: { name: string } | null; actions: unknown[];
  };
  runs: { id: string; run_number: number; source: string; seed: string; created_at: string; fairness: Record<string, unknown> }[];
  audit: { event_type: string; actor_type: string; created_at: string; metadata: Record<string, unknown> }[];
  result: DraftResult | null;
};

type Session = {
  configured: boolean;
  user: { id: string; displayName: string | null; username: string } | null;
  clans: { id: string; name: string; role: string }[];
};

const DISCORD_EVENTS = [
  'registration.created', 'registration.closed', 'captain.rankings_submitted',
  'live.started', 'live.pick', 'live.auto', 'draft.generated', 'draft.complete',
  'bingo.started', 'bingo.claim_submitted', 'bingo.claim_approved', 'bingo.announcement', 'bingo.completed',
];

export function AdvancedOrganizerTools({
  token, data, onRefresh, onMessage,
}: {
  token: string; data: Data; onRefresh: () => Promise<void>; onMessage: (message: string, isError?: boolean) => void;
}) {
  const [working, setWorking] = useState('');
  const [capacity, setCapacity] = useState(data.draft.registrationCapacity);
  const [approval, setApproval] = useState(data.draft.signupApprovalMode);
  const [registrationDeadline, setRegistrationDeadline] = useState(toLocalInput(data.draft.registrationDeadline));
  const [rankingDeadline, setRankingDeadline] = useState(toLocalInput(data.draft.rankingDeadline));
  const [visibility, setVisibility] = useState(data.draft.answersVisibility);
  const [liveOrder, setLiveOrder] = useState(data.live?.order ?? 'snake');
  const [pickSeconds, setPickSeconds] = useState(data.live?.pickSeconds ?? 0);
  const [autoPick, setAutoPick] = useState(data.live?.autoPick ?? false);
  const [seed, setSeed] = useState('');
  const [swapA, setSwapA] = useState('');
  const [swapB, setSwapB] = useState('');
  const [swapPreview, setSwapPreview] = useState<DraftResult | null>(null);
  const [intelProgress, setIntelProgress] = useState('');
  const [discordUrl, setDiscordUrl] = useState('');
  const [discordEvents, setDiscordEvents] = useState(DISCORD_EVENTS);
  const [discordConfigured, setDiscordConfigured] = useState(false);
  const [discordDeliveries, setDiscordDeliveries] = useState<Array<Record<string, unknown>>>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [claimClanId, setClaimClanId] = useState(data.draft.clanId ?? '');
  const [templateName, setTemplateName] = useState(`${data.draft.title} template`);

  useEffect(() => {
    let active = true;
    void Promise.all([
      fetch('/api/auth/session').then((response) => response.json() as Promise<Session>),
      fetch(`/api/manage/${encodeURIComponent(token)}/discord`).then((response) => response.json() as Promise<{
        configured?: boolean; enabledEvents?: string[]; deliveries?: Array<Record<string, unknown>>;
      }>),
    ]).then(([nextSession, discord]) => {
      if (!active) return;
      setSession(nextSession);
      setDiscordConfigured(Boolean(discord.configured));
      if (discord.enabledEvents?.length) setDiscordEvents(discord.enabledEvents);
      setDiscordDeliveries(discord.deliveries ?? []);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [token]);

  const resultPlayers = useMemo(() => data.result?.teams.flatMap((team) => team.players) ?? [], [data.result]);
  const reviewPlayers = data.players.filter((player) => ['pending', 'waitlisted', 'rejected'].includes(player.signup_status) && !player.withdrawn_at);

  async function run(action: string, path: string, init: RequestInit, success: string) {
    setWorking(action);
    try {
      const response = await fetch(path, init);
      const next = await response.json() as Record<string, unknown> & { error?: string };
      if (!response.ok) throw new Error(next.error || 'That change could not be saved.');
      await onRefresh();
      onMessage(success);
      return next;
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'That change could not be saved.', true);
      return null;
    } finally { setWorking(''); }
  }

  async function saveRegistration() {
    await run('registration-settings', `/api/manage/${encodeURIComponent(token)}/registration`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        open: data.registrationOpen, capacity, approvalMode: approval,
        registrationDeadline: toIso(registrationDeadline), rankingDeadline: toIso(rankingDeadline),
        answersVisibility: visibility,
      }),
    }, 'Registration and ranking settings saved.');
  }

  async function setPlayerStatus(playerId: string, status: string) {
    await run(`player-${playerId}`, `/api/manage/${encodeURIComponent(token)}/players`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerId, status }),
    }, `Registration marked ${status}.`);
  }

  async function lifecycle(status: string) {
    await run(`lifecycle-${status}`, `/api/manage/${encodeURIComponent(token)}/lifecycle`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    }, `Event moved to ${status}.`);
  }

  async function freezeRankings(frozen: boolean) {
    await run('freeze', `/api/manage/${encodeURIComponent(token)}/captains`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ frozen }),
    }, frozen ? 'Captain rankings frozen.' : 'Captain rankings reopened.');
  }

  async function liveControl(action: string, extra: Record<string, unknown> = {}) {
    await run(`live-${action}`, `/api/manage/${encodeURIComponent(token)}/live`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }),
    }, `Live control “${action}” applied.`);
  }

  async function runSeededDraft() {
    await run('seed', `/api/manage/${encodeURIComponent(token)}/run`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seed }),
    }, 'A new immutable draft run was generated.');
  }

  async function previewSwap(save: boolean) {
    setWorking(save ? 'save-swap' : 'preview-swap');
    try {
      const response = await fetch(`/api/manage/${encodeURIComponent(token)}/swaps`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerAId: swapA, playerBId: swapB, save }),
      });
      const next = await response.json() as { result?: DraftResult; error?: string };
      if (!response.ok || !next.result) throw new Error(next.error || 'The swap could not be previewed.');
      setSwapPreview(next.result);
      if (save) await onRefresh();
      onMessage(save ? 'Manual swap saved as a new run.' : 'Swap is legal. Review the fairness preview, then save it.');
    } catch (error) { onMessage(error instanceof Error ? error.message : 'The swap failed.', true); }
    finally { setWorking(''); }
  }

  async function restoreRun(runId: string) {
    await run(`restore-${runId}`, `/api/manage/${encodeURIComponent(token)}/runs/${encodeURIComponent(runId)}`, { method: 'PUT' }, 'Earlier draft run restored.');
  }

  async function prefetchIntel() {
    setWorking('intel');
    let offset = 0;
    try {
      for (;;) {
        const response = await fetch(`/api/manage/${encodeURIComponent(token)}/insights`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offset, limit: 20 }),
        });
        const next = await response.json() as { error?: string; nextOffset: number; total: number; complete: boolean; outcomes: { ok: boolean }[] };
        if (!response.ok) throw new Error(next.error || 'OSRS data refresh failed.');
        offset = next.nextOffset;
        setIntelProgress(`${Math.min(offset, next.total)} / ${next.total} cached`);
        if (next.complete) break;
      }
      onMessage('OSRS and Wise Old Man data is cached for the full active roster.');
    } catch (error) { onMessage(error instanceof Error ? error.message : 'OSRS data refresh failed.', true); }
    finally { setWorking(''); }
  }

  async function saveDiscord() {
    const next = await run('discord', `/api/manage/${encodeURIComponent(token)}/discord`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ webhookUrl: discordUrl, enabledEvents: discordEvents }),
    }, 'Discord webhook encrypted and enabled.');
    if (next) { setDiscordConfigured(true); setDiscordUrl(''); }
  }

  async function claimEvent() {
    const next = await run('claim', `/api/manage/${encodeURIComponent(token)}/claim`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clanId: claimClanId }),
    }, 'Event claimed to your clan workspace.');
    if (next) await onRefresh();
  }

  async function saveTemplate() {
    await run('template', '/api/templates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clanId: data.draft.clanId ?? claimClanId, name: templateName, draftId: data.draft.id }),
    }, 'Reusable clan event template saved.');
  }

  async function duplicateEvent() {
    const next = await run('duplicate', `/api/events/${encodeURIComponent(data.draft.id)}/duplicate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `${data.draft.title} copy` }),
    }, 'A clean signup copy was created without participant data.');
    const path = typeof next?.adminPath === 'string' ? next.adminPath : null;
    if (path) window.open(path, '_blank', 'noopener,noreferrer');
  }

  return <div className="mt-5 space-y-5">
    <details className="parchment-panel p-5 sm:p-7" open={reviewPlayers.length > 0}>
      <summary className="cursor-pointer list-none"><span className="fantasy-title text-2xl font-bold">Registration review & lifecycle</span> <span className="ml-2 text-xs text-[#6e7d77]">{reviewPlayers.length} awaiting action</span></summary>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          {reviewPlayers.map((player) => <article className="parchment-card flex flex-wrap items-center gap-2 p-3" key={player.id}>
            <div className="min-w-40 flex-1"><p className="font-black">{player.name}</p><p className="text-xs font-bold uppercase text-[#796847]">{player.signup_status}</p></div>
            <button className="iron-button px-3 py-2 text-xs" disabled={working === `player-${player.id}`} onClick={() => void setPlayerStatus(player.id, 'approved')}>Approve</button>
            <button className="scroll-button px-3 py-2 text-xs" disabled={working === `player-${player.id}`} onClick={() => void setPlayerStatus(player.id, 'waitlisted')}>Waitlist</button>
            <button className="scroll-button px-3 py-2 text-xs" disabled={working === `player-${player.id}`} onClick={() => void setPlayerStatus(player.id, 'rejected')}>Reject</button>
          </article>)}
          {!reviewPlayers.length ? <p className="rounded border border-dashed border-[#8b6a32]/35 p-4 text-sm text-[#6d6048]">No pending or waitlisted registrations.</p> : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-black uppercase text-[#65583f]">Capacity<input className="realm-field mt-1 h-10 w-full px-3" type="number" min={2} max={120} value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} /></label>
          <label className="text-xs font-black uppercase text-[#65583f]">Answer visibility<select className="realm-field mt-1 h-10 w-full px-3" value={visibility} onChange={(event) => setVisibility(event.target.value)}><option value="organizer">Organizer only</option><option value="captains">Captains</option><option value="public">Public</option></select></label>
          <label className="text-xs font-black uppercase text-[#65583f]">Signup deadline<input className="realm-field mt-1 h-10 w-full px-3 text-xs" type="datetime-local" value={registrationDeadline} onChange={(event) => setRegistrationDeadline(event.target.value)} /></label>
          <label className="text-xs font-black uppercase text-[#65583f]">Ranking deadline<input className="realm-field mt-1 h-10 w-full px-3 text-xs" type="datetime-local" value={rankingDeadline} onChange={(event) => setRankingDeadline(event.target.value)} /></label>
          <label className="col-span-full flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={approval} onChange={(event) => setApproval(event.target.checked)} /> Require organizer approval</label>
          <button className="gold-button col-span-full px-4 py-2.5 text-xs" disabled={working === 'registration-settings'} onClick={() => void saveRegistration()}>Save registration settings</button>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2 border-t border-[#8b6a32]/20 pt-4">
        <button className="iron-button px-3 py-2 text-xs" onClick={() => void freezeRankings(true)}>Freeze rankings</button>
        <button className="iron-button px-3 py-2 text-xs" onClick={() => void freezeRankings(false)}>Reopen rankings</button>
        <button className="scroll-button px-3 py-2 text-xs" onClick={() => void lifecycle('rankings')}>Move to rankings</button>
        <button className="scroll-button px-3 py-2 text-xs" onClick={() => void lifecycle('registration')}>Reopen lifecycle</button>
        <button className="scroll-button px-3 py-2 text-xs" onClick={() => void lifecycle('archived')}>{data.draft.archivedAt ? 'Archived' : 'Archive event'}</button>
      </div>
    </details>

    {data.live ? <details className="parchment-panel p-5 sm:p-7" open={data.live.started}>
      <summary className="cursor-pointer list-none"><span className="fantasy-title text-2xl font-bold">Live draft control room</span> <span className="ml-2 text-xs text-[#6e7d77]">{data.live.paused ? 'paused' : data.live.currentCaptain?.name ?? 'setup'}</span></summary>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-black uppercase">Pick order<select disabled={data.live.started} className="realm-field mt-1 h-10 w-full px-3" value={liveOrder} onChange={(event) => setLiveOrder(event.target.value)}><option value="snake">Snake</option><option value="linear">Linear</option><option value="random">Randomized snake</option><option value="third_round_reversal">Third-round reversal</option></select></label>
        <label className="text-xs font-black uppercase">Seconds per pick<input className="realm-field mt-1 h-10 w-full px-3" type="number" min={0} max={3600} value={pickSeconds} onChange={(event) => setPickSeconds(Number(event.target.value))} /></label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-bold"><input type="checkbox" checked={autoPick} onChange={(event) => setAutoPick(event.target.checked)} /> Auto-pick from private scores</label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="gold-button px-3 py-2 text-xs" onClick={() => void liveControl('configure', { order: liveOrder, pickSeconds, autoPick })}>Save live settings</button>
        {data.live.started ? <><button className="iron-button px-3 py-2 text-xs" onClick={() => void liveControl(data.live?.paused ? 'resume' : 'pause')}>{data.live.paused ? 'Resume' : 'Pause'}</button><button className="iron-button px-3 py-2 text-xs" onClick={() => void liveControl('pass')}>Pass turn</button><button className="iron-button px-3 py-2 text-xs" onClick={() => void liveControl('skip')}>Skip captain</button><button className="scroll-button px-3 py-2 text-xs" onClick={() => void liveControl('undo')}>Undo last turn</button><button className="scroll-button px-3 py-2 text-xs" onClick={() => void liveControl('tick', { force: true })}>Auto-pick now</button></> : null}
      </div>
    </details> : null}

    <details className="parchment-panel p-5 sm:p-7">
      <summary className="cursor-pointer list-none"><span className="fantasy-title text-2xl font-bold">Balance lab & run history</span> <span className="ml-2 text-xs text-[#6e7d77]">{data.runs.length} saved runs</span></summary>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <label className="text-xs font-black uppercase">Optional deterministic seed<input className="realm-field mt-1 h-10 w-full px-3" value={seed} onChange={(event) => setSeed(event.target.value)} placeholder="clan-bingo-week-12" /></label>
          {data.draft.draftType !== 'live' ? <button className="gold-button mt-3 px-4 py-2.5 text-xs" disabled={working === 'seed'} onClick={() => void runSeededDraft()}>Generate new seeded run</button> : null}
          {data.result ? <div className="mt-5 grid gap-2 sm:grid-cols-2"><select className="realm-field h-10 px-3 text-sm" value={swapA} onChange={(event) => setSwapA(event.target.value)}><option value="">First player</option>{resultPlayers.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select><select className="realm-field h-10 px-3 text-sm" value={swapB} onChange={(event) => setSwapB(event.target.value)}><option value="">Second player</option>{resultPlayers.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select><button className="iron-button px-3 py-2 text-xs" disabled={!swapA || !swapB || working === 'preview-swap'} onClick={() => void previewSwap(false)}>Preview legal swap</button><button className="gold-button px-3 py-2 text-xs" disabled={!swapPreview || working === 'save-swap'} onClick={() => void previewSwap(true)}>Save swap as run</button></div> : null}
        </div>
        <div className="space-y-2">{data.runs.map((item) => <article className="parchment-card flex items-center gap-3 p-3" key={item.id}><div className="min-w-0 flex-1"><p className="font-black">Run {item.run_number} · {item.source.replace('_', ' ')}</p><p className="truncate text-xs text-[#716447]">Seed: {item.seed} · {new Date(item.created_at).toLocaleString()}</p></div><button className="scroll-button px-3 py-2 text-xs" onClick={() => void restoreRun(item.id)}>Restore</button></article>)}{!data.runs.length ? <p className="text-sm text-[#6d6048]">No immutable runs yet.</p> : null}</div>
      </div>
    </details>

    <details className="parchment-panel p-5 sm:p-7">
      <summary className="cursor-pointer list-none"><span className="fantasy-title text-2xl font-bold">OSRS intelligence, Discord & exports</span></summary>
      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <section className="parchment-card p-4"><h3 className="font-black">Cached player intelligence</h3><p className="mt-2 text-xs text-[#6d6048]">Fetch Official Hiscores and Wise Old Man in rate-safe batches. Draft scoring reuses this cache.</p><button className="iron-button mt-4 px-3 py-2 text-xs" disabled={working === 'intel'} onClick={() => void prefetchIntel()}>{working === 'intel' ? intelProgress || 'Refreshing…' : intelProgress || 'Cache full roster'}</button></section>
        <section className="parchment-card p-4"><h3 className="font-black">Discord event delivery</h3><p className="mt-2 text-xs text-[#6d6048]">Webhook URLs are encrypted. Failures are logged and never cancel a signup, pick, or draft run.</p><input className="realm-field mt-3 h-10 w-full px-3 text-xs" type="password" value={discordUrl} onChange={(event) => setDiscordUrl(event.target.value)} placeholder={discordConfigured ? 'Configured · paste to replace' : 'Discord webhook URL'} /><div className="mt-3 max-h-28 space-y-1 overflow-auto">{DISCORD_EVENTS.map((event) => <label className="flex items-center gap-2 text-[11px]" key={event}><input type="checkbox" checked={discordEvents.includes(event)} onChange={(change) => setDiscordEvents((current) => change.target.checked ? [...new Set([...current, event])] : current.filter((item) => item !== event))} />{event}</label>)}</div><div className="mt-3 flex gap-2"><button className="gold-button px-3 py-2 text-xs" disabled={!discordUrl || working === 'discord'} onClick={() => void saveDiscord()}>Save</button><button className="scroll-button px-3 py-2 text-xs" onClick={() => void run('discord-retry', `/api/manage/${encodeURIComponent(token)}/discord`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'retry' }) }, 'Pending Discord deliveries retried.')}>Retry</button></div><p className="mt-2 text-[11px] text-[#6d6048]">{discordDeliveries.length} recent deliveries tracked</p></section>
        <section className="parchment-card p-4"><h3 className="font-black">Portable results</h3><div className="mt-3 grid grid-cols-2 gap-2"><a className="scroll-button px-3 py-2 text-center text-xs" href={`/api/manage/${encodeURIComponent(token)}/export?format=csv`}>CSV</a><a className="scroll-button px-3 py-2 text-center text-xs" href={`/api/manage/${encodeURIComponent(token)}/export?format=json`}>JSON</a><a className="scroll-button px-3 py-2 text-center text-xs" href={`/api/manage/${encodeURIComponent(token)}/export?format=discord`}>Discord text</a><a className="scroll-button px-3 py-2 text-center text-xs" href={`/api/manage/${encodeURIComponent(token)}/export?format=image`}>Team image</a></div>{data.draft.publicPath ? <a className="iron-button mt-3 block px-3 py-2 text-center text-xs" href={data.draft.publicPath} target="_blank" rel="noreferrer">Open public event page ↗</a> : null}</section>
      </div>
    </details>

    <details className="parchment-panel p-5 sm:p-7">
      <summary className="cursor-pointer list-none"><span className="fantasy-title text-2xl font-bold">Clan workspace & audit trail</span></summary>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section>{session?.user ? <><p className="text-sm font-bold">Signed in as {session.user.displayName || session.user.username}</p>{!data.draft.clanId ? <div className="mt-3 flex gap-2"><select className="realm-field h-10 min-w-0 flex-1 px-3" value={claimClanId} onChange={(event) => setClaimClanId(event.target.value)}><option value="">Choose clan</option>{session.clans.filter((clan) => ['owner', 'admin'].includes(clan.role)).map((clan) => <option value={clan.id} key={clan.id}>{clan.name}</option>)}</select><button className="gold-button px-3 py-2 text-xs" disabled={!claimClanId} onClick={() => void claimEvent()}>Claim event</button></div> : <div className="mt-3 space-y-2"><input className="realm-field h-10 w-full px-3" value={templateName} onChange={(event) => setTemplateName(event.target.value)} /><div className="flex gap-2"><button className="iron-button px-3 py-2 text-xs" onClick={() => void saveTemplate()}>Save template</button><button className="iron-button px-3 py-2 text-xs" onClick={() => void duplicateEvent()}>Duplicate clean event</button></div></div>}</> : <p className="text-sm text-[#6d6048]">Sign in with Discord from the header to claim this anonymous event, share clan administration, save templates, and duplicate it.</p>}</section>
        <section className="max-h-64 space-y-2 overflow-auto">{data.audit.map((event, index) => <article className="rounded border border-[#8b6a32]/25 bg-[#f6e5b6]/60 p-2.5 text-xs" key={`${event.created_at}-${index}`}><b>{event.event_type}</b> · {event.actor_type}<br /><span className="text-[#716447]">{new Date(event.created_at).toLocaleString()}</span></article>)}</section>
      </div>
    </details>
  </div>;
}

function toLocalInput(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
function toIso(value: string) { return value ? new Date(value).toISOString() : null; }
