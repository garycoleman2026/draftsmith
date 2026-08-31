'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { absoluteUrl, copyText } from '../lib/client';
import { dashboardEventKind, dashboardEventVisibility, extractClanInviteToken } from '../lib/dashboard';
import { SiteHeader } from './SiteHeader';

type Clan = {
  id: string;
  name: string;
  slug: string;
  description: string;
  public_listing: number;
  role: string;
};

type DashboardEvent = {
  id: string;
  title: string;
  draft_type: string;
  team_count: number;
  roster_mode: string;
  status: string;
  registration_open: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  clan_id: string | null;
  clan_name: string | null;
  public_slug: string | null;
  player_count: number;
  bingo_id: string | null;
  bingo_title: string | null;
  bingo_status: string | null;
  bingo_public_slug: string | null;
  bingo_public_spectator: number | null;
  bingo_public_listed: number | null;
  bingo_access_role: string | null;
};

type SavedBoard = {
  id: string;
  name: string;
  mode: string;
  board_scope: string;
  visibility: string;
  public_slug: string | null;
  summary: string;
  category: string;
  owner_user_id: string | null;
  clan_id: string | null;
  clan_name: string | null;
  updated_at: string;
};

type DraftTemplate = { id: string; clan_id: string; name: string; configuration_json: string; updated_at: string };
type Member = { id: string; username: string; display_name: string | null; role: string };

type DashboardData = {
  user: { id: string; displayName: string | null; username: string };
  clans: Clan[];
  events: DashboardEvent[];
  bingoEvents: DashboardEvent[];
  boards: SavedBoard[];
  draftTemplates: DraftTemplate[];
};

export function OrganizerDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [authConfigured, setAuthConfigured] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState('');
  const [clanName, setClanName] = useState('');
  const [joinValue, setJoinValue] = useState('');
  const [selectedClanId, setSelectedClanId] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [clanSettingsName, setClanSettingsName] = useState('');
  const [clanDescription, setClanDescription] = useState('');
  const [clanPublicListing, setClanPublicListing] = useState(false);
  const [inviteRole, setInviteRole] = useState('member');
  const [invitePath, setInvitePath] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/dashboard', { cache: 'no-store' });
      if (response.status === 401) {
        const session = await fetch('/api/auth/session', { cache: 'no-store' }).then((result) => result.json()) as { configured?: boolean };
        setAuthConfigured(Boolean(session.configured));
        setNeedsSignIn(true);
        return;
      }
      const next = (await response.json()) as DashboardData & { error?: string };
      if (!response.ok) throw new Error(next.error || 'Your account could not be loaded.');
      setData(next);
      setNeedsSignIn(false);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your account could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMembers = useCallback(async (clanId: string) => {
    if (!clanId) { setMembers([]); return; }
    const response = await fetch(`/api/clans/${encodeURIComponent(clanId)}/members`, { cache: 'no-store' });
    const next = await response.json() as { members?: Member[] };
    if (response.ok) setMembers(next.members ?? []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!data?.clans.length) { setSelectedClanId(''); return; }
      if (!data.clans.some((clan) => clan.id === selectedClanId)) setSelectedClanId(data.clans[0].id);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [data?.clans, selectedClanId]);

  useEffect(() => {
    const clan = data?.clans.find((item) => item.id === selectedClanId);
    if (!clan) return;
    const timer = window.setTimeout(() => {
      setClanSettingsName(clan.name);
      setClanDescription(clan.description ?? '');
      setClanPublicListing(Boolean(clan.public_listing));
      setInvitePath('');
      void loadMembers(clan.id);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [data?.clans, loadMembers, selectedClanId]);

  const draftEvents = useMemo(() => data?.events ?? [], [data?.events]);
  const bingoEvents = useMemo(() => data?.bingoEvents ?? [], [data?.bingoEvents]);
  const privateBoards = useMemo(() => (data?.boards ?? []).filter((board) => board.visibility !== 'public'), [data?.boards]);
  const publicBoards = useMemo(() => (data?.boards ?? []).filter((board) => board.visibility === 'public'), [data?.boards]);
  const selectedClan = useMemo(() => data?.clans.find((clan) => clan.id === selectedClanId) ?? null, [data?.clans, selectedClanId]);

  async function createClan() {
    if (clanName.trim().length < 2) return;
    setWorking('create-clan'); setError(''); setMessage('');
    try {
      const response = await fetch('/api/clans', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: clanName }),
      });
      const next = await response.json() as { clan?: Clan; error?: string };
      if (!response.ok || !next.clan) throw new Error(next.error || 'The clan could not be created.');
      setClanName('');
      setSelectedClanId(next.clan.id);
      setMessage(`${next.clan.name} was created as a private clan.`);
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The clan could not be created.'); }
    finally { setWorking(''); }
  }

  function openClanInvite() {
    const token = extractClanInviteToken(joinValue);
    if (!token) { setError('Paste a valid Terry’s Drafting clan invitation link or code.'); return; }
    window.location.assign(`/clans/join/${encodeURIComponent(token)}`);
  }

  async function openEvent(event: DashboardEvent, hash = '') {
    const key = event.bingo_id ?? event.id;
    setWorking(key); setError('');
    try {
      const response = await fetch(event.bingo_id
        ? `/api/bingo/events/${encodeURIComponent(event.bingo_id)}/manage-link`
        : `/api/events/${encodeURIComponent(event.id)}/manage-link`, { method: 'POST' });
      const next = await response.json() as { path?: string; error?: string };
      if (!response.ok || !next.path) throw new Error(next.error || 'The event could not be opened.');
      window.location.assign(`${next.path}${hash}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The event could not be opened.'); setWorking(''); }
  }

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.assign('/');
  }

  async function saveClanSettings() {
    if (!selectedClanId) return;
    setWorking('clan-settings'); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/clans/${encodeURIComponent(selectedClanId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: clanSettingsName, description: clanDescription, publicListing: clanPublicListing }),
      });
      const next = await response.json() as { error?: string };
      if (!response.ok) throw new Error(next.error || 'The clan settings could not be saved.');
      setMessage(clanPublicListing ? 'Clan settings saved. Its community page is public.' : 'Clan settings saved. The clan remains private.');
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The clan settings could not be saved.'); }
    finally { setWorking(''); }
  }

  async function createInvite() {
    if (!selectedClanId) return;
    setWorking('invite'); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/clans/${encodeURIComponent(selectedClanId)}/invites`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: inviteRole }),
      });
      const next = await response.json() as { path?: string; error?: string };
      if (!response.ok || !next.path) throw new Error(next.error || 'The invitation could not be created.');
      setInvitePath(next.path);
      try {
        await copyText(absoluteUrl(next.path));
        setMessage('Clan invitation copied. It expires in seven days.');
      } catch {
        setMessage('Clan invitation created. Copy the link shown below; it expires in seven days.');
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The invitation could not be created.'); }
    finally { setWorking(''); }
  }

  async function changeMemberRole(userId: string, role: string) {
    if (!selectedClanId) return;
    setWorking(`role-${userId}`); setError('');
    try {
      const response = await fetch(`/api/clans/${encodeURIComponent(selectedClanId)}/members`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, role }),
      });
      const next = await response.json() as { error?: string };
      if (!response.ok) throw new Error(next.error || 'The role could not be changed.');
      await loadMembers(selectedClanId);
      setMessage('Clan access updated.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The role could not be changed.'); }
    finally { setWorking(''); }
  }

  async function instantiateTemplate(id: string, name: string) {
    setWorking(`template-${id}`); setError('');
    try {
      const response = await fetch(`/api/templates/${encodeURIComponent(id)}/instantiate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `${name} event` }),
      });
      const next = await response.json() as { adminPath?: string; error?: string };
      if (!response.ok || !next.adminPath) throw new Error(next.error || 'The event could not be created.');
      window.location.assign(next.adminPath);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The event could not be created.'); setWorking(''); }
  }

  if (loading) return <DashboardLoading />;
  if (needsSignIn) return <DashboardSignIn configured={authConfigured} />;
  if (!data) return <DashboardUnavailable error={error} />;

  return (
    <main className="realm-bg min-h-screen text-[#eadcb9]">
      <SiteHeader badge="My account" />
      <section className="mx-auto max-w-7xl px-5 pb-24 pt-10 sm:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c69b3c]">My account</p>
            <h1 className="fantasy-title mt-3 text-4xl font-bold text-[#f5df9b] sm:text-6xl">Welcome, {data.user.displayName || data.user.username}.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#c8bb99]">Your personal account is private. Drafts, events, boards, and clans become public only when you choose a public setting for that item.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="gold-button px-5 py-3 text-sm" href="/events/new">New event</Link>
            <Link className="scroll-button px-5 py-3 text-sm" href="/bingo/studio">Design board</Link>
            <Link className="iron-button px-5 py-3 text-sm" href="/bingo#create">Start bingo</Link>
          </div>
        </div>

        {error ? <p role="alert" className="mt-6 rounded border border-[#a94c30] bg-[#321a12] px-4 py-3 text-sm font-bold text-[#f2c7ae]">{error}</p> : null}
        {message ? <p role="status" className="mt-6 rounded border border-[#6f873d] bg-[#1e2a15] px-4 py-3 text-sm font-bold text-[#d9e7aa]">{message}</p> : null}

        <section className="mt-9 grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-10">
            <div>
              <div className="border-b border-[#9b792f]/30 pb-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#c69b3c]">My work</p>
                <h2 className="fantasy-title mt-1 text-3xl font-bold text-[#f5df9b]">Events and designs</h2>
              </div>
              <EventSection title="Bingo events" empty="No bingo events yet." events={bingoEvents} working={working} onOpen={openEvent} />
              <EventSection title="Draft events" empty="No saved draft events yet." events={draftEvents} working={working} onOpen={openEvent} />
            </div>
            <BoardSection title="Saved boards" boards={privateBoards} userId={data.user.id} empty="No private, clan, or unlisted boards saved yet." />
            <BoardSection title="Published boards" boards={publicBoards} userId={data.user.id} empty="No boards published to the marketplace yet." />
            {data.draftTemplates.length ? <DraftTemplateSection templates={data.draftTemplates} working={working} onCreate={instantiateTemplate} /> : null}
          </div>

          <aside className="space-y-5">
            <section className="wood-panel p-6">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#d7ae50]">Account privacy</p>
              <p className="mt-4 font-black text-[#f5df9b]">Private by default</p>
              <p className="mt-2 text-xs leading-relaxed text-[#c8bb99]">Terry’s Drafting does not publish a personal profile page. Your Discord name identifies your private account and shared clan access.</p>
              <dl className="mt-5 grid grid-cols-2 gap-2 text-center">
                <Metric label="Drafts" value={draftEvents.length} />
                <Metric label="Bingos" value={bingoEvents.length} />
                <Metric label="Private boards" value={privateBoards.length} />
                <Metric label="Public boards" value={publicBoards.length} />
              </dl>
              <button className="iron-button mt-5 w-full px-4 py-2.5 text-xs" type="button" onClick={() => void signOut()}>Sign out</button>
            </section>
            <section className="rounded border border-[#8b6a32]/35 bg-black/15 p-5 text-xs leading-relaxed text-[#b9ab89]">
              <p className="font-black uppercase tracking-[0.12em] text-[#d7ae50]">Visibility key</p>
              <p className="mt-3"><b className="text-[#e8d8ad]">Private:</b> only you or invited clan staff can manage it.</p>
              <p className="mt-2"><b className="text-[#e8d8ad]">Unlisted link:</b> anyone with the link can view it, but it is not advertised.</p>
              <p className="mt-2"><b className="text-[#e8d8ad]">Publicly listed:</b> appears in community discovery.</p>
              <p className="mt-2">Published personal boards use “Community organizer” rather than creating a public personal profile. A clan name appears only when that clan enables its community page.</p>
            </section>
          </aside>
        </section>

        <section className="mt-16 border-t border-[#9b792f]/35 pt-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c69b3c]">My clans</p>
              <h2 className="fantasy-title mt-2 text-4xl font-bold text-[#f5df9b]">Clan workspaces are separate from your account.</h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#c8bb99]">Create a clan for shared administration or join one through an invitation. Clan access never places someone on an event roster.</p>
            </div>
          </div>

          <div className="mt-7 grid gap-5 lg:grid-cols-[330px_minmax(0,1fr)]">
            <aside className="wood-panel self-start p-6">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#d7ae50]">Your clans</p>
              {data.clans.length ? <div className="mt-4 space-y-2">{data.clans.map((clan) => <button type="button" onClick={() => setSelectedClanId(clan.id)} className={`block w-full rounded border px-3 py-3 text-left ${selectedClanId === clan.id ? 'border-[#d7ae50] bg-[#4b3a1d]' : 'border-white/10 bg-black/20'}`} key={clan.id}><div className="flex items-center justify-between gap-2"><p className="truncate font-black">{clan.name}</p><span className={`rounded px-2 py-1 text-[9px] font-black uppercase ${clan.public_listing ? 'bg-[#d7ae50]/20 text-[#f2d98f]' : 'bg-black/30 text-[#b8aa87]'}`}>{clan.public_listing ? 'Listed' : 'Private'}</span></div><p className="mt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#b8aa87]">{clan.role}</p></button>)}</div> : <p className="mt-4 rounded border border-dashed border-white/15 p-4 text-sm text-[#b8aa87]">You do not belong to a clan yet.</p>}

              <div className="mt-6 border-t border-white/10 pt-5">
                <label className="grid gap-2 text-xs font-black">Create a clan<input className="dark-field h-11 px-3 outline-none" value={clanName} maxLength={60} onChange={(event) => setClanName(event.target.value)} placeholder="Clan name" /></label>
                <button className="gold-button mt-3 w-full px-4 py-3 text-sm" type="button" disabled={working === 'create-clan' || clanName.trim().length < 2} onClick={() => void createClan()}>{working === 'create-clan' ? 'Creating…' : 'Create private clan'}</button>
              </div>

              <div className="mt-6 border-t border-white/10 pt-5">
                <label className="grid gap-2 text-xs font-black">Join a clan<input className="dark-field h-11 px-3 outline-none" value={joinValue} onChange={(event) => setJoinValue(event.target.value)} placeholder="Paste invite link or code" /></label>
                <button className="iron-button mt-3 w-full px-4 py-3 text-sm" type="button" disabled={!joinValue.trim()} onClick={openClanInvite}>Open invitation</button>
              </div>
            </aside>

            {selectedClan ? <section className="parchment-panel p-6 text-[#3b2d1b] sm:p-8">
              <div className="flex flex-col gap-3 border-b border-[#8b6a32]/25 pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#80642b]">Selected clan</p><h3 className="fantasy-title mt-1 text-3xl font-bold">{selectedClan.name}</h3><p className="mt-2 text-xs text-[#6c5b3c]">Your role: <b className="uppercase">{selectedClan.role}</b></p></div>
                <span className={`self-start rounded border px-3 py-1.5 text-[10px] font-black uppercase ${selectedClan.public_listing ? 'border-[#8a6924] bg-[#f1d68c] text-[#4c3918]' : 'border-[#8b6a32]/30 bg-[#e9ddbc] text-[#655536]'}`}>{selectedClan.public_listing ? 'Community page listed' : 'Private clan'}</span>
              </div>

              <div className="mt-7 grid gap-8 xl:grid-cols-2">
                <section>
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[#80642b]">Clan settings</p>
                  <p className="mt-2 text-xs leading-relaxed text-[#6d6048]">These settings belong to the clan—not your personal account.</p>
                  <label className="mt-5 grid gap-2 text-xs font-black">Clan name<input className="realm-field h-11 px-3" disabled={!['owner', 'admin'].includes(selectedClan.role)} maxLength={60} value={clanSettingsName} onChange={(event) => setClanSettingsName(event.target.value)} /></label>
                  <label className="mt-4 grid gap-2 text-xs font-black">Clan description<textarea className="realm-field min-h-28 p-3 text-xs normal-case" disabled={!['owner', 'admin'].includes(selectedClan.role)} maxLength={500} value={clanDescription} onChange={(event) => setClanDescription(event.target.value)} placeholder="What does this clan enjoy?" /></label>
                  <div className="mt-4 rounded border border-[#8b6a32]/25 bg-[#f4e7c3] p-4">
                    <p className="text-xs font-black">Community listing</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-[#6d6048]">Off keeps the clan out of the public hall. Your account is private either way. Events and boards use their own visibility controls.</p>
                    <label className="mt-3 flex items-start gap-2 text-xs font-bold"><input className="mt-0.5" type="checkbox" disabled={!['owner', 'admin'].includes(selectedClan.role)} checked={clanPublicListing} onChange={(event) => setClanPublicListing(event.target.checked)} /><span>List this clan in the public clan hall</span></label>
                  </div>
                  {['owner', 'admin'].includes(selectedClan.role) ? <button className="gold-button mt-4 w-full px-4 py-3 text-sm" disabled={working === 'clan-settings' || clanSettingsName.trim().length < 2} onClick={() => void saveClanSettings()}>{working === 'clan-settings' ? 'Saving…' : 'Save clan settings'}</button> : null}
                  {selectedClan.public_listing ? <Link className="mt-4 block text-center text-xs font-black text-[#315526] underline" href={`/clans/${selectedClan.slug}`} target="_blank">View public clan page ↗</Link> : null}
                </section>

                <section>
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[#80642b]">Clan access</p>
                  <p className="mt-2 text-xs leading-relaxed text-[#6d6048]">This controls who can help run the shared clan workspace. It is not the player list for drafts or bingo teams.</p>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-[10px] leading-relaxed text-[#67583e]"><RoleNote role="Owner" text="All clan settings" /><RoleNote role="Admin" text="Manage shared events" /><RoleNote role="Captain" text="Read shared clan tools" /><RoleNote role="Member" text="Basic clan access" /></div>
                  {['owner', 'admin'].includes(selectedClan.role) ? <div className="mt-5 rounded border border-[#8b6a32]/25 bg-[#f4e7c3] p-4"><p className="text-xs font-black">Invite by link</p><div className="mt-3 flex gap-2"><select className="realm-field h-10 flex-1 px-3 text-xs" value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}><option value="member">Member</option><option value="captain">Captain</option></select><button className="scroll-button px-3 py-2 text-xs" disabled={working === 'invite'} onClick={() => void createInvite()}>{working === 'invite' ? 'Making…' : 'Copy invite'}</button></div>{invitePath ? <p className="mt-2 break-all text-[10px] text-[#5f7140]">{absoluteUrl(invitePath)}</p> : <p className="mt-2 text-[10px] text-[#756748]">Links expire after seven days.</p>}</div> : null}
                  <div className="mt-5 space-y-2">{members.map((member) => {
                    const canEdit = ['owner', 'admin'].includes(selectedClan.role) && member.role !== 'owner' && member.id !== data.user.id;
                    const options = selectedClan.role === 'owner' ? ['admin', 'captain', 'member'] : ['captain', 'member'];
                    return <div className="flex items-center justify-between gap-3 rounded border border-[#8b6a32]/20 bg-[#f4e7c3] px-3 py-2.5 text-xs" key={member.id}><span className="min-w-0 truncate font-bold">{member.display_name || member.username}{member.id === data.user.id ? ' (you)' : ''}</span>{canEdit ? <select aria-label={`Role for ${member.display_name || member.username}`} className="realm-field h-8 px-2 text-[10px] uppercase" disabled={working === `role-${member.id}`} value={member.role} onChange={(event) => void changeMemberRole(member.id, event.target.value)}>{options.map((role) => <option key={role} value={role}>{role}</option>)}</select> : <span className="text-[10px] font-black uppercase text-[#756748]">{member.role}</span>}</div>;
                  })}</div>
                </section>
              </div>
            </section> : <section className="parchment-panel flex min-h-80 items-center justify-center p-8 text-center text-[#4e402b]"><div><h3 className="fantasy-title text-3xl font-bold">No clan selected.</h3><p className="mx-auto mt-3 max-w-md text-sm leading-relaxed">Create a private clan or open an invitation. Your account, events, and boards work without belonging to a clan.</p></div></section>}
          </div>
        </section>
      </section>
    </main>
  );
}

function EventSection({ title, events, empty, working, onOpen }: { title: string; events: DashboardEvent[]; empty: string; working: string; onOpen: (event: DashboardEvent, hash?: string) => Promise<void> }) {
  return <section className="mt-8"><div className="mb-4 flex items-end justify-between"><h3 className="fantasy-title text-2xl font-bold text-[#f5df9b]">{title}</h3><span className="text-xs font-black text-[#a99a78]">{events.length}</span></div>{events.length ? <div className="grid gap-4 md:grid-cols-2">{events.map((event) => {
    const visibility = dashboardEventVisibility(event);
    const publicPath = event.bingo_id && event.bingo_public_spectator && event.bingo_public_slug ? `/bingo/event/${event.bingo_public_slug}` : !event.bingo_id && event.public_slug ? `/event/${event.public_slug}` : null;
    const key = event.bingo_id ?? event.id;
    return <article className="parchment-card p-5" key={`${event.id}:${event.bingo_id ?? 'draft'}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#80642b]">{dashboardEventKind(event)}</p><p className="mt-1 truncate font-black">{event.bingo_title || event.title}</p><p className="mt-1 text-xs font-bold text-[#756748]">{event.clan_name || 'Personal'}{event.bingo_access_role && event.bingo_access_role !== 'owner' ? ` · ${event.bingo_access_role}` : ''}</p></div><VisibilityBadge value={visibility} /></div><p className="mt-4 text-sm text-[#665b45]">{event.player_count} players · {event.team_count} teams · {event.bingo_status || event.status}</p><div className="mt-5 flex flex-wrap gap-2"><button className="scroll-button flex-1 px-4 py-2.5 text-xs" type="button" disabled={working === key} onClick={() => void onOpen(event)}>{working === key ? 'Opening…' : 'Manage →'}</button>{event.bingo_id ? <button className="gold-button px-3 py-2.5 text-xs" type="button" disabled={working === key} onClick={() => void onOpen(event, '#review')}>Review hall</button> : null}{publicPath ? <Link className="iron-button px-3 py-2.5 text-xs" href={publicPath} target="_blank">View ↗</Link> : null}</div></article>;
  })}</div> : <div className="rounded border border-dashed border-[#8b6a32]/45 bg-black/10 px-5 py-8 text-center text-sm text-[#a99a78]">{empty}</div>}</section>;
}

function BoardSection({ title, boards, userId, empty }: { title: string; boards: SavedBoard[]; userId: string; empty: string }) {
  return <section><div className="mb-4 flex items-end justify-between border-b border-[#9b792f]/30 pb-3"><h2 className="fantasy-title text-2xl font-bold text-[#f5df9b]">{title}</h2><span className="text-xs font-black text-[#a99a78]">{boards.length}</span></div>{boards.length ? <div className="grid gap-4 md:grid-cols-2">{boards.map((board) => <article className="parchment-card p-5" key={board.id}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#80642b]">{board.category} · {board.mode}</p><h3 className="fantasy-title mt-1 text-2xl font-bold">{board.name}</h3></div><VisibilityBadge value={board.visibility === 'public' ? 'Publicly listed' : board.visibility === 'unlisted' ? 'Unlisted link' : board.visibility === 'clan' ? 'Clan only' : 'Private'} /></div><p className="mt-3 text-xs leading-relaxed text-[#67583e]">{board.summary || 'Reusable custom bingo board.'}</p><p className="mt-3 text-[10px] font-black uppercase text-[#756748]">{board.clan_name ? `${board.clan_name} board` : board.owner_user_id === userId ? 'Personal board' : 'Shared board'} · {board.board_scope}</p><div className="mt-4 flex gap-2"><Link className="scroll-button flex-1 px-3 py-2 text-center text-xs" href="/bingo/studio">Open studio</Link>{board.public_slug ? <Link className="iron-button px-3 py-2 text-xs" href={`/templates/${board.public_slug}`} target="_blank">View ↗</Link> : null}</div></article>)}</div> : <div className="rounded border border-dashed border-[#8b6a32]/45 bg-black/10 px-5 py-8 text-center text-sm text-[#a99a78]">{empty}</div>}</section>;
}

function DraftTemplateSection({ templates, working, onCreate }: { templates: DraftTemplate[]; working: string; onCreate: (id: string, name: string) => Promise<void> }) {
  return <section><div className="mb-4 flex items-end justify-between border-b border-[#9b792f]/30 pb-3"><div><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#c69b3c]">Draft setup</p><h2 className="fantasy-title mt-1 text-2xl font-bold text-[#f5df9b]">Reusable draft presets</h2></div><span className="text-xs font-black text-[#a99a78]">{templates.length}</span></div><div className="grid gap-3 md:grid-cols-2">{templates.map((template) => <article className="parchment-card p-4" key={template.id}><p className="font-black">{template.name}</p><p className="mt-1 text-xs text-[#756748]">Updated {new Date(template.updated_at).toLocaleDateString()}</p><button className="scroll-button mt-4 w-full px-3 py-2 text-xs" disabled={working === `template-${template.id}`} onClick={() => void onCreate(template.id, template.name)}>{working === `template-${template.id}` ? 'Creating…' : 'Create draft from preset'}</button></article>)}</div></section>;
}

function VisibilityBadge({ value }: { value: string }) {
  const style = value === 'Publicly listed' ? 'border-[#8a6924] bg-[#f1d68c] text-[#4c3918]' : value === 'Unlisted link' ? 'border-[#7e6b42] bg-[#e8dbb9] text-[#5f5032]' : 'border-[#8b6a32]/30 bg-[#eee3c4] text-[#655536]';
  return <span className={`shrink-0 rounded border px-2.5 py-1 text-[9px] font-black uppercase ${style}`}>{value}</span>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded border border-white/10 bg-black/20 px-2 py-3"><dt className="text-[9px] font-black uppercase tracking-[0.08em] text-[#a99a78]">{label}</dt><dd className="mt-1 text-xl font-black text-[#f2d98f]">{value}</dd></div>;
}

function RoleNote({ role, text }: { role: string; text: string }) {
  return <div className="rounded border border-[#8b6a32]/20 bg-[#f4e7c3] p-2"><b className="block uppercase text-[#4e402b]">{role}</b><span>{text}</span></div>;
}

function DashboardLoading() {
  return <main className="realm-bg min-h-screen text-[#eadcb9]"><SiteHeader badge="My account" /><div className="mx-auto max-w-7xl px-5 py-14 sm:px-8"><div className="h-12 w-72 animate-pulse rounded bg-[#d6ad4e]/15" /><div className="mt-8 h-72 animate-pulse rounded border border-[#8b6a32]/40 bg-white/5" /></div></main>;
}

function DashboardSignIn({ configured }: { configured: boolean }) {
  return <main className="realm-bg min-h-screen text-[#eadcb9]"><SiteHeader badge="My account" /><section className="mx-auto max-w-2xl px-5 py-20 text-center sm:px-8"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#c69b3c]">Private account</p><h1 className="fantasy-title mt-4 text-5xl font-bold text-[#f5df9b]">Keep your work in one place.</h1><p className="mx-auto mt-5 max-w-xl leading-relaxed text-[#b5a888]">Sign in to save personal boards, reopen drafts, manage bingos, and join clan workspaces. Nothing is published automatically.</p>{configured ? <a className="gold-button mt-8 inline-flex px-6 py-3.5 text-sm" href="/api/auth/discord/start?returnTo=/dashboard">Continue with Discord →</a> : <div className="mt-8 rounded border border-[#9c7933] bg-[#241d13] p-5 text-sm text-[#d7c69b]">Discord sign-in is not configured yet. Private organizer links still work.</div>}</section></main>;
}

function DashboardUnavailable({ error }: { error: string }) {
  return <main className="realm-bg min-h-screen text-[#eadcb9]"><SiteHeader badge="My account" /><p className="mx-auto max-w-xl px-5 py-20 text-center text-[#d9c69a]">{error || 'Your account is unavailable.'}</p></main>;
}
