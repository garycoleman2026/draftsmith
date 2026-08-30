import type { MetadataRoute } from 'next';
import { listGalleryTemplates } from '../lib/bingo-gallery';
import { listPublicClans } from '../lib/clan-gallery';
import { getDatabase } from '../lib/db';

const origin = 'https://draftsmith-teams.companyscreeninginfo.chatgpt.site';
const routes = [
  '', '/events/new', '/draft', '/bingo', '/bingo/studio', '/templates', '/clans', '/presets', '/runelite', '/guides', '/guides/osrs-clan-bingo', '/guides/custom-bingo-maker',
  '/guides/runelite-tracking', '/about', '/faq', '/privacy', '/terms', '/contact',
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base: MetadataRoute.Sitemap = routes.map((route, index) => ({
    url: `${origin}${route}`,
    lastModified: new Date('2026-08-27T00:00:00.000Z'),
    changeFrequency: index < 3 ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : route === '/bingo' ? 0.9 : route.startsWith('/guides') ? 0.8 : 0.6,
  }));
  const [templates, clans, events] = await Promise.all([
    listGalleryTemplates({ sort: 'newest' }),
    listPublicClans(),
    loadListedEvents(),
  ]);
  return [
    ...base,
    ...templates.map((template) => ({
      url: `${origin}/templates/${template.slug}`,
      lastModified: new Date(template.publishedAt ?? '2026-08-27T00:00:00.000Z'),
      changeFrequency: 'weekly' as const,
      priority: template.official ? 0.8 : 0.7,
    })),
    ...clans.map((clan) => ({
      url: `${origin}/clans/${clan.slug}`,
      lastModified: new Date(clan.latestEventAt ?? '2026-08-27T00:00:00.000Z'),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...events.map((event) => ({
      url: `${origin}/bingo/event/${event.public_slug}`,
      lastModified: new Date(event.updated_at),
      changeFrequency: event.status === 'live' ? 'hourly' as const : 'weekly' as const,
      priority: event.status === 'live' ? 0.9 : 0.7,
    })),
  ];
}

async function loadListedEvents() {
  try {
    const result = await getDatabase().prepare(
      `SELECT public_slug, status, updated_at FROM bingo_events
       WHERE public_listed = 1 AND public_spectator = 1 ORDER BY updated_at DESC LIMIT 500`,
    ).all<{ public_slug: string; status: string; updated_at: string }>();
    return result.results;
  } catch { return []; }
}
