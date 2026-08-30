'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type EventPath = 'draft-bingo' | 'bingo' | 'draft';

const paths: { id: EventPath; title: string; body: string }[] = [
  { id: 'draft-bingo', title: 'Draft, then bingo', body: 'Gather sign-ups, form fair teams, then open a bingo for them.' },
  { id: 'bingo', title: 'Bingo with ready teams', body: 'Paste teams you already have and go straight to the board.' },
  { id: 'draft', title: 'Draft only', body: 'Build teams now. You can add a bingo whenever you are ready.' },
];

export function EventSetupWizard() {
  const [kind, setKind] = useState<EventPath>('draft-bingo');
  const [clans, setClans] = useState<{ id: string; name: string; role: string }[]>([]);
  const [clanId, setClanId] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'unlisted' | 'public'>('unlisted');

  useEffect(() => {
    void fetch('/api/auth/session', { cache: 'no-store' })
      .then((response) => response.json() as Promise<{ clans?: { id: string; name: string; role: string }[] }>)
      .then((session) => setClans((session.clans ?? []).filter((clan) => ['owner', 'admin', 'captain'].includes(clan.role))))
      .catch(() => undefined);
  }, []);

  const nextHref = useMemo(() => {
    const query = new URLSearchParams();
    if (clanId) query.set('clanId', clanId);
    if (kind === 'draft-bingo') query.set('intent', 'bingo');
    if (kind === 'bingo') query.set('visibility', visibility);
    const target = kind === 'bingo' ? '/bingo' : '/draft';
    return `${target}?${query.toString()}${kind === 'bingo' ? '#create' : ''}`;
  }, [clanId, kind, visibility]);

  return <section className="mx-auto max-w-5xl px-5 pb-20 pt-10 sm:px-8">
    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c69b3c]">New event</p>
    <h1 className="fantasy-title mt-3 text-5xl font-bold text-[#f5df9b] sm:text-7xl">What are we gathering for?</h1>
    <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#b9ab89]">Choose a path. Terry will take you to the right hall and keep the event under your account or clan.</p>

    <div className="mt-8 grid gap-4 md:grid-cols-3">
      {paths.map((path) => <button className={`parchment-card p-6 text-left text-[#392d1b] transition ${kind === path.id ? 'ring-4 ring-[#c9a448]' : 'opacity-80 hover:opacity-100'}`} key={path.id} onClick={() => setKind(path.id)} type="button">
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#80642b]">{kind === path.id ? 'Chosen path' : 'Choose path'}</span>
        <span className="fantasy-title mt-2 block text-2xl font-bold">{path.title}</span>
        <span className="mt-3 block text-sm leading-relaxed text-[#66563d]">{path.body}</span>
      </button>)}
    </div>

    <section className="parchment-panel mt-6 p-6 text-[#392d1b] sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-[10px] font-black uppercase tracking-[0.1em] text-[#65583f]">Keep it under
          <select className="realm-field mt-2 h-12 w-full px-3 text-sm normal-case" value={clanId} onChange={(event) => setClanId(event.target.value)}>
            <option value="">My account</option>
            {clans.map((clan) => <option key={clan.id} value={clan.id}>{clan.name}</option>)}
          </select>
          <span className="mt-2 block text-xs font-normal normal-case text-[#68593f]">Clan halls are shared with your clan organizers. Personal events stay with you.</span>
        </label>
        {kind === 'bingo' ? <label className="text-[10px] font-black uppercase tracking-[0.1em] text-[#65583f]">Spectator board
          <select className="realm-field mt-2 h-12 w-full px-3 text-sm normal-case" value={visibility} onChange={(event) => setVisibility(event.target.value as 'private' | 'unlisted' | 'public')}>
            <option value="private">Private</option><option value="unlisted">Anyone with the link</option><option value="public">Publicly listed</option>
          </select>
          <span className="mt-2 block text-xs font-normal normal-case text-[#68593f]">You can change this later.</span>
        </label> : <div className="rounded border border-[#8b6a32]/30 bg-[#f4e2b4]/45 p-4"><p className="text-xs font-black uppercase text-[#6a511f]">Next up</p><p className="mt-2 text-sm text-[#5c4a30]">Choose how players join, the number of teams, and the kind of draft.</p></div>}
      </div>
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <Link className="gold-button px-6 py-3 text-sm" href={nextHref}>Continue →</Link>
        <Link className="scroll-button px-5 py-3 text-sm" href="/dashboard">Back to my account</Link>
      </div>
    </section>
  </section>;
}
