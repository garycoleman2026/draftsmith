'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SiteHeader } from './SiteHeader';

type DashboardData = {
  user: { id: string; displayName: string | null; username: string };
  clans: { id: string; name: string; slug: string; description: string; public_listing: number; role: string }[];
  events: {
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
    player_count: number;
  }[];
  templates: { id: string; clan_id: string; name: string; configuration_json: string; updated_at: string }[];
};

export function OrganizerDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [authConfigured, setAuthConfigured] = useState(true);
  const [error, setError] = useState('');
  const [clanName, setClanName] = useState('');
  const [working, setWorking] = useState('');
  const [selectedClanId, setSelectedClanId] = useState('');
  const [members, setMembers] = useState<{ id: string; username: string; display_name: string | null; role: string }[]>([]);
  const [discordId, setDiscordId] = useState('');
  const [memberRole, setMemberRole] = useState('member');
  const [clanDescription, setClanDescription] = useState('');
  const [clanPublicListing, setClanPublicListing] = useState(false);

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
      if (!response.ok) throw new Error(next.error || 'The organizer dashboard could not be loaded.');
      setData(next);
      setNeedsSignIn(false);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The organizer dashboard could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!selectedClanId) return;
    void fetch(`/api/clans/${encodeURIComponent(selectedClanId)}/members`).then(async (response) => {
      const next = await response.json() as { members?: typeof members };
      if (response.ok) setMembers(next.members ?? []);
    });
  }, [selectedClanId]);

  useEffect(() => {
    if (selectedClanId || !data?.clans[0]) return;
    const firstClan = data.clans[0];
    const timer = window.setTimeout(() => {
      setSelectedClanId(firstClan.id);
      setClanDescription(firstClan.description ?? '');
      setClanPublicListing(Boolean(firstClan.public_listing));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [data?.clans, selectedClanId]);

  const eventGroups = useMemo(() => {
    const events = data?.events ?? [];
    return {
      active: events.filter((event) => !event.archived_at && !['registration', 'complete'].includes(event.status)),
      scheduled: events.filter((event) => !event.archived_at && event.status === 'registration'),
      completed: events.filter((event) => !event.archived_at && event.status === 'complete'),
      archived: events.filter((event) => Boolean(event.archived_at)),
    };
  }, [data?.events]);
  const selectedClan = useMemo(() => data?.clans.find((clan) => clan.id === selectedClanId) ?? null, [data?.clans, selectedClanId]);

  async function createClan() {
    if (!clanName.trim()) return;
    setWorking('clan');
    setError('');
    try {
      const response = await fetch('/api/clans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: clanName }),
      });
      const next = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(next.error || 'The clan could not be created.');
      setClanName('');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The clan could not be created.');
    } finally {
      setWorking('');
    }
  }

  async function openEvent(id: string) {
    setWorking(id);
    setError('');
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(id)}/manage-link`, { method: 'POST' });
      const next = (await response.json()) as { path?: string; error?: string };
      if (!response.ok || !next.path) throw new Error(next.error || 'The event could not be opened.');
      window.location.assign(next.path);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The event could not be opened.');
      setWorking('');
    }
  }

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.assign('/');
  }

  async function addMember() {
    if (!selectedClanId || !discordId) return;
    setWorking('member');
    try {
      const response = await fetch(`/api/clans/${encodeURIComponent(selectedClanId)}/members`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ discordId, role: memberRole }),
      });
      const next = await response.json() as { error?: string };
      if (!response.ok) throw new Error(next.error || 'Member could not be added.');
      setDiscordId('');
      const refreshed = await fetch(`/api/clans/${encodeURIComponent(selectedClanId)}/members`).then((result) => result.json()) as { members: typeof members };
      setMembers(refreshed.members ?? []);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Member could not be added.'); }
    finally { setWorking(''); }
  }

  async function saveClanProfile() {
    if (!selectedClanId) return;
    setWorking('clan-profile'); setError('');
    try {
      const response = await fetch(`/api/clans/${encodeURIComponent(selectedClanId)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: clanDescription, publicListing: clanPublicListing }),
      });
      const next = await response.json() as { error?: string };
      if (!response.ok) throw new Error(next.error || 'The clan profile could not be saved.');
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The clan profile could not be saved.'); }
    finally { setWorking(''); }
  }

  async function instantiateTemplate(id: string, name: string) {
    setWorking(`template-${id}`);
    try {
      const response = await fetch(`/api/templates/${encodeURIComponent(id)}/instantiate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `${name} event` }),
      });
      const next = await response.json() as { adminPath?: string; error?: string };
      if (!response.ok || !next.adminPath) throw new Error(next.error || 'Event could not be created.');
      window.location.assign(next.adminPath);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Event could not be created.'); setWorking(''); }
  }

  if (loading) {
    return (
      <main className="realm-bg min-h-screen text-[#eadcb9]">
        <SiteHeader badge="Organizer dashboard" />
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
          <div className="h-12 w-72 animate-pulse rounded bg-[#d6ad4e]/15" />
          <div className="mt-8 h-72 animate-pulse rounded border border-[#8b6a32]/40 bg-white/5" />
        </div>
      </main>
    );
  }

  if (needsSignIn) {
    return (
      <main className="realm-bg min-h-screen text-[#eadcb9]">
        <SiteHeader badge="Organizer dashboard" />
        <section className="mx-auto max-w-2xl px-5 py-20 text-center sm:px-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c69b3c]">Clan workspace</p>
          <h1 className="fantasy-title mt-4 text-5xl font-bold text-[#f5df9b]">Keep every event in one hall.</h1>
          <p className="mx-auto mt-5 max-w-xl leading-relaxed text-[#b5a888]">
            Sign in to save clan rosters, reopen drafts, share administration, and reuse event templates. Anonymous drafts and private organizer links still work without an account.
          </p>
          {authConfigured ? (
            <a className="gold-button mt-8 inline-flex px-6 py-3.5 text-sm" href="/api/auth/discord/start?returnTo=/dashboard">
              Continue with Discord →
            </a>
          ) : (
            <div className="mt-8 rounded border border-[#9c7933] bg-[#241d13] p-5 text-sm text-[#d7c69b]">
              Discord sign-in is ready in the application but still needs its production client credentials. You can continue using organizer links in the meantime.
            </div>
          )}
        </section>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="realm-bg min-h-screen text-[#eadcb9]">
        <SiteHeader badge="Organizer dashboard" />
        <p className="mx-auto max-w-xl px-5 py-20 text-center text-[#d9c69a]">{error || 'The dashboard is unavailable.'}</p>
      </main>
    );
  }

  return (
    <main className="realm-bg min-h-screen text-[#eadcb9]">
      <SiteHeader badge="Organizer dashboard" />
      <section className="mx-auto max-w-7xl px-5 pb-20 pt-10 sm:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c69b3c]">Welcome back</p>
            <h1 className="fantasy-title mt-3 text-4xl font-bold text-[#f5df9b] sm:text-6xl">
              {data.user.displayName || data.user.username}&apos;s event hall.
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-[#c8bb99]">Create and reopen clan drafts, custom bingo boards, reusable templates, and event history from one place.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="gold-button px-5 py-3 text-sm" href="/bingo#create">Create bingo</Link>
            <Link className="scroll-button px-5 py-3 text-sm" href="/draft">Create draft</Link>
            <button className="iron-button px-4 py-3 text-xs" type="button" onClick={() => void signOut()}>Sign out</button>
          </div>
        </div>

        {error ? <p role="alert" className="mt-6 rounded border border-[#a94c30] bg-[#321a12] px-4 py-3 text-sm font-bold text-[#f2c7ae]">{error}</p> : null}

        <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-8">
            <EventSection title="Active events" events={eventGroups.active} working={working} onOpen={openEvent} />
            <EventSection title="Scheduled events" events={eventGroups.scheduled} working={working} onOpen={openEvent} />
            <EventSection title="Completed events" events={eventGroups.completed} working={working} onOpen={openEvent} />
            {eventGroups.archived.length ? <EventSection title="Archive" events={eventGroups.archived} working={working} onOpen={openEvent} /> : null}
            {data.templates.length ? <section><div className="mb-4 flex items-end justify-between border-b border-[#9b792f]/30 pb-3"><h2 className="fantasy-title text-2xl font-bold text-[#f5df9b]">Reusable templates</h2><span className="text-xs font-black text-[#a99a78]">{data.templates.length}</span></div><div className="grid gap-3 md:grid-cols-2">{data.templates.map((template) => <article className="parchment-card p-4" key={template.id}><p className="font-black">{template.name}</p><p className="mt-1 text-xs text-[#756748]">Updated {new Date(template.updated_at).toLocaleDateString()}</p><button className="scroll-button mt-4 w-full px-3 py-2 text-xs" disabled={working === `template-${template.id}`} onClick={() => void instantiateTemplate(template.id, template.name)}>{working === `template-${template.id}` ? 'Creating…' : 'Create event from template'}</button></article>)}</div></section> : null}
          </div>
          <aside className="wood-panel self-start p-6">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#d7ae50]">Clan workspaces</p>
            <div className="mt-4 space-y-2">
              {data.clans.map((clan) => (
                <button type="button" onClick={() => { setSelectedClanId(clan.id); setClanDescription(clan.description ?? ''); setClanPublicListing(Boolean(clan.public_listing)); }} className={`block w-full rounded border px-3 py-3 text-left ${selectedClanId === clan.id ? 'border-[#d7ae50] bg-[#4b3a1d]' : 'border-white/10 bg-black/20'}`} key={clan.id}>
                  <p className="font-black">{clan.name}</p>
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#b8aa87]">{clan.role}</p>
                </button>
              ))}
            </div>
            <label className="mt-6 grid gap-2 text-xs font-black">
              New clan workspace
              <input className="dark-field h-11 px-3 outline-none" value={clanName} maxLength={60} onChange={(event) => setClanName(event.target.value)} placeholder="Clan name" />
            </label>
            <button className="gold-button mt-3 w-full px-4 py-3 text-sm" type="button" disabled={working === 'clan' || clanName.trim().length < 2} onClick={() => void createClan()}>
              {working === 'clan' ? 'Creating…' : 'Create workspace'}
            </button>
            {selectedClan ? <section className="mt-6 border-t border-white/10 pt-5"><p className="text-xs font-black uppercase tracking-[0.12em] text-[#d7ae50]">Public clan page</p><textarea className="dark-field mt-3 min-h-24 w-full p-3 text-xs normal-case" disabled={!['owner', 'admin'].includes(selectedClan.role)} maxLength={500} value={clanDescription} onChange={(event) => setClanDescription(event.target.value)} placeholder="What does your clan enjoy and how do you run events?" /><label className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-[#d4c59f]"><input className="mt-0.5" type="checkbox" disabled={!['owner', 'admin'].includes(selectedClan.role)} checked={clanPublicListing} onChange={(event) => setClanPublicListing(event.target.checked)} /><span>List this clan in the public hall. Only bingo events separately marked “list publicly” appear in its history.</span></label>{['owner', 'admin'].includes(selectedClan.role) ? <button className="iron-button mt-3 w-full px-3 py-2.5 text-xs" disabled={working === 'clan-profile'} onClick={() => void saveClanProfile()}>{working === 'clan-profile' ? 'Saving…' : 'Save public profile'}</button> : null}{selectedClan.public_listing ? <Link className="mt-3 block text-center text-xs font-black text-[#d9e7aa] underline" href={`/clans/${selectedClan.slug}`} target="_blank">View public clan page ↗</Link> : null}</section> : null}
            {selectedClanId ? <details className="mt-6 border-t border-white/10 pt-5"><summary className="cursor-pointer text-xs font-black uppercase tracking-[0.12em] text-[#d7ae50]">Members & roles</summary><div className="mt-3 space-y-2">{members.map((member) => <div className="flex items-center justify-between rounded bg-black/20 px-3 py-2 text-xs" key={member.id}><span className="truncate font-bold">{member.display_name || member.username}</span><span className="uppercase text-[#b8aa87]">{member.role}</span></div>)}</div><input className="dark-field mt-3 h-10 w-full px-3 text-xs" value={discordId} onChange={(event) => setDiscordId(event.target.value)} placeholder="Discord numeric user ID" /><select className="dark-field mt-2 h-10 w-full px-3 text-xs" value={memberRole} onChange={(event) => setMemberRole(event.target.value)}><option value="member">Member</option><option value="captain">Captain</option><option value="admin">Admin</option></select><button className="iron-button mt-2 w-full px-3 py-2 text-xs" disabled={!discordId || working === 'member'} onClick={() => void addMember()}>Add or update member</button><p className="mt-2 text-[10px] leading-relaxed text-[#a99a78]">Members must sign in once before being added. Owners/admins can manage clan events; captains and members have read access to the workspace roster.</p></details> : null}
          </aside>
        </div>
      </section>
    </main>
  );
}

function EventSection({
  title,
  events,
  working,
  onOpen,
}: {
  title: string;
  events: DashboardData['events'];
  working: string;
  onOpen: (id: string) => Promise<void>;
}) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between border-b border-[#9b792f]/30 pb-3">
        <h2 className="fantasy-title text-2xl font-bold text-[#f5df9b]">{title}</h2>
        <span className="text-xs font-black text-[#a99a78]">{events.length}</span>
      </div>
      {events.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {events.map((event) => (
            <article className="parchment-card p-5" key={event.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-black">{event.title}</p>
                  <p className="mt-1 text-xs font-bold text-[#756748]">{event.clan_name || 'Personal event'}</p>
                </div>
                <span className="seal-badge px-2.5 py-1 text-[10px] font-black uppercase">{event.status}</span>
              </div>
              <p className="mt-4 text-sm text-[#665b45]">{event.player_count} players · {event.team_count} teams · {event.draft_type}</p>
              <button className="scroll-button mt-5 w-full px-4 py-2.5 text-xs" type="button" disabled={working === event.id} onClick={() => void onOpen(event.id)}>
                {working === event.id ? 'Opening…' : 'Manage event →'}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded border border-dashed border-[#8b6a32]/45 bg-black/10 px-5 py-8 text-center text-sm text-[#a99a78]">No events in this hall yet.</div>
      )}
    </section>
  );
}
