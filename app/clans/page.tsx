import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '../../components/SiteFooter';
import { SiteHeader } from '../../components/SiteHeader';
import { listPublicClans } from '../../lib/clan-gallery';

export const metadata: Metadata = {
  title: 'OSRS clan bingo hall — Terry’s Drafting',
  description: 'Discover OSRS clans that publicly share their bingo events, completed boards, and reusable community templates.',
  alternates: { canonical: '/clans' },
};

export default async function PublicClansPage() {
  const clans = await listPublicClans();
  return <main className="realm-bg min-h-screen text-[#eadcb9]">
    <SiteHeader badge="Public clan hall" />
    <section className="mx-auto max-w-7xl px-5 pb-20 pt-12 sm:px-8">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c69b3c]">Opt-in community history</p>
      <h1 className="fantasy-title mt-3 max-w-4xl text-5xl font-bold text-[#f5df9b] sm:text-7xl">See how clans run their bingos.</h1>
      <p className="mt-5 max-w-3xl text-base leading-relaxed text-[#b9ab89]">Only clans that explicitly enable a public profile appear here. Each organizer separately chooses which spectator boards belong in public history.</p>
      {clans.length ? <div className="mt-9 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{clans.map((clan) => <article className="parchment-card flex h-full flex-col p-5 text-[#342817]" key={clan.id}><p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#80642b]">OSRS clan workspace</p><h2 className="fantasy-title mt-2 text-3xl font-bold">{clan.name}</h2><p className="mt-3 flex-1 text-sm leading-relaxed text-[#67583e]">{clan.description || 'This clan shares selected bingo events and boards with the community.'}</p><dl className="mt-5 grid grid-cols-3 gap-2 border-y border-[#8b6a32]/20 py-3 text-center"><Metric label="Members" value={clan.memberCount} /><Metric label="Events" value={clan.eventCount} /><Metric label="Templates" value={clan.templateCount} /></dl><div className="mt-4 flex items-center justify-between gap-3"><p className="text-[10px] text-[#756748]">{clan.completedCount} completed{clan.latestEventAt ? ` · active ${new Date(clan.latestEventAt).toLocaleDateString()}` : ''}</p><Link className="gold-button px-4 py-2.5 text-xs" href={`/clans/${clan.slug}`}>Enter hall →</Link></div></article>)}</div> : <section className="parchment-panel mt-9 p-10 text-center text-[#4e402b]"><h2 className="fantasy-title text-3xl font-bold">The public hall is ready for its first clan.</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed">Clan owners can opt in from the organizer dashboard. Private workspaces and unlisted event links never appear here.</p><Link className="gold-button mt-6 inline-flex px-5 py-3 text-sm" href="/dashboard">Open organizer dashboard →</Link></section>}
    </section>
    <SiteFooter />
  </main>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div><dt className="text-[8px] font-black uppercase text-[#7d6a47]">{label}</dt><dd className="mt-1 text-xs font-black">{value}</dd></div>; }
