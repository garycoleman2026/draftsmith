import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '../../components/SiteFooter';
import { SiteHeader } from '../../components/SiteHeader';

export const metadata: Metadata = {
  title: 'RuneLite integration and privacy — Terry’s Drafting',
  description: 'How Terry’s Drafting pairs RuneLite, which bingo observations are transmitted, and how to disconnect a device.',
  alternates: { canonical: '/runelite' },
};

const sent = [
  ['XP & levels', 'Skill name, XP gained or level reached, and observation time.'],
  ['Loot & log slots', 'Item name/ID, quantity, pet or collection-log event, and observation time.'],
  ['Bosses & raids', 'Boss/raid name, one kill or completion, anonymous party size when needed, and completion seconds.'],
  ['Achievements & clues', 'The completed task or clue tier and observation time.'],
] as const;

export default function RuneliteGuidePage() {
  return (
    <main className="realm-bg min-h-screen text-[#eadcb9]">
      <SiteHeader badge="RuneLite integration" />
      <section className="mx-auto max-w-5xl px-5 pb-24 pt-10 sm:px-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c69b3c]">Transparent by design</p>
        <h1 className="fantasy-title mt-3 max-w-4xl text-4xl font-bold leading-none text-[#f5df9b] sm:text-6xl">Pair once. Share only the bingo signal.</h1>
        <p className="mt-5 max-w-3xl text-sm leading-relaxed text-[#b5a888]">The Terry’s Drafting plugin connects one logged-in character to one clan event. It sends small, task-relevant observations to the event’s review queue. RuneLite observations are useful evidence, but they are client reports—not cryptographic proof.</p>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <section className="parchment-panel p-6 text-[#433520]">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#80642b]">Pairing</p>
            <h2 className="fantasy-title mt-2 text-3xl font-bold">A ten-minute, one-use code.</h2>
            <ol className="mt-5 space-y-3 text-sm leading-relaxed">
              <li><b>1.</b> Open your event’s private team board and issue a code beside your character.</li>
              <li><b>2.</b> Log into that exact character in RuneLite and open the Terry’s Drafting plugin.</li>
              <li><b>3.</b> Review the enabled data categories, accept the disclosure, and enter the code.</li>
              <li><b>4.</b> The code expires after ten minutes and cannot be used again. The resulting device credential can be revoked by you, your team, or the organizer.</li>
            </ol>
          </section>
          <section className="wood-panel p-6">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#d7ae50]">Never collected</p>
            <h2 className="fantasy-title mt-2 text-3xl font-bold text-[#f2d98f]">No passwords. No raw chat archive.</h2>
            <ul className="mt-5 space-y-3 text-sm leading-relaxed text-[#c8b990]">
              <li>• No Jagex or RuneLite account password, session, launcher token, or bank PIN.</li>
              <li>• No raw public, private, clan, friends-chat, or game-message text.</li>
              <li>• No teammate or party-member names; shared encounters send only an anonymous party size.</li>
              <li>• No full bank, inventory, equipment, friends list, or always-on location history.</li>
              <li>• No event data when the organizer disables its category or the bingo is not live.</li>
            </ul>
          </section>
        </div>

        <section className="parchment-panel mt-5 p-6 text-[#433520] sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#80642b]">What can be sent</p>
          <h2 className="fantasy-title mt-2 text-3xl font-bold">The organizer chooses the allowed categories.</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">{sent.map(([title, detail]) => <article className="parchment-card p-4" key={title}><h3 className="font-black">{title}</h3><p className="mt-2 text-xs leading-relaxed text-[#6e5e43]">{detail}</p></article>)}</div>
          <p className="mt-5 text-xs leading-relaxed text-[#6e5e43]">Every accepted observation receives a device-scoped idempotency key, so reconnects and retries do not add the same progress twice. Normalized observations remain with the event’s evidence history; device secrets are stored only as one-way hashes.</p>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
          <div className="wood-panel p-6"><p className="text-xs font-black uppercase tracking-[0.14em] text-[#d7ae50]">Controls</p><h2 className="fantasy-title mt-2 text-3xl font-bold text-[#f2d98f]">Disconnect at any time.</h2><p className="mt-4 text-sm leading-relaxed text-[#c8b990]">A team can disconnect its paired devices from the private board. The organizer can disconnect any event device or disable the integration, which revokes every active credential. The plugin can also revoke its own credential.</p></div>
          <div className="parchment-panel p-6 text-[#433520]"><p className="text-xs font-black uppercase tracking-[0.14em] text-[#80642b]">Status</p><h2 className="fantasy-title mt-2 text-3xl font-bold">Open-source beta.</h2><p className="mt-4 text-sm leading-relaxed text-[#6e5e43]">The service and standalone plugin source are public. Clone the beta and run it in RuneLite developer mode for the first in-game test; Plugin Hub submission follows a confirmed gameplay pass.</p><a className="mt-4 inline-block text-xs font-black text-[#315d45] underline" href="https://github.com/garycoleman2026/terrys-drafting-runelite" target="_blank" rel="noreferrer">Open the plugin repository ↗</a></div>
        </section>

        <div className="mt-8 flex flex-wrap gap-3"><Link className="gold-button px-5 py-3 text-sm" href="/bingo">Explore the bingo hall →</Link><Link className="scroll-button px-5 py-3 text-sm" href="/">Back to Terry’s Drafting</Link></div>
        <p className="mt-8 text-[10px] leading-relaxed text-[#8f8267]">Terry’s Drafting is an independent community tool and is not affiliated with or endorsed by RuneLite, Jagex, or Wise Old Man.</p>
      </section>
      <SiteFooter />
    </main>
  );
}
