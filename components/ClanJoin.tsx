'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SiteHeader } from './SiteHeader';

type Invitation = { clan: { id: string; name: string }; role: string; expiresAt: string };

export function ClanJoin({ token }: { token: string }) {
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void fetch(`/api/clans/join/${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json() as Invitation & { error?: string };
        if (!response.ok) throw new Error(result.error || 'This invitation could not be opened.');
        if (active) setInvitation(result);
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'This invitation could not be opened.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  async function joinClan() {
    setWorking(true); setError('');
    try {
      const response = await fetch(`/api/clans/join/${encodeURIComponent(token)}`, { method: 'POST' });
      const result = await response.json() as { joined?: boolean; error?: string };
      if (response.status === 401) { setNeedsSignIn(true); return; }
      if (!response.ok || !result.joined) throw new Error(result.error || 'The clan could not be joined.');
      setJoined(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The clan could not be joined.');
    } finally {
      setWorking(false);
    }
  }

  const returnTo = `/clans/join/${token}`;
  return (
    <main className="realm-bg min-h-screen text-[#eadcb9]">
      <SiteHeader badge="Clan invitation" />
      <section className="mx-auto max-w-2xl px-5 py-20 text-center sm:px-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c69b3c]">Private invitation</p>
        <h1 className="fantasy-title mt-4 text-5xl font-bold text-[#f5df9b]">
          {loading ? 'Opening the invitation…' : invitation ? `Join ${invitation.clan.name}` : 'Invitation unavailable'}
        </h1>
        {invitation ? <p className="mx-auto mt-5 max-w-xl leading-relaxed text-[#b5a888]">Join this clan workspace as a {invitation.role}. This gives you clan access; it does not place you on a draft or bingo team.</p> : null}
        {error ? <p role="alert" className="mt-6 rounded border border-[#a94c30] bg-[#321a12] px-4 py-3 text-sm font-bold text-[#f2c7ae]">{error}</p> : null}
        {joined ? <div className="mt-8"><p className="font-bold text-[#d9e7aa]">You joined the clan.</p><Link className="gold-button mt-5 inline-flex px-6 py-3 text-sm" href="/dashboard">Open my account →</Link></div> : invitation && !needsSignIn ? <button className="gold-button mt-8 px-6 py-3.5 text-sm" disabled={working} onClick={() => void joinClan()}>{working ? 'Joining…' : `Join ${invitation.clan.name}`}</button> : null}
        {needsSignIn ? <a className="gold-button mt-8 inline-flex px-6 py-3.5 text-sm" href={`/api/auth/discord/start?returnTo=${encodeURIComponent(returnTo)}`}>Sign in with Discord to join →</a> : null}
        {!loading && !invitation ? <Link className="iron-button mt-8 inline-flex px-5 py-3 text-sm" href="/dashboard">Return to my account</Link> : null}
      </section>
    </main>
  );
}
