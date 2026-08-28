import type { Metadata } from 'next';
import { BingoBoardStudio, type BingoStudioStarter } from '../../../components/BingoBoardStudio';
import { SiteFooter } from '../../../components/SiteFooter';
import { SiteHeader } from '../../../components/SiteHeader';
import { builtinGalleryTemplates, loadGalleryTemplate } from '../../../lib/bingo-gallery';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'OSRS bingo board studio — Terry’s Drafting',
  description: 'Design, save, share, and publish custom OSRS bingo boards without starting a draft or live event.',
  alternates: { canonical: '/bingo/studio' },
};

export default async function BingoStudioPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const requested = first(params.template);
  const builtin = builtinGalleryTemplates();
  const requestedTemplate = requested ? await loadGalleryTemplate(requested).catch(() => null) : null;
  const initialGallery = requestedTemplate ?? builtin.find((item) => item.configuration.key === 'points') ?? builtin[0];
  const starters: BingoStudioStarter[] = builtin.map((item) => ({
    slug: item.slug, name: item.name, summary: item.summary, configuration: item.configuration,
  }));
  const initial: BingoStudioStarter = {
    slug: initialGallery.slug,
    name: initialGallery.name,
    summary: initialGallery.summary,
    configuration: initialGallery.configuration,
  };
  if (!starters.some((item) => item.slug === initial.slug)) starters.unshift(initial);
  return <main className="realm-bg min-h-screen text-[#eadcb9]"><SiteHeader badge="Board studio" /><BingoBoardStudio initial={initial} starters={starters} /><SiteFooter /></main>;
}

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? '' : value ?? ''; }
