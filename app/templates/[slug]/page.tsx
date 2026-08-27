import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteFooter } from '../../../components/SiteFooter';
import { SiteHeader } from '../../../components/SiteHeader';
import { TemplateActions } from '../../../components/TemplateActions';
import { loadGalleryTemplate } from '../../../lib/bingo-gallery';
import { serializeBingoTaskImport } from '../../../lib/bingo-types';
import { serializeStructuredData } from '../../../lib/structured-data';

const origin = 'https://draftsmith-teams.companyscreeninginfo.chatgpt.site';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const template = await loadGalleryTemplate(slug).catch(() => null);
  if (!template) return { title: 'Bingo template not found — Terry’s Drafting', robots: { index: false, follow: false } };
  return {
    title: `${template.name} OSRS bingo template — Terry’s Drafting`,
    description: template.summary,
    alternates: { canonical: `/templates/${template.slug}` },
    openGraph: { title: template.name, description: template.summary, url: `${origin}/templates/${template.slug}`, images: [] },
    twitter: { title: template.name, description: template.summary, images: [] },
  };
}

export default async function TemplateDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const template = await loadGalleryTemplate(slug).catch(() => null);
  if (!template) notFound();
  const configuration = template.configuration;
  const preferredValue = template.official ? `builtin:${configuration.key}` : `custom:${template.id}`;
  const schema = {
    '@context': 'https://schema.org', '@type': 'CreativeWork', name: template.name,
    description: template.summary, url: `${origin}/templates/${template.slug}`,
    author: { '@type': 'Organization', name: template.creatorName },
    interactionStatistic: template.official ? undefined : {
      '@type': 'InteractionCounter', interactionType: 'https://schema.org/UseAction', userInteractionCount: template.cloneCount,
    },
    aggregateRating: template.ratingAverage === null ? undefined : {
      '@type': 'AggregateRating', ratingValue: template.ratingAverage, ratingCount: template.ratingCount, bestRating: 5, worstRating: 1,
    },
  };
  return (
    <main className="realm-bg min-h-screen text-[#eadcb9]">
      <SiteHeader badge="Template preview" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(schema) }} />
      <section className="mx-auto max-w-[1500px] px-4 pb-20 pt-9 sm:px-8">
        <Link className="text-xs font-black text-[#d7c48e] underline" href="/templates">← Community templates</Link>
        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div>
            <div className="flex flex-wrap items-center gap-2"><span className="seal-badge px-3 py-1.5 text-[10px] font-black uppercase">{template.official ? 'Official starter' : template.category}</span><span className="rounded border border-[#8b6d2c] bg-[#2c2417] px-3 py-1.5 text-[10px] font-black uppercase text-[#ddc27b]">{modeLabel(template.mode)}</span></div>
            <h1 className="fantasy-title mt-4 text-5xl font-bold text-[#f5df9b] sm:text-7xl">{template.name}</h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-[#b9ab89]">{template.summary}</p>
            <p className="mt-3 text-xs text-[#9f9272]">Published by {template.creatorName}{template.publishedAt ? ` · ${new Date(template.publishedAt).toLocaleDateString()}` : ''}</p>
          </div>
          <aside className="parchment-panel p-5 text-[#342817]">
            <dl className="grid grid-cols-2 gap-3"><Metric label="Layout" value={`${template.gridSize} × ${template.gridSize}`} /><Metric label="Tasks" value={String(template.taskCount)} /><Metric label="Board type" value={template.boardScope === 'shared' ? 'Shared board' : 'Per team'} /><Metric label="Community uses" value={template.official ? 'Maintained starter' : String(template.cloneCount)} /></dl>
            <div className="mt-5"><TemplateActions slug={template.slug} preferredValue={preferredValue} importText={serializeBingoTaskImport(configuration.tasks)} official={template.official} initialRatingAverage={template.ratingAverage} initialRatingCount={template.ratingCount} /></div>
          </aside>
        </div>

        <section className="parchment-panel mt-7 p-4 text-[#342817] sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#8b6a32]/25 pb-4"><div><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#80642b]">Editable board preview</p><h2 className="fantasy-title mt-1 text-3xl font-bold">Every tile can be changed before launch.</h2></div><div className="flex flex-wrap gap-1.5">{template.tags.map((tag) => <span className="rounded bg-[#7c642f]/10 px-2 py-1 text-[9px] font-black uppercase text-[#765d2c]" key={tag}>{tag}</span>)}</div></div>
          <div className="mt-5 overflow-x-auto pb-2">
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${template.gridSize}, minmax(128px, 1fr))`, minWidth: Math.max(640, template.gridSize * 138) }}>
              {configuration.tasks.map((task, index) => <article className="min-h-36 rounded border border-[#9c7933] bg-[#efe0b6] p-3 shadow-[0_2px_0_#735629]" key={`${index}-${task.title}`}><p className="text-[9px] font-black uppercase tracking-[0.08em] text-[#7b643d]">#{index + 1} · {task.category}</p><h3 className="mt-2 text-sm font-black leading-tight">{task.title}</h3><p className="mt-2 line-clamp-3 text-[10px] leading-relaxed text-[#6d5b3e]">{task.description}</p><p className="mt-3 text-[9px] font-black uppercase text-[#80642b]">{task.points} pts · {task.rule.verifier.type.replaceAll('_', ' ')}</p></article>)}
            </div>
          </div>
        </section>
      </section>
      <SiteFooter />
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded border border-[#8b6a32]/25 bg-[#f6e7bc]/70 p-3"><dt className="text-[9px] font-black uppercase text-[#7d6a47]">{label}</dt><dd className="mt-1 text-sm font-black">{value}</dd></div>; }
function modeLabel(value: string) { return ({ classic: 'Classic lines', points: 'Points hunt', lockout: 'Shared lockout', blackout: 'Blackout race', progression: 'Progression path', categories: 'Category challenge' } as Record<string, string>)[value] ?? 'Custom bingo'; }
