import type { MetadataRoute } from 'next';

const origin = 'https://draftsmith-teams.companyscreeninginfo.chatgpt.site';
const routes = [
  '', '/bingo', '/presets', '/runelite', '/guides', '/guides/osrs-clan-bingo', '/guides/custom-bingo-maker',
  '/guides/runelite-tracking', '/about', '/faq', '/privacy', '/terms', '/contact',
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route, index) => ({
    url: `${origin}${route}`,
    lastModified: new Date('2026-08-27T00:00:00.000Z'),
    changeFrequency: index < 3 ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : route === '/bingo' ? 0.9 : route.startsWith('/guides') ? 0.8 : 0.6,
  }));
}
