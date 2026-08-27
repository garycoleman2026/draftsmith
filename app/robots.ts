import type { MetadataRoute } from 'next';

const origin = 'https://draftsmith-teams.companyscreeninginfo.chatgpt.site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/manage/', '/rank/', '/join/', '/participant/', '/dashboard', '/bingo/manage/', '/bingo/team/'],
    }],
    sitemap: `${origin}/sitemap.xml`,
  };
}
