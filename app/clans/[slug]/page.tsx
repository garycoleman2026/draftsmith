import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteFooter } from '../../../components/SiteFooter';
import { SiteHeader } from '../../../components/SiteHeader';
import { loadPublicClan } from '../../../lib/clan-gallery';
import { serializeStructuredData } from '../../../lib/structured-data';

const origin = 'https://draftsmith-teams.companyscreeninginfo.chatgpt.site';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadPublicClan(slug).catch(() => null);
  if (!data) return { title: 'Clan not found — Terry’s Drafting', robots: { index: false, follow: false } };
  const description = data.clan.description || `Public OSRS bingo events and templates from ${data.clan.name}.`;
  return { title: `${data.clan.name} OSRS bingo history — Terry’s Drafting`, description, alternates: { canonical: `/clans/${slug}` }, openGraph: { title: data.clan.name, description, url: `${origin}/clans/${slug}`, images: [] }, twitter: { title: data.clan.name, description, images: [] } };
}

export default async function PublicClanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await loadPublicClan(slug).catch(() => null);
  if (!data) notFound();
  const schema = { '@context': 'https://schema.org', '@type': 'Organization', name: data.clan.name, description: data.clan.description, url: `${origin}/clans/${slug}` };
  return <main className="realm-bg min-h-screen text-[#eadcb9]">
    <SiteHeader badge="Clan history" />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(schema) }} />
    <section className="mx-auto max-w-7xl px-5 pb-20 pt-10 sm:px-8">
      <Link className="text-xs font-black text-[#d7c48e] underline" href="/clans">← Public clan hall</Link>
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#c69b3c]">Public OSRS clan profile</p><h1 className="fantasy-title mt-3 text-5xl font-bold text-[#f5df9b] sm:text-7xl">{data.clan.name}</h1><p className="mt-5 max-w-3xl text-base leading-relaxed text-[#b9ab89]">{data.clan.description || 'This clan shares selected bingo events and reusable boards with the community.'}</p></div><dl className="wood-panel grid grid-cols-2 gap-3 p-5"><Metric label="Workspace members" value={data.clan.memberCount} /><Metric label="Listed bingos" value={data.clan.eventCount} /><Metric label="Completed" value={data.clan.completedCount} /><Metric label="Templates" value={data.clan.templateCount} /></dl></div>

      <section className="mt-10"><div className="flex items-end justify-between border-b border-[#9b792f]/35 pb-4"><div><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#c69b3c]">Selected public events</p><h2 className="fantasy-title mt-1 text-3xl font-bold text-[#f5df9b]">Bingo history</h2></div><span className="text-xs font-black text-[#a99a78]">{data.events.length}</span></div>{data.events.length ? <div className="mt-5 grid gap-4 md:grid-cols-2">{data.events.map((event) => <article className="parchment-card p-5 text-[#342817]" key={event.id}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase text-[#80642b]">{modeLabel(event.mode)} · {event.gridSize} × {event.gridSize}</p><h3 className="fantasy-title mt-1 text-2xl font-bold">{event.title}</h3></div><span className="seal-badge px-2.5 py-1 text-[9px] font-black uppercase">{event.status}</span></div><p className="mt-4 text-xs text-[#67583e]">{event.teamCount} teams · {event.taskCount} tasks · {event.completionCount} verified completions</p><div className="mt-4 flex items-center justify-between gap-3"><p className="text-[10px] text-[#756748]">{new Date(event.startedAt || event.createdAt).toLocaleDateString()}</p><Link className="gold-button px-4 py-2.5 text-xs" href={`/bingo/event/${event.slug}`}>{event.status === 'live' ? 'Watch live →' : 'View board →'}</Link></div></article>)}</div> : <p className="mt-5 rounded border border-dashed border-[#8b6a32]/45 bg-black/10 px-5 py-8 text-center text-sm text-[#a99a78]">No event has been separately listed yet.</p>}</section>

      <section className="mt-10"><div className="flex items-end justify-between border-b border-[#9b792f]/35 pb-4"><div><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#c69b3c]">Published by this clan</p><h2 className="fantasy-title mt-1 text-3xl font-bold text-[#f5df9b]">Reusable boards</h2></div><Link className="text-xs font-black text-[#e3cf96] underline" href="/templates">Browse every template</Link></div>{data.templates.length ? <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.templates.map((template) => <article className="parchment-card p-5 text-[#342817]" key={template.id}><p className="text-[10px] font-black uppercase text-[#80642b]">{template.category}</p><h3 className="fantasy-title mt-2 text-2xl font-bold">{template.name}</h3><p className="mt-2 text-xs leading-relaxed text-[#67583e]">{template.summary}</p><p className="mt-4 text-[10px] font-black uppercase text-[#756748]">{template.cloneCount} uses · {template.ratingAverage === null ? 'New' : `${template.ratingAverage.toFixed(1)}★ from ${template.ratingCount}`}</p><Link className="scroll-button mt-4 inline-flex px-4 py-2.5 text-xs" href={`/templates/${template.slug}`}>Preview board →</Link></article>)}</div> : <p className="mt-5 text-sm text-[#a99a78]">No community templates published yet.</p>}</section>
    </section>
    <SiteFooter />
  </main>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded border border-white/10 bg-black/15 p-3"><dt className="text-[9px] font-black uppercase tracking-[0.08em] text-[#b8a777]">{label}</dt><dd className="mt-1 text-xl font-black text-[#f2d98f]">{value}</dd></div>; }
function modeLabel(value: string) { return ({ classic: 'Classic lines', points: 'Points hunt', lockout: 'Shared lockout', blackout: 'Blackout race', progression: 'Progression', categories: 'Categories' } as Record<string, string>)[value] ?? 'Custom bingo'; }
