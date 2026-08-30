'use client';

import { useEffect, useState } from 'react';

export function BingoCollaboratorJoin({ token }: { token: string }) {
  const [invite, setInvite] = useState<{ title: string; role: string } | null>(null);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    void fetch(`/api/bingo/collaborate/${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (response) => { const data = await response.json() as { title?: string; role?: string; error?: string }; if (!response.ok) throw new Error(data.error); setInvite({ title: data.title!, role: data.role! }); })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'This invitation could not be opened.'));
  }, [token]);

  async function accept() {
    setWorking(true); setError('');
    const response = await fetch(`/api/bingo/collaborate/${encodeURIComponent(token)}`, { method: 'POST' });
    const data = await response.json() as { eventId?: string; error?: string };
    if (response.status === 401) { window.location.href = `/api/auth/discord/start?returnTo=${encodeURIComponent(`/bingo/collaborate/${token}`)}`; return; }
    if (!response.ok || !data.eventId) { setError(data.error || 'The invitation could not be accepted.'); setWorking(false); return; }
    const manage = await fetch(`/api/bingo/events/${encodeURIComponent(data.eventId)}/manage-link`, { method: 'POST' });
    const result = await manage.json() as { path?: string; error?: string };
    if (!manage.ok || !result.path) { setError(result.error || 'The organizer room could not be opened.'); setWorking(false); return; }
    window.location.href = result.path;
  }

  return <main className="realm-bg grid min-h-screen place-items-center px-5 text-[#eadcb9]"><section className="parchment-panel max-w-xl p-8 text-center text-[#392d1b]">
    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#80642b]">Bingo helper invitation</p>
    <h1 className="fantasy-title mt-3 text-4xl font-bold">{invite?.title ?? 'Opening the invitation…'}</h1>
    {invite ? <><p className="mt-4 text-sm leading-relaxed text-[#66563d]">Join as <b>{invite.role}</b>. Organizers can set up the event; scorekeepers can review claims and update progress.</p><button className="gold-button mt-6 px-6 py-3 text-sm" disabled={working} onClick={() => void accept()}>{working ? 'Joining…' : 'Join this event →'}</button></> : null}
    {error ? <p className="mt-5 rounded border border-[#a75e44]/45 bg-[#efd1bd] p-3 text-sm font-bold text-[#723b2b]">{error}</p> : null}
  </section></main>;
}
