'use client';

import { useCallback, useEffect, useState } from 'react';
import { absoluteUrl, copyText } from '../lib/client';

type Person = { userId: string; name: string; role: string; createdAt: string };
type Invite = { id: string; role: string; path?: string; expiresAt: string; useCount: number; maxUses: number };

export function BingoCollaboratorsPanel({ eventId, accessRole, onNotice, onError }: { eventId: string; accessRole: string; onNotice: (message: string) => void; onError: (message: string) => void }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [role, setRole] = useState<'organizer' | 'scorekeeper'>('scorekeeper');
  const [working, setWorking] = useState(false);
  const [signedIn, setSignedIn] = useState(true);
  const endpoint = `/api/bingo/events/${encodeURIComponent(eventId)}/collaborators`;

  const load = useCallback(async () => {
    const response = await fetch(endpoint, { cache: 'no-store' });
    if (response.status === 401) { setSignedIn(false); return; }
    const data = await response.json() as { collaborators?: Person[]; invites?: Invite[]; error?: string };
    if (!response.ok) throw new Error(data.error || 'Helpers could not be loaded.');
    setSignedIn(true); setPeople(data.collaborators ?? []); setInvites(data.invites ?? []);
  }, [endpoint]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load().catch(() => undefined), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function invite() {
    setWorking(true);
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
      const data = await response.json() as Invite & { error?: string };
      if (!response.ok || !data.path) throw new Error(data.error || 'The helper link could not be created.');
      await copyText(absoluteUrl(data.path));
      setInvites((current) => [{ ...data }, ...current]);
      onNotice(`${role === 'organizer' ? 'Organizer' : 'Scorekeeper'} invite copied. It works for 14 days.`);
    } catch (cause) { onError(cause instanceof Error ? cause.message : 'The helper link could not be created.'); }
    finally { setWorking(false); }
  }

  async function remove(input: { userId?: string; inviteId?: string }) {
    const response = await fetch(endpoint, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const data = await response.json() as { error?: string };
    if (!response.ok) { onError(data.error || 'That helper could not be removed.'); return; }
    onNotice('Helper access removed.'); await load();
  }

  if (accessRole === 'scorekeeper') return null;
  return <section className="wood-panel p-5">
    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#d7ae50]">Event helpers</p>
    <h3 className="fantasy-title mt-1 text-2xl font-bold text-[#f2d98f]">Share the workload.</h3>
    {!signedIn ? <div className="mt-4 rounded border border-white/10 bg-black/20 p-4 text-xs text-[#c8bb99]"><p>Sign in to invite helpers by account.</p><a className="scroll-button mt-3 inline-flex px-3 py-2 text-xs" href="/api/auth/discord/start?returnTo=/dashboard">Sign in →</a></div> : <>
      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2"><select className="realm-field h-10 px-3 text-xs" value={role} onChange={(event) => setRole(event.target.value as 'organizer' | 'scorekeeper')}><option value="scorekeeper">Scorekeeper · claims and progress</option>{accessRole === 'owner' ? <option value="organizer">Organizer · full event setup</option> : null}</select><button className="scroll-button px-3 py-2 text-xs" disabled={working} onClick={() => void invite()}>{working ? 'Creating…' : 'Copy invite'}</button></div>
      <div className="mt-4 space-y-2">{people.map((person) => <div className="flex items-center justify-between gap-2 rounded border border-white/10 bg-black/20 p-3" key={person.userId}><div><p className="text-sm font-bold text-[#eedca8]">{person.name}</p><p className="text-[10px] uppercase text-[#b8aa87]">{person.role}</p></div><button className="text-[10px] font-black text-[#e8b69c] underline" onClick={() => void remove({ userId: person.userId })}>Remove</button></div>)}</div>
      {invites.length ? <p className="mt-3 text-[10px] text-[#aa9d7e]">{invites.length} active invitation{invites.length === 1 ? '' : 's'}. Create a new link whenever you need to share one again.</p> : null}
    </>}
  </section>;
}
