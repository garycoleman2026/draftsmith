import type { Metadata } from 'next';
import Link from 'next/link';
import { StandaloneBingoCreator, type StandaloneBingoTemplateOption } from '../../components/StandaloneBingoCreator';
import { SiteFooter } from '../../components/SiteFooter';
import { SiteHeader } from '../../components/SiteHeader';
import { listGalleryTemplates } from '../../lib/bingo-gallery';

export const metadata: Metadata = {
  title: 'Custom OSRS bingo maker and live tracker — Terry’s Drafting',
  description: 'Choose a board, add your teams, and run a custom OSRS clan bingo with live scoring and claim review.',
  alternates: { canonical: '/bingo' },
};

const views = [
  ['Organizer room', 'Edit the board, share team links, and approve claims.'],
  ['Team board', 'See open tasks, send proof, and follow the score.'],
  ['Spectator board', 'Let the clan watch the event without showing private proof.'],
] as const;

export default async function BingoHallPage({ searchParams }: { searchParams: Promise<{ clanId?: string; visibility?: string }> }) {
  const query = await searchParams;
  const gallery = await listGalleryTemplates({ sort: 'popular' });
  const templates: StandaloneBingoTemplateOption[] = [...gallery]
    .sort((left, right) => {
      const leftPriority = left.official && left.configuration.key === 'points' ? 0 : left.official ? 1 : 2;
      const rightPriority = right.official && right.configuration.key === 'points' ? 0 : right.official ? 1 : 2;
      return leftPriority - rightPriority || left.name.localeCompare(right.name);
    })
    .map((template) => ({
      value: template.official ? `builtin:${template.configuration.key}` : `community:${template.id}`,
      name: template.name,
      summary: template.summary,
      meta: `${template.gridSize}×${template.gridSize} · ${template.mode.replaceAll('_', ' ')}`,
      configuration: template.configuration,
    }));

  return (
    <main className="realm-bg min-h-screen text-[#eadcb9]">
      <SiteHeader badge="Bingo hall" />
      <section className="mx-auto max-w-7xl px-5 pb-20 pt-12 sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c69b3c]">Clan bingo hall</p>
            <h1 className="fantasy-title mt-3 max-w-4xl text-4xl font-bold leading-none text-[#f5df9b] sm:text-6xl">Choose a board. Bring the teams. Begin.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#b5a888]">Start with teams you already have, or use a Terry draft. You will get an organizer room, private team boards, and a live spectator view.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="gold-button inline-flex justify-center px-5 py-3 text-sm" href="#create">Start a bingo ↓</Link>
            <Link className="scroll-button inline-flex justify-center px-5 py-3 text-sm" href="/bingo/studio">Design a board first →</Link>
          </div>
        </div>

        <StandaloneBingoCreator
          templates={templates}
          initialClanId={query.clanId ?? ''}
          initialVisibility={['private', 'public'].includes(query.visibility ?? '') ? query.visibility as 'private' | 'public' : 'unlisted'}
        />

        <section className="mt-10 grid gap-5 md:grid-cols-3">
          {views.map(([title, body]) => (
            <article className="parchment-card p-6 text-[#392d1b]" key={title}>
              <h2 className="fantasy-title text-2xl font-bold">{title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#66563d]">{body}</p>
            </article>
          ))}
        </section>

        <section className="wood-panel mt-8 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#d7ae50]">Need a board?</p>
            <h2 className="fantasy-title mt-2 text-2xl font-bold text-[#f2d98f]">Build your own or borrow one from the archives.</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="gold-button inline-flex justify-center px-5 py-3 text-sm" href="/bingo/studio">Open the studio</Link>
            <Link className="scroll-button inline-flex justify-center px-5 py-3 text-sm" href="/templates">Browse boards</Link>
          </div>
        </section>
      </section>
      <SiteFooter />
    </main>
  );
}
