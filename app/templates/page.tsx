import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '../../components/SiteFooter';
import { SiteHeader } from '../../components/SiteHeader';
import {
  TEMPLATE_CATEGORIES, listGalleryTemplates, sanitizeGalleryDifficulty, sanitizeGallerySort, type GalleryTemplate,
} from '../../lib/bingo-gallery';
import { BINGO_TASK_DIFFICULTIES } from '../../lib/bingo-types';

export const metadata: Metadata = {
  title: 'Community OSRS bingo templates — Terry’s Drafting',
  description: 'Search, vote on, and reuse OSRS clan bingo boards for points, lockout, progression, blackout, categories, and classic lines.',
  alternates: { canonical: '/templates' },
};

export default async function TemplateGalleryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = first(params.q);
  const category = first(params.category) || 'All';
  const mode = first(params.mode) || 'all';
  const difficulty = sanitizeGalleryDifficulty(first(params.difficulty));
  const sort = sanitizeGallerySort(first(params.sort));
  const templates = await listGalleryTemplates({ query, category, mode, difficulty, sort });
  const communityCount = templates.filter((template) => !template.official).length;
  const schema = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: 'Community OSRS bingo templates',
    description: 'Reusable OSRS clan bingo board templates.',
    url: 'https://draftsmith-teams.companyscreeninginfo.chatgpt.site/templates',
  };
  return (
    <main className="realm-bg min-h-screen text-[#eadcb9]">
      <SiteHeader badge="Template gallery" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <section className="mx-auto max-w-7xl px-5 pb-20 pt-12 sm:px-8">
        <div className="max-w-4xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c69b3c]">The board archives</p>
          <h1 className="fantasy-title mt-3 text-5xl font-bold text-[#f5df9b] sm:text-7xl">Find a board. Make it yours.</h1>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-[#b9ab89]">Borrow a board from Terry or another organizer. Change any task before you begin.</p>
          <Link className="gold-button mt-5 inline-flex px-5 py-3 text-sm" href="/bingo/studio">Create a board →</Link>
        </div>

        <form className="wood-panel mt-8 grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3 2xl:grid-cols-[minmax(0,1fr)_170px_170px_150px_160px_auto]" method="get">
          <label className="text-[10px] font-black uppercase tracking-[0.08em] text-[#c4b48c]">Search
            <input className="dark-field mt-1 h-11 w-full px-3 text-sm normal-case" defaultValue={query} name="q" placeholder="Raid, skilling, lockout…" />
          </label>
          <label className="text-[10px] font-black uppercase tracking-[0.08em] text-[#c4b48c]">Category
            <select className="dark-field mt-1 h-11 w-full px-3 text-sm normal-case" defaultValue={category} name="category">
              <option>All</option>{TEMPLATE_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-black uppercase tracking-[0.08em] text-[#c4b48c]">Game style
            <select className="dark-field mt-1 h-11 w-full px-3 text-sm normal-case" defaultValue={mode} name="mode">
              <option value="all">All styles</option><option value="points">Points</option><option value="classic">Classic lines</option><option value="lockout">Lockout</option><option value="blackout">Blackout</option><option value="progression">Progression</option><option value="categories">Categories</option>
            </select>
          </label>
          <label className="text-[10px] font-black uppercase tracking-[0.08em] text-[#c4b48c]">Difficulty
            <select className="dark-field mt-1 h-11 w-full px-3 text-sm normal-case" defaultValue={difficulty} name="difficulty">
              <option value="all">All tiers</option>{BINGO_TASK_DIFFICULTIES.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-black uppercase tracking-[0.08em] text-[#c4b48c]">Sort
            <select className="dark-field mt-1 h-11 w-full px-3 text-sm normal-case" defaultValue={sort} name="sort">
              <option value="popular">Most used</option><option value="votes">Most votes</option><option value="newest">Newest</option><option value="name">Name</option><option value="difficulty">Difficulty</option><option value="type">Game style</option>
            </select>
          </label>
          <button className="gold-button self-end px-5 py-3 text-sm" type="submit">Search</button>
        </form>

        <div className="mt-7 flex flex-wrap items-end justify-between gap-3 border-b border-[#9b792f]/35 pb-4">
          <div><h2 className="fantasy-title text-3xl font-bold text-[#f5df9b]">{templates.length} matching board{templates.length === 1 ? '' : 's'}</h2><p className="mt-1 text-xs text-[#a99a78]">{communityCount} shared by the community in this view</p></div>
          {(query || category !== 'All' || mode !== 'all' || difficulty !== 'all' || sort !== 'popular') ? <Link className="text-xs font-black text-[#e3cf96] underline" href="/templates">Clear filters</Link> : null}
        </div>
        {templates.length ? <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{templates.map((template) => <TemplateCard key={template.slug} template={template} />)}</div> : <div className="parchment-panel mt-6 p-10 text-center text-[#5d4b30]"><h2 className="fantasy-title text-3xl font-bold">No board matches those filters.</h2><p className="mt-3 text-sm">Try a broader search or publish the first board for this niche from an organizer room.</p></div>}
      </section>
      <SiteFooter />
    </main>
  );
}

function TemplateCard({ template }: { template: GalleryTemplate }) {
  return <article className="parchment-card flex h-full flex-col p-5 text-[#342817]">
    <div className="flex items-start justify-between gap-3"><span className="seal-badge px-2.5 py-1 text-[9px] font-black uppercase">{template.official ? 'Official starter' : template.category}</span><span className="text-[10px] font-black uppercase text-[#7d6a47]">{modeLabel(template.mode)}</span></div>
    <h2 className="fantasy-title mt-4 text-2xl font-bold">{template.name}</h2>
    <p className="mt-2 flex-1 text-sm leading-relaxed text-[#67583e]">{template.summary}</p>
    <div className="mt-4 flex flex-wrap gap-1.5">{template.tags.map((tag) => <span className="rounded bg-[#7c642f]/10 px-2 py-1 text-[9px] font-black uppercase text-[#765d2c]" key={tag}>{tag}</span>)}</div>
    <dl className="mt-5 grid grid-cols-2 gap-2 border-y border-[#8b6a32]/20 py-3 text-center sm:grid-cols-4"><div><dt className="text-[8px] font-black uppercase text-[#7d6a47]">Layout</dt><dd className="mt-1 text-xs font-black">{template.gridSize} × {template.gridSize}</dd></div><div><dt className="text-[8px] font-black uppercase text-[#7d6a47]">Difficulty</dt><dd className="mt-1 text-xs font-black capitalize">{template.difficulty}</dd></div><div><dt className="text-[8px] font-black uppercase text-[#7d6a47]">Uses</dt><dd className="mt-1 text-xs font-black">{template.official ? 'Starter' : template.cloneCount}</dd></div><div><dt className="text-[8px] font-black uppercase text-[#7d6a47]">Votes</dt><dd className="mt-1 text-xs font-black">{template.official ? '—' : `↑ ${template.upvoteCount} · ↓ ${template.downvoteCount}`}</dd></div></dl>
    <div className="mt-4 flex items-center justify-between gap-3"><p className="min-w-0 truncate text-[10px] text-[#756748]">By {template.creatorName}</p><Link className="gold-button shrink-0 px-4 py-2.5 text-xs" href={`/templates/${template.slug}`}>Preview →</Link></div>
  </article>;
}

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? '' : value ?? ''; }
function modeLabel(value: string) { return ({ classic: 'Classic lines', points: 'Points', lockout: 'Lockout', blackout: 'Blackout', progression: 'Progression', categories: 'Categories' } as Record<string, string>)[value] ?? 'Custom'; }
